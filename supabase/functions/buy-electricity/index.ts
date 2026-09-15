import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ────────────────────────────────────────────────────────────────
   NEPAWatch — buy-electricity edge function
   Flutterwave COLLECTS (Starter account: collection + withdrawal OK,
   Bills API blocked for unregistered accounts) and PAIRGATE FULFILLS
   (meter verify + token vending + async token webhook).

   Flow:
     action:"billers"                        → live Pairgate electricity providers
     action:"detect"   + number              → auto-detect DISCO + meter type
     action:"verify"   + provider/number/type→ Pairgate meter verification
     action:"initiate" + billing details      → FLW payment link
     action:"verify"   + transaction_id/tx_ref→ confirm payment, vend via Pairgate
     POST {event:…}     + verif-hash         → Flutterwave webhook (same path)
     POST x-pairgate-signature               → Pairgate webhook (HMAC-checked):
                                                electricity.purchase delivers the token

   Secrets required:
     FLW_SECRET_KEY             Flutterwave collection
     FLW_WEBHOOK_HASH           verif-hash guard for the FLW webhook
     PAIRGATE_SECRET_KEY        Pairgate API key
     PAIRGATE_WEBHOOK_SECRET    Pairgate webhook HMAC secret (optional but
                                recommended — unverified webhooks are ignored)
     NW_FEE_PCT / NW_FEE_CAP / NW_FEE_MIN   service fee formula
     NW_MAX_SINGLE_TX / NW_DAILY_LIMIT      FLW Starter collection limits

   Notes:
     - Pairgate's electricity minimum is ₦1,000 per purchase.
     - Prepaid tokens arrive asynchronously: either the Pairgate webhook
       (field `pin`) or polling GET /transaction/status?reference_code=…
     - Postpaid has no token — a successful status means the meter is credited.
   ──────────────────────────────────────────────────────────────── */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pairgate-timestamp, x-pairgate-signature",
};

const FLW = "https://api.flutterwave.com/v3";
const PG  = "https://pairgate.com/api/v1";

/* ── Service fee: 3% of the units, capped at ₦500 ───────────── */
const FEE_PCT = Number(Deno.env.get("NW_FEE_PCT") ?? 3);
const FEE_CAP = Number(Deno.env.get("NW_FEE_CAP") ?? 500);
const FEE_MIN = Number(Deno.env.get("NW_FEE_MIN") ?? 0);

function serviceFeeFor(amount: number): number {
  return Math.min(Math.max((FEE_PCT / 100) * amount, FEE_MIN), FEE_CAP);
}

/* ── FLW Starter collection limits ──────────────────────────── */
const MAX_SINGLE_TX = Number(Deno.env.get("NW_MAX_SINGLE_TX") ?? 500000);
const DAILY_LIMIT   = Number(Deno.env.get("NW_DAILY_LIMIT")   ?? 500000);

/* Pairgate electricity floor */
const PG_MIN_AMOUNT = 1000;

/* ── DISCO slugs: ours → Pairgate ───────────────────────────── */
const DISCO_NAMES: Record<string, string> = {
  "ikeja-electric":  "IKEDC",
  "eko-electric":    "EKEDC",
  "abuja-electric":  "AEDC",
  "ibadan-electric": "IBEDC",
  "enugu-electric":  "EEDC",
  "phed":            "PHED",
  "kaduna-electric": "KAEDCO",
  "kano-electric":   "KEDCO",
  "benin-electric":  "BEDC",
  "jos-electric":    "JED",
  "yola-electric":   "YEDC",
  "aba-electric":    "ABA",
};

/* Pairgate's provider slugs (their docs table). Used live via
   /providers/electricity, with this as a degraded fallback. */
const PG_SLUGS: Record<string, string> = {
  "ikeja-electric":  "ikedc",
  "eko-electric":    "eko",
  "abuja-electric":  "aedc",
  "ibadan-electric": "ibedc",
  "enugu-electric":  "enugu",
  "phed":            "ph",
  "kaduna-electric": "kaduna",
  "kano-electric":   "kedco",
  "benin-electric":  "benin",
  "jos-electric":    "jedc",
  "yola-electric":   "yola",
  "aba-electric":    "aba",
};
const PG_TO_OURS: Record<string, string> = Object.fromEntries(
  Object.entries(PG_SLUGS).map(([ours, pg]) => [pg, ours]),
);

let discoCache: { at: number; slugs: Array<{ ours: string; pg: string; name: string }> } | null = null;
let providersFromFallback = false;
const PROVIDERS_TTL_MS = 10 * 60 * 1000;

/* Live electricity providers on THIS Pairgate account */
async function getElectricityProviders(): Promise<Array<{ ours: string; pg: string; name: string }>> {
  if (discoCache && Date.now() - discoCache.at < PROVIDERS_TTL_MS) return discoCache.slugs;
  try {
    const r = await fetch(`${PG}/providers/electricity`, {
      headers: { ...pgHeaders(), "Cache-Control": "no-cache" },
    });
    const d = await r.json();
    if (d.code === 200 && d.status === "success" && Array.isArray(d.data)) {
      const slugs = (d.data as Array<Record<string, unknown>>)
        .map((p) => ({
          pg:   String(p.slug ?? "").toLowerCase(),
          name: String(p.name ?? ""),
        }))
        .filter((p) => PG_TO_OURS[p.pg])
        .map((p) => ({ ours: PG_TO_OURS[p.pg], pg: p.pg, name: DISCO_NAMES[PG_TO_OURS[p.pg]] }));
      if (slugs.length) {
        discoCache = { at: Date.now(), slugs };
        providersFromFallback = false;
        return slugs;
      }
    }
    console.error("buy-electricity: live providers unavailable — using snapshot", d.message ?? "");
  } catch (e) {
    console.error("buy-electricity: providers fetch failed — using snapshot", e);
  }
  providersFromFallback = true;
  return Object.entries(PG_SLUGS).map(([ours, pg]) => ({ ours, pg, name: DISCO_NAMES[ours] }));
}

/* ── Clients ────────────────────────────────────────────────── */
function flwHeaders(): HeadersInit {
  return {
    Authorization:  `Bearer ${Deno.env.get("FLW_SECRET_KEY") ?? ""}`,
    "Content-Type": "application/json",
  };
}
function pgHeaders(): HeadersInit {
  return {
    Authorization:  `Bearer ${Deno.env.get("PAIRGATE_SECRET_KEY") ?? ""}`,
    "Content-Type": "application/json",
  };
}
function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function makeRef(prefix = "NW"): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const r = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${d}-${r}`;
}

/* ── HMAC-SHA256 hex (Pairgate webhook verification) ────────── */
async function hmacHex(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ── Pairgate: verify meter ─────────────────────────────────── */
async function pgVerifyMeter(pgSlug: string, number: string, type: string):
  Promise<{ ok: boolean; name?: string; error?: string }> {
  const r = await fetch(`${PG}/electricity/verify`, {
    method:  "POST",
    headers: pgHeaders(),
    body: JSON.stringify({
      provider_id: pgSlug,
      meter_number: number,
      meter_type:  type === "postpaid" ? 2 : 1,
    }),
  });
  const d = await r.json();
  if (d.code === 200 && d.data?.status === true) {
    return { ok: true, name: (d.data.customer_name as string) || "Customer" };
  }
  return { ok: false, error: d.message ?? "Meter not found — check the number and DISCO" };
}

/* ── Pairgate: vend (token arrives async) ───────────────────── */
async function pgVend(
  pgSlug: string, number: string, type: string, amount: number, customerName: string, ref: string,
): Promise<{ ok: boolean; pairgateRef?: string; error?: string }> {
  const r = await fetch(`${PG}/electricity/purchase`, {
    method:  "POST",
    headers: pgHeaders(),
    body: JSON.stringify({
      provider_id:    pgSlug,
      amount,
      meter_number:   number,
      meter_type:     type === "postpaid" ? 2 : 1,
      recipient_name: customerName || "Unknown Customer",
      reference:      ref,
    }),
  });
  const d = await r.json();
  if (d.code === 200 && d.data?.status === true) {
    return { ok: true, pairgateRef: (d.data.reference_code as string) || "" };
  }
  return { ok: false, error: d.message ?? d.data?.message ?? "Pairgate electricity purchase failed" };
}

/* ── Pairgate: poll final status (token lives in `pin`) ─────── */
async function pgStatus(pairgateRef: string):
  Promise<{ status: string; pin?: string; message?: string }> {
  const r = await fetch(`${PG}/transaction/status?reference_code=${encodeURIComponent(pairgateRef)}`, {
    headers: { ...pgHeaders(), "Cache-Control": "no-cache" },
  });
  const d = await r.json();
  const dd = d.data as Record<string, unknown> | undefined;
  return {
    status:  (dd?.status as string) ?? "unknown",
    pin:     (dd?.pin as string) || (dd?.token as string) || (dd?.extra as string) || (dd?.meter_token as string) || undefined,
    message: d.message as string | undefined,
  };
}

/* ══════════════════════════════════════════════════════════════ */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  /* ── Pairgate webhook: HMAC-verified, delivers the token ──── */
  const pgSig = req.headers.get("x-pairgate-signature");
  const pgTs  = req.headers.get("x-pairgate-timestamp");
  if (pgSig && pgTs) {
    const secret = Deno.env.get("PAIRGATE_WEBHOOK_SECRET") ?? "";
    const raw    = await req.text();
    if (!secret) {
      console.error("buy-electricity: Pairgate webhook received but PAIRGATE_WEBHOOK_SECRET is not set — ignored");
      return json({ ok: false }, 400);
    }
    const expected = await hmacHex(secret, `${pgTs}.${raw}`);
    if (expected !== pgSig) return json({ ok: false }, 401);

    const p = JSON.parse(raw) as Record<string, unknown>;
    console.log("buy-electricity: pairgate webhook", p.event, p.status);
    if (p.event === "electricity.purchase") {
      const refCode = p.reference_code as string | undefined;
      const ref     = p.reference     as string | undefined;
      try {
        if (refCode || ref) {
          const { data: rows } = await adminClient()
            .from("electricity_transactions").select("meter_type, status")
            .or(ref ? `reference.eq.${ref}` : `bill_ref.eq.${refCode}`)
            .limit(1);
          const row = rows?.[0];
          if (row) {
            const isPostpaid = row.meter_type === "postpaid";
            if (p.status === "successful" && (p.pin || isPostpaid)) {
              const updates: Record<string, unknown> = { status: "success" };
              if (p.pin) updates.token = p.pin as string;
              let q = adminClient().from("electricity_transactions").update(updates);
              if (ref) q = q.eq("reference", ref);
              else q = q.eq("bill_ref", refCode as string);
              await q;
            } else if (p.status === "failed") {
              let q = adminClient().from("electricity_transactions").update({
                status: "failed",
                error:  (p.message as string) ?? "Pairgate failed the electricity purchase",
              });
              if (ref) q = q.eq("reference", ref);
              else q = q.eq("bill_ref", refCode as string);
              await q;
            }
          }
        }
      } catch (_) {}
    }
    return new Response("ok", { status: 200 });
  }

  try {
    const body   = await req.json();
    const action = body.action;

    /* ── 0. Live biller/provider list (health check) ─────────── */
    if (action === "billers") {
      const providers = await getElectricityProviders();
      return json({
        success: true,
        usingFallback: providersFromFallback,
        providers: providers.map((p) => ({ slug: p.ours, pairgate: p.pg, name: p.name })),
        minimum: PG_MIN_AMOUNT,
      });
    }

    /* ── 0b. Auto-detect DISCO + meter type from the number ──── */
    if (action === "detect" && body.number) {
      const num = String(body.number).replace(/\D/g, "");
      if (num.length < 10) return json({ success: false, error: "Enter the full meter number" });

      try {
        const { data } = await adminClient()
          .from("meter_disco_cache").select("*").eq("meter_number", num).single();
        if (data?.provider) {
          const providers = await getElectricityProviders();
          const prov = providers.find((p) => p.ours === data.provider);
          if (prov) {
            return json({
              success:   true,
              provider:  data.provider,
              discoName: prov.name,
              type:      data.meter_type ?? "prepaid",
              cached:    true,
              minimum:   PG_MIN_AMOUNT,
              maximum:   500000,
              feePct:    FEE_PCT, feeCap: FEE_CAP, feeMin: FEE_MIN,
            });
          }
        }
      } catch (_) {}

      const hint = String(body.hint ?? "");
      const providers = await getElectricityProviders();
      /* Try the customer's last-known DISCO first — repeat purchases
         resolve instantly instead of re-scanning every provider. */
      const ordered = hint
        ? [...providers.filter((p) => p.ours === hint || p.pg === hint),
           ...providers.filter((p) => p.ours !== hint && p.pg !== hint)]
        : providers;
      for (const t of ["prepaid", "postpaid"]) {
        for (const prov of ordered) {
          try {
            const v = await pgVerifyMeter(prov.pg, num, t);
            if (v.ok) {
              try {
                await adminClient().from("meter_disco_cache").upsert(
                  { meter_number: num, provider: prov.ours, meter_type: t },
                  { onConflict: "meter_number" },
                );
              } catch (_) {}
              return json({
                success:      true,
                provider:     prov.ours,
                discoName:    prov.name,
                type:         t,
                customerName: v.name,
                minimum:      PG_MIN_AMOUNT,
                maximum:      500000,
                feePct:       FEE_PCT, feeCap: FEE_CAP, feeMin: FEE_MIN,
              });
            }
          } catch (_) { /* try the next provider */ }
        }
      }
      return json({ success: false, error: "Meter not recognised — select your DISCO and try again" });
    }

    /* ── 1. Meter verification via Pairgate ─────────────────── */
    if (action === "verify" && body.provider && !body.transaction_id && !body.tx_ref) {
      const providers = await getElectricityProviders();
      const prov = providers.find((p) => p.ours === body.provider);
      if (!prov) return json({ success: false, error: "Unknown DISCO" });

      const v = await pgVerifyMeter(prov.pg, String(body.number), body.type === "postpaid" ? "postpaid" : "prepaid");
      if (v.ok) {
        return json({
          success:      true,
          customerName: v.name,
          minimum:      PG_MIN_AMOUNT,
          maximum:      500000,
          feePct:       FEE_PCT,
          feeCap:       FEE_CAP,
          feeMin:       FEE_MIN,
        });
      }
      return json({ success: false, error: v.error });
    }

    /* ── 2. Initiate Flutterwave payment ─────────────────────── */
    if (action === "initiate") {
      const { provider, number, type, amount, email, customerName } = body;

      const providers = await getElectricityProviders();
      const prov = providers.find((p) => p.ours === provider);
      if (!prov) return json({ success: false, error: "Unknown DISCO" });

      if (!email || !number || !amount || amount < PG_MIN_AMOUNT) {
        return json({ success: false, error: `Minimum purchase is ₦${PG_MIN_AMOUNT.toLocaleString()}` });
      }

      const units = Number(amount);
      const fee   = serviceFeeFor(units);
      const total = units + fee;

      if (total > MAX_SINGLE_TX) {
        return json({
          success: false,
          error: `Amount exceeds the ₦${MAX_SINGLE_TX.toLocaleString()} transaction limit — contact support`,
        });
      }

      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data: todayRows } = await adminClient()
          .from("electricity_transactions")
          .select("total_paid")
          .in("status", ["success", "pending_bill"])
          .gte("created_at", `${today}T00:00:00Z`)
          .lt("created_at",  `${today}T23:59:59Z`);
        const collected = (todayRows ?? []).reduce((sum, r) => sum + Number(r.total_paid ?? 0), 0);
        if (collected + total > DAILY_LIMIT) {
          return json({
            success: false,
            error: `Daily payment limit reached (₦${collected.toLocaleString()} of ₦${DAILY_LIMIT.toLocaleString()} collected today). Try again tomorrow.`,
          });
        }
      } catch (_) {}

      const txRef    = makeRef("NW");
      const origin   = req.headers.get("origin") ?? "https://nepawatch.app";
      const redirect = `${origin}/topup.html`;

      const flwRes = await fetch(`${FLW}/payments`, {
        method:  "POST",
        headers: flwHeaders(),
        body: JSON.stringify({
          tx_ref:       txRef,
          amount:       total,
          currency:     "NGN",
          redirect_url: redirect,
          customer:     { email, name: customerName ?? email },
          customizations: {
            title:       `${prov.name} Electricity`,
            description: `${type === "postpaid" ? "Postpaid bill" : "Prepaid token"} for meter ${number}`,
            logo:        `${origin}/logo2.jpg`,
          },
          meta: { provider, number, type, customerName: customerName ?? "", units, fee },
        }),
      });
      const flw = await flwRes.json();
      if (flw.status !== "success") {
        return json({
          success: false,
          error: `Flutterwave payment init failed: ${flw.message ?? "unknown error"} — check FLW_SECRET_KEY is the LIVE key (FLWSECK-…)`,
        });
      }

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
      } catch (_) {}

      return json({
        success:     true,
        checkoutUrl: flw.data.link,
        tx_ref:      txRef,
        units, fee, total,
      });
    }

    /* ── 3. Verify payment + vend (redirect polling) ─────────── */
    if (action === "verify" && (body.transaction_id || body.tx_ref)) {
      return verifyAndVend(
        body.transaction_id as string | undefined,
        body.tx_ref         as string | undefined,
      );
    }

    /* ── 4. Flutterwave webhook ──────────────────────────────── */
    if (body.event) {
      if (req.headers.get("verif-hash") !== (Deno.env.get("FLW_WEBHOOK_HASH") ?? "")) {
        return json({ success: false }, 401);
      }
      if (body.event === "charge.completed" && body.data?.status === "successful") {
        const res = await verifyAndVend(
          body.data?.id ? String(body.data.id) : undefined,
          body.data?.tx_ref as string | undefined,
        );
        if (res.status !== 200) return res;
        const parsed = await res.clone().json();
        return parsed.success === true ? res : json({ success: false }, 503);
      }
      return json({ success: true });
    }

    return json({ success: false, error: "Unknown action" });

  } catch (err) {
    console.error("buy-electricity:", err);
    return json({ success: false, error: "Internal server error" }, 500);
  }
});

/* ── Confirm FLW payment → vend via Pairgate → report state ───
   The DB row is the idempotency ledger: duplicate polls/webhooks find
   the cached row and never vend twice. */
async function verifyAndVend(transactionId?: string, payTxRef?: string): Promise<Response> {
  let cached: Record<string, unknown> | null = null;
  try {
    if (payTxRef) {
      const { data } = await adminClient()
        .from("electricity_transactions").select("*").eq("reference", payTxRef).single();
      cached = data;
    }
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
    return json({ success: false, fatal: true, error: cached.error ?? "Transaction failed — contact support" });
  }

  /* Step A: confirm the customer actually paid */
  let payConfirmed = false;
  let payMeta: Record<string, unknown> = {};
  let paidTotal = 0;
  let payEmail  = "";

  if (transactionId) {
    const r = await fetch(`${FLW}/transactions/${transactionId}/verify`, { headers: flwHeaders() });
    const d = await r.json();
    if (d.status === "success" && d.data?.status === "successful") {
      if (d.data.currency !== "NGN") {
        return json({ success: false, fatal: true, error: "Payment currency mismatch — contact support" });
      }
      payConfirmed = true;
      payMeta   = (d.data.meta as Record<string, unknown>) ?? {};
      paidTotal = Number(d.data.amount ?? 0);
      payEmail  = (d.data.customer as Record<string, unknown>)?.email as string ?? "";
    }
  }
  if (!payConfirmed && payTxRef) {
    const r = await fetch(`${FLW}/transactions?tx_ref=${encodeURIComponent(payTxRef)}`, { headers: flwHeaders() });
    const d  = await r.json();
    const tx = d.data?.[0];
    if (d.status === "success" && tx?.status === "successful") {
      if (tx.currency !== "NGN") {
        return json({ success: false, fatal: true, error: "Payment currency mismatch — contact support" });
      }
      payConfirmed = true;
      payMeta   = (tx.meta as Record<string, unknown>) ?? {};
      paidTotal = Number(tx.amount ?? 0);
      payEmail  = (tx.customer as Record<string, unknown>)?.email as string ?? "";
    }
  }
  if (!payConfirmed) return json({ success: false });

  /* Step B: what actually goes to the meter */
  const provider = (payMeta.provider ?? cached?.provider) as string;
  const number   = (payMeta.number   ?? cached?.meter_number) as string;
  const type     = (payMeta.type     ?? cached?.meter_type ?? "prepaid") as string;
  const email    = payEmail || (cached?.email as string) || "";

  const fee   = Number(payMeta.fee ?? cached?.service_fee ?? serviceFeeFor(paidTotal));
  const units = Number(payMeta.units ?? cached?.amount ?? Math.max(0, paidTotal - fee));

  const expectedTotal = Number(cached?.total_paid ?? units + fee);
  if (paidTotal < expectedTotal - 5) {
    return json({ success: false, fatal: true, error: "Payment amount mismatch — contact support" });
  }

  const providers = await getElectricityProviders();
  const prov = providers.find((p) => p.ours === provider);
  if (!prov) return json({ success: false, fatal: true, error: "Invalid DISCO" });
  if (units < PG_MIN_AMOUNT) {
    return json({ success: false, fatal: true, error: `Minimum purchase is ₦${PG_MIN_AMOUNT.toLocaleString()}` });
  }

  /* Step C: vend via Pairgate (once). bill_ref stores Pairgate's reference_code */
  let pgRef = (cached?.bill_ref as string) || "";
  if (cached?.status !== "pending_bill" || !pgRef) {
    const vend = await pgVend(prov.pg, number, type, units, email, payTxRef ?? makeRef("NW"));
    if (!vend.ok) {
      try {
        await adminClient().from("electricity_transactions").upsert(
          { reference: payTxRef ?? pgRef, status: "failed", error: vend.error,
            provider, meter_number: number, meter_type: type,
            amount: units, service_fee: fee, total_paid: paidTotal, email },
          { onConflict: "reference" },
        );
      } catch (_) {}
      return json({ success: false, fatal: true, error: vend.error });
    }
    pgRef = vend.pairgateRef ?? "";
    try {
      await adminClient().from("electricity_transactions").upsert(
        { reference: payTxRef ?? pgRef, bill_ref: pgRef, status: "pending_bill",
          provider, meter_number: number, meter_type: type,
          amount: units, service_fee: fee, total_paid: paidTotal, email },
        { onConflict: "reference" },
      );
    } catch (_) {}
  }

  /* Step D: poll Pairgate until the token (prepaid) or credit (postpaid) lands */
  if (pgRef) {
    const st = await pgStatus(pgRef);
    if (st.status === "successful") {
      const token = st.pin ?? "";
      if (!token && type !== "postpaid") {
        /* Pairgate delivers prepaid tokens ONLY via its webhook — the
           status endpoint confirms success but not the token. Stay in
           pending_bill and let the webhook (or the customer's next poll
           after the webhook lands) fill the token in. Never show an
           empty "Token Ready" for real money. */
        return json({ success: false, waitingToken: true });
      }
      try {
        await adminClient().from("electricity_transactions").upsert(
          { reference: payTxRef ?? pgRef, bill_ref: pgRef, status: "success",
            token, units: "",
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
    if (st.status === "failed") {
      const msg = st.message ?? "Pairgate failed the electricity purchase";
      try {
        await adminClient().from("electricity_transactions").upsert(
          { reference: payTxRef ?? pgRef, bill_ref: pgRef, status: "failed", error: msg },
          { onConflict: "reference" },
        );
      } catch (_) {}
      return json({ success: false, fatal: true, error: msg });
    }
  }

  return json({ success: false }); // still processing — frontend retries
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
