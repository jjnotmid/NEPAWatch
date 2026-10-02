// Public, shared reads only. Vercel caches each fixed URL before it reaches
// Supabase, so open browsers do not each download the same database rows.
const SUPABASE_URL = 'https://djurokbkkqrmpafcxlez.supabase.co';
// This is the public anon key already shipped in app.js. It grants only RLS
// public access. SUPABASE_ANON_KEY can override it when the key is rotated.
const PUBLIC_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdXJva2Jra3FybXBhZmN4bGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzE5OTUsImV4cCI6MjA4ODE0Nzk5NX0.ZLOtWFB7qy_J0mitjb_pcZ88wxmRjMe-3OdbQCRL8xE';

const SOURCES = {
  feed: { path: 'reports', select: 'id,user_id,location_name,location_area,type,confirms,created_at,ai_prob,wrong_votes', order: 'created_at.desc', limit: 400, ttl: 60 },
  recent: { path: 'reports', select: 'id,user_id,location_name,location_area,type,confirms,created_at,ai_prob,wrong_votes', order: 'created_at.desc', limit: 50, ttl: 30 },
  locations: { path: 'custom_locations', select: 'id,street_name,area_name,lat,lng', order: 'created_at.asc', ttl: 60 },
  predictions: { path: 'area_predictions', select: 'area,current_prob,ai_status,last_ai_out_at', ttl: 180 },
  weights: { path: 'ai_accuracy_weights', select: 'area,weight', ttl: 300 },
  nerc: { path: 'nerc_baselines', select: 'disco,band,outage_prob,supply_hours', ttl: 600 },
  week: { path: 'reports', select: 'user_id,display_name,location_area,type,created_at', order: 'created_at.desc', limit: 500, weekly: true, ttl: 300 },
  status: { path: 'model-status', function: true, ttl: 300 },
  stats: { custom: true, ttl: 300 },
};

const AUTH_HEADERS = { apikey: PUBLIC_ANON_KEY, Authorization: `Bearer ${PUBLIC_ANON_KEY}` };

async function publicStats() {
  const watNow = new Date(Date.now() + 60 * 60 * 1000);
  watNow.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(watNow.getTime() - 60 * 60 * 1000).toISOString();
  const specs = [
    `${SUPABASE_URL}/rest/v1/reports?select=id`,
    `${SUPABASE_URL}/rest/v1/profiles?select=id`,
    `${SUPABASE_URL}/rest/v1/reports?select=id&created_at=gte.${encodeURIComponent(todayStart)}`,
  ];
  const responses = await Promise.all(specs.map(url => fetch(url, {
    method: 'HEAD', headers: { ...AUTH_HEADERS, Prefer: 'count=exact' },
    signal: AbortSignal.timeout(8000),
  })));
  if (responses.some(response => !response.ok)) throw new Error('Stats unavailable');
  const counts = responses.map(response => Number(response.headers.get('content-range')?.split('/').pop()));
  if (counts.some(count => !Number.isFinite(count))) throw new Error('Stats count missing');
  return { reports: counts[0], users: counts[1], reportsToday: counts[2] };
}

function weekStartUtc() {
  const watNow = new Date(Date.now() + 60 * 60 * 1000);
  const daysBack = (watNow.getUTCDay() + 6) % 7;
  watNow.setUTCDate(watNow.getUTCDate() - daysBack);
  watNow.setUTCHours(0, 0, 0, 0);
  return new Date(watNow.getTime() - 60 * 60 * 1000).toISOString();
}

module.exports = async function publicData(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const type = typeof req.query.type === 'string' ? req.query.type : '';
  const config = SOURCES[type];
  if (!config) return res.status(400).json({ error: 'Unknown public data type' });

  try {
    if (config.custom) {
      const body = await publicStats();
      res.setHeader('Cache-Control', `public, s-maxage=${config.ttl}, stale-while-revalidate=${config.ttl}`);
      return res.status(200).json(body);
    }
    const url = new URL(`${SUPABASE_URL}/${config.function ? 'functions/v1' : 'rest/v1'}/${config.path}`);
    if (config.select) url.searchParams.set('select', config.select);
    if (config.order) url.searchParams.set('order', config.order);
    if (config.limit) url.searchParams.set('limit', String(config.limit));
    if (config.weekly) {
      url.searchParams.append('user_id', 'not.is.null');
      url.searchParams.append('user_id', 'neq.00000000-0000-0000-0000-000000000001');
      url.searchParams.set('created_at', `gte.${weekStartUtc()}`);
    }
    const upstream = await fetch(url, {
      headers: { ...AUTH_HEADERS, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ error: 'Public data temporarily unavailable', upstreamStatus: upstream.status });
    }
    const rows = await upstream.json();
    res.setHeader('Cache-Control', `public, s-maxage=${config.ttl}, stale-while-revalidate=${config.ttl}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).json(rows);
  } catch (_) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'Public data temporarily unavailable' });
  }
};
