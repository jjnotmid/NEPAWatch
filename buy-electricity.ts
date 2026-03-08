// ================================================================
// Supabase Edge Function: buy-electricity
// File path: supabase/functions/buy-electricity/index.ts
//
// Set these in Supabase Dashboard → Edge Functions → Secrets:
//   BUDPAY_SECRET_KEY         →  sk_test_... or sk_live_...
//   WEBHOOK_SECRET            →  any random string you make up
// ================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const BUDPAY = "https://api.budpay.com/api/v2";
const SECRET = Deno.env.get("BUDPAY_SECRET_KEY")!;

function bpHeaders() {
  return {
    Authorization: `Bearer ${SECRET}`,
    "Content-Type": "application/json",
  };
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── 1. VERIFY METER ──────────────────────────────────────────
async function verifyMeter(provider: string, number: string, type: string) {
  const res = await fetch(`${BUDPAY}/electricity/validate`, {
    method: "POST",
    headers: bpHeaders(),
    body: JSON.stringify({ provider, number, type }),
  });
  const data = await res.json();

  console.log("[verifyMeter] BudPay response:", JSON.stringify(data));

  // BudPay returns Customer_Name (capital C and N) not name
  if (data.success && data.data?.Customer_Name) {
    return {
      success: true,
      customerName: data.data.Customer_Name,
      address: data.data.address || data.data.Address || "",
    };
  }
  return {
    success: false,
    error: data.message || "Meter not found — check your meter number",
  };
}

// ── 2. INITIATE PAYMENT ──────────────────────────────────────
async function initiatePayment(body: Record<string, unknown>) {
  const { provider, number, type, amount, email, phone, customerName } = body as {
    provider: string; number: string; type: string;
    amount: number; email: string; phone: string; customerName: string;
  };

  const reference = `NW-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  const sb = adminClient();

  const { error: dbErr } = await sb.from("electricity_purchases").insert({
    reference,
    provider,
    meter_number: number,
    meter_type: type,
    amount,
    email,
    phone,
    customer_name: customerName,
    status: "pending",
  });

  if (dbErr) {
    console.error("[initiatePayment] DB error:", dbErr);
    return { success: false, error: "Could not start purchase — try again" };
  }

  // BudPay transaction/initialize — amount must be a string in kobo
  const res = await fetch(`${BUDPAY}/transaction/initialize`, {
    method: "POST",
    headers: bpHeaders(),
    body: JSON.stringify({
      email,
      amount: String(amount * 100),
      currency: "NGN",
      reference,
      callback: `https://nepawatch.app/topup?reference=${reference}`,
    }),
  });

  const data = await res.json();
  console.log("[initiatePayment] BudPay response:", JSON.stringify(data));

  if (data.status && data.data?.authorization_url) {
    return { success: true, checkoutUrl: data.data.authorization_url, reference };
  }

  return { success: false, error: data.message || "Payment init failed" };
}

// ── 3. VEND TOKEN ────────────────────────────────────────────
async function vendToken(reference: string) {
  const sb = adminClient();

  const { data: purchase, error } = await sb
    .from("electricity_purchases")
    .select("*")
    .eq("reference", reference)
    .single();

  if (error || !purchase) {
    return { success: false, error: "Purchase not found" };
  }

  if (purchase.status === "delivered") {
    return {
      success: true,
      token: purchase.token,
      units: purchase.units,
      amount: purchase.amount,
      meter: purchase.meter_number,
    };
  }

  // Verify payment with BudPay
  const verifyRes = await fetch(`${BUDPAY}/transaction/verify/${reference}`, {
    headers: bpHeaders(),
  });
  const verify = await verifyRes.json();
  console.log("[vendToken] verify response:", JSON.stringify(verify));

  if (verify.data?.status !== "success") {
    return { success: false, error: "Payment not confirmed yet" };
  }

  // Vend the electricity token
  const vendRes = await fetch(`${BUDPAY}/electricity/recharge`, {
    method: "POST",
    headers: bpHeaders(),
    body: JSON.stringify({
      provider: purchase.provider,
      number: purchase.meter_number,
      type: purchase.meter_type,
      amount: purchase.amount,
      reference: `${reference}-vend`,
    }),
  });

  const vend = await vendRes.json();
  console.log("[vendToken] vend response:", JSON.stringify(vend));

  if (vend.success && vend.data?.purchased_code) {
    // Strip "Token : " prefix if present
    const rawToken = vend.data.purchased_code.replace(/^Token\s*:\s*/i, "").trim();
    const units = vend.data.units || "—";

    await sb.from("electricity_purchases").update({
      status: "delivered",
      token: rawToken,
      units,
    }).eq("reference", reference);

    return {
      success: true,
      token: rawToken,
      units,
      amount: purchase.amount,
      meter: purchase.meter_number,
    };
  }

  await sb.from("electricity_purchases").update({ status: "failed" }).eq("reference", reference);
  return { success: false, error: vend.message || "Token vending failed" };
}

// ── 4. GET RESULT (called from callback page) ─────────────────
async function getResult(reference: string) {
  const sb = adminClient();
  const { data: purchase } = await sb
    .from("electricity_purchases")
    .select("*")
    .eq("reference", reference)
    .single();

  if (purchase?.status === "delivered") {
    return {
      success: true,
      token: purchase.token,
      units: purchase.units,
      amount: purchase.amount,
      meter: purchase.meter_number,
    };
  }

  return await vendToken(reference);
}

// ── MAIN HANDLER ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // BudPay webhook
  if (req.method === "POST" && req.headers.get("x-budpay-signature")) {
    try {
      const payload = await req.json();
      const ref = payload?.data?.reference;
      if (ref) await vendToken(ref);
    } catch (e) {
      console.error("Webhook error:", e);
    }
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = await req.json();
    console.log("[handler] action:", body.action);

    if (body.action === "verify") {
      const r = await verifyMeter(body.provider, body.number, body.type);
      return new Response(JSON.stringify(r), { headers: CORS });
    }

    if (body.action === "initiate") {
      const r = await initiatePayment(body);
      return new Response(JSON.stringify(r), { headers: CORS });
    }

    if (body.action === "getResult") {
      const r = await getResult(body.reference);
      return new Response(JSON.stringify(r), { headers: CORS });
    }

    // Return purchase row so browser can call BudPay recharge directly
    if (body.action === "getPurchase") {
      const sb = adminClient();
      const { data: purchase, error } = await sb
        .from("electricity_purchases")
        .select("*")
        .eq("reference", body.reference)
        .single();

      if (error || !purchase) {
        return new Response(JSON.stringify({ success: false, error: "Purchase not found" }), { headers: CORS });
      }
      // If already delivered return token immediately
      if (purchase.status === "delivered") {
        return new Response(JSON.stringify({
          success: true, token: purchase.token, units: purchase.units,
          amount: purchase.amount, meter: purchase.meter_number
        }), { headers: CORS });
      }
      return new Response(JSON.stringify({ success: true, purchase }), { headers: CORS });
    }

    // Save token vended by browser back to DB
    if (body.action === "saveToken") {
      const sb = adminClient();
      await sb.from("electricity_purchases").update({
        status: "delivered",
        token: body.token,
        units: body.units,
      }).eq("reference", body.reference);
      return new Response(JSON.stringify({ success: true }), { headers: CORS });
    }

    return new Response(JSON.stringify({ success: false, error: "Unknown action" }), { headers: CORS });
  } catch (err) {
    console.error("[handler] error:", err);
    return new Response(JSON.stringify({ success: false, error: "Server error" }), { status: 500, headers: CORS });
  }
});
