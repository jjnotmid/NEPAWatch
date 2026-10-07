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
     charge.completed          → matching consumer only, based on tx_ref or
                                 payment-plan fields
     everything else
     (subscription.*, etc.)    → api-billing only (only billing uses
                                 payment plans / subscriptions)

   Secrets: FLW_WEBHOOK_HASH (same value as the FLW dashboard hash)
   ──────────────────────────────────────────────────────────────── */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  const webhookHash = Deno.env.get("FLW_WEBHOOK_HASH");
  if (!webhookHash || req.headers.get("verif-hash") !== webhookHash) {
    return new Response("invalid signature", { status: 401 });
  }

  let event = "", txRef = "", hasPlan = false;
  try {
    const p = JSON.parse(raw);
    event = String(p.event ?? "");
    txRef = String(p.data?.tx_ref ?? p.tx_ref ?? "");
    hasPlan = !!(p.data?.plan || p.data?.payment_plan || p.data?.flw_sub);
  } catch (_) {}

  const statuses: number[] = [];
  if (event === "charge.completed") {
    if (txRef.startsWith("PRO-") || hasPlan) {
      const b = await forward(CONSUMERS.billing, req.headers, raw);
      statuses.push(b);
      console.log(`flw-router: charge.completed ${txRef} → billing:${b}`);
    } else if (txRef.startsWith("NW-")) {
      const e = await forward(CONSUMERS.electricity, req.headers, raw);
      statuses.push(e);
      console.log(`flw-router: charge.completed ${txRef} → electricity:${e}`);
    } else {
      console.log(`flw-router: ignored unknown charge reference ${txRef}`);
    }
  } else {
    const b = await forward(CONSUMERS.billing, req.headers, raw);
    statuses.push(b);
    console.log(`flw-router: ${event} → billing:${b}`);
  }

  if (statuses.some((status) => status < 200 || status >= 300)) {
    return new Response("consumer unavailable", { status: 502 });
  }
  return new Response("ok", { status: 200 });
});
