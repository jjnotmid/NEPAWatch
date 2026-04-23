import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ────────────────────────────────────────────────────────────────
   NEPAWatch — buy-electricity edge function
   100% Flutterwave — no VTPass dependency

   Flow:
     action:"verify"   + provider/number/type  → FLW bill-items validate
     action:"initiate" + billing details        → FLW payment link
     action:"verify"   + transaction_id/tx_ref  → confirm payment + POST /bills + poll token
   ──────────────────────────────────────────────────────────────── */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── DISCO map: provider slug → Flutterwave biller codes ────────
interface DiscoInfo {
  billerCode: string;
  prepaid:    string;
  postpaid:   string | null;
  name:       string;
}
const DISCOS: Record<string, DiscoInfo> = {
  "ikeja-electric":  { billerCode: "BIL113", prepaid: "UB159", postpaid: "UB160", name: "IKEDC" },
  "eko-electric":    { billerCode: "BIL112", prepaid: "UB157", postpaid: "UB158", name: "EKEDC" },
  "abuja-electric":  { billerCode: "BIL204", prepaid: "UB584", postpaid: "UB585", name: "AEDC"  },
  "ibadan-electric": { billerCode: "BIL114", prepaid: "UB161", postpaid: "UB162", name: "IBEDC" },
  "enugu-electric":  { billerCode: "BIL115", prepaid: "UB163", postpaid: "UB164", name: "EEDC"  },
  "phed":            { billerCode: "BIL116", prepaid: "UB633", postpaid: "UB165", name: "PHED"  },
  "kaduna-electric": { billerCode: "BIL119", prepaid: "UB602", postpaid: "UB603", name: "KAEDCO"},
  "kano-electric":   { billerCode: "BIL120", prepaid: "UB169", postpaid: "UB170", name: "KEDCO" },
  "benin-electric":  { billerCode: "BIL117", prepaid: "UB167", postpaid: "UB166", name: "BEDC"  },
  "jos-electric":    { billerCode: "BIL215", prepaid: "UB676", postpaid: "UB677", name: "JED"   },
  "yola-electric":   { billerCode: "BIL118", prepaid: "UB168", postpaid: null,    name: "YEDC"  },
};

// ── Flutterwave ────────────────────────────────────────────────
const FLW = "https://api.flutterwave.com/v3";

function flwHeaders(): HeadersInit {
  return {
    Authorization:  `Bearer ${Deno.env.get("FLW_SECRET_KEY") ?? ""}`,
    "Content-Type": "application/json",
  };
}

// ── Supabase admin ─────────────────────────────────────────────
function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ── Unique refs ────────────────────────────────────────────────
function makeRef(prefix = "NW"): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const r = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${d}-${r}`;
}

// ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const { action } = body;

    /* ── 1. Meter validation via Flutterwave bill-items ───────── */
    if (action === "verify" && body.provider && !body.transaction_id && !body.tx_ref) {
      const disco = DISCOS[body.provider as string];
      if (!disco) return json({ success: false, error: "Unknown DISCO" });

      const isPostpaid = body.type === "postpaid";
      const itemCode   = isPostpaid ? disco.postpaid : disco.prepaid;
      if (!itemCode) return json({ success: false, error: `${disco.name} does not support ${body.type} meters` });

      const params = new URLSearchParams({
        code:     disco.billerCode,
        customer: body.number,
      });
      const r = await fetch(
        `${FLW}/bill-items/${itemCode}/validate?${params}`,
        { headers: flwHeaders() },
      );
      const d = await r.json();

      if (d.status === "success" && d.data?.response_code === "00") {
        return json({
          success:      true,
          customerName: d.data.name   ?? "Customer",
          address:      d.data.address ?? "",
          fee:          d.data.fee    ?? 100,
          minimum:      d.data.minimum ?? 100,
          maximum:      d.data.maximum ?? 500000,
        });
      }
      return json({
        success: false,
        error:   d.data?.response_message ?? d.message ?? "Meter not found — check number and DISCO",
      });
    }

    /* ── 2. Initiate Flutterwave payment ──────────────────────── */
    if (action === "initiate") {
      const { provider, number, type, amount, email, customerName, ...kycFields } = body;

      const disco = DISCOS[provider as string];
      if (!disco) return json({ success: false, error: "Unknown DISCO" });
      if (!email || !number || !amount || amount < 100) {
        return json({ success: false, error: "Missing required fields" });
      }

      const txRef    = makeRef("NW");
      const origin   = req.headers.get("origin") ?? "https://nepawatch.app";
      const redirect = `${origin}/topup.html`;

      const flwRes = await fetch(`${FLW}/payments`, {
        method:  "POST",
        headers: flwHeaders(),
        body: JSON.stringify({
          tx_ref:       txRef,
          amount,
          currency:     "NGN",
          redirect_url: redirect,
          customer: {
            email,
            name: customerName ?? email,
          },
          customizations: {
            title:       `${disco.name} Electricity`,
            description: `${type === "postpaid" ? "Postpaid bill" : "Prepaid token"} for meter ${number}`,
            logo:        `${origin}/logo2.jpg`,
          },
          meta: { provider, number, type, customerName: customerName ?? "", amount, ...kycFields },
        }),
      });

      const flw = await flwRes.json();
      if (flw.status !== "success") {
        return json({ success: false, error: flw.message ?? "Payment init failed" });
      }

      // Persist pending record
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

      return json({ success: true, checkoutUrl: flw.data.link, tx_ref: txRef });
    }

    /* ── 3. Verify payment + deliver electricity token ─────────── */
    if (action === "verify" && (body.transaction_id || body.tx_ref)) {
      const transactionId = body.transaction_id as string | undefined;
      const payTxRef      = body.tx_ref         as string | undefined;

      // Check idempotency cache
      let cached: Record<string, unknown> | null = null;
      try {
        if (payTxRef) {
          const { data } = await adminClient()
            .from("electricity_transactions")
            .select("*")
            .eq("reference", payTxRef)
            .single();
          cached = data;
        }
      } catch (_) {}

      if (cached?.status === "success") {
        return json({
          success:    true,
          token:      cached.token      as string,
          units:      cached.units      as string ?? "",
          amount:     cached.amount     as number,
          meter:      cached.meter_number as string,
          isPostpaid: cached.meter_type === "postpaid",
        });
      }
      if (cached?.status === "failed") {
        return json({ success: false, fatal: true, error: "Transaction failed — contact support" });
      }

      // If bill already placed but token not yet ready → skip to poll
      if (cached?.status !== "pending_bill") {
        // Step A: verify the customer payment with Flutterwave
        let payConfirmed = false;
        let payMeta: Record<string, unknown> = {};
        let payAmount = 0;
        let payEmail  = "";

        if (transactionId) {
          const r  = await fetch(`${FLW}/transactions/${transactionId}/verify`, { headers: flwHeaders() });
          const d  = await r.json();
          if (d.status === "success" && d.data?.status === "successful") {
            payConfirmed = true;
            payMeta   = (d.data.meta as Record<string, unknown>) ?? {};
            payAmount = Number(d.data.amount ?? 0);
            payEmail  = (d.data.customer as Record<string,unknown>)?.email as string ?? "";
          }
        }

        // Fallback: query by tx_ref
        if (!payConfirmed && payTxRef) {
          const r = await fetch(
            `${FLW}/transactions?tx_ref=${encodeURIComponent(payTxRef)}`,
            { headers: flwHeaders() },
          );
          const d = await r.json();
          const tx = d.data?.[0];
          if (d.status === "success" && tx?.status === "successful") {
            payConfirmed = true;
            payMeta   = (tx.meta as Record<string, unknown>) ?? {};
            payAmount = Number(tx.amount ?? 0);
            payEmail  = (tx.customer as Record<string,unknown>)?.email as string ?? "";
          }
        }

        if (!payConfirmed) return json({ success: false }); // payment not yet confirmed

        // Step B: place bill payment
        const provider  = (payMeta.provider  ?? cached?.provider)      as string;
        const number    = (payMeta.number    ?? cached?.meter_number)   as string;
        const type      = (payMeta.type      ?? cached?.meter_type ?? "prepaid") as string;
        const amount    = payAmount || (cached?.amount as number) || 0;
        const email     = payEmail  || (cached?.email  as string) || "";

        const disco = DISCOS[provider];
        if (!disco) return json({ success: false, fatal: true, error: "Invalid DISCO" });

        const billRef = makeRef("BILL");

        const billRes = await fetch(`${FLW}/bills`, {
          method:  "POST",
          headers: flwHeaders(),
          body: JSON.stringify({
            country:     "NG",
            customer:    number,
            amount,
            type:        disco.billerCode,
            reference:   billRef,
            recurrence:  "ONCE",
            biller_name: disco.name,
          }),
        });
        const bill = await billRes.json();

        if (bill.status !== "success") {
          // Bill payment failed — possibly insufficient Flutterwave balance
          const errMsg = bill.message ?? "Bill payment failed";
          try {
            await adminClient().from("electricity_transactions").upsert(
              { reference: payTxRef ?? billRef, status: "failed", error: errMsg,
                provider, meter_number: number, meter_type: type, amount, email },
              { onConflict: "reference" },
            );
          } catch (_) {}
          return json({ success: false, fatal: true, error: errMsg });
        }

        // If token arrived immediately in POST /bills response
        if (bill.data?.extra) {
          const token = bill.data.extra as string;
          try {
            await adminClient().from("electricity_transactions").upsert(
              { reference: payTxRef ?? billRef, bill_ref: billRef, status: "success",
                token, units: "", provider, meter_number: number, meter_type: type, amount, email },
              { onConflict: "reference" },
            );
          } catch (_) {}
          return json({
            success:    true,
            token,
            units:      "",
            amount,
            meter:      number,
            isPostpaid: type === "postpaid",
          });
        }

        // Token not immediate — persist bill_ref, frontend will retry
        try {
          await adminClient().from("electricity_transactions").upsert(
            { reference: payTxRef ?? billRef, bill_ref: billRef, status: "pending_bill",
              provider, meter_number: number, meter_type: type, amount, email },
            { onConflict: "reference" },
          );
        } catch (_) {}
      }

      // Step C: poll bill status for token
      const billRef = cached?.bill_ref as string | undefined;
      if (!billRef) return json({ success: false }); // will retry when DB catches up

      const statusRes = await fetch(
        `${FLW}/bills/${encodeURIComponent(billRef)}?verbose=1`,
        { headers: flwHeaders() },
      );
      const statusD = await statusRes.json();
      const billData = statusD.data as Record<string, unknown> | undefined;

      if (statusD.status === "success" && billData?.extra) {
        const token = billData.extra as string;
        const units = "";

        try {
          await adminClient().from("electricity_transactions").upsert(
            { reference: payTxRef ?? billRef, bill_ref: billRef, status: "success",
              token, units,
              provider:     cached?.provider     as string,
              meter_number: cached?.meter_number as string,
              meter_type:   cached?.meter_type   as string,
              amount:       cached?.amount       as number,
              email:        cached?.email        as string },
            { onConflict: "reference" },
          );
        } catch (_) {}

        return json({
          success:    true,
          token,
          units,
          amount:     cached?.amount as number ?? 0,
          meter:      cached?.meter_number as string ?? "",
          isPostpaid: cached?.meter_type === "postpaid",
        });
      }

      if (billData?.status === "failed") {
        const errMsg = (billData?.product_details as string) ?? "Bill payment failed";
        try {
          await adminClient().from("electricity_transactions").upsert(
            { reference: payTxRef ?? billRef, bill_ref: billRef, status: "failed", error: errMsg },
            { onConflict: "reference" },
          );
        } catch (_) {}
        return json({ success: false, fatal: true, error: errMsg });
      }

      return json({ success: false }); // still processing — frontend retries
    }

    return json({ success: false, error: "Unknown action" });

  } catch (err) {
    console.error("buy-electricity:", err);
    return json({ success: false, error: "Internal server error" }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
