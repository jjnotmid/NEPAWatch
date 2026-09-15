/* ═══════════════════════════════════════════════════════════════════════════
   NEPAWatch — send-push Edge Function

   Sends Web Push notifications to users subscribed to an area.
   Implements VAPID (RFC 8292) + aes128gcm payload encryption (RFC 8291)
   directly against Web Crypto — no third-party push library needed.

   Required secrets (Dashboard → Edge Functions → Secrets):
     VAPID_PUBLIC_KEY   base64url, same value as app.js VAPID_PUBLIC_KEY
     VAPID_PRIVATE_KEY  base64url, the matching P-256 private scalar (d)
     VAPID_SUBJECT      e.g. mailto:hello@nepawatch.app

   POST body: { area, type, title, body, url }
   Auth: service role bearer token (called by ai-engine / DB triggers)
   ═══════════════════════════════════════════════════════════════════════════ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@nepawatch.app';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

/* ─── base64url helpers ──────────────────────────────────────────────────── */
function b64uToBytes(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64u(b: Uint8Array): string {
  let s = '';
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

/* ─── VAPID JWT (ES256) ──────────────────────────────────────────────────── */
async function vapidAuthHeader(endpoint: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header  = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  };
  const enc = (o: object) => bytesToB64u(new TextEncoder().encode(JSON.stringify(o)));
  const signingInput = `${enc(header)}.${enc(payload)}`;

  /* Import the raw private scalar as a PKCS#8-free JWK. The public key gives
     us x and y; the private key gives d. */
  const pub = b64uToBytes(VAPID_PUBLIC_KEY);          // 65 bytes: 0x04 || X || Y
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToB64u(pub.slice(1, 33)),
    y: bytesToB64u(pub.slice(33, 65)),
    d: VAPID_PRIVATE_KEY,
    ext: true,
  };
  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput),
  ));
  return `vapid t=${signingInput}.${bytesToB64u(sig)}, k=${VAPID_PUBLIC_KEY}`;
}

/* ─── HKDF-SHA256 ────────────────────────────────────────────────────────── */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const base = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info }, base, len * 8,
  );
  return new Uint8Array(bits);
}

/* ─── aes128gcm payload encryption (RFC 8291) ────────────────────────────── */
async function encryptPayload(plaintext: string, p256dhB64: string, authB64: string) {
  const clientPub = b64uToBytes(p256dhB64);   // 65 bytes uncompressed point
  const authSecret = b64uToBytes(authB64);    // 16 bytes
  const salt = crypto.getRandomValues(new Uint8Array(16));

  /* Ephemeral sender keypair */
  const eph = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  ) as CryptoKeyPair;
  const ephPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));

  const clientKey = await crypto.subtle.importKey(
    'raw', clientPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );
  const shared = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey }, eph.privateKey, 256,
  ));

  /* IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || ua_pub || as_pub) */
  const te = new TextEncoder();
  const prkInfo = concat(te.encode('WebPush: info\0'), clientPub, ephPubRaw);
  const ikm = await hkdf(authSecret, shared, prkInfo, 32);

  const cek   = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);

  /* Plaintext gets a 0x02 delimiter appended (last record) */
  const body = concat(te.encode(plaintext), new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aesKey, body,
  ));

  /* Header: salt(16) || record_size(4, BE) || idlen(1) || keyid(ephemeral pub) */
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([ephPubRaw.length]), ephPubRaw, ct);
}

/* ─── Send one push ──────────────────────────────────────────────────────── */
async function sendOne(sub: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  const bodyBytes = await encryptPayload(payload, sub.p256dh, sub.auth);
  const auth = await vapidAuthHeader(sub.endpoint);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
      'Urgency': 'normal',
    },
    body: bodyBytes,
    signal: AbortSignal.timeout(10000),
  });
  return res.status;
}

/* ─── Handler ────────────────────────────────────────────────────────────── */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (b: object, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

  const authHeader = req.headers.get('Authorization') ?? '';
  /* Gateway already verified the JWT signature (verify_jwt = true) — check
     the ROLE instead of comparing raw keys, so key rotation never breaks it. */
  const isServiceRole = (() => {
    try {
      const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!jwt) return false;
      const b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64));
      return payload.role === 'service_role';
    } catch (_) {
      return authHeader.includes(SERVICE_KEY);
    }
  })();
  if (!isServiceRole) return json({ error: 'Unauthorized' }, 401);

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: 'VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets.' }, 500);
  }

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { /* empty body */ }

  const area  = String(payload.area ?? '');
  const type  = String(payload.type ?? 'info');
  const title = String(payload.title ?? 'NEPAWatch');
  const body  = String(payload.body ?? 'Power update in your area.');
  const url   = String(payload.url ?? '/');

  if (!area) return json({ error: 'area is required' }, 400);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  /* Only users watching this exact area. Keeps fan-out small and predictable. */
  const { data: subs, error } = await sb
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .eq('area', area);

  if (error) return json({ error: error.message }, 500);
  if (!subs?.length) return json({ sent: 0, note: 'no subscribers for this area' });

  const msg = JSON.stringify({ title, body, type, area, url });

  const results = await Promise.allSettled(
    subs.map(s => sendOne(s as never, msg).then(status => ({ status, sub: s }))),
  );

  /* 404/410 mean the browser dropped the subscription — clean those up so we
     stop paying to retry them on every future send. */
  const dead: string[] = [];
  let sent = 0;
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { status, sub } = r.value as { status: number; sub: { user_id: string } };
    if (status >= 200 && status < 300) sent++;
    else if (status === 404 || status === 410) dead.push(sub.user_id);
  }
  if (dead.length) {
    await sb.from('push_subscriptions').delete().in('user_id', dead);
  }

  return json({ sent, total: subs.length, pruned: dead.length });
});
