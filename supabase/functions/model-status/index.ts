import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const supabase  = createClient(SUPABASE_URL, SERVICE_KEY);
  const THIRTY_D  = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const ONE_D     = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [predsRes, weightsRes, pendingRes, recentRes] = await Promise.all([
    supabase
      .from('ai_predictions')
      .select('area, disco, outcome, probability')
      .gte('predicted_at', THIRTY_D),
    supabase
      .from('ai_accuracy_weights')
      .select('area, weight')
      .order('weight', { ascending: false }),
    supabase
      .from('ai_predictions')
      .select('id', { count: 'exact', head: true })
      .is('outcome', null)
      .lt('predicted_at', new Date(Date.now() - 3 * 3600 * 1000).toISOString()),
    supabase
      .from('ai_predictions')
      .select('id', { count: 'exact', head: true })
      .gte('predicted_at', ONE_D),
  ]);

  const preds    = predsRes.data ?? [];
  const resolved = preds.filter(p => p.outcome && p.outcome !== 'unresolved');
  const correct  = resolved.filter(p => p.outcome === 'correct');
  const wrong    = resolved.filter(p => p.outcome === 'wrong');
  const accPct   = resolved.length > 0
    ? parseFloat((correct.length / resolved.length * 100).toFixed(1))
    : null;

  // Per-area breakdown
  type AreaAcc = { disco: string; total: number; correct: number; wrong: number };
  const byArea: Record<string, AreaAcc> = {};
  for (const p of resolved) {
    if (!byArea[p.area]) byArea[p.area] = { disco: p.disco ?? '', total: 0, correct: 0, wrong: 0 };
    byArea[p.area].total++;
    if (p.outcome === 'correct') byArea[p.area].correct++;
    if (p.outcome === 'wrong')   byArea[p.area].wrong++;
  }

  const areaList = Object.entries(byArea)
    .filter(([, v]) => v.total >= 3)
    .map(([area, v]) => ({
      area, disco: v.disco,
      accuracy: parseFloat((v.correct / v.total * 100).toFixed(1)),
      total: v.total,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

  // Per-DISCO breakdown
  type DiscoAcc = { total: number; correct: number };
  const byDisco: Record<string, DiscoAcc> = {};
  for (const p of resolved) {
    if (!p.disco) continue;
    if (!byDisco[p.disco]) byDisco[p.disco] = { total: 0, correct: 0 };
    byDisco[p.disco].total++;
    if (p.outcome === 'correct') byDisco[p.disco].correct++;
  }
  const discoList = Object.entries(byDisco).map(([disco, v]) => ({
    disco,
    accuracy: parseFloat((v.correct / v.total * 100).toFixed(1)),
    total: v.total,
  })).sort((a, b) => b.accuracy - a.accuracy);

  const weights = weightsRes.data ?? [];

  return new Response(JSON.stringify({
    ok: true,
    generated_at: new Date().toISOString(),
    summary: {
      total_predictions_30d:   preds.length,
      resolved_30d:            resolved.length,
      correct_30d:             correct.length,
      wrong_30d:               wrong.length,
      unresolved_30d:          preds.filter(p => p.outcome === 'unresolved').length,
      accuracy_pct:            accPct,
      calibrated_areas:        weights.length,
      pending_outcomes:        pendingRes.count ?? 0,
      predictions_last_24h:    recentRes.count ?? 0,
    },
    top_areas:   areaList.slice(0, 10),
    worst_areas: [...areaList].sort((a, b) => a.accuracy - b.accuracy).slice(0, 10),
    discos:      discoList,
  }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
});
