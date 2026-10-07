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
     action:"status"    + tx_ref         → key/status for the frontend poll
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
  const r = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${d}-${r}`;
}

/* ── One FLW payment plan per tier, cached ──────────────────── */
const planCache: Record<string, string> = {};
async function ensurePlan(tier: string): Promise<string> {
  if (planCache[tier]) return planCache[tier];
  const t = TIERS[tier];
  const name = `NEPAWatch API ${t.label}`;

  const r = await fetch(`${FLW}/payment-plans?name=${encodeURIComponent(name)}`, { headers: flwHeaders() });
  const d = await r.json();
  if (d.status === "success" && d.data?.[0]?.id) {
    planCache[tier] = String(d.data[0].id);
    return planCache[tier];
  }

  const c = await fetch(`${FLW}/payment-plans`, {
    method:  "POST",
    headers: flwHeaders(),
    body: JSON.stringify({
      name:     name,
      amount:   t.price,
      currency: "NGN",
      interval: "monthly",
      duration: 0,          // charges until cancelled
    }),
  });
  const cd = await c.json();
  if (cd.status === "success" && cd.data?.id) {
    planCache[tier] = String(cd.data.id);
    return planCache[tier];
  }
  throw new Error(cd.message ?? "Could not create the payment plan");
}

/* ── Extend renews_at by one month from the later of now / renews_at ── */
function nextRenewal(current: string | null | undefined): string {
  const base = current && !isNaN(new Date(current).getTime()) && new Date(current) > new Date()
    ? new Date(current)
    : new Date();
  return new Date(base.getTime() + 30 * 24 * 3600 * 1000).toISOString();
}

/* ── 7-day grace sweep: past_due whose grace expired → revoke ── */
async function sweepExpiredGrace() {
  try {
    const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 3600 * 1000).toISOString();
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

  try {
    const body = await req.json();

    /* ── FLW webhook ─────────────────────────────────────────── */
    if (body.event) {
      if (req.headers.get("verif-hash") !== (Deno.env.get("FLW_WEBHOOK_HASH") ?? "")) {
        return json({ success: false }, 401);
      }

      if (body.event === "charge.completed") {
        const txId  = body.data?.id as number | undefined;
        const txRef = body.data?.tx_ref as string | undefined;
        const meta  = (body.data?.meta as Record<string, unknown>) ?? {};
        const paid  = body.data?.status === "successful";

        let confirmed = false, amount = 0, currency = "";
        if (txId) {
          try {
            const v = await fetch(`${FLW}/transactions/${txId}/verify`, { headers: flwHeaders() });
            const vd = await v.json();
            if (vd.status === "success" && vd.data?.status === "successful") {
              confirmed = true;
              amount   = Number(vd.data.amount ?? 0);
              currency = String(vd.data.currency ?? "");
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
                }).eq("id", sub.id);
              }
            } catch (_) {}
          }
          await sweepExpiredGrace();
          return json({ success: true });
        }

        /* Successful charge — amount must match the subscribed tier */
        const keyId = (meta.api_key_id as string) || "";
        try {
          let sub: Record<string, unknown> | null = null;
          if (txRef) {
            const { data } = await adminClient().from("api_subscriptions")
              .select("*").eq("tx_ref", txRef).limit(1);
            sub = data?.[0] ?? null;
          }
          if (!sub && keyId) {
            const { data } = await adminClient().from("api_subscriptions")
              .select("*").eq("api_key_id", keyId).limit(1);
            sub = data?.[0] ?? null;
          }
          if (sub) {
            const tier = String(sub.tier ?? "pro");
            const t    = TIERS[tier] ?? TIERS.pro;
            if (amount < t.price - 5) {
              /* Paid less than the tier price → don't activate */
              return json({ success: true });
            }
            if (sub.last_tx_id !== String(txId)) {
              const subId = body.data?.flw_sub ?? body.data?.plan?.id ?? undefined;
              await adminClient().from("api_subscriptions").update({
                status:       "active",
                last_tx_id:   String(txId),
                renews_at:    nextRenewal(sub.renews_at as string | null),
                grace_ends_at: null,
                ...(subId ? { flw_sub_id: String(subId) } : {}),
              }).eq("id", sub.id);

              await adminClient().from("api_keys")
                .update({
                  status:      "active",
                  tier:        tier,
                  daily_limit: t.daily,
                  approved_at: new Date().toISOString(),
                })
                .eq("id", sub.api_key_id)
                .eq("status", "pending");
            }
          }
        } catch (_) {}
        await sweepExpiredGrace();
        return json({ success: true });
      }

      if (body.event === "subscription.cancelled") {
        const subId = body.data?.id as string | undefined;
        const email = (body.data?.customer as Record<string, unknown>)?.email as string | undefined;
        try {
          let q = adminClient().from("api_subscriptions").select("id, api_key_id");
          if (subId) q = q.eq("flw_sub_id", String(subId));
          else if (email) q = q.eq("email", String(email));
          const { data } = await q.limit(1);
          const sub = data?.[0];
          if (sub) {
            await adminClient().from("api_subscriptions")
              .update({ status: "cancelled" }).eq("id", sub.id);
            await adminClient().from("api_keys")
              .update({ status: "revoked", revoked_at: new Date().toISOString() })
              .eq("id", sub.api_key_id);
          }
        } catch (_) {}
        await sweepExpiredGrace();
        return json({ success: true });
      }

      await sweepExpiredGrace();
      return json({ success: true });
    }

    /* ── Tier list for the pricing UI ───────────────────────── */
    if (body.action === "plans") {
      /* Live/test mode is readable from the key PREFIX — the secret itself
         is never exposed. "live" = real money, "test" = dry-run key. */
      const secretKey = Deno.env.get("FLW_SECRET_KEY") ?? "";
      const flwMode = secretKey.startsWith("FLWSECK_TEST") ? "test"
                    : secretKey.startsWith("FLWSECK") ? "live" : "missing";
      const webhookHashSet = !!(Deno.env.get("FLW_WEBHOOK_HASH") ?? "");
      return json({
        success:  true,
        currency: "NGN",
        interval: "monthly",
        graceDays: GRACE_DAYS,
        flwMode,
        webhookHashSet,
        tiers: Object.entries(TIERS).map(([id, t]) => ({
          id, label: t.label, price: t.price, dailyLimit: t.daily,
        })),
      });
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
      catch (e) { return json({ success: false, error: (e as Error).message }); }

      /* If the buyer is signed in (developer dashboard), link the pending
         key to their account immediately — uid comes from the verified JWT,
         never from the client payload. */
      let ownerId: string | null = null;
      try {
        const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (token) {
          const { data: { user } } = await adminClient().auth.getUser(token);
          ownerId = user?.id ?? null;
        }
      } catch (_) {}

      const { data: keyRows, error: keyErr } = await adminClient()
        .from("api_keys").insert({
          developer_name: name,
          email,
          app_name:       app || null,
          use_case:       `[${tierId.toUpperCase()}] ${useCase}`,
          status:         "pending",
          tier:           tierId,
          ...(ownerId ? { user_id: ownerId } : {}),
        }).select("id");
      if (keyErr || !keyRows?.[0]) {
        return json({ success: false, error: keyErr?.message ?? "Could not create key" });
      }
      const keyId = String(keyRows[0].id);

      const txRef = makeRef("PRO");
      const { error: subErr } = await adminClient()
        .from("api_subscriptions").insert({
          api_key_id: keyId, email, tier: tierId, tx_ref: txRef, price: t.price,
        });
      if (subErr) {
        await cleanupPendingKey(keyId);
        return json({ success: false, error: subErr.message });
      }

      const origin = req.headers.get("origin") ?? "https://nepawatch.app";
      let flw: Record<string, any>;
      try {
        const flwRes = await fetch(`${FLW}/payments`, {
          method:  "POST",
          headers: flwHeaders(),
          body: JSON.stringify({
            tx_ref:       txRef,
            amount:       t.price,
            currency:     "NGN",
            redirect_url: `${origin}/developer.html`,
            payment_plan: planId,
            customer:     { email, name },
            customizations: {
              title:       `NEPAWatch API — ${t.label}`,
              description: `${t.daily.toLocaleString()} requests/day`,
              logo:        `${origin}/logo2.jpg`,
            },
            meta: { api_key_id: keyId, email, tier: tierId },
          }),
        });
        flw = await flwRes.json();
      } catch (_) {
        await cleanupPendingKey(keyId);
        return json({ success: false, error: "Could not reach Flutterwave. Please try again." });
      }
      if (flw.status !== "success" || !flw.data?.link) {
        await cleanupPendingKey(keyId);
        return json({ success: false, error: `Flutterwave init failed: ${flw.message ?? "unknown"}` });
      }

      return json({
        success:     true,
        checkoutUrl: flw.data.link,
        tx_ref:      txRef,
        price:       t.price,
        tier:        tierId,
      });
    }

    /* ── Subscription status (frontend polls after redirect) ── */
    if (body.action === "status" && body.tx_ref) {
      await sweepExpiredGrace();
      const { data, error } = await adminClient()
        .from("api_subscriptions")
        .select("status, tier, renews_at, price, grace_ends_at, api_keys(key, status, tier, daily_limit, requests_today, total_requests)")
        .eq("tx_ref", String(body.tx_ref))
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
        key:        (sub.api_keys as { key?: string } | null)?.key ?? null,
        keyStatus:  (sub.api_keys as { status?: string } | null)?.status ?? null,
        dailyLimit: (sub.api_keys as { daily_limit?: number } | null)?.daily_limit ?? null,
      });
    }

    return json({ success: false, error: "Unknown action" });

  } catch (err) {
    console.error("api-billing:", err);
    return json({ success: false, error: "Internal server error" }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
