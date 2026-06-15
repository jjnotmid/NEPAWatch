import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-api-key',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // Require either a valid API key (paid tier) or service role for direct use
  // For now: require any active API key — free tier can export small samples
  const apiKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key');
  const authHeader = req.headers.get('Authorization') ?? '';
  const isServiceRole = authHeader.includes(SERVICE_KEY);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const url = new URL(req.url);
  const format    = url.searchParams.get('format') || 'json';  // json | csv
  const days      = Math.min(parseInt(url.searchParams.get('days') || '90'), 365);
  const sinceDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  let authorized = isServiceRole;
  let tier = 'service';

  if (!authorized && apiKey) {
    const { data: keyRow } = await supabase
      .from('api_keys')
      .select('status, tier')
      .eq('key', apiKey)
      .eq('status', 'active')
      .single();
    if (keyRow) {
      authorized = true;
      tier = keyRow.tier;
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: 'API key required. Request one at nepawatch.com/api' }), {
      status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Limit by tier
  const reportLimit      = tier === 'pro' || tier === 'service' ? 50000 : 1000;
  const predictionLimit  = tier === 'pro' || tier === 'service' ? 10000 : 500;

  const [reportsRes, predsRes, weightsRes, reliabilityRes, nercRes] = await Promise.all([
    supabase.from('reports')
      .select('id, location_area, type, created_at, confirms, wrong_votes, user_id, ai_prob')
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false })
      .limit(reportLimit),
    supabase.from('ai_predictions')
      .select('id, area, disco, type, probability, predicted_at, outcome, human_confirms, human_wrong_votes, outcome_checked_at')
      .gte('predicted_at', sinceDate)
      .not('outcome', 'is', null)
      .order('predicted_at', { ascending: false })
      .limit(predictionLimit),
    supabase.from('ai_accuracy_weights')
      .select('area, weight, sample_count, last_updated')
      .order('weight'),
    supabase.from('area_reliability')
      .select('area, disco, total_predictions, correct_predictions, accuracy_pct, avg_hours_out_per_day, reliability_score, last_computed')
      .order('reliability_score', { ascending: false }),
    supabase.from('nerc_baselines')
      .select('disco, band, outage_prob, supply_hours, saidi_annual, saifi_annual, source_period, updated_at')
      .order('disco').order('band'),
  ]);

  const reports     = reportsRes.data     ?? [];
  const predictions = predsRes.data       ?? [];
  const weights     = weightsRes.data     ?? [];
  const reliability = reliabilityRes.data ?? [];
  const nerc        = nercRes.data        ?? [];

  const resolved = predictions.filter(p => p.outcome !== 'unresolved');
  const correct  = resolved.filter(p => p.outcome === 'correct');
  const accPct   = resolved.length > 0
    ? parseFloat((correct.length / resolved.length * 100).toFixed(1))
    : null;

  if (format === 'csv') {
    // CSV export of reports — most useful for quick ML ingestion
    const headers = ['id','location_area','type','created_at','confirms','wrong_votes','is_ai'];
    const rows = reports.map(r => [
      r.id,
      `"${(r.location_area || '').replace(/"/g, '')}"`,
      r.type,
      r.created_at,
      r.confirms ?? 1,
      r.wrong_votes ?? 0,
      r.user_id === '00000000-0000-0000-0000-000000000001' ? 1 : 0,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    return new Response(csv, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="nepawatch-reports-${days}d.csv"`,
      },
    });
  }

  return new Response(JSON.stringify({
    meta: {
      generated_at:      new Date().toISOString(),
      days_included:     days,
      tier,
      total_reports:     reports.length,
      total_predictions: predictions.length,
      resolved_predictions: resolved.length,
      overall_accuracy_pct: accPct,
      calibrated_areas:  weights.length,
      nerc_discos:       [...new Set(nerc.map(n => n.disco))].length,
    },
    reports,
    predictions,
    accuracy_weights:  weights,
    area_reliability:  reliability,
    nerc_baselines:    nerc,
  }, null, 2), {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="nepawatch-training-${days}d.json"`,
    },
  });
});
