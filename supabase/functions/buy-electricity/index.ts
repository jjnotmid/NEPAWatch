import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ────────────────────────────────────────────────────────────────
   NEPAWatch — buy-electricity edge function
   Handles:
     action:"verify"   (with provider/number/type) → VTPass meter lookup
     action:"initiate" → Paystack checkout init
     action:"verify"   (with reference)            → Poll Paystack + deliver token
   ──────────────────────────────────────────────────────────────── */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── VTPass service IDs (exact strings VTPass expects) ──────────
const VTPASS_SERVICE_IDS: Record<string, string> = {
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

function vtpassBase(): string {
  const sandbox = Deno.env.get("VTPASS_SANDBOX") === "true";
  return sandbox
    ? "https://sandbox.vtpass.com/api"
    : "https://vtpass.com/api";
}

function vtpassHeaders(): HeadersInit {
  const apiKey    = Deno.env.get("VTPASS_API_KEY")    ?? "";
  const secretKey = Deno.env.get("VTPASS_SECRET_KEY") ?? "";
  return {
    "Content-Type":  "application/json",
    "api-key":       apiKey,
    "secret-key":    secretKey,
  };
}

// ── Paystack ───────────────────────────────────────────────────
function paystackSecret(): string {
  return Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
}

// ── Supabase admin client for persisting transactions ──────────
function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ── Unique request ID for VTPass (16-char alphanum) ───────────
function makeRequestId(): string {
  const now  = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${date}${rand}`;
}

// ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const { action } = body;

    // ── 1. Meter verification ─────────────────────────────────
    if (action === "verify" && body.provider && !body.reference) {
      const serviceId = VTPASS_SERVICE_IDS[body.provider];
      if (!serviceId) {
        return json({ success: false, error: "Unknown DISCO provider" });
      }

      const params = new URLSearchParams({
        billersCode: body.number,
        serviceID:   serviceId,
        type:        body.type === "postpaid" ? "postpaid" : "prepaid",
      });

      const r = await fetch(`${vtpassBase()}/merchant-verify?${params}`, {
        headers: vtpassHeaders(),
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

    // ── 2. Initiate Paystack payment ──────────────────────────
    if (action === "initiate") {
      const { provider, number, type, amount, email, customerName, ...kycFields } = body;

      if (!VTPASS_SERVICE_IDS[provider]) {
        return json({ success: false, error: "Unknown DISCO provider" });
      }
      if (!email || !number || !amount || amount < 500) {
        return json({ success: false, error: "Missing required fields" });
      }

      const callbackUrl = `${req.headers.get("origin") ?? "https://nepawatch.app"}/topup.html`;

      const psRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${paystackSecret()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount:        amount * 100, // kobo
          callback_url:  callbackUrl,
          metadata: {
            provider,
            number,
            type,
            customerName: customerName ?? "",
            amount,
            ...kycFields,
          },
        }),
      });

      const ps = await psRes.json();
      if (!ps.status) {
        return json({ success: false, error: ps.message ?? "Paystack error" });
      }

      // Persist pending transaction
      try {
        await adminClient()
          .from("electricity_transactions")
          .insert({
            reference:     ps.data.reference,
            provider,
            meter_number:  number,
            meter_type:    type,
            amount,
            email,
            status:        "pending",
          });
      } catch (_) { /* non-fatal — table may not exist */ }

      return json({ success: true, checkoutUrl: ps.data.authorization_url, reference: ps.data.reference });
    }

    // ── 3. Poll / deliver token (action:"verify" with reference) ─
    if (action === "verify" && body.reference) {
      const ref = body.reference as string;

      // Check if already processed (idempotency)
      let cached: Record<string, unknown> | null = null;
      try {
        const { data } = await adminClient()
          .from("electricity_transactions")
          .select("*")
          .eq("reference", ref)
          .single();
        cached = data;
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
        return json({ success: false, fatal: true, error: "Transaction failed — please contact support" });
      }

      // Verify Paystack payment
      const psRes = await fetch(`https://api.paystack.co/transaction/verify/${ref}`, {
        headers: { Authorization: `Bearer ${paystackSecret()}` },
      });
      const ps = await psRes.json();

      if (!ps.status || ps.data?.status !== "success") {
        return json({ success: false }); // not yet paid, frontend retries
      }

      // Payment confirmed — extract metadata
      const meta     = ps.data.metadata ?? {};
      const provider = meta.provider as string;
      const number   = meta.number   as string;
      const type     = (meta.type    as string) ?? "prepaid";
      const amount   = (meta.amount  as number) ?? Math.round(ps.data.amount / 100);
      const email    = ps.data.customer?.email as string;

      const serviceId = VTPASS_SERVICE_IDS[provider];
      if (!serviceId) {
        return json({ success: false, fatal: true, error: "Invalid DISCO in transaction" });
      }

      // Call VTPass to purchase token
      const requestId = makeRequestId();
      const vtRes = await fetch(`${vtpassBase()}/pay`, {
        method:  "POST",
        headers: vtpassHeaders(),
        body: JSON.stringify({
          request_id:  requestId,
          serviceID:   serviceId,
          billersCode: number,
          variation_code: type === "postpaid" ? "postpaid" : "prepaid",
          amount,
          phone:       "08000000000", // VTPass requires a phone field; use dummy for non-SMS delivery
          quantity:    1,
        }),
      });
      const vt = await vtRes.json();

      // VTPass success codes: "000" (prepaid token) or "099" (postpaid)
      const vtCode = vt.code ?? vt.content?.transactions?.status;
      const isSuccess = vtCode === "000" || vtCode === "099" || vt.content?.transactions?.status === "delivered";

      if (isSuccess) {
        const token = vt.content?.transactions?.token
          ?? vt.token
          ?? vt.content?.token
          ?? "";
        const units = vt.content?.transactions?.units
          ?? vt.units
          ?? "";

        // Persist success
        try {
          await adminClient()
            .from("electricity_transactions")
            .upsert({ reference: ref, status: "success", token, units, meter_number: number, provider, meter_type: type, amount, email }, { onConflict: "reference" });
        } catch (_) {}

        return json({
          success:    true,
          token,
          units:      String(units),
          amount,
          meter:      number,
          isPostpaid: type === "postpaid",
        });
      }

      // VTPass returned an error
      const vtError = vt.response_description ?? vt.content?.errors?.join(", ") ?? "VTPass transaction failed";

      // Persist failure
      try {
        await adminClient()
          .from("electricity_transactions")
          .upsert({ reference: ref, status: "failed", error: vtError, provider, meter_number: number, meter_type: type, amount, email }, { onConflict: "reference" });
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
