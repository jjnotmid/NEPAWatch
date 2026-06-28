import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const THREE_HOURS_AGO = new Date(Date.now() - 3 * 3600 * 1000).toISOString();

  // ── 1. Find predictions older than 3h with no outcome ────────────────────
  const { data: pending, error: pendErr } = await supabase
    .from('ai_predictions')
    .select('id, area, type, probability, predicted_at, report_id')
    .is('outcome', null)
    .lt('predicted_at', THREE_HOURS_AGO)
    .order('predicted_at', { ascending: true })
    .limit(200);

  if (pendErr) {
    return new Response(JSON.stringify({ error: pendErr.message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  if (!pending?.length) {
    return new Response(JSON.stringify({ ok: true, checked: 0, message: 'No pending predictions.' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ── 2. For each prediction, look up human reports in the ±3h window ──────
  const WINDOW_MS = 3 * 3600 * 1000;
  const outcomes: Array<{
    id: string; outcome: 'correct' | 'wrong' | 'unresolved';
    human_confirms: number; human_wrong_votes: number;
  }> = [];
  const weightDeltas: Record<string, Array<'correct' | 'wrong'>> = {};

  for (const pred of pending) {
    const windowStart = new Date(new Date(pred.predicted_at).getTime() - 15 * 60 * 1000).toISOString();
    const windowEnd   = new Date(new Date(pred.predicted_at).getTime() + WINDOW_MS).toISOString();

    const { data: humanReports } = await supabase
      .from('reports')
      .select('type, confirms, wrong_votes, user_id')
      .eq('location_area', pred.area)
      .neq('user_id', '00000000-0000-0000-0000-000000000001') // exclude AI's own
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd);

    const relevant = humanReports ?? [];

    let totalConfirms  = 0;
    let totalWrongVotes = 0;
    let sameTypeReports = 0;
    let oppositeTypeReports = 0;

    for (const r of relevant) {
      if (r.type === pred.type) {
        sameTypeReports++;
        totalConfirms   += Math.max(0, (r.confirms || 1) - 1);
        totalWrongVotes += r.wrong_votes || 0;
      } else {
        oppositeTypeReports++;
      }
    }

    let outcome: 'correct' | 'wrong' | 'unresolved';
    if (totalWrongVotes >= 2 || (oppositeTypeReports >= 2 && sameTypeReports === 0)) {
      outcome = 'wrong';
    } else if (totalConfirms >= 2 || sameTypeReports >= 2) {
      outcome = 'correct';
    } else {
      outcome = 'unresolved';
    }

    outcomes.push({ id: pred.id, outcome, human_confirms: totalConfirms, human_wrong_votes: totalWrongVotes });

    // Only 'out' predictions adjust accuracy weights (same as browser logic)
    if (pred.type === 'out' && outcome !== 'unresolved') {
      if (!weightDeltas[pred.area]) weightDeltas[pred.area] = [];
      weightDeltas[pred.area].push(outcome);
    }
  }

  // ── 3. Batch-update outcomes in ai_predictions ───────────────────────────
  let updated = 0;
  for (const o of outcomes) {
    const { error } = await supabase
      .from('ai_predictions')
      .update({
        outcome: o.outcome,
        human_confirms: o.human_confirms,
        human_wrong_votes: o.human_wrong_votes,
        outcome_checked_at: new Date().toISOString(),
      })
      .eq('id', o.id);
    if (!error) updated++;
  }

  // ── 4. Update ai_accuracy_weights based on new outcomes ──────────────────
  if (Object.keys(weightDeltas).length > 0) {
    const { data: existingWeights } = await supabase
      .from('ai_accuracy_weights')
      .select('area, weight, sample_count')
      .in('area', Object.keys(weightDeltas));

    const weightMap: Record<string, { weight: number; sample_count: number }> = {};
    for (const w of (existingWeights ?? [])) {
      weightMap[w.area] = { weight: parseFloat(w.weight), sample_count: w.sample_count ?? 0 };
    }

    const upserts = Object.entries(weightDeltas).map(([area, results]) => {
      let cur = weightMap[area]?.weight ?? 1.0;
      let count = weightMap[area]?.sample_count ?? 0;
      for (const r of results) {
        if (r === 'wrong')   cur = Math.max(0.35, cur * 0.82);
        if (r === 'correct') cur = Math.min(1.25, cur * 1.06);
        count++;
      }
      return { area, weight: parseFloat(cur.toFixed(4)), sample_count: count, last_updated: new Date().toISOString() };
    });

    await supabase.from('ai_accuracy_weights').upsert(upserts, { onConflict: 'area' });
  }

  const correctCount = outcomes.filter(o => o.outcome === 'correct').length;
  const wrongCount   = outcomes.filter(o => o.outcome === 'wrong').length;

  return new Response(JSON.stringify({
    ok: true,
    checked: pending.length,
    updated,
    correct: correctCount,
    wrong: wrongCount,
    unresolved: outcomes.filter(o => o.outcome === 'unresolved').length,
    weights_updated: Object.keys(weightDeltas).length,
  }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
});
