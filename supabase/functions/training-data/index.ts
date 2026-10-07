import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'GET') return jsonError('Use GET', 405);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return jsonError('Sign in required', 401);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return jsonError('Sign in required', 401);
  const { data: admin, error: adminError } = await supabase.from('admins')
    .select('user_id').eq('user_id', user.id).maybeSingle();
  if (adminError) return jsonError('Could not verify admin access', 500);
  if (!admin) return jsonError('Forbidden', 403);

  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'json';
  if (!['json', 'csv'].includes(format)) return jsonError('format must be json or csv', 400);
  const rawDays = url.searchParams.get('days') || '90';
  if (!/^\d+$/.test(rawDays)) return jsonError('days must be an integer from 1 to 365', 400);
  const days = Number(rawDays);
  if (days < 1 || days > 365) return jsonError('days must be an integer from 1 to 365', 400);
  const sinceDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  const reportLimit = 50000;
  const predictionLimit = 10000;

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

  const queryError = reportsRes.error || predsRes.error || weightsRes.error ||
    reliabilityRes.error || nercRes.error;
  if (queryError) {
    console.error('training-data export:', queryError);
    return jsonError('Could not prepare export', 500);
  }

  const reports = (reportsRes.data ?? []).map(({ user_id, ...report }) => ({
    ...report,
    is_ai: user_id === '00000000-0000-0000-0000-000000000001',
  }));
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
      csvCell(r.id),
      csvCell(r.location_area),
      csvCell(r.type),
      csvCell(r.created_at),
      csvCell(r.confirms ?? 1),
      csvCell(r.wrong_votes ?? 0),
      csvCell(r.is_ai ? 1 : 0),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    return new Response(csv, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="nepawatch-reports-${days}d.csv"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  return new Response(JSON.stringify({
    meta: {
      generated_at:      new Date().toISOString(),
      days_included:     days,
      access:            'admin',
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
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
