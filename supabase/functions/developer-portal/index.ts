import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ────────────────────────────────────────────────────────────────
   NEPAWatch — developer-portal edge function
   Signed-in developers manage their API keys, usage and plan.

   Auth: the gateway requires a valid Supabase JWT (verify_jwt = true,
   the default) — we derive the user id from that token server-side, so
   every query is scoped to the caller. No cross-account access.

   Actions (all require sign-in):
     me              → keys + subscription + usage overview
     create {name}   → new free key (instant, 100 req/day), nw_… format
     claim {key}     → link an existing UNCLAIMED key to this account
     revoke {id}     → revoke one of your keys
     billing         → subscription status/tier/renews for upgrade UI
   ──────────────────────────────────────────────────────────────── */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

  try {
    const userId = await uid(req);
    if (!userId) return json({ success: false, error: "Sign in required" }, 401);

    const sb  = adminClient();
    const body = await req.json();
    const action = body.action;

    /* ── Overview: keys + subscription ───────────────────────── */
    if (action === "me" || action === "billing") {
      const { data: keys, error: kErr } = await sb
        .from("api_keys")
        .select("id, name, key, status, tier, daily_limit, requests_today, total_requests, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (kErr) return json({ success: false, error: kErr.message });

      const ids = (keys ?? []).map((k) => k.id);
      let subs: Array<Record<string, unknown>> = [];
      if (ids.length) {
        const { data } = await sb
          .from("api_subscriptions")
          .select("api_key_id, tier, status, price, renews_at, grace_ends_at")
          .in("api_key_id", ids);
        subs = data ?? [];
      }
      const subByKey: Record<string, Record<string, unknown>> = {};
      for (const s of subs) subByKey[String(s.api_key_id)] = s;

      const overview = {
        keys: (keys ?? []).map((k) => ({
          ...k,
          subscription: subByKey[String(k.id)] ?? null,
        })),
        totals: {
          keys: (keys ?? []).length,
          requestsToday: (keys ?? []).reduce((s, k) => s + Number(k.requests_today ?? 0), 0),
          requestsAll: (keys ?? []).reduce((s, k) => s + Number(k.total_requests ?? 0), 0),
        },
      };
      return json({ success: true, ...overview });
    }

    /* ── Create a free key (instant) ─────────────────────────── */
    if (action === "create") {
      const name = String(body.name ?? "Default key").trim().slice(0, 60) || "Default key";
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
      if (error) return json({ success: false, error: error.message });
      return json({ success: true, key: data });
    }

    /* ── Claim an existing unclaimed key ─────────────────────── */
    if (action === "claim") {
      const key = String(body.key ?? "").trim();
      if (!key) return json({ success: false, error: "Paste your API key" });

      const { data, error } = await sb.from("api_keys")
        .select("id, key, user_id, status").eq("key", key).limit(1);
      if (error) return json({ success: false, error: error.message });
      const row = data?.[0];
      if (!row) return json({ success: false, error: "Key not found — check and paste it exactly" });
      if (row.user_id === userId) return json({ success: true, alreadyYours: true });
      if (row.user_id) return json({ success: false, error: "This key is already linked to another account" });

      const { error: upErr } = await sb.from("api_keys")
        .update({ user_id: userId })
        .eq("id", row.id);
      if (upErr) return json({ success: false, error: upErr.message });
      return json({ success: true });
    }

    /* ── Revoke one of your keys ─────────────────────────────── */
    if (action === "revoke") {
      const id = String(body.id ?? "");
      if (!id) return json({ success: false, error: "Missing key id" });
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
