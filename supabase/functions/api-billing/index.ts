import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ────────────────────────────────────────────────────────────────
   NEPAWatch — api-billing edge function
   Flutterwave monthly subscriptions for the data API.

   Tiers (env-tunable):
     starter  ₦1,000/mo  →   1,000 requests/day
     pro      ₦5,000/mo  →  10,000 requests/day
     scale    ₦15,000/mo →  50,000 requests/day
     business ₦30,000/mo → 200,000 requests/day

   Flow:
     action:"plans"                      → tier list for the pricing UI
     action:"initiate"  + tier + info    → FLW checkout (payment plan per tier)
     action:"status"    + tx_ref + JWT   → owner-scoped status (never returns a key)
     POST {event:…}      + verif-hash    → FLW webhook:
        charge.completed (successful)    → activate key w/ tier limit, renew +1mo
        charge.completed (failed)        → past_due + 7-day grace
        subscription.cancelled           → revoke immediately
     Every invocation also sweeps subscriptions whose 7-day grace expired.

   Secrets:
     FLW_SECRET_KEY      Flutterwave secret key (live; swap to FLWSECK_TEST-
                         for test-mode dry runs, then back to live)
     FLW_WEBHOOK_HASH    verif-hash guard (same value as FLW dashboard)
     NW_GRACE_DAYS       optional, default 7 (days before past-due keys revoke)
     NW_PRICE_* / NW_LIMIT_*   optional per-tier overrides
   ──────────────────────────────────────────────────────────────── */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FLW = "https://api.flutterwave.com/v3";
const GRACE_DAYS = Number(Deno.env.get("NW_GRACE_DAYS") ?? 7);

const TIERS: Record<string, { price: number; daily: number; label: string }> = {
  starter:  { price: Number(Deno.env.get("NW_PRICE_STARTER")  ?? 1000),   daily: Number(Deno.env.get("NW_LIMIT_STARTER")  ?? 1000),   label: "Starter"  },
  pro:      { price: Number(Deno.env.get("NW_PRICE_PRO")      ?? 5000),   daily: Number(Deno.env.get("NW_LIMIT_PRO")      ?? 10000),  label: "Pro"      },
  scale:    { price: Number(Deno.env.get("NW_PRICE_SCALE")    ?? 15000),  daily: Number(Deno.env.get("NW_LIMIT_SCALE")    ?? 50000),  label: "Scale"    },
  business: { price: Number(Deno.env.get("NW_PRICE_BUSINESS") ?? 30000),  daily: Number(Deno.env.get("NW_LIMIT_BUSINESS") ?? 200000), label: "Business" },
};

function flwHeaders(): HeadersInit {
  return {
    Authorization:  `Bearer ${Deno.env.get("FLW_SECRET_KEY") ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}
function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
function makeRef(prefix = "PRO"): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const r = crypto.randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase();
  return `${prefix}-${d}-${r}`;
}

function providerPlanId(value: unknown): string {
  if (value && typeof value === "object") {
    const plan = value as Record<string, unknown>;
    return String(plan.id ?? plan.plan_id ?? "");
  }
  return value == null ? "" : String(value);
}

const FLW_TEMPORARY_ERROR = "Flutterwave is temporarily unavailable. Please retry in a few minutes.";

async function flwJson(
  url: string,
  init: RequestInit = {},
  safeRetries = 0,
): Promise<{ response: Response; data: Record<string, any> }> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= safeRetries; attempt++) {
    try {
      const response = await fetch(url, init);
      const raw = await response.text();
      let data: Record<string, any>;
      try {
        data = JSON.parse(raw);
      } catch (_) {
        throw new Error("FLW_NON_JSON_RESPONSE");
      }

      if (response.status >= 500 && attempt < safeRetries) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
        continue;
      }
      return { response, data };
    } catch (error) {
      lastError = error;
      if (attempt < safeRetries) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
        continue;
      }
    }
  }
  console.error("api-billing: Flutterwave returned an unavailable or non-JSON response", lastError);
  throw new Error(FLW_TEMPORARY_ERROR);
}

async function authUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(token);
  return error || !user ? null : { id: user.id, email: user.email };
}

/* ── One FLW payment plan per tier, cached ──────────────────── */
const planCache: Record<string, string> = {};
async function ensurePlan(tier: string): Promise<string> {
  if (planCache[tier]) return planCache[tier];
  const t = TIERS[tier];
  const name = `NEPAWatch API ${t.label}`;

  const params = new URLSearchParams({
    amount: String(t.price), currency: "NGN", page: "1",
  });
  const { response: r, data: d } = await flwJson(
    `${FLW}/payment-plans?${params}`,
    { headers: flwHeaders() },
    2,
  );
  if (r.status === 401 || r.status === 403) {
    throw new Error("Flutterwave rejected the billing credentials. Check FLW_SECRET_KEY.");
  }
  if (d.status === "success" && Array.isArray(d.data)) {
    const matching = d.data.find((p: Record<string, unknown>) =>
      p.name === name && Number(p.amount) === t.price &&
      String(p.currency ?? "NGN").toUpperCase() === "NGN" &&
      String(p.interval ?? "").toLowerCase() === "monthly" &&
      String(p.status ?? "active").toLowerCase() === "active"
    );
    if (matching?.id) {
      planCache[tier] = String(matching.id);
      return planCache[tier];
    }
  }
  if (!r.ok || d.status !== "success" || !Array.isArray(d.data)) {
    throw new Error(d.message ?? FLW_TEMPORARY_ERROR);
  }

  const { response: c, data: cd } = await flwJson(`${FLW}/payment-plans`, {
    method:  "POST",
    headers: flwHeaders(),
    body: JSON.stringify({
      name:     name,
      amount:   t.price,
      currency: "NGN",
      interval: "monthly",
    }),
  });
  if (cd.status === "success" && cd.data?.id) {
    planCache[tier] = String(cd.data.id);
    return planCache[tier];
  }
  if (c.status === 401 || c.status === 403) {
    throw new Error("Flutterwave rejected the billing credentials. Check FLW_SECRET_KEY.");
  }
  throw new Error(cd.message ?? FLW_TEMPORARY_ERROR);
}

/* ── Extend renews_at by one month from the later of now / renews_at ── */
function nextRenewal(current: string | null | undefined): string {
  const base = current && !isNaN(new Date(current).getTime()) && new Date(current) > new Date()
    ? new Date(current)
    : new Date();
  const originalDay = base.getUTCDate();
  base.setUTCDate(1);
  base.setUTCMonth(base.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(originalDay, lastDay));
  return base.toISOString();
}

/* ── 7-day grace sweep: past_due whose grace expired → revoke ── */
async function sweepExpiredGrace() {
  try {
    const cutoff = new Date().toISOString();
    const { data } = await adminClient()
      .from("api_subscriptions")
      .select("id, api_key_id")
      .eq("status", "past_due")
      .lt("grace_ends_at", cutoff)
      .limit(50);
    for (const sub of data ?? []) {
      await adminClient().from("api_subscriptions")
        .update({ status: "cancelled" }).eq("id", sub.id);
      await adminClient().from("api_keys")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("id", sub.api_key_id)
        .eq("status", "active");
    }
    if (data?.length) console.log(`api-billing: grace sweep revoked ${data.length} subscription(s)`);
  } catch (_) {}
}

async function disablePaymentLink(link: string | null | undefined) {
  if (!link) return;
  try {
    await fetch(`${FLW}/payments/link/disable`, {
      method: "POST",
      headers: flwHeaders(),
      body: JSON.stringify({ link }),
    });
  } catch (_) {}
}

async function retirePendingCheckout(sub: { id: string; api_key_id: string; checkout_url?: string | null }) {
  await disablePaymentLink(sub.checkout_url);
  const { data: cancelled, error } = await adminClient().from("api_subscriptions")
    .update({ status: "cancelled" }).eq("id", sub.id).eq("status", "pending").select("id");
  if (error) throw error;
  if (cancelled?.length) {
    await adminClient().from("api_keys")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", sub.api_key_id).eq("status", "pending");
  }
}

/* Flutterwave closes the checkout after 30 minutes. Retire our pending record
   after one hour so a delayed webhook still has time to arrive. */
async function sweepExpiredCheckouts() {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await adminClient().from("api_subscriptions")
    .select("id, api_key_id, checkout_url").eq("status", "pending").lt("created_at", cutoff).limit(50);
  if (error) {
    if (error.code === "42703" || /checkout_url/i.test(error.message ?? "")) {
      throw new Error("BILLING_SCHEMA_INCOMPLETE");
    }
    throw error;
  }
  for (const sub of data ?? []) await retirePendingCheckout(sub);
}

/* Remove incomplete checkout records so a failed attempt does not leave a
   pending API key in the developer dashboard. Subscriptions cascade from it. */
async function cleanupPendingKey(keyId: string) {
  try {
    await adminClient().from("api_keys")
      .delete().eq("id", keyId).eq("status", "pending");
  } catch (_) {}
}

/* ══════════════════════════════════════════════════════════════ */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "Use POST" }, 405);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ success: false, error: "Invalid JSON body" }, 400);

    /* ── FLW webhook ─────────────────────────────────────────── */
    if (body.event) {
      const webhookHash = Deno.env.get("FLW_WEBHOOK_HASH");
      if (!webhookHash || req.headers.get("verif-hash") !== webhookHash) {
        return json({ success: false }, 401);
      }

      if (body.event === "charge.completed") {
        const txId  = body.data?.id as number | undefined;
        const txRef = body.data?.tx_ref as string | undefined;
        const paid  = body.data?.status === "successful";

        let confirmed = false, amount = 0, currency = "", verifiedRef = "", verifiedEmail = "", verifiedKeyId = "", verifiedPlanId = "";
        if (txId) {
          try {
            const v = await fetch(`${FLW}/transactions/${txId}/verify`, { headers: flwHeaders() });
            const vd = await v.json();
            if (vd.status === "success" && vd.data?.status === "successful") {
              confirmed = true;
              amount   = Number(vd.data.amount ?? 0);
              currency = String(vd.data.currency ?? "");
              verifiedRef = String(vd.data.tx_ref ?? "");
              verifiedEmail = String(vd.data.customer?.email ?? "").toLowerCase();
              verifiedKeyId = String(vd.data.meta?.api_key_id ?? "");
              verifiedPlanId = providerPlanId(vd.data.plan ?? vd.data.payment_plan);
            }
          } catch (_) {}
        }

        if (!paid || !confirmed || currency !== "NGN") {
          if (txRef) {
            try {
              const { data: subs } = await adminClient().from("api_subscriptions")
                .select("id, last_tx_id, grace_ends_at").eq("tx_ref", txRef).limit(1);
              const sub = subs?.[0];
              if (sub && sub.last_tx_id !== String(txId)) {
                await adminClient().from("api_subscriptions").update({
                  status:       "past_due",
                  last_tx_id:   String(txId),
                  grace_ends_at: new Date(Date.now() + GRACE_DAYS * 24 * 3600 * 1000).toISOString(),
                }).eq("id", sub.id).eq("status", "active");
              }
            } catch (_) {}
          }
          await sweepExpiredGrace();
          return json({ success: true });
        }

        /* Successful charge — amount must match the subscribed tier */
        try {
          let sub: Record<string, unknown> | null = null;
          if (txRef && txRef === verifiedRef) {
            const { data } = await adminClient().from("api_subscriptions")
              .select("*").eq("tx_ref", txRef).limit(1);
            sub = data?.[0] ?? null;
          }
          if (!sub && verifiedKeyId && txRef === verifiedRef) {
            const { data } = await adminClient().from("api_subscriptions")
              .select("*").eq("api_key_id", verifiedKeyId)
              .in("status", ["active", "past_due"]).limit(2);
            if (data?.length === 1) sub = data[0];
          }
          if (!sub && verifiedPlanId && verifiedEmail && txRef === verifiedRef) {
            const { data } = await adminClient().from("api_subscriptions")
              .select("*").eq("flw_plan_id", verifiedPlanId)
              .eq("email", verifiedEmail).in("status", ["active", "past_due"]).limit(2);
            if (data?.length === 1) sub = data[0];
          }
          if (sub) {
            const initialActivation = sub.status === "pending" ||
              (sub.status === "cancelled" && !sub.last_tx_id);
            const tier = String(sub.tier ?? "pro");
            const t = TIERS[tier];
            if (!t || txRef !== verifiedRef ||
                (initialActivation && verifiedRef !== String(sub.tx_ref)) ||
                (verifiedKeyId && verifiedKeyId !== String(sub.api_key_id)) ||
                verifiedEmail !== String(sub.email).toLowerCase() ||
                amount !== Number(sub.price) || amount !== t.price) {
              /* Mismatched or stale payment must never activate a key. */
              return json({ success: true });
            }
            const cancelledAfterActivation = sub.status === "cancelled" && !!sub.last_tx_id;
            if (!cancelledAfterActivation && sub.last_tx_id !== String(txId)) {
              const subId = body.data?.flw_sub ?? undefined;
              const allowedStatuses = initialActivation
                ? ["pending", "active", "past_due", "cancelled"]
                : ["active", "past_due"];
              const { data: activatedSubs, error: subError } = await adminClient().from("api_subscriptions").update({
                status:       "active",
                last_tx_id:   String(txId),
                renews_at:    nextRenewal(sub.renews_at as string | null),
                grace_ends_at: null,
                ...(subId ? { flw_sub_id: String(subId) } : {}),
              }).eq("id", sub.id).in("status", allowedStatuses).select("id");
              if (subError) throw subError;
              if (!activatedSubs?.length) {
                console.error("api-billing: subscription activation lost a concurrent update", sub.id);
                return json({ success: false, error: "Activation needs reconciliation" }, 409);
              }

              if (initialActivation) {
                const { data: activatedKeys, error: keyError } = await adminClient().from("api_keys")
                  .update({
                    status:      "active",
                    tier:        tier,
                    daily_limit: t.daily,
                    approved_at: new Date().toISOString(),
                    revoked_at:  null,
                  })
                  .eq("id", sub.api_key_id)
                  .in("status", ["pending", "revoked"])
                  .select("id");
                if (keyError) throw keyError;
                if (!activatedKeys?.length) {
                  await adminClient().from("api_subscriptions")
                    .update({ status: "past_due", grace_ends_at: new Date().toISOString() })
                    .eq("id", sub.id).eq("status", "active");
                  throw new Error("API key activation failed after payment confirmation");
                }
              }
            }
          }
        } catch (e) {
          console.error("api-billing: activation failed", e);
          return json({ success: false, error: "Activation failed" }, 500);
        }
        await sweepExpiredGrace();
        return json({ success: true });
      }

      if (body.event === "subscription.cancelled") {
        const subId = body.data?.id as string | undefined;
        try {
          let matches: Array<{ id: string; api_key_id: string }> = [];
          if (subId) {
            const { data, error } = await adminClient().from("api_subscriptions")
              .select("id, api_key_id").eq("flw_sub_id", String(subId)).limit(2);
            if (error) throw error;
            matches = data ?? [];
          }
          if (!matches.length) {
            const email = String(
              body.data?.customer?.email ?? body.data?.customer?.customer_email ?? "",
            ).toLowerCase();
            const planId = providerPlanId(body.data?.plan ?? body.data?.payment_plan);
            if (!email || !planId) return json({ success: false, error: "Cannot identify subscription" }, 400);
            const { data, error } = await adminClient().from("api_subscriptions")
              .select("id, api_key_id").eq("email", email)
              .eq("flw_plan_id", planId)
              .in("status", ["active", "past_due", "cancelled"]).limit(2);
            if (error) throw error;
            matches = data ?? [];
          }
          if (matches.length !== 1) return json({ success: false, error: "Subscription match is ambiguous or missing" }, 409);
          const sub = matches[0];
          if (sub) {
            const { error: subError } = await adminClient().from("api_subscriptions")
              .update({ status: "cancelled" }).eq("id", sub.id);
            if (subError) throw subError;
            const { error: keyError } = await adminClient().from("api_keys")
              .update({ status: "revoked", revoked_at: new Date().toISOString() })
              .eq("id", sub.api_key_id);
            if (keyError) throw keyError;
          }
        } catch (e) {
          console.error("api-billing: subscription cancellation failed", e);
          return json({ success: false, error: "Cancellation needs reconciliation" }, 500);
        }
        await sweepExpiredGrace();
        return json({ success: true });
      }

      await sweepExpiredGrace();
      return json({ success: true });
    }

    /* ── Tier list for the pricing UI ───────────────────────── */
    if (body.action === "plans") {
      return json({
        success:  true,
        currency: "NGN",
        interval: "monthly",
        graceDays: GRACE_DAYS,
        tiers: Object.entries(TIERS).map(([id, t]) => ({
          id, label: t.label, price: t.price, dailyLimit: t.daily,
        })),
      });
    }

    const user = await authUser(req);
    if (!user) return json({ success: false, error: "Sign in required" }, 401);
    const ownerId = user.id;
    await sweepExpiredCheckouts();

    /* ── Abandon an unpaid checkout ─────────────────────────── */
    if (body.action === "abandon" && body.tx_ref) {
      const { data, error } = await adminClient().from("api_subscriptions")
        .select("id, api_key_id, checkout_url, api_keys!inner(user_id)")
        .eq("tx_ref", String(body.tx_ref))
        .eq("status", "pending")
        .eq("api_keys.user_id", ownerId)
        .limit(1);
      if (error) return json({ success: false, error: "Could not cancel checkout" }, 500);
      if (data?.[0]) await retirePendingCheckout(data[0]);
      return json({ success: true });
    }

    /* ── Initiate subscription checkout ─────────────────────── */
    if (body.action === "initiate") {
      const name    = String(body.developer_name ?? "").trim();
      const email   = String(body.email ?? "").trim().toLowerCase();
      const app     = String(body.app_name ?? "").trim();
      const useCase = String(body.use_case ?? "").trim();
      const tierId  = String(body.tier ?? "pro");
      const t       = TIERS[tierId];
      if (!t) return json({ success: false, error: "Unknown tier" });
      if (!name || !email.includes("@") || !useCase) {
        return json({ success: false, error: "Name, email and use case are required" });
      }

      let planId: string;
      try { planId = await ensurePlan(tierId); }
      catch (e) {
        const message = e instanceof Error ? e.message : FLW_TEMPORARY_ERROR;
        const status = message === FLW_TEMPORARY_ERROR ? 503 : 500;
        return json({ success: false, error: message }, status);
      }

      /* If the buyer is signed in (developer dashboard), link the pending
         key to their account immediately — uid comes from the verified JWT,
         never from the client payload. */
      if (user.email?.toLowerCase() !== email) {
        return json({ success: false, error: "Billing email must match your signed-in account" }, 403);
      }
      const { data: paidKeys, error: paidErr } = await adminClient().from("api_keys")
        .select("id").eq("user_id", ownerId).eq("status", "active")
        .in("tier", ["starter", "pro", "scale", "business"]).limit(1);
      if (paidErr) return json({ success: false, error: "Could not check existing plan" }, 500);
      if (paidKeys?.length) return json({ success: false, error: "An active paid plan already exists. Contact support before starting another subscription." }, 409);

      const { data: pending, error: pendingErr } = await adminClient().from("api_subscriptions")
        .select("id, api_keys!inner(user_id)")
        .eq("status", "pending")
        .eq("api_keys.user_id", ownerId)
        .limit(1);
      if (pendingErr) return json({ success: false, error: "Could not check pending checkout" }, 500);
      if (pending?.length) {
        return json({ success: false, error: "A checkout is already pending. Cancel it from the dashboard or wait for it to expire before trying again." }, 409);
      }

      const { data: keyRows, error: keyErr } = await adminClient()
        .from("api_keys").insert({
          developer_name: name,
          email,
          app_name:       app || null,
          use_case:       `[${tierId.toUpperCase()}] ${useCase}`,
          status:         "pending",
          tier:           tierId,
          user_id: ownerId,
        }).select("id");
      if (keyErr || !keyRows?.[0]) {
        return json({ success: false, error: keyErr?.message ?? "Could not create key" });
      }
      const keyId = String(keyRows[0].id);

      const txRef = makeRef("PRO");
      const { error: subErr } = await adminClient()
        .from("api_subscriptions").insert({
          api_key_id: keyId, email, tier: tierId, tx_ref: txRef, price: t.price, flw_plan_id: planId,
        });
      if (subErr) {
        await cleanupPendingKey(keyId);
        return json({ success: false, error: subErr.message });
      }

      const origin = Deno.env.get("NW_PUBLIC_ORIGIN") ?? "https://nepawatch.app";
      if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) {
        await cleanupPendingKey(keyId);
        return json({ success: false, error: "Invalid public site configuration" }, 500);
      }
      let flw: Record<string, any>;
      try {
        const result = await flwJson(`${FLW}/payments`, {
          method:  "POST",
          headers: flwHeaders(),
          body: JSON.stringify({
            tx_ref:       txRef,
            amount:       t.price,
            currency:     "NGN",
            redirect_url: `${origin}/developer.html`,
            payment_plan: planId,
            configurations: { session_duration: 30, max_retry_attempt: 5 },
            customer:     { email, name },
            customizations: {
              title:       `NEPAWatch API — ${t.label}`,
              description: `${t.daily.toLocaleString()} requests/day`,
              logo:        `${origin}/logo2.jpg`,
            },
            meta: { api_key_id: keyId, email, tier: tierId },
          }),
        });
        flw = result.data;
      } catch (error) {
        await cleanupPendingKey(keyId);
        return json({
          success: false,
          error: error instanceof Error ? error.message : FLW_TEMPORARY_ERROR,
        }, 503);
      }
      if (flw.status !== "success" || !flw.data?.link) {
        await cleanupPendingKey(keyId);
        return json({ success: false, error: `Flutterwave init failed: ${flw.message ?? "unknown"}` });
      }

      const checkoutUrl = String(flw.data.link);
      const checkoutExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { error: checkoutErr } = await adminClient().from("api_subscriptions").update({
        checkout_url: checkoutUrl,
        checkout_expires_at: checkoutExpiresAt,
      }).eq("tx_ref", txRef).eq("status", "pending");
      if (checkoutErr) {
        await disablePaymentLink(checkoutUrl);
        await cleanupPendingKey(keyId);
        return json({ success: false, error: "Could not save checkout session. Please try again." }, 500);
      }

      return json({
        success:     true,
        checkoutUrl,
        tx_ref:      txRef,
        price:       t.price,
        tier:        tierId,
      });
    }

    /* ── Cancel an active recurring subscription ────────────── */
    if (body.action === "cancel" && body.api_key_id) {
      const { data, error } = await adminClient().from("api_subscriptions")
        .select("id, api_key_id, email, price, flw_plan_id, flw_sub_id, api_keys!inner(user_id)")
        .eq("api_key_id", String(body.api_key_id))
        .eq("api_keys.user_id", ownerId)
        .in("status", ["active", "past_due"])
        .limit(2);
      if (error) return json({ success: false, error: "Could not load subscription" }, 500);
      if (data?.length !== 1) return json({ success: false, error: "Active subscription not found" }, 404);
      const sub = data[0];

      let providerSubId = String(sub.flw_sub_id ?? "");
      if (providerSubId && !/^\d+$/.test(providerSubId)) providerSubId = "";
      if (!providerSubId) {
        const params = new URLSearchParams({
          email: String(sub.email), plan: String(sub.flw_plan_id), status: "active", page: "1",
        });
        const response = await fetch(`${FLW}/subscriptions?${params}`, { headers: flwHeaders() });
        const result = await response.json();
        const matches = Array.isArray(result.data) ? result.data.filter((candidate: Record<string, any>) => {
          const candidateEmail = String(candidate.customer?.customer_email ?? candidate.customer?.email ?? "").toLowerCase();
          return candidateEmail === String(sub.email).toLowerCase() &&
            providerPlanId(candidate.plan ?? candidate.payment_plan) === String(sub.flw_plan_id) &&
            Number(candidate.amount) === Number(sub.price) &&
            String(candidate.status).toLowerCase() === "active";
        }) : [];
        if (matches.length !== 1) {
          return json({ success: false, error: "Could not identify one Flutterwave subscription. Contact support before retrying." }, 409);
        }
        providerSubId = String(matches[0].id);
      }

      const cancelResponse = await fetch(`${FLW}/subscriptions/${encodeURIComponent(providerSubId)}/cancel`, {
        method: "PUT",
        headers: flwHeaders(),
      });
      const cancelled = await cancelResponse.json();
      if (!cancelResponse.ok || cancelled.status !== "success") {
        return json({ success: false, error: cancelled.message ?? "Flutterwave could not cancel the subscription" }, 502);
      }

      const { error: updateError } = await adminClient().from("api_subscriptions").update({
        status: "cancelled", flw_sub_id: providerSubId,
      }).eq("id", sub.id).in("status", ["active", "past_due"]);
      if (updateError) return json({ success: false, error: "Subscription was cancelled at Flutterwave but local status needs reconciliation" }, 500);
      await adminClient().from("api_keys").update({
        status: "revoked", revoked_at: new Date().toISOString(),
      }).eq("id", sub.api_key_id);
      return json({ success: true });
    }

    /* ── Subscription status (frontend polls after redirect) ── */
    if (body.action === "status" && body.tx_ref) {
      await sweepExpiredGrace();
      const { data, error } = await adminClient()
        .from("api_subscriptions")
        .select("status, tier, renews_at, price, grace_ends_at, api_keys!inner(user_id, status, daily_limit)")
        .eq("tx_ref", String(body.tx_ref))
        .eq("api_keys.user_id", ownerId)
        .limit(1);
      if (error) return json({ success: false, error: error.message });
      const sub = data?.[0];
      if (!sub) return json({ success: false, error: "Subscription not found" });
      return json({
        success:    true,
        status:     sub.status,
        tier:       sub.tier,
        renewsAt:   sub.renews_at,
        price:      sub.price,
        graceEndsAt: sub.grace_ends_at,
        keyStatus:  (sub.api_keys as { status?: string } | null)?.status ?? null,
        dailyLimit: (sub.api_keys as { daily_limit?: number } | null)?.daily_limit ?? null,
      });
    }

    return json({ success: false, error: "Unknown action" });

  } catch (err) {
    console.error("api-billing:", err);
    if (err instanceof Error && err.message === "BILLING_SCHEMA_INCOMPLETE") {
      return json({
        success: false,
        code: "BILLING_SCHEMA_INCOMPLETE",
        error: "Billing database setup is incomplete. Run api-security-hotfix.sql in Supabase SQL Editor, then retry.",
      }, 503);
    }
    return json({ success: false, error: "Internal server error" }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
