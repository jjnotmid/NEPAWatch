import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const keyId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';

function adminHandler({ signedIn = true, admin = true, env = {}, rpcResult } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: actorId } : null }, error: null }) },
    from(table) {
      assert.equal(table, 'admins', 'grant must use the atomic RPC for key writes');
      return {
        select() { return this; },
        eq(field, value) { assert.equal(field, 'user_id'); assert.equal(value, actorId); return this; },
        async maybeSingle() { return { data: admin ? { user_id: actorId } : null }; },
      };
    },
    async rpc(name, args) {
      calls.push({ name, args });
      return rpcResult ?? { data: [{ id: keyId, tier: 'starter', status: 'active', daily_limit: args.p_daily_limit }] };
    },
  };
  let handler;
  const context = vm.createContext({
    Response, createClient: () => client,
    Deno: { env: { get: name => env[name] }, serve: fn => { handler = fn; } },
  });
  const source = read('supabase/functions/admin-action/index.ts').replace(/^import .*\n/gm, '');
  vm.runInContext(stripTypeScriptTypes(source), context);
  const request = async (body = {}, auth = true) => handler(new Request('https://test.local/admin-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test-session' } : {}) },
    body: JSON.stringify({ action: 'grant_partner_starter', keyId, reason: 'Partner agreement', ...body }),
  }));
  return { request, calls };
}

test('partnership grants require a verified admin session', async () => {
  for (const [options, auth, status] of [
    [{}, false, 401], [{ signedIn: false }, true, 401], [{ admin: false }, true, 403],
  ]) {
    const { request, calls } = adminHandler(options);
    assert.equal((await request({}, auth)).status, status);
    assert.equal(calls.length, 0);
  }
});

test('grant uses verified actor and configured Starter allowance, ignoring client overrides', async () => {
  const { request, calls } = adminHandler({ env: { NW_LIMIT_STARTER: '1500' } });
  const response = await request({ reason: '  Partnership  ', p_admin_id: 'fake', adminEmail: 'fake@example.com', daily_limit: 200000, tier: 'business' });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{
    name: 'grant_partner_starter',
    args: { p_key_id: keyId, p_admin_id: actorId, p_reason: 'Partnership', p_daily_limit: 1500 },
  }]);
  const body = await response.json();
  assert.equal(body.key.tier, 'starter');
  assert.equal(body.key.daily_limit, 1500);
  assert.equal(body.key.key, undefined);
});

test('grant defaults to 1000 requests and rejects invalid input before mutation', async () => {
  const defaultHandler = adminHandler();
  assert.equal((await defaultHandler.request()).status, 200);
  assert.equal(defaultHandler.calls[0].args.p_daily_limit, 1000);
  for (const body of [{ keyId: 'invalid' }, { reason: '' }, { reason: 'x'.repeat(501) }]) {
    const { request, calls } = adminHandler();
    assert.equal((await request(body)).status, 400);
    assert.equal(calls.length, 0);
  }
  for (const limit of ['0', '-1', '1.5', 'oops', '2147483648']) {
    const { request, calls } = adminHandler({ env: { NW_LIMIT_STARTER: limit } });
    assert.equal((await request()).status, 500);
    assert.equal(calls.length, 0);
  }
});

test('grant reports billing/revocation conflicts and missing migration without success', async () => {
  for (const [code, status] of [['P0001', 409], ['42501', 403], ['P0002', 404], ['22023', 400], ['PGRST202', 503]]) {
    const { request } = adminHandler({ rpcResult: { error: { code, message: 'Grant refused' } } });
    const response = await request();
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.ok, undefined);
    if (status === 503) assert.match(body.error, /api-partner-grants.sql/);
  }
  const { request } = adminHandler({ rpcResult: { data: [] } });
  assert.equal((await request()).status, 500);
});

test('developer overview identifies complimentary grants without exposing attribution or secrets', async () => {
  let handler;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: actorId } } }) },
    from(table) {
      let columns;
      const query = {
        select(value) { columns = value; return this; },
        eq() { return this; }, lt() { return this; }, in() { return this; }, order() { return this; }, limit() { return this; },
        then(resolve, reject) {
          const data = table === 'api_keys' ? [
            { id: keyId, user_id: actorId, key: 'secret-never-return', tier: 'starter', status: 'active', daily_limit: 1000, partner_granted_at: '2026-10-24T00:00:00Z', partner_grant_reason: 'Internal note' },
            { id: 'paid', key: 'other-secret', tier: 'starter', status: 'active', daily_limit: 1000 },
          ] : [];
          if (table === 'api_keys') assert.match(columns, /partner_granted_at/);
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const context = vm.createContext({
    Response, console, createClient: () => client, serve: fn => { handler = fn; },
    Deno: { env: { get: () => undefined } },
  });
  vm.runInContext(stripTypeScriptTypes(read('supabase/functions/developer-portal/index.ts').replace(/^import .*\n/gm, '')), context);
  const response = await handler(new Request('https://test.local/developer-portal', {
    method: 'POST', headers: { Authorization: 'Bearer test-session' }, body: JSON.stringify({ action: 'me' }),
  }));
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.keys[0].complimentary, true);
  assert.equal(body.keys[1].complimentary, false);
  for (const key of body.keys) {
    assert.equal(key.key, undefined);
    assert.equal(key.partner_grant_reason, undefined);
    assert.equal(key.partner_granted_by, undefined);
  }
});

function renderPlan(keys) {
  const box = { innerHTML: '', appendChild() {} };
  const source = read('developer.html');
  const fn = source.slice(source.indexOf('function renderPlan(keys){'), source.indexOf('\nfunction renderKeys'));
  const context = vm.createContext({ keys, document: { getElementById: () => box, createElement: () => ({}) }, nf: n => Number(n).toLocaleString('en-NG') });
  vm.runInContext(`${fn}\nrenderPlan(keys)`, context);
  return box.innerHTML;
}

test('developer dashboard shows permanent partnership access without checkout or renewal controls', () => {
  const html = renderPlan([{ id: keyId, tier: 'starter', status: 'active', complimentary: true, daily_limit: 1000 }]);
  assert.match(html, /Starter · Partnership/);
  assert.match(html, /1,000 requests\/day · No expiry/);
  assert.doesNotMatch(html, /Choose a paid plan|Cancel plan|renews|\/month/);
});

test('paid Starter remains paid; pending, revoked and unmarked keys are never shown as complimentary', () => {
  const html = renderPlan([{ id: keyId, tier: 'starter', status: 'active', subscription: { tier: 'starter', status: 'active', price: 1000, renews_at: '2026-11-24' } }]);
  assert.match(html, /₦1,000\/month/);
  assert.match(html, /Cancel plan/);
  assert.doesNotMatch(html, /Partnership|Complimentary|No expiry/);
  for (const key of [
    { tier: 'starter', status: 'revoked', complimentary: true },
    { tier: 'starter', status: 'pending', complimentary: true },
    { tier: 'starter', status: 'active' },
    { tier: 'free', status: 'active' },
  ]) assert.doesNotMatch(renderPlan([key]), /Starter · Partnership/);
});

test('admin dashboard exposes grant only for eligible keys and escapes partnership notes', () => {
  const table = { innerHTML: '' };
  const source = read('ops-7e11366b.html');
  const fn = source.slice(source.indexOf('function renderApiKeys()'), source.indexOf('\nasync function grantPartnerStarter'));
  const context = vm.createContext({
    allApiKeys: [
      { id: 'eligible', tier: 'free', status: 'active' },
      { id: 'revoked', tier: 'free', status: 'revoked' },
      { id: 'paid', tier: 'starter', status: 'active' },
      { id: 'partner', tier: 'starter', status: 'active', partner_granted_at: '2026-10-24', partner_grant_reason: '<script>bad</script>' },
    ],
    document: { getElementById: id => id === 'ak-filter' ? { value: '' } : table },
    ago: () => '', _escHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  });
  vm.runInContext(`${fn}\nrenderApiKeys()`, context);
  assert.match(table.innerHTML, /grantPartnerStarter\('eligible'/);
  assert.doesNotMatch(table.innerHTML, /grantPartnerStarter\('(revoked|paid|partner)'/);
  assert.match(table.innerHTML, /revokeApiKey\('partner'/);
  assert.match(table.innerHTML, /Complimentary · No expiry/);
  assert.match(table.innerHTML, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(table.innerHTML, /<script>/);
});
