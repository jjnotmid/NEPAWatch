const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicData = require('../api/public.js');

function response() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('public feed uses a fixed bounded query and sets a CDN TTL', async () => {
  const previous = global.fetch;
  let requested;
  global.fetch = async (url) => {
    requested = new URL(url);
    return { ok: true, json: async () => [{ id: 'one' }] };
  };
  try {
    const res = response();
    await publicData({ method: 'GET', query: { type: 'recent' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, [{ id: 'one' }]);
    assert.equal(requested.pathname, '/rest/v1/reports');
    assert.equal(requested.searchParams.get('limit'), '50');
    assert.match(res.headers['cache-control'], /s-maxage=30/);
  } finally { global.fetch = previous; }
});

test('upstream quota errors are not cached', async () => {
  const previous = global.fetch;
  global.fetch = async () => ({ ok: false, status: 402 });
  try {
    const res = response();
    await publicData({ method: 'GET', query: { type: 'feed' } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.body.upstreamStatus, 402);
  } finally { global.fetch = previous; }
});

test('service worker passes public API requests straight to network', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const handlers = {};
  let networkCalls = 0;
  const context = {
    self: {
      location: { origin: 'https://nepawatch.app' },
      addEventListener: (name, handler) => { handlers[name] = handler; },
    },
    URL,
    fetch: async () => { networkCalls++; return { status: 200 }; },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  let response;
  handlers.fetch({
    request: { url: 'https://nepawatch.app/api/public?type=recent', method: 'GET' },
    respondWith: promise => { response = promise; },
  });
  assert.equal((await response).status, 200);
  assert.equal(networkCalls, 1);
});

test('unknown public data types never reach Supabase', async () => {
  const previous = global.fetch;
  global.fetch = () => { throw new Error('unexpected upstream request'); };
  try {
    const res = response();
    await publicData({ method: 'GET', query: { type: 'profiles' } }, res);
    assert.equal(res.statusCode, 400);
  } finally { global.fetch = previous; }
});

test('stats combines only aggregate counts', async () => {
  const previous = global.fetch;
  const counts = [1234, 2001, 42];
  global.fetch = async (_url, options) => {
    assert.equal(options.method, 'HEAD');
    const count = counts.shift();
    return { ok: true, headers: { get: () => `*/${count}` } };
  };
  try {
    const res = response();
    await publicData({ method: 'GET', query: { type: 'stats' } }, res);
    assert.deepEqual(res.body, { reports: 1234, users: 2001, reportsToday: 42 });
  } finally { global.fetch = previous; }
});

test('Realtime subscribes only to watched areas and never requests mass email on receipt', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const start = source.indexOf('let _rtChannel=null');
  const end = source.indexOf('/* ── WAKE-UP HANDLER', start);
  assert.ok(start >= 0 && end > start);
  const subscriptions = [], alerts = [], removed = [];
  const channel = {
    on(_kind, config) { subscriptions.push(config); return this; },
    subscribe() { return this; },
  };
  const context = {
    document: { visibilityState: 'visible' },
    filterArea: 'Yaba', PR: { location_area: 'Yaba' },
    savedPlaces: [{ location_area: 'Lekki Phase 1', notif_on: true }],
    reports: [], CU: { id: 'viewer' }, AI_USER_ID: 'ai', _nearbyAreas: [],
    sb: { channel: () => channel, removeChannel: c => { removed.push(c); return Promise.resolve(); } },
    renderStats() {}, prependReportCard() {}, renderDiscos() {},
    renderSavedPlacesHome() {}, renderMyPlacesList() {},
    sendAreaAlerts: (...args) => alerts.push(args),
    clearTimeout() {}, setTimeout: () => 1,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end) + '\nglobalThis.hooks={startRealtime,handleRealtimeInsert};', context);
  context.hooks.startRealtime();
  assert.equal(subscriptions.length, 4);
  assert.deepEqual([...new Set(subscriptions.map(s => s.filter))],
    ['location_area=eq.Yaba', 'location_area=eq.Lekki Phase 1']);
  context.hooks.handleRealtimeInsert({ new: {
    id: 'report-1', user_id: 'other', location_name: 'Street',
    location_area: 'Yaba', type: 'out', created_at: new Date().toISOString(), confirms: 1,
  } });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0][4], true);
  context.document.visibilityState = 'hidden';
  context.hooks.startRealtime();
  assert.equal(removed.length, 1);
});

test('polling merges cached new reports and updated votes', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const start = source.indexOf('async function pollReports()');
  const end = source.indexOf('function startPolling()', start);
  let rows = [{ id: 'new', user_id: 'other', location_name: 'Street',
    location_area: 'Yaba', type: 'out', confirms: 1,
    created_at: '2026-10-02T13:01:00Z', wrong_votes: 0 }];
  let renders = 0;
  const context = {
    document: { visibilityState: 'visible' },
    _lastReportPollAt: '2026-10-02T13:00:00Z',
    _lastReportReconcileAt: Date.now(),
    reports: [{ id: 'old', time: Date.parse('2026-10-02T13:00:00Z'), confirms: 1, wrongVotes: 0 }],
    AI_USER_ID: 'ai', _nearbyAreas: [],
    fetchPublicRows: async () => rows,
    loadReports: async () => { throw new Error('unexpected full refresh'); },
    render: () => { renders++; }, renderSavedPlacesHome() {}, renderMyPlacesList() {},
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end) + '\nglobalThis.pollReports=pollReports;', context);
  await context.pollReports();
  assert.equal(context.reports[0].id, 'new');
  rows = [{ ...rows[0], confirms: 3, wrong_votes: 2 }];
  await context.pollReports();
  assert.equal(context.reports[0].confirms, 3);
  assert.equal(context.reports[0].wrongVotes, 2);
  assert.equal(renders, 2);
  rows = [{ ...rows[0], confirms: 1, wrong_votes: 0 }];
  await context.pollReports();
  assert.equal(context.reports[0].confirms, 3);
  assert.equal(context.reports[0].wrongVotes, 2);
  assert.equal(renders, 2);
  context.document.visibilityState = 'hidden';
  await context.pollReports();
  assert.equal(renders, 2);
});
