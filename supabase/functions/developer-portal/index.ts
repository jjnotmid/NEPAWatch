import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ────────────────────────────────────────────────────────────────
   NEPAWatch — developer-portal edge function
   Signed-in developers manage their API keys, usage and plan.

   Auth: the gateway requires a valid Supabase JWT (verify_jwt = true,
   the default) — we derive the user id from that token server-side, so
   every query is scoped to the caller. No cross-account access.

   Actions (all require sign-in):
     me              → masked keys + subscription + usage overview
     create {name}   → new free key (instant, 100 req/day), nw_… format
     claim {key}     → link an existing UNCLAIMED key to this account
     rotate {id}     → replace a compromised key and reveal it once
     revoke {id}     → revoke one of your keys
     billing         → subscription status/tier/renews for upgrade UI
   ──────────────────────────────────────────────────────────────── */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function uid(req: Request): Promise<string | null> {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const { data: { user } } = await adminClient().auth.getUser(token);
    return user?.id ?? null;
  } catch (_) { return null; }
}

/* nw_ + 32 base62 chars — the readable key format */
function makeKey(): string {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let out = "nw_";
  for (const b of bytes) out += CHARS[b % CHARS.length];
  return out;
}

const FREE_LIMIT = 100;

/* ══════════════════════════════════════════════════════════════ */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "Use POST" }, 405);

  try {
    const userId = await uid(req);
    if (!userId) return json({ success: false, error: "Sign in required" }, 401);

    const sb  = adminClient();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ success: false, error: "Invalid JSON body" }, 400);
    const action = body.action;

    /* ── Overview: keys + subscription ───────────────────────── */
    if (action === "me" || action === "billing") {
      /* A Flutterwave checkout closes after 30 minutes. Reconcile this user's
         stale local attempts on dashboard load so they cannot remain labelled
         pending forever when no later billing request is made. */
      const pendingCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: expired, error: expiredErr } = await sb
        .from("api_subscriptions")
        .select("id, api_key_id, api_keys!inner(user_id)")
        .eq("status", "pending")
        .eq("api_keys.user_id", userId)
        .lt("created_at", pendingCutoff)
        .limit(20);
      if (expiredErr) return json({ success: false, error: "Could not reconcile checkout status" }, 500);
      for (const sub of expired ?? []) {
        const { data: cancelled, error: cancelErr } = await sb.from("api_subscriptions")
          .update({ status: "cancelled" })
          .eq("id", sub.id).eq("status", "pending").select("id");
        if (cancelErr) return json({ success: false, error: "Could not reconcile checkout status" }, 500);
        if (cancelled?.length) {
          const { error: keyErr } = await sb.from("api_keys")
            .update({ status: "revoked", revoked_at: new Date().toISOString() })
            .eq("id", sub.api_key_id).eq("status", "pending");
          if (keyErr) return json({ success: false, error: "Could not reconcile checkout key" }, 500);
        }
      }

      const { data: keys, error: kErr } = await sb
        .from("api_keys")
        .select("id, name, key, status, tier, daily_limit, requests_today, total_requests, last_reset_date, created_at, partner_granted_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (kErr) return json({ success: false, error: kErr.message });
      const utcToday = new Date().toISOString().slice(0, 10);
      const displayKeys = (keys ?? []).map((k) => ({
        ...k,
        requests_today: k.last_reset_date === utcToday ? Number(k.requests_today ?? 0) : 0,
      }));
      const portalKeys = displayKeys.filter((k) => k.status === "active" || k.status === "pending");

      const ids = portalKeys.map((k) => k.id);
      let subs: Array<Record<string, unknown>> = [];
      if (ids.length) {
        const { data } = await sb
          .from("api_subscriptions")
          .select("api_key_id, tier, status, price, renews_at, grace_ends_at, tx_ref, created_at, checkout_expires_at")
          .in("api_key_id", ids)
          .order("created_at", { ascending: false });
        subs = data ?? [];
      }
      const subByKey: Record<string, Record<string, unknown>> = {};
      const statusRank: Record<string, number> = { active: 4, past_due: 3, pending: 2, cancelled: 1 };
      for (const s of subs) {
        const id = String(s.api_key_id);
        const current = subByKey[id];
        if (!current || (statusRank[String(s.status)] ?? 0) > (statusRank[String(current.status)] ?? 0)) {
          subByKey[id] = s;
        }
      }

      const activeKeys = portalKeys.filter((k) => k.status === "active");
      const dailyLimit = activeKeys.reduce((s, k) => s + Number(k.daily_limit ?? 0), 0);
      const requestsToday = activeKeys.reduce((s, k) => s + Number(k.requests_today ?? 0), 0);

      const overview = {
        keys: portalKeys.map((k) => ({
          id: k.id,
          name: k.name,
          keyHint: k.status === "pending" ? "Not issued until payment is confirmed" : `••••${String(k.key).slice(-4)}`,
          status: k.status,
          tier: k.tier,
          complimentary: k.tier === "starter" && !!k.partner_granted_at,
          daily_limit: k.daily_limit,
          requests_today: k.requests_today,
          total_requests: k.total_requests,
          created_at: k.created_at,
          subscription: subByKey[String(k.id)] ?? null,
        })),
        totals: {
          keys: activeKeys.length,
          requestsToday,
          requestsAll: displayKeys.reduce((s, k) => s + Number(k.total_requests ?? 0), 0),
          dailyLimit,
          requestsRemaining: Math.max(0, dailyLimit - requestsToday),
        },
      };
      return json({ success: true, ...overview });
    }

    /* ── Create a free key (instant) ─────────────────────────── */
    if (action === "create") {
      const name = String(body.name ?? "Default key").trim().slice(0, 60) || "Default key";
      const { count, error: countErr } = await sb.from("api_keys")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("tier", "free").eq("status", "active");
      if (countErr) return json({ success: false, error: "Could not check key allowance" }, 500);
      if ((count ?? 0) >= 1) return json({ success: false, error: "One active free key is allowed per account. Revoke it before creating another." }, 409);
      const { data, error } = await sb.from("api_keys").insert({
        developer_name: name,
        name,
        email:        "",             // legacy column, unused for dashboards
        user_id:      userId,
        status:       "active",
        tier:         "free",
        daily_limit:  FREE_LIMIT,
        key:          makeKey(),
      }).select("id, key, name, tier, daily_limit, status").single();
      if (error?.code === "23505") {
        return json({ success: false, error: "One active free key is allowed per account. Revoke it before creating another." }, 409);
      }
      if (error) return json({ success: false, error: error.message });
      return json({ success: true, key: data });
    }

    /* ── Claim an existing unclaimed key ─────────────────────── */
    if (action === "claim") {
      const key = String(body.key ?? "").trim();
      if (!key) return json({ success: false, error: "Paste your API key" });

      const { data, error } = await sb.from("api_keys")
        .select("id, key, user_id, status, tier").eq("key", key).limit(1);
      if (error) return json({ success: false, error: error.message });
      const row = data?.[0];
      if (!row) return json({ success: false, error: "Key not found — check and paste it exactly" });
      if (row.user_id === userId) return json({ success: true, alreadyYours: true });
      if (row.user_id) return json({ success: false, error: "This key is already linked to another account" });

      if (row.status === "active" && row.tier === "free") {
        const { data: existing } = await sb.from("api_keys")
          .select("id").eq("user_id", userId).eq("tier", "free").eq("status", "active").limit(1);
        if (existing?.length) return json({ success: false, error: "Revoke your active free key before linking another." }, 409);
      }

      const { data: claimed, error: upErr } = await sb.from("api_keys")
        .update({ user_id: userId })
        .eq("id", row.id)
        .is("user_id", null)
        .select("id");
      if (upErr) return json({ success: false, error: upErr.message });
      if (!claimed?.length) return json({ success: false, error: "This key is no longer available to link" }, 409);
      return json({ success: true });
    }

    /* ── Rotate a compromised key and reveal the replacement once ──────── */
    if (action === "rotate") {
      const id = String(body.id ?? "");
      if (!id) return json({ success: false, error: "Missing key id" });
      const replacement = makeKey();
      const { data, error } = await sb.from("api_keys")
        .update({ key: replacement })
        .eq("id", id)
        .eq("user_id", userId)
        .eq("status", "active")
        .select("id, key")
        .single();
      if (error || !data) return json({ success: false, error: "Could not rotate this active key" }, 400);
      return json({ success: true, key: data.key });
    }

    /* ── Revoke one of your keys ─────────────────────────────── */
    if (action === "revoke") {
      const id = String(body.id ?? "");
      if (!id) return json({ success: false, error: "Missing key id" });
      const { data: activeSubs, error: subErr } = await sb.from("api_subscriptions")
        .select("id").eq("api_key_id", id).in("status", ["active", "past_due"]).limit(1);
      if (subErr) return json({ success: false, error: "Could not check subscription status" }, 500);
      if (activeSubs?.length) {
        return json({ success: false, error: "Cancel the paid subscription before revoking its key. Use Rotate if the key was exposed." }, 409);
      }
      const { error } = await sb.from("api_keys")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) return json({ success: false, error: error.message });
      return json({ success: true });
    }

    return json({ success: false, error: "Unknown action" });

  } catch (err) {
    console.error("developer-portal:", err);
    return json({ success: false, error: "Internal server error" }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
