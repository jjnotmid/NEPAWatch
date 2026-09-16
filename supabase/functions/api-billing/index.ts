import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ────────────────────────────────────────────────────────────────
   NEPAWatch — api-billing edge function
   Flutterwave monthly subscription for Pro API access (₦5,000/month,
   10,000 requests/day). Replaces the old "we'll email you" manual flow.

   Flow:
     action:"plans"                       → plan price/interval
     action:"initiate"  + developer info  → FLW checkout (payment plan),
                                            pending key + subscription rows
     action:"status"    + tx_ref          → key/status for the frontend poll
     POST {event:…}      + verif-hash     → FLW webhook:
        charge.completed (successful)     → activate key, extend renews_at +1mo
        charge.completed (failed)         → mark past_due (grace, no revoke)
        subscription.cancelled            → revoke key, mark cancelled

   Secrets:
     FLW_SECRET_KEY       Flutterwave live secret key
     FLW_WEBHOOK_HASH     verif-hash guard (same value as FLW dashboard)
     FLW_PRO_PLAN_ID      optional — existing payment plan id (auto-created
                          on first use if absent)
     NW_PRO_PRICE         optional, default 5000 (naira per month)

   NOTE: Flutterwave sends webhooks to ONE URL per account — point the
   dashboard webhook at this function while Pro billing is live.
   ──────────────────────────────────────────────────────────────── */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FLW   = "https://api.flutterwave.com/v3";
const PRICE = Number(Deno.env.get("NW_PRO_PRICE") ?? 5000);

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

/* ── Payment plan (monthly, indefinite) — created once, cached ── */
let proPlanId: string | null = null;
async function ensurePlan(): Promise<string> {
  if (proPlanId) return proPlanId;
  const envPlan = Deno.env.get("FLW_PRO_PLAN_ID");
  if (envPlan) { proPlanId = envPlan; return proPlanId; }

  const r = await fetch(`${FLW}/payment-plans?name=${encodeURIComponent("NEPAWatch Pro API")}`, { headers: flwHeaders() });
  const d = await r.json();
  if (d.status === "success" && d.data?.[0]?.id) {
    proPlanId = String(d.data[0].id);
    return proPlanId;
  }

  const c = await fetch(`${FLW}/payment-plans`, {
    method:  "POST",
    headers: flwHeaders(),
    body: JSON.stringify({
      name:     "NEPAWatch Pro API",
      amount:   PRICE,
      currency: "NGN",
      interval: "monthly",
      duration: 0,          // charges until cancelled
    }),
  });
  const cd = await c.json();
  if (cd.status === "success" && cd.data?.id) {
    proPlanId = String(cd.data.id);
    return proPlanId;
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

        /* Re-verify with the API (never trust the webhook alone) */
        let confirmed = false;
        let amount = 0, currency = "";
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

        if (!paid || !confirmed || currency !== "NGN" || amount < PRICE - 5) {
          /* Failed or unconfirmed charge → grace period, don't revoke */
          if (txRef) {
            try {
              const { data: subs } = await adminClient().from("api_subscriptions")
                .select("id, last_tx_id").eq("tx_ref", txRef).limit(1);
              const sub = subs?.[0];
              if (sub && sub.last_tx_id !== String(txId)) {
                await adminClient().from("api_subscriptions")
                  .update({ status: "past_due", last_tx_id: String(txId) })
                  .eq("id", sub.id);
              }
            } catch (_) {}
          }
          return json({ success: true });
        }

        /* Successful monthly charge → activate + extend */
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
          if (sub && sub.last_tx_id !== String(txId)) {
            const subId = body.data?.flw_sub ?? body.data?.plan?.id ?? undefined;
            await adminClient().from("api_subscriptions").update({
              status:    "active",
              last_tx_id: String(txId),
              renews_at: nextRenewal(sub.renews_at as string | null),
              ...(subId ? { flw_sub_id: String(subId) } : {}),
            }).eq("id", sub.id);

            /* Activate the key if it's still pending */
            await adminClient().from("api_keys")
              .update({ status: "active", tier: "pro", approved_at: new Date().toISOString() })
              .eq("id", sub.api_key_id)
              .eq("status", "pending");
          }
        } catch (_) {}
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
        return json({ success: true });
      }

      return json({ success: true });
    }

    /* ── Plan info ──────────────────────────────────────────── */
    if (body.action === "plans") {
      return json({
        success:  true,
        price:    PRICE,
        currency: "NGN",
        interval: "monthly",
        limits:   { requestsPerDay: 10000 },
      });
    }

    /* ── Initiate subscription checkout ─────────────────────── */
    if (body.action === "initiate") {
      const name    = String(body.developer_name ?? "").trim();
      const email   = String(body.email ?? "").trim().toLowerCase();
      const app     = String(body.app_name ?? "").trim();
      const useCase = String(body.use_case ?? "").trim();
      if (!name || !email.includes("@") || !useCase) {
        return json({ success: false, error: "Name, email and use case are required" });
      }

      let planId: string;
      try { planId = await ensurePlan(); }
      catch (e) { return json({ success: false, error: (e as Error).message }); }

      /* Pending key + subscription rows (service role, idempotent by tx_ref) */
      const { data: keyRows, error: keyErr } = await adminClient()
        .from("api_keys").insert({
          developer_name: name,
          email,
          app_name:       app || null,
          use_case:       `[PRO] ${useCase}`,
          status:         "pending",
          tier:           "pro",
        }).select("id");
      if (keyErr || !keyRows?.[0]) {
        return json({ success: false, error: keyErr?.message ?? "Could not create key" });
      }
      const keyId = String(keyRows[0].id);

      const txRef = makeRef("PRO");
      const { error: subErr } = await adminClient()
        .from("api_subscriptions").insert({
          api_key_id: keyId, email, tx_ref: txRef, price: PRICE,
        });
      if (subErr) {
        return json({ success: false, error: subErr.message });
      }

      const origin = req.headers.get("origin") ?? "https://nepawatch.app";
      const flwRes = await fetch(`${FLW}/payments`, {
        method:  "POST",
        headers: flwHeaders(),
        body: JSON.stringify({
          tx_ref:       txRef,
          amount:       PRICE,
          currency:     "NGN",
          redirect_url: `${origin}/api.html`,
          payment_plan: planId,
          customer:     { email, name },
          customizations: {
            title:       "NEPAWatch Pro API",
            description: "Monthly Pro API subscription — 10,000 requests/day",
            logo:        `${origin}/logo2.jpg`,
          },
          meta: { api_key_id: keyId, email },
        }),
      });
      const flw = await flwRes.json();
      if (flw.status !== "success") {
        return json({ success: false, error: `Flutterwave init failed: ${flw.message ?? "unknown"}` });
      }

      return json({
        success:     true,
        checkoutUrl: flw.data.link,
        tx_ref:      txRef,
        price:       PRICE,
      });
    }

    /* ── Subscription status (frontend polls after redirect) ── */
    if (body.action === "status" && body.tx_ref) {
      const { data, error } = await adminClient()
        .from("api_subscriptions")
        .select("status, renews_at, price, api_keys(key, status, tier, requests_today, total_requests)")
        .eq("tx_ref", String(body.tx_ref))
        .limit(1);
      if (error) return json({ success: false, error: error.message });
      const sub = data?.[0];
      if (!sub) return json({ success: false, error: "Subscription not found" });
      return json({
        success:  true,
        status:   sub.status,
        renewsAt: sub.renews_at,
        price:    sub.price,
        key:      (sub.api_keys as { key?: string } | null)?.key ?? null,
        keyStatus: (sub.api_keys as { status?: string } | null)?.status ?? null,
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
