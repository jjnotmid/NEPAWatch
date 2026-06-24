/* ═══════════════════════════════════════════════════════════════════════════
   NEPAWatch — ai-engine Edge Function
   Runs every 10 minutes via pg_cron. Replaces all browser-side AI logic.

   What it does each run:
   1. Loads 2 000 recent reports (was 10 000 in browser — saves ~1.4 MB/user/session)
   2. Trains the statistical model server-side
   3. Fetches weather for all unique grid cells across Nigeria
   4. Computes outage probabilities for every area (~200 areas)
   5. Files 'out' reports where probability ≥ 0.58 and cooldown has elapsed
   6. Files 'bck' reports where probability dropped or outage is stale
   7. Writes precomputed probabilities to area_predictions table
      → browsers fetch this tiny table (~40 KB) instead of 10 000 training rows
   ═══════════════════════════════════════════════════════════════════════════ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  AI_USER_ID, AI_CONFIDENCE_THRESH, AI_RESTORE_THRESH,
  AI_MAX_PER_SCAN, AI_MIN_REFIRE_MS,
  AI_BOOTSTRAP_THRESH, AI_BOOTSTRAP_COOLDOWN_MS, AI_MAX_BOOTSTRAP_PER_SCAN,
  NIGERIA_AREA_BANDS, NIGERIA_AREA_COORDS,
  DISCO_BAND_BASELINE, DISCO_BAND_SUPPLY_HOURS,
  DISCO_ROTATION_MS, DISCO_BAND_MAX_OUT_MS,
  BAND_BASELINE,
  HOURLY_SOUTH, HOURLY_NORTH, HOURLY_CENTRAL, DAY_FACTOR,
  getAreaDisco, getHourlyCurve, getWeatherCellKey, getWeatherRiskMultiplier,
} from '../_shared/nigeria-data.ts';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS_HEADERS  = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };

/* ─── TYPES ─────────────────────────────────────────────────────────────── */
interface Report {
  id: string;
  location_area: string;
  type: 'out' | 'bck';
  created_at: string;
  confirms: number;
  wrong_votes: number;
}

interface HistoryCell {
  out: number;
  total: number;
  confirms: number;
}

interface WeatherData {
  code: number | null;
  rain: number;
  wind: number;
}

interface AreaState {
  ai_status: string | null;
  last_ai_out_at: string | null;
  last_ai_report_id: string | null;
}

/* ─── SERVER-SIDE HISTORY ENGINE ─────────────────────────────────────────
   Same algorithm as browser PredictHistory.ingest() but runs on 2 000 rows
   instead of 10 000. The per-DISCO weight cap prevents Lagos from drowning
   out sparse data from other DISCOs.                                       */
function buildHistory(rows: Report[]): Map<string, HistoryCell> {
  const data = new Map<string, HistoryCell>();
  const nowMs    = Date.now();
  const HALF_LIFE = 21 * 24 * 3600 * 1000;
  const DISCO_CAP = 500;

  const processed = rows
    .filter(r => r.location_area)
    .map(r => {
      const t     = new Date(r.created_at);
      const ageMs = Math.max(0, nowMs - t.getTime());
      const w     = Math.max(0.1, Math.pow(0.5, ageMs / HALF_LIFE))
                    * Math.min(3.0, 1 + (r.confirms || 1) * 0.25)
                    * Math.max(0.2, 1 - (r.wrong_votes || 0) * 0.35);
      return {
        k:    `${r.location_area}|${t.getHours()}|${t.getDay()}`,
        type: r.type,
        disco: getAreaDisco(r.location_area),
        w,
      };
    });

  const discoTotals: Record<string, number> = {};
  for (const { disco, w } of processed) discoTotals[disco] = (discoTotals[disco] || 0) + w;

  for (const { k, type, disco, w } of processed) {
    const sw = discoTotals[disco] > DISCO_CAP ? w * DISCO_CAP / discoTotals[disco] : w;
    const cell = data.get(k) || { out: 0, total: 0, confirms: 0 };
    cell.total += sw;
    if (type === 'out') cell.out += sw;
    data.set(k, cell);
  }

  return data;
}

function getRate(history: Map<string, HistoryCell>, area: string, h: number, d: number): number | null {
  const b = history.get(`${area}|${h}|${d}`);
  if (!b || b.total < 4) return null;
  const confirmBoost = Math.min(0.12, (b.confirms / (b.total * 4)) * 0.12);
  const raw = b.out / b.total;
  return Math.min(0.97, raw + (raw > 0.5 ? confirmBoost : -confirmBoost));
}

function getAreaRate(history: Map<string, HistoryCell>, area: string): number | null {
  let out = 0, total = 0;
  for (const [k, v] of history) {
    if (k.startsWith(area + '|')) { out += v.out; total += v.total; }
  }
  return total >= 6 ? out / total : null;
}

/* ─── FEEDER ROTATION ────────────────────────────────────────────────────
   Uses the last 'bck' report timestamp per area (loaded from DB).
   Returns a multiplier: < 1.0 = supply window, > 1.0 = due to go dark.   */
function getFeederRotationFactor(
  area: string,
  disco: string,
  band: string,
  lastBckAt: Date | null,
  nowMs: number,
): number {
  if (!lastBckAt) return 1.0;
  const rotMs    = DISCO_ROTATION_MS[disco] || 12 * 3600000;
  const bandHrs  = (DISCO_BAND_SUPPLY_HOURS[disco] || {})[band] || 10;
  const supplyMs = bandHrs * 3600000;
  const timeSince = nowMs - lastBckAt.getTime();
  if (timeSince > rotMs * 2) return 1.0;
  if (timeSince <= supplyMs) {
    return Math.max(0.5, 1.0 - 0.4 * (1.0 - timeSince / supplyMs));
  }
  const offFraction = Math.min(1.0, (timeSince - supplyMs) / Math.max(1, rotMs - supplyMs));
  return 1.0 + offFraction * 0.35;
}

/* ─── CORE PREDICTION ────────────────────────────────────────────────────
   Server-side equivalent of predictOutage() from predict.js.
   No ground truth override here — server uses statistical model only.
   Ground truth (live human reports) is handled by the browser layer.      */
function computeProb(
  area: string,
  h: number,
  d: number,
  history: Map<string, HistoryCell>,
  accuracyWeights: Record<string, number>,
  weatherCache: Map<string, WeatherData>,
  lastBckAt: Date | null,
  nowMs: number,
  nercOverrides: Record<string, Record<string, number>> | null,
): number {
  const band   = NIGERIA_AREA_BANDS[area] || 'C';
  const disco  = getAreaDisco(area);

  const bandBaselines = nercOverrides?.[disco] ?? DISCO_BAND_BASELINE[disco] ?? BAND_BASELINE;
  const base   = (bandBaselines as Record<string, number>)[band] ?? 0.42;

  const hourlyFactor = getHourlyCurve(area);
  const hProb  = Math.min(0.95, base * hourlyFactor[h]);
  const dAdj   = DAY_FACTOR[d];

  const hist   = getRate(history, area, h, d);
  const aHist  = getAreaRate(history, area);

  let statProb: number;
  if (hist !== null) {
    statProb = hist * 0.50 + hProb * 0.25 + base * dAdj * 0.25;
  } else if (aHist !== null) {
    statProb = aHist * 0.35 + hProb * 0.35 + base * dAdj * 0.30;
  } else {
    statProb = base * 0.45 + hProb * 0.35 + (base * dAdj - base) * 0.20;
  }

  // Feeder rotation
  const rotFactor = getFeederRotationFactor(area, disco, band, lastBckAt, nowMs);
  statProb = Math.min(0.97, statProb * rotFactor);

  // Per-area accuracy weight
  const accFactor = accuracyWeights[area] || 1.0;
  if (accFactor !== 1.0) statProb = Math.min(0.97, Math.max(0.03, statProb * accFactor));

  // Weather
  const cellKey = getWeatherCellKey(area);
  const wx = weatherCache.get(cellKey) || null;
  const wxFactor = getWeatherRiskMultiplier(wx);
  statProb = Math.min(0.97, statProb * wxFactor);

  return Math.min(0.97, Math.max(0.03, statProb));
}

/* ─── WEATHER FETCHER ────────────────────────────────────────────────────
   Fetches current weather from Open-Meteo (free, no key).
   Batches all unique 1-degree grid cells across Nigeria.                  */
async function fetchWeatherForAreas(areas: string[]): Promise<Map<string, WeatherData>> {
  const cache = new Map<string, WeatherData>();
  const seen  = new Set<string>();
  const cells: Array<{ key: string; lat: number; lng: number }> = [];

  for (const area of areas) {
    const c = NIGERIA_AREA_COORDS[area] || { lat: 9.08, lng: 7.40 };
    const key = `${Math.round(c.lat)}|${Math.round(c.lng)}`;
    if (!seen.has(key)) {
      seen.add(key);
      cells.push({ key, lat: Math.round(c.lat), lng: Math.round(c.lng) });
    }
  }

  // Fetch all cells in parallel (Nigeria has ~35 unique cells — well within Open-Meteo limits)
  await Promise.allSettled(cells.map(async ({ key, lat, lng }) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weathercode,precipitation,windspeed_10m&timezone=Africa%2FLagos`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;
      const d  = await res.json();
      const cu = d.current || {};
      cache.set(key, {
        code: cu.weathercode  ?? null,
        rain: cu.precipitation ?? 0,
        wind: cu.windspeed_10m ?? 0,
      });
    } catch {
      /* Degrade gracefully — model runs without weather data for this cell */
    }
  }));

  return cache;
}

/* ─── MAIN HANDLER ───────────────────────────────────────────────────────── */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  /* Require service role in Authorization header (pg_cron or admin HTTP call) */
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.includes(SERVICE_KEY)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const nowMs    = Date.now();
  const now      = new Date(nowMs);
  const h        = now.getUTCHours() + 1; // UTC+1 = WAT (Nigeria timezone)
  const wAt      = Math.floor(h / 24);
  const h_wat    = ((h % 24) + 24) % 24;
  const d_wat    = (now.getUTCDay() + wAt) % 7;

  const runLog: string[] = [];
  const log = (msg: string) => { runLog.push(msg); console.log(`[ai-engine] ${msg}`); };

  log(`Run start — WAT ${h_wat}:00 day ${d_wat}`);

  /* ── 1. Load recent reports for training ─────────────────────────────── */
  const { data: reportRows } = await supabase
    .from('reports')
    .select('id, location_area, type, created_at, confirms, wrong_votes')
    .order('created_at', { ascending: false })
    .limit(2000);

  const reports: Report[] = (reportRows || []) as Report[];
  log(`Loaded ${reports.length} training reports`);

  /* ── 2. Build history engine ─────────────────────────────────────────── */
  const history = buildHistory(reports);

  /* ── 3. Load accuracy weights ────────────────────────────────────────── */
  const { data: weightRows } = await supabase
    .from('ai_accuracy_weights')
    .select('area, weight');
  const accuracyWeights: Record<string, number> = {};
  for (const row of (weightRows || [])) accuracyWeights[row.area] = row.weight;
  log(`Loaded ${weightRows?.length || 0} accuracy weights`);

  /* ── 4. Load NERC baseline overrides ────────────────────────────────── */
  const { data: nercRows } = await supabase
    .from('nerc_baselines')
    .select('disco, band, outage_prob');
  const nercOverrides: Record<string, Record<string, number>> = {};
  for (const row of (nercRows || [])) {
    if (!nercOverrides[row.disco]) nercOverrides[row.disco] = {};
    nercOverrides[row.disco][row.band] = row.outage_prob;
  }

  /* ── 5. Load current area state (ai_status + cooldown timestamps) ─────── */
  const { data: stateRows } = await supabase
    .from('area_predictions')
    .select('area, ai_status, last_ai_out_at, last_ai_report_id');
  const areaState: Record<string, AreaState> = {};
  for (const row of (stateRows || [])) {
    areaState[row.area] = {
      ai_status:        row.ai_status,
      last_ai_out_at:   row.last_ai_out_at,
      last_ai_report_id: row.last_ai_report_id,
    };
  }

  /* ── 6. Fetch weather for all areas ─────────────────────────────────── */
  const allAreas = Object.keys(NIGERIA_AREA_BANDS);
  const weatherCache = await fetchWeatherForAreas(allAreas);
  log(`Weather fetched for ${weatherCache.size} grid cells`);

  /* ── 7. Get last 'bck' report per area (for feeder rotation) ─────────── */
  const cutoff48h = new Date(nowMs - 48 * 3600000).toISOString();
  const { data: bckRows } = await supabase
    .from('reports')
    .select('location_area, created_at')
    .eq('type', 'bck')
    .gte('created_at', cutoff48h)
    .order('created_at', { ascending: false });

  const lastBckByArea: Record<string, Date> = {};
  for (const row of (bckRows || [])) {
    if (!lastBckByArea[row.location_area]) {
      lastBckByArea[row.location_area] = new Date(row.created_at);
    }
  }

  /* ── 8. Compute probabilities for all areas ───────────────────────────── */
  interface AreaResult {
    area: string;
    disco: string;
    band: string;
    currentProb: number;
    forecast24h: Array<{ hour: number; prob: number }>;
    hasHistory: boolean;
  }

  const areaResults: AreaResult[] = [];

  for (const area of allAreas) {
    const band  = NIGERIA_AREA_BANDS[area] || 'C';
    const disco = getAreaDisco(area);
    const lastBck = lastBckByArea[area] || null;

    const currentProb = computeProb(area, h_wat, d_wat, history, accuracyWeights, weatherCache, lastBck, nowMs, nercOverrides);

    const forecast24h: Array<{ hour: number; prob: number }> = [];
    for (let i = 0; i < 24; i++) {
      const fh = (h_wat + i) % 24;
      const fd = (d_wat + Math.floor((h_wat + i) / 24)) % 7;
      const p  = computeProb(area, fh, fd, history, accuracyWeights, weatherCache, lastBck, nowMs, nercOverrides);
      forecast24h.push({ hour: fh, prob: parseFloat(p.toFixed(4)) });
    }

    const hasHistory = getAreaRate(history, area) !== null;

    areaResults.push({ area, disco, band, currentProb, forecast24h, hasHistory });
  }

  /* ── 9. Scan for outages to file ─────────────────────────────────────── */
  const outCandidates: Array<{ area: string; prob: number; isBootstrap: boolean }> = [];

  for (const { area, hasHistory, currentProb } of areaResults) {
    const state = areaState[area];
    if (state?.ai_status === 'out') continue; // already tracking outage

    // Cooldown: don't re-fire within AI_MIN_REFIRE_MS
    if (state?.last_ai_out_at) {
      const lastOutMs = new Date(state.last_ai_out_at).getTime();
      if (nowMs - lastOutMs < AI_MIN_REFIRE_MS) continue;
    }

    if (currentProb < AI_CONFIDENCE_THRESH) continue;

    // Bootstrap mode: much stricter rules for areas with no history
    let isBootstrap = false;
    if (!hasHistory) {
      if (currentProb < AI_BOOTSTRAP_THRESH) continue;
      if (state?.last_ai_out_at) {
        const lastOutMs = new Date(state.last_ai_out_at).getTime();
        if (nowMs - lastOutMs < AI_BOOTSTRAP_COOLDOWN_MS) continue;
      }
      isBootstrap = true;
    }

    outCandidates.push({ area, prob: currentProb, isBootstrap });
  }

  // Sort highest probability first
  outCandidates.sort((a, b) => b.prob - a.prob);

  let outFired = 0, bootstrapFired = 0;
  const firedReports: Array<{ area: string; type: string; repId: string | null }> = [];

  for (const { area, prob, isBootstrap } of outCandidates) {
    if (outFired >= AI_MAX_PER_SCAN) break;
    if (isBootstrap && bootstrapFired >= AI_MAX_BOOTSTRAP_PER_SCAN) continue;

    const { data: insertData, error: insertErr } = await supabase
      .from('reports')
      .insert({
        user_id:       AI_USER_ID,
        location_name: area,
        location_area: area,
        type:          'out',
        confirms:      1,
        ai_prob:       parseFloat(prob.toFixed(3)),
      })
      .select('id')
      .single();

    if (!insertErr && insertData) {
      const repId = String(insertData.id);
      firedReports.push({ area, type: 'out', repId });
      // Log to ai_predictions
      await supabase.from('ai_predictions').insert({
        report_id:   repId,
        area,
        disco:       getAreaDisco(area),
        type:        'out',
        probability: parseFloat(prob.toFixed(4)),
      }).then(() => {}).catch(() => {});
      // Update area state
      areaState[area] = { ai_status: 'out', last_ai_out_at: now.toISOString(), last_ai_report_id: repId };
      outFired++;
      if (isBootstrap) bootstrapFired++;
      log(`Filed OUT — ${area} @ ${Math.round(prob * 100)}%${isBootstrap ? ' [bootstrap]' : ''}`);
    } else if (insertErr) {
      log(`Insert failed for ${area}: ${insertErr.message}`);
    }
  }

  /* ── 10. Scan for restorations ───────────────────────────────────────── */
  const outAreas = Object.entries(areaState)
    .filter(([, s]) => s.ai_status === 'out')
    .map(([area]) => area);

  let bckFired = 0;

  for (const area of outAreas) {
    if (bckFired >= AI_MAX_PER_SCAN) break;

    const areaResult = areaResults.find(r => r.area === area);
    if (!areaResult) continue;

    const { currentProb, band } = areaResult;
    const state = areaState[area];
    const disco = getAreaDisco(area);
    const lastOutAt = state.last_ai_out_at ? new Date(state.last_ai_out_at) : null;
    const outageAgeMs = lastOutAt ? nowMs - lastOutAt.getTime() : 0;

    // Check if stale: been out longer than DISCO_BAND_MAX_OUT_MS and no human confirms
    const maxOutMs = (DISCO_BAND_MAX_OUT_MS[disco] || {})[band] || 12 * 3600000;
    let humanConfirmsForOutage = 0;
    if (state.last_ai_report_id) {
      const { count } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('location_area', area)
        .eq('type', 'out')
        .neq('user_id', AI_USER_ID)
        .gte('created_at', lastOutAt?.toISOString() || '2000-01-01');
      humanConfirmsForOutage = count || 0;
    }

    const isStale = outageAgeMs > maxOutMs && humanConfirmsForOutage === 0;

    // Check if probability dropped below restoration threshold
    const probDropped = currentProb < AI_RESTORE_THRESH && outageAgeMs > 90 * 60000;

    if (!isStale && !probDropped) continue;

    const reason = isStale ? 'stale' : 'prob-dropped';
    const { data: insertData, error: insertErr } = await supabase
      .from('reports')
      .insert({
        user_id:       AI_USER_ID,
        location_name: area,
        location_area: area,
        type:          'bck',
        confirms:      1,
        ai_prob:       parseFloat((1 - currentProb).toFixed(3)),
      })
      .select('id')
      .single();

    if (!insertErr && insertData) {
      const repId = String(insertData.id);
      firedReports.push({ area, type: 'bck', repId });
      areaState[area] = { ...state, ai_status: 'bck', last_ai_report_id: repId };
      bckFired++;
      log(`Filed BCK — ${area} [${reason}] prob=${Math.round(currentProb * 100)}%`);
    }
  }

  /* ── 11. Upsert all area_predictions ─────────────────────────────────── */
  const upsertRows = areaResults.map(({ area, disco, band, currentProb, forecast24h }) => {
    const state = areaState[area];
    return {
      area,
      disco,
      band,
      current_prob:      parseFloat(currentProb.toFixed(4)),
      forecast_24h:      forecast24h,
      ai_status:         state?.ai_status ?? null,
      last_ai_out_at:    state?.last_ai_out_at ?? null,
      last_ai_report_id: state?.last_ai_report_id ?? null,
      computed_at:       now.toISOString(),
    };
  });

  const { error: upsertErr } = await supabase
    .from('area_predictions')
    .upsert(upsertRows, { onConflict: 'area' });

  if (upsertErr) log(`Upsert error: ${upsertErr.message}`);
  else log(`Upserted ${upsertRows.length} area predictions`);

  /* ── 12. Persist weather readings to weather_log ─────────────────────── */
  if (weatherCache.size > 0) {
    const weatherInserts = [];
    for (const [key, wx] of weatherCache) {
      const [latStr, lonStr] = key.split('|');
      weatherInserts.push({
        lat_key:      parseFloat(latStr),
        lon_key:      parseFloat(lonStr),
        weather_code: wx.code,
        rain_mm:      wx.rain,
        wind_kmh:     wx.wind,
      });
    }
    await supabase.from('weather_log').insert(weatherInserts).then(() => {}).catch(() => {});
  }

  const summary = {
    run_at:          now.toISOString(),
    training_rows:   reports.length,
    areas_computed:  areaResults.length,
    out_reports:     outFired,
    bck_reports:     bckFired,
    weather_cells:   weatherCache.size,
    accuracy_weights: Object.keys(accuracyWeights).length,
    log:             runLog,
  };

  log(`Done — ${outFired} out, ${bckFired} bck, ${areaResults.length} areas updated`);

  return new Response(JSON.stringify(summary, null, 2), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
