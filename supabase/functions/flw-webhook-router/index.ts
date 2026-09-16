import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

/* ────────────────────────────────────────────────────────────────
   NEPAWatch — flw-webhook-router edge function

   Flutterwave allows ONE webhook URL per account, but several NEPAWatch
   services need FLW events:
     - api-billing      (Pro API subscriptions, tx_ref prefix PRO-)
     - buy-electricity  (electricity vending,    tx_ref prefix NW-)

   Point the FLW dashboard webhook here and every event fans out to the
   right consumer. The router re-checks the verif-hash once, then forwards
   the ORIGINAL headers + body so the downstream functions keep their own
   signature checks unchanged.

   Routing:
     charge.completed          → BOTH consumers (each matches its own
                                 tx_ref; unknown refs are harmless no-ops)
     everything else
     (subscription.*, etc.)    → api-billing only (only billing uses
                                 payment plans / subscriptions)

   Secrets: FLW_WEBHOOK_HASH (same value as the FLW dashboard hash)
   ──────────────────────────────────────────────────────────────── */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

const CONSUMERS: Record<string, string> = {
  billing:    `${SUPABASE_URL}/functions/v1/api-billing`,
  electricity:`${SUPABASE_URL}/functions/v1/buy-electricity`,
};

async function forward(url: string, headers: Headers, body: string) {
  try {
    const h: Record<string, string> = {
      "Content-Type": headers.get("content-type") ?? "application/json",
    };
    const hash = headers.get("verif-hash");
    if (hash) h["verif-hash"] = hash; // pass through for downstream checks
    const r = await fetch(url, {
      method:  "POST",
      headers: h,
      body,
      signal:  AbortSignal.timeout(8000),
    });
    return r.status;
  } catch (_) {
    return 0; // consumer unreachable — logged below
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const raw = await req.text();
  if (req.headers.get("verif-hash") !== (Deno.env.get("FLW_WEBHOOK_HASH") ?? "")) {
    return new Response("invalid signature", { status: 401 });
  }

  let event = "", txRef = "";
  try {
    const p = JSON.parse(raw);
    event = String(p.event ?? "");
    txRef = String(p.data?.tx_ref ?? p.tx_ref ?? "");
  } catch (_) {}

  /* charge.completed → both consumers (each matches its own tx_ref).
     Everything else → billing only (subscriptions live there). */
  if (event === "charge.completed") {
    const b = await forward(CONSUMERS.billing, req.headers, raw);
    const e = await forward(CONSUMERS.electricity, req.headers, raw);
    console.log(`flw-router: charge.completed ${txRef} → billing:${b} electricity:${e}`);
  } else {
    const b = await forward(CONSUMERS.billing, req.headers, raw);
    console.log(`flw-router: ${event} → billing:${b}`);
  }

  /* Acknowledge FLW immediately regardless of consumer outcomes —
     each consumer is idempotent and has its own retry surfaces. */
  return new Response("ok", { status: 200 });
});
