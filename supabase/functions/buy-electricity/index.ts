import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ────────────────────────────────────────────────────────────────
   NEPAWatch — buy-electricity edge function (Flutterwave + VTPass)

   Actions:
     verify   (provider + number + type)  → VTPass meter lookup
     initiate (provider + number + ...)   → Flutterwave payment link
     verify   (transaction_id + tx_ref)   → Verify FLW payment + deliver token
   ──────────────────────────────────────────────────────────────── */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── VTPass service IDs ─────────────────────────────────────────
const VTPASS_IDS: Record<string, string> = {
  "ikeja-electric":  "ikeja-electric",
  "eko-electric":    "eko-electric",
  "abuja-electric":  "abuja-electric",
  "ibadan-electric": "ibadan-electric",
  "enugu-electric":  "enugu-electric",
  "phed":            "phed",
  "kaduna-electric": "kaduna-electric",
  "kano-electric":   "kano-electric",
  "benin-electric":  "benin-electric",
  "jos-electric":    "jos-electric",
  "yola-electric":   "yola-electric",
};

// ── VTPass helpers ─────────────────────────────────────────────
function vtBase(): string {
  return Deno.env.get("VTPASS_SANDBOX") === "true"
    ? "https://sandbox.vtpass.com/api"
    : "https://vtpass.com/api";
}

function vtHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "api-key":      Deno.env.get("VTPASS_API_KEY")    ?? "",
    "secret-key":   Deno.env.get("VTPASS_SECRET_KEY") ?? "",
  };
}

function vtVerifyHeaders(): HeadersInit {
  // Merchant-verify uses public-key, not secret-key
  return {
    "Content-Type": "application/json",
    "api-key":      Deno.env.get("VTPASS_API_KEY")     ?? "",
    "public-key":   Deno.env.get("VTPASS_PUBLIC_KEY")  ?? "",
  };
}

// ── Flutterwave helpers ────────────────────────────────────────
function flwSecret(): string {
  return Deno.env.get("FLW_SECRET_KEY") ?? "";
}

function flwHeaders(): HeadersInit {
  return {
    Authorization:  `Bearer ${flwSecret()}`,
    "Content-Type": "application/json",
  };
}

// ── Supabase admin client ──────────────────────────────────────
function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ── Unique tx_ref ──────────────────────────────────────────────
function makeTxRef(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `NW-${date}-${rand}`;
}

// ── Unique VTPass request_id ───────────────────────────────────
function makeRequestId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${date}${rand}`;
}

// ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const { action } = body;

    /* ── 1. Meter verification ────────────────────────────────── */
    if (action === "verify" && body.provider && !body.transaction_id) {
      const serviceId = VTPASS_IDS[body.provider];
      if (!serviceId) return json({ success: false, error: "Unknown DISCO" });

      const params = new URLSearchParams({
        billersCode: body.number,
        serviceID:   serviceId,
        type:        body.type === "postpaid" ? "postpaid" : "prepaid",
      });

      const r = await fetch(`${vtBase()}/merchant-verify?${params}`, {
        headers: vtVerifyHeaders(),
      });
      const d = await r.json();

      if (d.code === "000" && d.content?.Customer_Name) {
        return json({
          success:      true,
          customerName: d.content.Customer_Name,
          address:      d.content.Address ?? "",
          meterNumber:  d.content.Meter_Number ?? body.number,
        });
      }
      return json({
        success: false,
        error:   d.content?.error ?? d.response_description ?? "Meter not found — check number and DISCO",
      });
    }

    /* ── 2. Initiate Flutterwave payment ──────────────────────── */
    if (action === "initiate") {
      const { provider, number, type, amount, email, customerName, ...kycFields } = body;

      if (!VTPASS_IDS[provider]) return json({ success: false, error: "Unknown DISCO" });
      if (!email || !number || !amount || amount < 500) {
        return json({ success: false, error: "Missing required fields" });
      }

      const txRef = makeTxRef();
      const origin = req.headers.get("origin") ?? "https://nepawatch.app";
      const redirectUrl = `${origin}/topup.html`;

      const flwRes = await fetch("https://api.flutterwave.com/v3/payments", {
        method:  "POST",
        headers: flwHeaders(),
        body: JSON.stringify({
          tx_ref:       txRef,
          amount,
          currency:     "NGN",
          redirect_url: redirectUrl,
          customer: {
            email,
            name: customerName ?? email,
          },
          customizations: {
            title:       "NEPAWatch Electricity",
            description: `${provider.toUpperCase()} meter top-up`,
            logo:        `${origin}/logo2.jpg`,
          },
          meta: {
            provider,
            number,
            type,
            customerName: customerName ?? "",
            amount,
            ...kycFields,
          },
        }),
      });

      const flw = await flwRes.json();
      if (flw.status !== "success") {
        return json({ success: false, error: flw.message ?? "Flutterwave error" });
      }

      // Persist pending transaction
      try {
        await adminClient().from("electricity_transactions").insert({
          reference:    txRef,
          provider,
          meter_number: number,
          meter_type:   type,
          amount,
          email,
          status:       "pending",
        });
      } catch (_) { /* non-fatal */ }

      return json({
        success:     true,
        checkoutUrl: flw.data.link,
        tx_ref:      txRef,
      });
    }

    /* ── 3. Verify payment + deliver token ─────────────────────── */
    if (action === "verify" && (body.transaction_id || body.tx_ref)) {
      const transactionId = body.transaction_id as string | undefined;
      const txRef         = body.tx_ref         as string | undefined;

      // Check idempotency cache first
      let cached: Record<string, unknown> | null = null;
      try {
        if (txRef) {
          const { data } = await adminClient()
            .from("electricity_transactions")
            .select("*")
            .eq("reference", txRef)
            .single();
          cached = data;
        }
      } catch (_) {}

      if (cached?.status === "success") {
        return json({
          success:    true,
          token:      cached.token as string,
          units:      cached.units as string,
          amount:     cached.amount as number,
          meter:      cached.meter_number as string,
          isPostpaid: cached.meter_type === "postpaid",
        });
      }
      if (cached?.status === "failed") {
        return json({ success: false, fatal: true, error: "Transaction failed — contact support" });
      }

      // Verify with Flutterwave
      let flwData: Record<string, unknown> | null = null;

      if (transactionId) {
        const r = await fetch(
          `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
          { headers: flwHeaders() },
        );
        const d = await r.json();
        if (d.status === "success") flwData = d.data;
      }

      // Fallback: verify by tx_ref query
      if (!flwData && txRef) {
        const r = await fetch(
          `https://api.flutterwave.com/v3/transactions?tx_ref=${encodeURIComponent(txRef)}`,
          { headers: flwHeaders() },
        );
        const d = await r.json();
        if (d.status === "success" && d.data?.length > 0) {
          flwData = d.data[0];
        }
      }

      if (!flwData || flwData.status !== "successful") {
        return json({ success: false }); // not yet confirmed — frontend retries
      }

      // Extract metadata from Flutterwave response
      const meta      = (flwData.meta as Record<string, unknown>) ?? {};
      const provider  = (meta.provider  ?? cached?.provider)  as string;
      const number    = (meta.number    ?? cached?.meter_number) as string;
      const type      = (meta.type      ?? cached?.meter_type ?? "prepaid") as string;
      const amount    = Number(meta.amount ?? flwData.amount ?? cached?.amount ?? 0);
      const email     = ((flwData.customer as Record<string, unknown>)?.email ?? cached?.email ?? "") as string;

      const serviceId = VTPASS_IDS[provider];
      if (!serviceId) return json({ success: false, fatal: true, error: "Invalid DISCO" });

      // Purchase token via VTPass
      const requestId = makeRequestId();
      const vtRes = await fetch(`${vtBase()}/pay`, {
        method:  "POST",
        headers: vtHeaders(),
        body: JSON.stringify({
          request_id:     requestId,
          serviceID:      serviceId,
          billersCode:    number,
          variation_code: type === "postpaid" ? "postpaid" : "prepaid",
          amount,
          phone:          "08000000000",
          quantity:       1,
        }),
      });
      const vt = await vtRes.json();

      const vtCode      = vt.code ?? vt.content?.transactions?.status;
      const isSuccess   = vtCode === "000" || vtCode === "099" ||
                          vt.content?.transactions?.status === "delivered";

      if (isSuccess) {
        const token = vt.content?.transactions?.token ?? vt.token ?? "";
        const units = String(vt.content?.transactions?.units ?? vt.units ?? "");

        try {
          await adminClient().from("electricity_transactions").upsert(
            { reference: txRef ?? requestId, status: "success", token, units,
              meter_number: number, provider, meter_type: type, amount, email },
            { onConflict: "reference" },
          );
        } catch (_) {}

        return json({
          success:    true,
          token,
          units,
          amount,
          meter:      number,
          isPostpaid: type === "postpaid",
        });
      }

      const vtError = vt.response_description ?? vt.content?.errors?.join(", ") ?? "VTPass error";

      try {
        await adminClient().from("electricity_transactions").upsert(
          { reference: txRef ?? requestId, status: "failed", error: vtError,
            provider, meter_number: number, meter_type: type, amount, email },
          { onConflict: "reference" },
        );
      } catch (_) {}

      return json({ success: false, fatal: true, error: vtError });
    }

    return json({ success: false, error: "Unknown action" });

  } catch (err) {
    console.error("buy-electricity error:", err);
    return json({ success: false, error: "Internal server error" }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
