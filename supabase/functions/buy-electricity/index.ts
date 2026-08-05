import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ────────────────────────────────────────────────────────────────
   NEPAWatch — buy-electricity edge function

   Payment collection : Paystack
   Token vending      : Flutterwave Bills

   These are two different jobs and Paystack only does the first —
   its API has no bills/utilities resource, so it cannot hand back a
   meter token. Paystack takes the customer's money; the vendor below
   turns that money into units on the meter.

   Flow:
     action:"verify"   + provider/number/type  → validate meter, quote fee
     action:"initiate" + billing details        → Paystack checkout URL
     action:"verify"   + reference              → confirm payment, vend token

   Secrets required:
     PAYSTACK_SECRET_KEY   sk_live_… (payment collection)
     FLW_SECRET_KEY        token vending
     NW_SERVICE_FEE        optional, naira, defaults to 100
   ──────────────────────────────────────────────────────────────── */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ── Service fee ───────────────────────────────────────────────
   Added on top of the units the customer is buying. They enter
   ₦2 000 of electricity, they are charged ₦2 100, and ₦2 000 goes
   to the meter. Configurable without a redeploy via NW_SERVICE_FEE. */
const SERVICE_FEE = Number(Deno.env.get("NW_SERVICE_FEE") ?? 100);

function serviceFeeFor(_amount: number): number {
  return SERVICE_FEE;
}

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

// ── Paystack (payment collection) ──────────────────────────────
const PAYSTACK = "https://api.paystack.co";

function psHeaders(): HeadersInit {
  return {
    Authorization:  `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY") ?? ""}`,
    "Content-Type": "application/json",
  };
}

// ── Flutterwave (token vending only) ───────────────────────────
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

/* ── Vend the token once payment is confirmed ───────────────────
   `amount` here is the electricity value only — the service fee has
   already been stripped off, so we never send our margin to the meter. */
async function vendToken(
  disco: DiscoInfo, number: string, amount: number, billRef: string,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const res = await fetch(`${FLW}/bills`, {
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
  const bill = await res.json();
  if (bill.status !== "success") {
    return { ok: false, error: bill.message ?? "Token vending failed" };
  }
  return { ok: true, token: bill.data?.extra as string | undefined };
}

// ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const { action } = body;

    /* ── 1. Meter validation (still via Flutterwave bill-items) ── */
    if (action === "verify" && body.provider && !body.reference) {
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
          serviceFee:   SERVICE_FEE,
          minimum:      d.data.minimum ?? 100,
          maximum:      d.data.maximum ?? 500000,
        });
      }
      return json({
        success: false,
        error:   d.data?.response_message ?? d.message ?? "Meter not found — check number and DISCO",
      });
    }

    /* ── 2. Initiate Paystack payment ─────────────────────────── */
    if (action === "initiate") {
      const { provider, number, type, amount, email, customerName, ...kycFields } = body;

      const disco = DISCOS[provider as string];
      if (!disco) return json({ success: false, error: "Unknown DISCO" });
      if (!email || !number || !amount || amount < 100) {
        return json({ success: false, error: "Missing required fields" });
      }

      const units  = Number(amount);            // value that reaches the meter
      const fee    = serviceFeeFor(units);      // NEPAWatch margin
      const total  = units + fee;               // what the customer is charged

      const txRef    = makeRef("NW");
      const origin   = req.headers.get("origin") ?? "https://nepawatch.app";
      const callback = `${origin}/topup.html`;

      const psRes = await fetch(`${PAYSTACK}/transaction/initialize`, {
        method:  "POST",
        headers: psHeaders(),
        body: JSON.stringify({
          email,
          amount:       Math.round(total * 100),   // Paystack works in kobo
          currency:     "NGN",
          reference:    txRef,
          callback_url: callback,
          metadata: {
            provider, number, type,
            customerName: customerName ?? "",
            units, fee,
            custom_fields: [
              { display_name: "Meter",  variable_name: "meter",  value: number },
              { display_name: "DISCO",  variable_name: "disco",  value: disco.name },
              { display_name: "Units",  variable_name: "units",  value: `NGN ${units.toLocaleString()}` },
              { display_name: "Service fee", variable_name: "fee", value: `NGN ${fee}` },
            ],
            ...kycFields,
          },
        }),
      });

      const ps = await psRes.json();
      if (!ps.status || !ps.data?.authorization_url) {
        return json({ success: false, error: ps.message ?? "Payment init failed" });
      }

      // Persist pending record — amount stores the meter value, not the total
      try {
        await adminClient().from("electricity_transactions").insert({
          reference:    txRef,
          provider,
          meter_number: number,
          meter_type:   type,
          amount:       units,
          service_fee:  fee,
          total_paid:   total,
          email,
          status:       "pending",
        });
      } catch (_) { /* non-fatal */ }

      return json({
        success:     true,
        checkoutUrl: ps.data.authorization_url,
        reference:   txRef,
        units, fee, total,
      });
    }

    /* ── 3. Verify payment + deliver electricity token ─────────── */
    if (action === "verify" && body.reference) {
      const reference = body.reference as string;

      // Idempotency: never vend twice for one payment
      let cached: Record<string, unknown> | null = null;
      try {
        const { data } = await adminClient()
          .from("electricity_transactions")
          .select("*")
          .eq("reference", reference)
          .single();
        cached = data;
      } catch (_) {}

      if (cached?.status === "success") {
        return json({
          success:    true,
          token:      cached.token as string,
          units:      cached.units as string ?? "",
          amount:     cached.amount as number,
          meter:      cached.meter_number as string,
          isPostpaid: cached.meter_type === "postpaid",
        });
      }
      if (cached?.status === "failed") {
        return json({ success: false, fatal: true, error: "Transaction failed — contact support" });
      }

      /* Step A: confirm the customer actually paid */
      let payConfirmed = false;
      let payMeta: Record<string, unknown> = {};
      let paidKobo = 0;
      let payEmail = "";

      const vr = await fetch(
        `${PAYSTACK}/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: psHeaders() },
      );
      const vd = await vr.json();
      if (vd.status && vd.data?.status === "success") {
        payConfirmed = true;
        payMeta  = (vd.data.metadata as Record<string, unknown>) ?? {};
        paidKobo = Number(vd.data.amount ?? 0);
        payEmail = (vd.data.customer as Record<string, unknown>)?.email as string ?? "";
      } else if (vd.data?.status === "failed" || vd.data?.status === "abandoned") {
        try {
          await adminClient().from("electricity_transactions")
            .update({ status: "failed", error: `Payment ${vd.data.status}` })
            .eq("reference", reference);
        } catch (_) {}
        return json({ success: false, fatal: true, error: "Payment was not completed" });
      }

      if (!payConfirmed) return json({ success: false }); // still pending — frontend retries

      /* Step B: work out what actually goes to the meter.
         Trust our own stored value first; fall back to the paid total
         minus the fee so a missing DB row can never over-vend.        */
      const provider = (payMeta.provider ?? cached?.provider) as string;
      const number   = (payMeta.number   ?? cached?.meter_number) as string;
      const type     = (payMeta.type     ?? cached?.meter_type ?? "prepaid") as string;
      const email    = payEmail || (cached?.email as string) || "";

      const paidTotal = paidKobo / 100;
      const fee       = Number(payMeta.fee ?? cached?.service_fee ?? SERVICE_FEE);
      const units     = Number(payMeta.units ?? cached?.amount ?? Math.max(0, paidTotal - fee));

      const disco = DISCOS[provider];
      if (!disco) return json({ success: false, fatal: true, error: "Invalid DISCO" });
      if (units < 100) return json({ success: false, fatal: true, error: "Invalid electricity amount" });

      /* Step C: vend, unless a previous attempt already placed the bill */
      let billRef = cached?.bill_ref as string | undefined;
      if (cached?.status !== "pending_bill" || !billRef) {
        billRef = makeRef("BILL");
        const vend = await vendToken(disco, number, units, billRef);

        if (!vend.ok) {
          try {
            await adminClient().from("electricity_transactions").upsert(
              { reference, status: "failed", error: vend.error,
                provider, meter_number: number, meter_type: type,
                amount: units, service_fee: fee, total_paid: paidTotal, email },
              { onConflict: "reference" },
            );
          } catch (_) {}
          return json({ success: false, fatal: true, error: vend.error });
        }

        if (vend.token) {
          try {
            await adminClient().from("electricity_transactions").upsert(
              { reference, bill_ref: billRef, status: "success", token: vend.token, units: "",
                provider, meter_number: number, meter_type: type,
                amount: units, service_fee: fee, total_paid: paidTotal, email },
              { onConflict: "reference" },
            );
          } catch (_) {}
          return json({
            success: true, token: vend.token, units: "",
            amount: units, meter: number, isPostpaid: type === "postpaid",
          });
        }

        // Token not immediate — record the bill ref and let the frontend poll
        try {
          await adminClient().from("electricity_transactions").upsert(
            { reference, bill_ref: billRef, status: "pending_bill",
              provider, meter_number: number, meter_type: type,
              amount: units, service_fee: fee, total_paid: paidTotal, email },
            { onConflict: "reference" },
          );
        } catch (_) {}
      }

      /* Step D: poll the vendor for a token */
      const statusRes = await fetch(
        `${FLW}/bills/${encodeURIComponent(billRef)}?verbose=1`,
        { headers: flwHeaders() },
      );
      const statusD  = await statusRes.json();
      const billData = statusD.data as Record<string, unknown> | undefined;

      if (statusD.status === "success" && billData?.extra) {
        const token = billData.extra as string;
        try {
          await adminClient().from("electricity_transactions").upsert(
            { reference, bill_ref: billRef, status: "success", token, units: "",
              provider, meter_number: number, meter_type: type,
              amount: units, service_fee: fee, total_paid: paidTotal, email },
            { onConflict: "reference" },
          );
        } catch (_) {}
        return json({
          success: true, token, units: "",
          amount: units, meter: number, isPostpaid: type === "postpaid",
        });
      }

      if (billData?.status === "failed") {
        const errMsg = (billData?.product_details as string) ?? "Token vending failed";
        try {
          await adminClient().from("electricity_transactions").upsert(
            { reference, bill_ref: billRef, status: "failed", error: errMsg },
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
