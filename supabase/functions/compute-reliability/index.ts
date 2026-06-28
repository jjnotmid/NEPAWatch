import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS_HEADERS  = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const SEVEN_DAYS_AGO  = new Date(Date.now() - 7  * 24 * 3600 * 1000).toISOString();

  // ── 1. Compute per-area accuracy from ai_predictions (last 30 days) ──────
  const { data: predictions, error: predErr } = await supabase
    .from('ai_predictions')
    .select('area, disco, outcome, probability')
    .not('outcome', 'is', null)
    .gte('predicted_at', THIRTY_DAYS_AGO);

  if (predErr) {
    return new Response(JSON.stringify({ error: predErr.message }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  type AreaStats = { disco: string; total: number; correct: number };
  const byArea: Record<string, AreaStats> = {};
  for (const p of (predictions ?? [])) {
    if (!byArea[p.area]) byArea[p.area] = { disco: p.disco ?? '', total: 0, correct: 0 };
    byArea[p.area].total++;
    if (p.outcome === 'correct') byArea[p.area].correct++;
  }

  // ── 2. Compute avg hours out per day from crowd reports (last 7 days) ────
  const { data: reports } = await supabase
    .from('reports')
    .select('location_area, type, created_at')
    .gte('created_at', SEVEN_DAYS_AGO)
    .order('location_area')
    .order('created_at');

  type OutageWindow = { start: number; end?: number };
  const areaWindows: Record<string, OutageWindow[]> = {};
  const lastOut: Record<string, number> = {};

  for (const row of (reports ?? [])) {
    const area = row.location_area;
    const ts   = new Date(row.created_at).getTime();
    if (row.type === 'out') {
      lastOut[area] = ts;
    } else if (row.type === 'bck' && lastOut[area]) {
      if (!areaWindows[area]) areaWindows[area] = [];
      areaWindows[area].push({ start: lastOut[area], end: ts });
      delete lastOut[area];
    }
  }
  // Any area still 'out' at query time — treat as outage until now
  const nowMs = Date.now();
  for (const [area, startTs] of Object.entries(lastOut)) {
    if (!areaWindows[area]) areaWindows[area] = [];
    areaWindows[area].push({ start: startTs, end: nowMs });
  }

  const hoursOutPerDay: Record<string, number> = {};
  for (const [area, windows] of Object.entries(areaWindows)) {
    const totalMs = windows.reduce((sum, w) => sum + ((w.end ?? nowMs) - w.start), 0);
    hoursOutPerDay[area] = parseFloat((totalMs / (7 * 3600000)).toFixed(2));
  }

  // ── 3. Build and upsert area_reliability rows ────────────────────────────
  const upserts = Object.entries(byArea).map(([area, stats]) => {
    const accuracy = stats.total > 0 ? stats.correct / stats.total : null;
    return {
      area,
      disco: stats.disco,
      total_predictions:     stats.total,
      correct_predictions:   stats.correct,
      accuracy_pct:          accuracy !== null ? parseFloat((accuracy * 100).toFixed(2)) : null,
      avg_hours_out_per_day: hoursOutPerDay[area] ?? null,
      reliability_score:     accuracy !== null ? parseFloat(accuracy.toFixed(4)) : 0.5,
      last_computed:         new Date().toISOString(),
    };
  });

  if (upserts.length) {
    const { error: upsertErr } = await supabase
      .from('area_reliability')
      .upsert(upserts, { onConflict: 'area' });
    if (upsertErr) {
      return new Response(JSON.stringify({ error: upsertErr.message }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }
  }

  // Also pull the accuracy weights to include a summary in the response
  const { data: weights } = await supabase
    .from('ai_accuracy_weights')
    .select('area, weight')
    .order('weight');

  return new Response(JSON.stringify({
    ok: true,
    areas_computed: upserts.length,
    accuracy_weights_count: weights?.length ?? 0,
    overall_accuracy: byArea && Object.keys(byArea).length > 0
      ? parseFloat((Object.values(byArea).reduce((s, v) => s + (v.total > 0 ? v.correct / v.total : 0), 0) / Object.keys(byArea).length * 100).toFixed(1))
      : null,
  }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
});
