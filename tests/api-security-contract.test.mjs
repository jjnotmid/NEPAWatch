import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const billing = read('supabase/functions/api-billing/index.ts');
const portal = read('supabase/functions/developer-portal/index.ts');
const gateway = read('supabase/functions/nepawatch-api/index.ts');
const admin = read('supabase/functions/admin-action/index.ts');
const router = read('supabase/functions/flw-webhook-router/index.ts');
const training = read('supabase/functions/training-data/index.ts');
const dashboard = read('developer.html');
const ops = read('ops-7e11366b.html');
const hotfix = read('api-security-hotfix.sql');

test('client roles cannot write keys or read subscriptions', () => {
  assert.match(hotfix, /REVOKE ALL ON TABLE public\.api_keys FROM anon, authenticated/);
  assert.match(hotfix, /REVOKE ALL ON TABLE public\.api_subscriptions FROM anon, authenticated/);
  assert.doesNotMatch(hotfix, /CREATE POLICY[\s\S]*api_keys[\s\S]*WITH CHECK\s*\(true\)/i);
});

test('daily quota is atomic and callable only by service role', () => {
  assert.match(hotfix, /CREATE OR REPLACE FUNCTION public\.consume_api_quota/);
  assert.match(hotfix, /WHERE key = p_key FOR UPDATE/);
  assert.match(hotfix, /GRANT EXECUTE ON FUNCTION public\.consume_api_quota\(text\) TO service_role/);
  assert.match(gateway, /\.rpc\('consume_api_quota'/);
  assert.doesNotMatch(gateway, /requests_today:\s*requestsToday\s*\+\s*1/);
});

test('free key allowance is enforced in code and database', () => {
  assert.match(hotfix, /idx_api_keys_one_active_free_per_user/);
  assert.match(hotfix, /WHERE user_id IS NOT NULL AND tier = 'free' AND status = 'active'/);
  assert.match(portal, /One active free key is allowed per account/);
  assert.match(portal, /error\?\.code === "23505"/);
});

test('dashboard never receives stored full keys during overview', () => {
  assert.match(portal, /keyHint:/);
  assert.doesNotMatch(portal, /keys:\s*\(keys \?\? \[\]\)\.map\(\(k\) => \(\{\s*\.\.\.k/);
  const statusBlock = billing.slice(billing.indexOf('body.action === "status"'));
  assert.doesNotMatch(statusBlock, /api_keys\([^)]*\bkey\b/);
  assert.doesNotMatch(statusBlock, /\bkey:\s*\(sub\.api_keys/);
});

test('billing actions require ownership and verified payment details', () => {
  assert.match(billing, /const user = await authUser\(req\)/);
  assert.match(billing, /\.eq\("api_keys\.user_id", ownerId\)/);
  assert.match(billing, /transactions\/\$\{txId\}\/verify/);
  assert.match(billing, /verifiedRef !== String\(sub\.tx_ref\)/);
  assert.match(billing, /verifiedEmail !== String\(sub\.email\)\.toLowerCase\(\)/);
  assert.match(billing, /amount !== Number\(sub\.price\)/);
  assert.match(billing, /currency !== "NGN"/);
  assert.match(billing, /initialActivation = sub\.status === "pending"/);
  assert.match(billing, /if \(!activatedSubs\?\.length\)/);
  assert.match(billing, /cancelledAfterActivation/);
});

test('cancelled and expired checkouts are retired and links disabled', () => {
  assert.match(billing, /body.action === "abandon"/);
  assert.match(billing, /payments\/link\/disable/);
  assert.match(billing, /body.action === "cancel"/);
  assert.match(billing, /subscriptions\/\$\{encodeURIComponent\(providerSubId\)\}\/cancel/);
  assert.match(dashboard, /status&&status!==['"]successful['"]/);
  assert.match(dashboard, /Cancel attempt/);
});

test('webhook router fails closed when a required consumer fails', () => {
  assert.match(router, /webhookHash \|\| req\.headers\.get\("verif-hash"\) !== webhookHash/);
  assert.match(router, /statuses\.some\(\(status\) => status < 200 \|\| status >= 300\)/);
  assert.match(router, /status: 502/);
});

test('admin UI has no direct API-key table fallback', () => {
  assert.match(admin, /action === 'list_api_keys'/);
  assert.match(admin, /Paid keys can only be activated by a verified Flutterwave payment/);
  assert.match(admin, /Cancel the Flutterwave subscription before revoking this paid key/);
  assert.doesNotMatch(ops, /sb\.from\('api_keys'\)/);
  assert.match(ops, /_escHtml\(k\.developer_name/);
});

test('internal training export requires an admin session and strips user ids', () => {
  assert.match(training, /\.from\('admins'\)/);
  assert.match(training, /if \(!admin\) return jsonError\('Forbidden', 403\)/);
  assert.doesNotMatch(training, /\.from\('api_keys'\)/);
  assert.match(training, /map\(\(\{ user_id, \.\.\.report \}\)/);
  assert.match(training, /'Cache-Control': 'private, no-store'/);
  assert.doesNotMatch(ops, /id="dpApiKey"/);
});

test('dashboard supports one-time reveal and key rotation', () => {
  assert.match(portal, /action === "rotate"/);
  assert.match(dashboard, /function revealNewKey/);
  assert.match(dashboard, /Rotate/);
  assert.match(dashboard, /cannot be recovered from the dashboard/);
});

test('developer key list omits revoked and unpaid checkout records', () => {
  assert.match(portal, /portalKeys = displayKeys\.filter\(\(k\) => k\.status === "active" \|\| k\.status === "pending"\)/);
  assert.match(dashboard, /visible=keys\.filter\(k=>k\.status==='active'\)/);
});
