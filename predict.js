/* ===== NEPAWatch Nigeria — predict.js ===== */
/* AI Auto-Reporter: predicts outages and auto-submits reports attributed to  */
/* "NEPAWatch AI". No external APIs — pure statistical model, 100% free.      */
/*                                                                             */
/* Research grounding:                                                         */
/*  - Energy for Growth Hub (2025): outage peaks 5am & 7pm; ~60% load shedding*/
/*  - NERC SBT tariff bands: Band A=20-24h supply, Band E=4-8h supply target  */
/*  - Sensors/MDPI (2024): XGBoost 98.4% accuracy on outage duration           */

/* ─── IDENTITY ──────────────────────────────────────────────────────────── */
const AI_USER_ID            = '00000000-0000-0000-0000-000000000001';
const AI_USER_NAME          = 'NEPAWatch AI';

/* ── LAUNCH DAY MODE — higher activity, lower thresholds ───────────────────
   Tuned to keep the feed busy for launch. Revert after launch week.         */
const AI_CONFIDENCE_THRESH  = 0.58;   /* launch: fire more freely */
const AI_SCAN_INTERVAL_MS   = 3 * 60 * 1000;   /* scan every 3 min */
const AI_RESTORE_THRESH     = 0.32;   /* restore more aggressively */
const AI_MAX_PER_SCAN       = 6;      /* up to 6 reports per scan */
const AI_MIN_REFIRE_MS      = 45 * 60 * 1000;  /* 45 min cooldown per area */

/* Cold-start bootstrap — seeds new-DISCO cities before any human has reported.
   Stricter than normal: higher threshold, 6 h cooldown, max 2 per scan, and
   only for areas whose DISCO is mapped in NIGERIA_DISCOS.                   */
const AI_BOOTSTRAP_THRESH       = 0.72;              /* well above normal 0.58   */
const AI_BOOTSTRAP_COOLDOWN_MS  = 6 * 3600 * 1000;  /* 6 h vs normal 45 min     */
const AI_MAX_BOOTSTRAP_PER_SCAN = 2;                 /* max 2 bootstrap fires/scan */

/* Per-area AI accuracy multipliers — adjusted by the 15-min feedback loop.
   Persisted to localStorage so corrections survive page reloads.            */
const _AI_ACCURACY_KEY = 'nw_ai_accuracy_v1';
const _aiAreaAccuracy = (() => {
  try { return JSON.parse(localStorage.getItem(_AI_ACCURACY_KEY)) || {}; }
  catch(e) { return {}; }
})();

/* Cached model-status response from the server — populated on start(), used
   to show live accuracy % in the AI banner without additional fetches.      */
let _modelStatus = null;
async function loadModelStatus() {
  if (window.NW_MAINTENANCE) return;
  if (typeof SUPA_URL === 'undefined') return;
  try {
    const res = await fetch('/api/public?type=status');
    if (res.ok) {
      _modelStatus = await res.json();
      if (typeof renderPredictPage === 'function') renderPredictPage();
      console.log(`[NEPAWatch AI] Model status: ${_modelStatus?.summary?.accuracy_pct ?? '—'}% accuracy (30d).`);
    }
  } catch(e) {}
}
function _saveAiAccuracy() {
  try { localStorage.setItem(_AI_ACCURACY_KEY, JSON.stringify(_aiAreaAccuracy)); }
  catch(e) {}
  _syncAccuracyToSupabase();
}
async function _syncAccuracyToSupabase() {
  if (typeof sb === 'undefined') return;
  try {
    const upserts = Object.entries(_aiAreaAccuracy).map(([area, weight]) => ({
      area, weight: parseFloat(weight.toFixed(4)), last_updated: new Date().toISOString(),
    }));
    if (upserts.length) await sb.from('ai_accuracy_weights').upsert(upserts, { onConflict: 'area' });
  } catch(e) {}
}
async function _loadAccuracyFromSupabase() {
  if (window.NW_MAINTENANCE) return;
  if (typeof sb === 'undefined') return;
  try {
    const data = await fetchPublicRows('weights');
    if (data.length) {
      for (const row of data) _aiAreaAccuracy[row.area] = parseFloat(row.weight);
      try { localStorage.setItem(_AI_ACCURACY_KEY, JSON.stringify(_aiAreaAccuracy)); } catch(e2) {}
      console.log(`[NEPAWatch AI] Loaded ${data.length} accuracy weights from Supabase.`);
    }
  } catch(e) {}
}
async function _loadNercBaselines() {
  if (window.NW_MAINTENANCE) return;
  if (typeof sb === 'undefined') return;
  try {
    const data = await fetchPublicRows('nerc');
    if (data.length) {
      for (const row of data) {
        if (!DISCO_BAND_BASELINE[row.disco]) DISCO_BAND_BASELINE[row.disco] = {};
        if (!DISCO_BAND_SUPPLY_HOURS[row.disco]) DISCO_BAND_SUPPLY_HOURS[row.disco] = {};
        DISCO_BAND_BASELINE[row.disco][row.band]      = parseFloat(row.outage_prob);
        DISCO_BAND_SUPPLY_HOURS[row.disco][row.band]  = parseFloat(row.supply_hours);
      }
      console.log(`[NEPAWatch AI] Loaded ${data.length} NERC baselines from Supabase.`);
    }
  } catch(e) {}
}

/* Max time an AI outage can stay 'out' before auto-restoring if no human
   confirms it.  Lagos DISCOs rotate every ~2-4 h; Northern DISCOs (KAEDCO,
   YEDC) are out 8-30 h routinely — a flat table causes false restorations.  */
const DISCO_BAND_MAX_OUT_MS = {
  'IE':     { A: 2*3600000, B: 4*3600000, C: 6*3600000, D:  9*3600000, E: 12*3600000 },
  'EKEDC':  { A: 2*3600000, B: 4*3600000, C: 6*3600000, D:  9*3600000, E: 12*3600000 },
  'AEDC':   { A: 3*3600000, B: 5*3600000, C: 7*3600000, D: 10*3600000, E: 14*3600000 },
  'IBEDC':  { A: 4*3600000, B: 6*3600000, C: 8*3600000, D: 11*3600000, E: 16*3600000 },
  'PHED':   { A: 5*3600000, B: 7*3600000, C: 9*3600000, D: 12*3600000, E: 18*3600000 },
  'EEDC':   { A: 5*3600000, B: 7*3600000, C: 9*3600000, D: 12*3600000, E: 18*3600000 },
  'BEDC':   { A: 4*3600000, B: 6*3600000, C: 8*3600000, D: 11*3600000, E: 16*3600000 },
  'JED':    { A: 6*3600000, B: 8*3600000, C:10*3600000, D: 13*3600000, E: 20*3600000 },
  'KEDCO':  { A: 5*3600000, B: 7*3600000, C: 9*3600000, D: 12*3600000, E: 18*3600000 },
  'KAEDCO': { A: 8*3600000, B:10*3600000, C:13*3600000, D: 18*3600000, E: 24*3600000 },
  'YEDC':   { A:10*3600000, B:14*3600000, C:18*3600000, D: 22*3600000, E: 30*3600000 },
};
function _getBandMaxOutMs(area) {
  _buildAreaDiscoMap();
  return DISCO_BAND_MAX_OUT_MS[_AREA_DISCO[area]] || DISCO_BAND_MAX_OUT_MS['IE'];
}

/* ─── DISCO ALERT MULTIPLIERS ────────────────────────────────────────────── */
/* Admin-settable probability multipliers for declared grid emergencies.
 * Set via the admin Grid Alerts panel. Keys are DISCO short names.
 * 1.0 = normal, 2.5 = declared emergency, 0.0 = suppress AI for this DISCO.
 * Persisted to localStorage ('nw-disco-alert') and a Supabase disco_alerts table.
 *
 * Example: during total IKEDC collapse → DISCO_ALERT['IKEDC'] = 2.5
 */
const DISCO_ALERT = (()=>{try{return JSON.parse(localStorage.getItem('nw-disco-alert')||'{}');}catch(e){return {};}})();

/* _AREA_DISCO is built dynamically from NIGERIA_DISCOS below; _getAreaDisco provides a safe accessor. */
function _getAreaDisco(area){ _buildAreaDiscoMap(); return _AREA_DISCO[area] || 'IKEDC'; }

/* ─── BAND CLASSIFICATION ────────────────────────────────────────────────── */
/* AREA_BANDS is populated by nigeria_data.js (NIGERIA_AREA_BANDS) which loads */
/* immediately after this file.  This empty object is the merge target — never */
/* add entries here.  NIGERIA_AREA_BANDS in nigeria_data.js is the sole source.*/
const AREA_BANDS = {};

const BAND_BASELINE      = { A:0.18, B:0.28, C:0.42, D:0.58, E:0.74 }; /* Lagos fallback */
const BAND_SUPPLY_HOURS  = { A:22,   B:18,   C:14,   D:10,   E:6    }; /* Lagos fallback */
const BAND_COLOR         = { A:"#00E676", B:"#69F0AE", C:"#FFB300", D:"#FF7043", E:"#FF3D57" };

/* ─── PER-DISCO BAND BASELINES ────────────────────────────────────────────
   Outage probability per NERC band, calibrated to each DISCO's actual
   performance tier.  Source: NERC Annual Reports 2022-24 + SBT scorecards.

   Key insight: Band A in Lagos (IE/EKEDC) averages ~21 h supply/day.
   Band A in Kaduna (KAEDCO) averages ~11 h — nearly twice the outage rate.
   A single flat baseline produces large systematic errors for non-Lagos areas. */
const DISCO_BAND_BASELINE = {
  'IE':     { A:0.18, B:0.28, C:0.42, D:0.58, E:0.74 }, /* Ikeja Electric  — Lagos North, best  */
  'EKEDC':  { A:0.18, B:0.28, C:0.42, D:0.58, E:0.74 }, /* Eko Electric    — Lagos South        */
  'AEDC':   { A:0.22, B:0.34, C:0.50, D:0.64, E:0.78 }, /* Abuja Electric  — above average      */
  'IBEDC':  { A:0.32, B:0.44, C:0.57, D:0.70, E:0.82 }, /* Ibadan Electric — below average      */
  'PHED':   { A:0.38, B:0.50, C:0.62, D:0.74, E:0.86 }, /* PHED Port Harcourt — poor            */
  'EEDC':   { A:0.42, B:0.53, C:0.64, D:0.75, E:0.86 }, /* Enugu Electric  — poor               */
  'BEDC':   { A:0.32, B:0.45, C:0.58, D:0.71, E:0.84 }, /* Benin Electric  — below average      */
  'JED':    { A:0.45, B:0.56, C:0.67, D:0.77, E:0.88 }, /* Jos Electric    — poor               */
  'KEDCO':  { A:0.40, B:0.52, C:0.64, D:0.76, E:0.88 }, /* Kano Electric   — poor, Northern     */
  'KAEDCO': { A:0.48, B:0.59, C:0.70, D:0.81, E:0.92 }, /* Kaduna Electric — very poor          */
  'YEDC':   { A:0.55, B:0.65, C:0.74, D:0.84, E:0.94 }, /* Yola Electric   — worst performer    */
};

/* Expected actual supply hours per band per DISCO (used in UI + duration model) */
const DISCO_BAND_SUPPLY_HOURS = {
  'IE':     { A:22, B:18, C:13, D:9,  E:7 },
  'EKEDC':  { A:22, B:18, C:13, D:9,  E:7 },
  'AEDC':   { A:20, B:16, C:12, D:8,  E:6 },
  'IBEDC':  { A:17, B:13, C:10, D:7,  E:5 },
  'PHED':   { A:14, B:11, C:9,  D:6,  E:3 },
  'EEDC':   { A:14, B:11, C:9,  D:6,  E:3 },
  'BEDC':   { A:17, B:13, C:10, D:7,  E:4 },
  'JED':    { A:13, B:10, C:8,  D:6,  E:3 },
  'KEDCO':  { A:14, B:11, C:9,  D:6,  E:3 },
  'KAEDCO': { A:12, B:9,  C:7,  D:5,  E:2 },
  'YEDC':   { A:10, B:8,  C:6,  D:4,  E:2 },
};

/* Area → DISCO lookup, built once on first use from NIGERIA_DISCOS.lgas */
const _AREA_DISCO = {};
let   _areaDiscoReady = false;
function _buildAreaDiscoMap() {
  if (_areaDiscoReady || typeof NIGERIA_DISCOS === 'undefined') return;
  for (const d of NIGERIA_DISCOS)
    for (const lga of (d.lgas || []))
      _AREA_DISCO[lga] = d.shortName;
  _areaDiscoReady = true;
}

function _getBandBaseline(area) {
  _buildAreaDiscoMap();
  const t = DISCO_BAND_BASELINE[_AREA_DISCO[area]];
  return t || BAND_BASELINE;
}
function _getBandSupplyHours(area) {
  _buildAreaDiscoMap();
  const t = DISCO_BAND_SUPPLY_HOURS[_AREA_DISCO[area]];
  return t || BAND_SUPPLY_HOURS;
}

/* ─── FEEDER ROTATION MODEL ──────────────────────────────────────────────────
   Nigerian DISCOs operate explicit feeder schedules — Feeder A gets power for
   N hours, then it's cut and Feeder B gets it.  This creates a deterministic
   cyclic pattern stronger than anything PredictHistory can learn from sparse
   crowd data.  Rotation periods vary by DISCO culture and grid topology.

   Typical values (field reports + NERC grid-code review 2024):
     - Lagos DISCOs operate 12 h rotation blocks with better adherence
     - Ibadan, PH, Enugu: strict 8 h feeder-switching regimes
     - Northern DISCOs: 12 h blocks but often extended during high-load season  */
const DISCO_ROTATION_MS = {
  'IE':     12 * 3600000,
  'EKEDC':  12 * 3600000,
  'AEDC':   12 * 3600000,
  'IBEDC':   8 * 3600000,
  'PHED':    8 * 3600000,
  'EEDC':    8 * 3600000,
  'BEDC':   12 * 3600000,
  'JED':    12 * 3600000,
  'KEDCO':   8 * 3600000,
  'KAEDCO': 12 * 3600000,
  'YEDC':   12 * 3600000,
};

/* ─── DISCO OPERATIONAL STATE ───────────────────────────────────────────────
   Admin (or a future admin-panel call) sets entries here to reflect declared
   grid emergencies, force-majeure events, or planned restoration windows.
   multiplier > 1.0 boosts outage probability (worse than normal).
   multiplier < 1.0 suppresses it (e.g. announced maintenance complete).
   Entries with `until` in the past are silently ignored.

   Example — to activate from browser console / admin panel:
     DISCO_ALERT['KAEDCO'] = { level:'emergency', multiplier:1.5, until: Date.now()+8*3600000 };
     DISCO_ALERT['IE']     = { level:'maintenance', multiplier:0.7, until: Date.now()+2*3600000 }; */

/* Returns a multiplier (0.5–1.35) based on where the area is in its feeder
   rotation cycle, estimated from the last known restoration report.
   < 1.0: still in supply window — reduce outage probability
   > 1.0: supply window elapsed — area is due to go off                       */
function _getFeederRotationFactor(area, nowMs) {
  if (typeof reports === 'undefined') return 1.0;
  _buildAreaDiscoMap();
  const disco = _AREA_DISCO[area];
  if (!disco) return 1.0;
  const rotMs    = DISCO_ROTATION_MS[disco] || 12 * 3600000;
  const band     = AREA_BANDS[area] || 'C';
  const supplyMs = (_getBandSupplyHours(area)[band] || 10) * 3600000;

  const lastBck = reports
    .filter(r => r.area === area && r.type === 'bck')
    .sort((a, b) => b.time - a.time)[0];
  if (!lastBck) return 1.0;

  const timeSince = nowMs - lastBck.time;
  if (timeSince > rotMs * 2) return 1.0; // too stale — no meaningful phase info

  if (timeSince <= supplyMs) {
    // Still within expected supply window — lower outage probability
    return Math.max(0.5, 1.0 - 0.4 * (1.0 - timeSince / supplyMs));
  }
  // Past supply window — rotation says this feeder is due to go dark
  const offFraction = Math.min(1.0, (timeSince - supplyMs) / Math.max(1, rotMs - supplyMs));
  return 1.0 + offFraction * 0.35;
}

/* ─── HOURLY DEMAND-RISK CURVES (region-specific) ────────────────────────
   Nigeria spans 14° of latitude and three distinct demand cultures:

   SOUTH  (lat ≤ 7.5°) — Lagos/SW/SS/SE — Energy for Growth Hub (2025)
     Dual peaks: 5 am (water pumps, AC start) and 7 pm (cooking, lighting).

   NORTH  (lat > 10°)  — Kano/KEDCO, Kaduna/KAEDCO
     Earlier peaks: 5 am Fajr prayer + 6 pm Maghrib prayer/cooking.
     Earlier bedtime, lower late-night demand, midday lull more pronounced.

   CENTRAL (7.5° < lat ≤ 10°) — Abuja/AEDC, Jos/JED, Yola/YEDC, middle belt
     Blends: small 5 am prayer spike + sustained 8 am–5 pm government-office
     hump + 7 pm residential evening peak.                                   */

const HOURLY_SOUTH = [              /* Lagos + South West / South South / South East */
  0.90,0.80,0.72,0.68,0.72,1.38,1.22,1.10,
  0.98,0.88,0.82,0.80,0.82,0.86,0.90,0.95,
  1.05,1.12,1.38,1.55,1.45,1.30,1.18,1.05,
];
const HOURLY_NORTH = [              /* Kano / Kaduna — Fajr 5 am, Maghrib 6 pm peaks */
  0.70,0.62,0.58,0.72,1.20,1.48,1.30,1.12,
  0.98,0.90,0.88,0.90,0.95,1.02,1.05,1.00,
  0.96,1.05,1.52,1.35,1.15,0.95,0.82,0.74,
];
const HOURLY_CENTRAL = [            /* Abuja / Jos / Yola / middle belt */
  0.82,0.74,0.68,0.70,0.85,1.28,1.18,1.08,
  1.05,1.02,0.98,0.95,0.95,0.96,0.98,1.02,
  1.08,1.15,1.35,1.45,1.35,1.20,1.05,0.90,
];

function _getHourlyFactor(area) {
  const c = (typeof AREA_COORDS !== 'undefined') ? AREA_COORDS[area] : null;
  if (!c) return HOURLY_CENTRAL;
  if (c.lat > 10.0) return HOURLY_NORTH;
  if (c.lat <= 7.5)  return HOURLY_SOUTH;
  return HOURLY_CENTRAL;
}

const DAY_FACTOR = [0.88,1.06,1.06,1.03,1.00,0.97,0.90]; /* 0=Sun */

/* ─── HISTORY ENGINE ────────────────────────────────────────────────────── */
/* Trains on crowd-sourced reports using:
   - Time decay: recent reports weighted up to 3x more than 30-day-old ones
   - Confirmation boost: confirmed reports count more (stronger ground truth)
   - Wrong-vote penalty: flagged/disputed reports count less
   - Minimum count guard: need ≥4 weighted reports before returning a rate  */
const PredictHistory = {
  _data: {},
  _liveAdded: 0,

  /* Full re-ingest from DB — called on startup and every 2h.
     Two-pass design: pass 1 computes raw weights + per-DISCO totals;
     pass 2 applies a scale factor so no single DISCO (e.g. high-traffic
     Lagos) drowns out sparse non-Lagos training data.                        */
  ingest(rows) {
    this._data = {};
    this._liveAdded = 0;
    const nowMs      = Date.now();
    const HALF_LIFE  = 21 * 24 * 3600 * 1000;
    const DISCO_CAP  = 500; /* max effective weight units per DISCO */
    _buildAreaDiscoMap();

    const processed = rows.map(r => {
      if (!r.location_area) return null;
      const t     = new Date(r.created_at || r.time);
      const ageMs = Math.max(0, nowMs - t.getTime());
      const w     = Math.max(0.1, Math.pow(0.5, ageMs / HALF_LIFE))
                    * Math.min(3.0, 1 + (r.confirms || 1) * 0.25)
                    * Math.max(0.2, 1 - (r.wrong_votes || 0) * 0.35);
      return {
        k: `${r.location_area}|${t.getHours()}|${t.getDay()}`,
        type: r.type,
        confirms: r.confirms || 1,
        disco: _AREA_DISCO[r.location_area] || '__unknown',
        w,
      };
    }).filter(Boolean);

    const discoTotals = {};
    for (const { disco, w } of processed) discoTotals[disco] = (discoTotals[disco] || 0) + w;

    for (const { k, type, confirms, disco, w } of processed) {
      const sw = discoTotals[disco] > DISCO_CAP ? w * DISCO_CAP / discoTotals[disco] : w;
      if (!this._data[k]) this._data[k] = { out:0, total:0, confirms:0 };
      this._data[k].total    += sw;
      if (type === 'out') this._data[k].out += sw;
      this._data[k].confirms += confirms * sw;
    }
  },

  /* Live-train from a single incoming report (real-time INSERT) */
  addReport(r) {
    if (!r.location_area && !r.area) return;
    const area = r.location_area || r.area;
    const t = new Date(r.created_at || r.time || Date.now());
    const k = `${area}|${t.getHours()}|${t.getDay()}`;
    if (!this._data[k]) this._data[k] = { out:0, total:0, confirms:0 };
    /* Live reports get full weight — they're the freshest signal we have */
    const confirmWeight = Math.min(3.0, 1 + (r.confirms || 1) * 0.25);
    const wrongPenalty  = Math.max(0.2, 1 - (r.wrong_votes || 0) * 0.35);
    const w = confirmWeight * wrongPenalty;
    this._data[k].total   += w;
    if ((r.type||'') === 'out') this._data[k].out += w;
    this._data[k].confirms += (r.confirms || 1) * w;
    this._liveAdded++;
  },

  getRate(area, hour, day) {
    const b = this._data[`${area}|${hour}|${day}`];
    /* Need at least 4 weighted data points — less than that is noise */
    if (!b || b.total < 4) return null;
    const confirmBoost = Math.min(0.12, (b.confirms / (b.total * 4)) * 0.12);
    const raw = b.out / b.total;
    return Math.min(0.97, raw + (raw > 0.5 ? confirmBoost : -confirmBoost));
  },

  getAreaRate(area) {
    let out = 0, total = 0;
    for (const [k, v] of Object.entries(this._data))
      if (k.startsWith(area + '|')) { out += v.out; total += v.total; }
    return total >= 6 ? out / total : null;
  },

  /* ── DATA EXTRACTION ────────────────────────────────────────────────────
     Returns all accumulated outage-rate knowledge as a plain array.
     Each row = one (area, hour, day) cell with outage_rate + data quality.
     Call PredictHistory.downloadCSV() from browser console to get a file. */
  export() {
    const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const rows = [];
    for (const [k, v] of Object.entries(this._data)) {
      if (v.total < 1) continue;
      const [area, hour, day] = k.split('|');
      rows.push({
        area,
        hour: +hour,
        day:  +day,
        day_name: DAY_NAMES[+day],
        outage_rate: +(v.out / v.total).toFixed(4),
        data_weight: +v.total.toFixed(2),
        weighted_confirms: +v.confirms.toFixed(2),
      });
    }
    return rows.sort((a, b) => a.area.localeCompare(b.area) || a.day - b.day || a.hour - b.hour);
  },

  exportCSV() {
    const rows = this.export();
    if (!rows.length) return '';
    const header = Object.keys(rows[0]).join(',');
    const body   = rows.map(r =>
      Object.values(r).map(v => (typeof v === 'string' && v.includes(',') ? `"${v}"` : v)).join(',')
    );
    return [header, ...body].join('\n');
  },

  downloadCSV() {
    const csv = this.exportCSV();
    if (!csv) { console.warn('[NEPAWatch] No training data yet.'); return; }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `nepawatch-reliability-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    console.log(`[NEPAWatch] Exported ${this.export().length} rows.`);
  },
};

/* Console hook: PredictHistory.downloadCSV() triggers a CSV download of the
   accumulated outage-rate heatmap — area × hour × day × outage_rate.       */
window.NEPAWatchExport = () => PredictHistory.downloadCSV();

/* ─── WEATHER CACHE (Open-Meteo, free, no API key) ──────────────────────── */
/* Per-area weather using 1-degree grid cells (~100 km × 100 km).            */
/* Nigeria spans 14° of latitude — Lagos weather must NOT be used for Kano.  */
const WeatherCache = {
  _store: {},                         /* cellKey → { code, rain, wind, lastFetch } */
  FETCH_INTERVAL: 20 * 60 * 1000,    /* re-fetch each cell at most every 20 min   */

  _key(lat, lng) {
    return `${Math.round(lat)}|${Math.round(lng)}`;
  },

  _coords(area) {
    const c = (typeof AREA_COORDS !== 'undefined') ? AREA_COORDS[area] : null;
    return c || { lat: 9.08, lng: 7.40 }; /* Nigeria centroid fallback (Abuja) */
  },

  _isStale(key) {
    const e = this._store[key];
    return !e || (Date.now() - e.lastFetch) >= this.FETCH_INTERVAL;
  },

  async _fetchCell(lat, lng) {
    const key = this._key(lat, lng);
    if (!this._isStale(key)) return;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(1)}&longitude=${lng.toFixed(1)}&current=weathercode,precipitation,windspeed_10m&timezone=Africa%2FLagos`;
      const res = await fetch(url);
      const d   = await res.json();
      const c   = d.current || {};
      this._store[key] = {
        code:      c.weathercode   ?? null,
        rain:      c.precipitation ?? 0,
        wind:      c.windspeed_10m ?? 0,
        lastFetch: Date.now(),
      };
      // Persist to weather_log for ML training history (non-blocking)
      if (typeof sb !== 'undefined') {
        const latKey = parseFloat(lat.toFixed(1));
        const lonKey = parseFloat(lng.toFixed(1));
        sb.from('weather_log').insert({
          lat_key:      latKey,
          lon_key:      lonKey,
          weather_code: c.weathercode ?? null,
          rain_mm:      c.precipitation ?? 0,
          wind_kmh:     c.windspeed_10m ?? 0,
        }).then(() => {}).catch(() => {});
      }
    } catch(e) {
      /* Keep stale value — model degrades gracefully without weather */
      if (!this._store[key]) this._store[key] = { code: null, rain: 0, wind: 0, lastFetch: Date.now() };
    }
  },

  /* Pre-fetch every unique 1-degree cell that covers the given area list.
     Stale cells are fetched in parallel; fresh cells are skipped.           */
  async prefetch(areas) {
    const seen = new Set();
    const fetches = [];
    for (const area of areas) {
      const { lat, lng } = this._coords(area);
      const key = this._key(lat, lng);
      if (!seen.has(key)) {
        seen.add(key);
        if (this._isStale(key)) fetches.push(this._fetchCell(lat, lng));
      }
    }
    if (fetches.length) await Promise.allSettled(fetches);
  },

  /* Synchronous lookup — call prefetch() first so data is always available */
  getFor(area) {
    const { lat, lng } = this._coords(area);
    return this._store[this._key(lat, lng)] || null;
  },

  /* WMO codes: 51-67 = rain, 80-82 = showers, 95-99 = thunderstorm */
  getRiskMultiplier(wx) {
    if (!wx || wx.code === null) return 1.0;
    const c = wx.code;
    if (c >= 95) return 1.85;
    if (c >= 80 || (c >= 51 && c <= 67)) {
      if (wx.rain > 10) return 1.65;
      if (wx.rain > 3)  return 1.40;
      return 1.20;
    }
    if (wx.wind > 40) return 1.30;
    return 1.0;
  },

  getLabel(wx) {
    if (!wx || wx.code === null) return null;
    const c = wx.code;
    if (c >= 95) return 'Thunderstorm';
    if (c >= 80) return 'Rain showers';
    if (c >= 51 && c <= 67) return `Rain (${wx.rain}mm)`;
    if (c >= 1 && c <= 3) return 'Cloudy';
    if (c === 0) return 'Clear';
    return null;
  },
};

/* ─── GROUND TRUTH ENGINE ────────────────────────────────────────────────── */
// Human reports are the strongest signal. This replaces the weak "momentum boost"
// with a proper ground-truth layer that dominates the statistical model.

function getGroundTruth(area) {
  if (typeof reports === 'undefined') return null;
  const now = Date.now();
  const SIX_HRS = 6 * 3600 * 1000;

  // Collect all relevant reports: exact area + parent area + sibling areas
  const family = new Set([area]);
  if (typeof AREA_PARENT !== 'undefined') {
    const parent = AREA_PARENT[area];
    if (parent) family.add(parent);
    // siblings — other children of same parent
    for (const [child, par] of Object.entries(AREA_PARENT)) {
      if (par === area || (parent && par === parent)) family.add(child);
    }
  }

  const relevant = reports.filter(r =>
    family.has(r.area) && (now - r.time) < SIX_HRS
  );
  if (!relevant.length) return null;

  // Score each report: newer = stronger. Decays by half every 90 minutes.
  // Out reports push score positive, bck reports push negative.
  let score = 0;
  let totalWeight = 0;
  for (const r of relevant) {
    const ageMs = now - r.time;
    const halfLife = 90 * 60 * 1000; // 90 min
    const weight = Math.pow(0.5, ageMs / halfLife);
    // Human reports count 3x AI reports for ground truth
    const authority = (r.isAI || r.userId === AI_USER_ID) ? 1 : 3;
    const signal = r.type === 'out' ? 1 : -1;
    score += signal * weight * authority;
    totalWeight += weight * authority;
  }

  if (totalWeight === 0) return null;
  const netScore = score / totalWeight; // -1 (definitely on) to +1 (definitely out)

  // Convert to probability: netScore of +1 → 0.95, -1 → 0.05
  const prob = 0.5 + netScore * 0.45;
  const age = now - Math.max(...relevant.map(r => r.time));
  const freshestIsHuman = relevant
    .sort((a,b) => b.time - a.time)
    .find(r => !r.isAI && r.userId !== AI_USER_ID);

  return {
    prob: Math.min(0.95, Math.max(0.05, prob)),
    confidence: age < 20*60000 ? 'high' : age < 90*60000 ? 'medium' : 'low',
    reportCount: relevant.length,
    hasFreshHuman: !!freshestIsHuman && (now - freshestIsHuman.time) < 30*60000,
  };
}

/* ─── CORE PREDICTION ────────────────────────────────────────────────────── */
function predictOutage(area, hour, dayOfWeek, statOnly = false) {
  const band   = AREA_BANDS[area] || 'C';
  const base   = _getBandBaseline(area)[band];
  const hProb  = Math.min(0.95, base * _getHourlyFactor(area)[hour]);
  const dAdj   = DAY_FACTOR[dayOfWeek];
  const hist   = PredictHistory.getRate(area, hour, dayOfWeek);
  const aHist  = PredictHistory.getAreaRate(area);

  // Statistical baseline
  let statProb, confidence;
  if (hist !== null) {
    statProb = hist*0.50 + hProb*0.25 + base*dAdj*0.25; confidence = 'high';
  } else if (aHist !== null) {
    statProb = aHist*0.35 + hProb*0.35 + base*dAdj*0.30; confidence = 'medium';
  } else {
    statProb = base*0.45 + hProb*0.35 + (base*dAdj-base)*0.20; confidence = 'low';
  }

  // Feeder rotation: phase-adjust outage probability based on estimated position
  // in the DISCO's supply cycle, derived from the last known restoration time
  if (!statOnly) {
    const rotFactor = _getFeederRotationFactor(area, Date.now());
    statProb = Math.min(0.97, statProb * rotFactor);
  }

  // DISCO operational alert: admin-declared grid emergency or restoration window
  _buildAreaDiscoMap();
  const _alert = DISCO_ALERT[_AREA_DISCO[area] || ''];
  if (_alert && _alert.until > Date.now() && _alert.multiplier) {
    statProb = Math.min(0.97, Math.max(0.03, statProb * _alert.multiplier));
  }

  // Per-area accuracy factor: self-corrects over time from wrong_votes / confirms
  const _accFactor = _aiAreaAccuracy[area] || 1.0;
  if (_accFactor !== 1.0) statProb = Math.min(0.97, Math.max(0.03, statProb * _accFactor));

  // Weather multiplier — area-specific, not a single global Lagos reading
  const _wx = WeatherCache.getFor(area);
  const wxFactor = WeatherCache.getRiskMultiplier(_wx);
  statProb = Math.min(0.97, statProb * wxFactor);
  if (wxFactor > 1.3) confidence = confidence === 'low' ? 'medium' : 'high';

  // Ground truth from live reports — dominates for current-day only
  // statOnly=true means we want the historical/day-of-week forecast without live override
  const gt = statOnly ? null : getGroundTruth(area);
  let prob;
  if (gt) {
    // Weight: ground truth 80%, statistics 20% when we have recent reports
    // If there's a fresh human report, ground truth weight goes to 95%
    const gtWeight = gt.hasFreshHuman ? 0.95 : gt.confidence === 'high' ? 0.85 : 0.70;
    prob = gt.prob * gtWeight + statProb * (1 - gtWeight);
    confidence = gt.confidence;
  } else {
    prob = statProb;
  }

  // Apply DISCO_ALERT multiplier last — admin-declared emergency overrides model
  const _discoEntry = DISCO_ALERT[_getAreaDisco(area)];
  const discoMult = _discoEntry != null ? (typeof _discoEntry === 'object' ? (_discoEntry.mult ?? null) : _discoEntry) : null;
  if (discoMult != null) prob = Math.min(0.97, prob * discoMult);

  return {
    prob: Math.min(0.97, Math.max(0.03, prob)),
    confidence,
    band,
    bandSupplyHours: _getBandSupplyHours(area)[band],
    weather: WeatherCache.getLabel(WeatherCache.getFor(area)),
    groundTruth: gt,
  };
}

function predictDuration(area, hour) {
  const band = AREA_BANDS[area] || 'C';
  const base = { A:2.5, B:4.5, C:6.0, D:7.5, E:10.0 }[band];
  const peak = (hour>=17&&hour<=22)||(hour>=4&&hour<=6);
  return parseFloat((base + (peak?1.8:0)).toFixed(1));
}

function getRiskLevel(prob) {
  if (prob<0.25) return { label:'Low Risk',  short:'LOW',  color:'#00E676' };
  if (prob<0.50) return { label:'Moderate',  short:'MOD',  color:'#FFB300' };
  if (prob<0.72) return { label:'High Risk', short:'HIGH', color:'#FF7043' };
  return              { label:'Critical',  short:'CRIT', color:'#FF3D57' };
}

/* ─── SEARCHABLE AREA PICKER ─────────────────────────────────────────────
   Replaces plain <select> menus. 291 areas is far too many to scroll, so
   this filters as you type. Ordering puts Lagos first, then Abuja, then the
   rest alphabetically — matching where our reporters actually are.
   ─────────────────────────────────────────────────────────────────────── */
const _LAGOS_DISCOS = ['IE', 'EKEDC'];

function _areaSortKey(area) {
  const disco = (typeof _getAreaDisco === 'function') ? _getAreaDisco(area) : '';
  if (_LAGOS_DISCOS.includes(disco)) return 0;   // Lagos — most of our users
  if (disco === 'AEDC') return 1;                // Abuja — second densest
  return 2;
}

function sortedAreaList(areas) {
  return areas.slice().sort((a, b) => {
    const ka = _areaSortKey(a), kb = _areaSortKey(b);
    return ka !== kb ? ka - kb : a.localeCompare(b);
  });
}

/* Renders a searchable picker into `mountId`. onPick(area) fires on select. */
function initAreaPicker(mountId, areas, selected, onPick) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  const ordered = sortedAreaList(areas);
  const uid = mountId + '_ap';

  mount.innerHTML = `
    <div class="ap" id="${uid}">
      <button type="button" class="ap-trigger" id="${uid}_trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="ap-current" id="${uid}_current">${selected || 'Select an area'}</span>
        <svg class="ap-caret" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="ap-panel" id="${uid}_panel" role="listbox">
        <input type="text" class="ap-search" id="${uid}_search" placeholder="Search areas…" autocomplete="off" spellcheck="false">
        <div class="ap-list" id="${uid}_list"></div>
        <div class="ap-empty" id="${uid}_empty" hidden>No area matches that search.</div>
      </div>
    </div>`;

  const el = id => document.getElementById(uid + '_' + id);
  const panel = el('panel'), search = el('search'), list = el('list'),
        empty = el('empty'), trigger = el('trigger'), current = el('current');
  let cur = selected;

  function paint(filter) {
    const q = (filter || '').trim().toLowerCase();
    const rows = q ? ordered.filter(a => a.toLowerCase().includes(q)) : ordered;
    list.innerHTML = rows.map(a =>
      `<button type="button" class="ap-opt${a === cur ? ' ap-opt-on' : ''}" role="option" data-area="${a.replace(/"/g, '&quot;')}">${a}</button>`
    ).join('');
    empty.hidden = rows.length > 0;
  }

  function open() {
    panel.classList.add('ap-open');
    trigger.setAttribute('aria-expanded', 'true');
    search.value = '';
    paint('');
    search.focus();
  }
  function close() {
    panel.classList.remove('ap-open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    panel.classList.contains('ap-open') ? close() : open();
  });
  search.addEventListener('input', () => paint(search.value));
  search.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); trigger.focus(); }
    if (e.key === 'Enter') {
      const first = list.querySelector('.ap-opt');
      if (first) first.click();
      e.preventDefault();
    }
  });
  list.addEventListener('click', e => {
    const btn = e.target.closest('.ap-opt');
    if (!btn) return;
    cur = btn.dataset.area;
    current.textContent = cur;
    close();
    if (typeof onPick === 'function') onPick(cur);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#' + uid)) close();
  });

  paint('');
  return { set(area) { cur = area; current.textContent = area; } };
}

/* ─── SERVER PREDICTIONS CACHE ───────────────────────────────────────────
   Populated by loadAreaPredictions() on startup.
   Stores server-precomputed probabilities and AI status per area.
   Browser reads area_predictions table (~40 KB) instead of 10 000 training rows.
   ─────────────────────────────────────────────────────────────────────── */
let _areaStatusCache = {};

async function loadAreaPredictions() {
  if (window.NW_MAINTENANCE) return;
  if (typeof sb === 'undefined') return;
  try {
    /* Only the four fields the UI actually reads. forecast_24h is a 24-entry
       JSONB blob per area — across ~291 areas it dominated the payload and
       nothing in the browser consumed it (predictOutage computes locally).
       Dropping it takes this fetch from ~230 KB to ~15 KB per session.     */
    const data = await fetchPublicRows('predictions');
    if (data.length) {
      _areaStatusCache = {};
      for (const row of data) _areaStatusCache[row.area] = row;
      console.log(`[NEPAWatch] Loaded ${data.length} server predictions from area_predictions.`);
    }
  } catch(e) {}
  // Load accuracy weights for display (tiny: ~160 rows, improves local predict charts)
  await _loadAccuracyFromSupabase();
}

/* Legacy stub — kept so any residual callers don't throw. Does nothing now. */
const AIReporter = {
  _timer: null,

  // Per-area state machine: tracks what the AI last said about each area
  // 'out' = AI said power is out (don't say out again until bck confirmed)
  // 'bck' = AI said power is back (or area is known to have light)
  //  null = unknown, AI has never spoken about this area
  _areaState: {},
  _lastFired: {},  /* area -> timestamp of last _fire() call — persisted to localStorage */

  _loadFiredState() {
    try {
      const stored = localStorage.getItem(_AI_FIRED_KEY);
      if (stored) this._lastFired = JSON.parse(stored);
    } catch(e) { this._lastFired = {}; }
  },
  _saveFiredState() {
    try { localStorage.setItem(_AI_FIRED_KEY, JSON.stringify(this._lastFired)); } catch(e) {}
  },

  async _seedFiredFromDB() {
    if (typeof sb === 'undefined') return;
    try {
      // Use 8h window — covers realistic browser restart gaps. Stamp _lastFired
      // as Date.now() (not the actual report time) so the 45-min refire cooldown
      // blocks immediate re-firing; _rebuildState() handles the long-term case
      // once loadReports() has populated the reports array.
      const SEED_WINDOW_MS = 8 * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - SEED_WINDOW_MS).toISOString();
      const { data } = await sb.from('reports')
        .select('location_area, type, created_at')
        .eq('user_id', AI_USER_ID)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });
      if (data && data.length) {
        // Only seed 'out' reports — 'bck' reports shouldn't block re-firing
        const seenAreas = new Set();
        for (const row of data) {
          if (seenAreas.has(row.location_area)) continue;
          seenAreas.add(row.location_area);
          if (row.type === 'out') {
            // Stamp now so the refire cooldown kicks in immediately after restart
            this._lastFired[row.location_area] = Date.now();
          }
        }
        this._saveFiredState();
        console.log(`[NEPAWatch AI] Seeded _lastFired from DB (8h window): ${seenAreas.size} area(s).`);
      }
    } catch(e) { /* localStorage state still in effect */ }
  },

  // Rebuild state from AI-only reports — human reports must NOT reset this
  // state machine or scan() will re-fire an AI "out" every time humans say bck
  _rebuildState() {
    if (typeof reports === 'undefined') return;
    this._areaState = {};

    /* Step 1: seed from _lastFired timestamps — if we fired an outage recently
       and the AI report hasn't reached DB yet (e.g., migration pending), the
       area should still be considered 'out' for rate-limit purposes. */
    const nowMs = Date.now();
    for (const [area, ts] of Object.entries(this._lastFired)) {
      if (nowMs - ts < AI_MIN_REFIRE_MS) {
        /* We fired something recently — seed as 'out' (worst case assumption).
           The DB report pass below will correct this if 'bck' was actually filed. */
        this._areaState[area] = 'out';
      }
    }

    /* Step 2: override with actual DB / in-memory AI reports (most recent wins) */
    const sorted = [...reports]
      .filter(r => r.isAI || r.userId === AI_USER_ID || String(r.id).startsWith('ai-'))
      .sort((a, b) => a.time - b.time);
    for (const r of sorted) {
      if (!r.area) continue;
      this._areaState[r.area] = r.type;
    }
  },

  async loadHistory() {
    // AI engine now runs server-side. Use loadAreaPredictions() instead.
    await loadAreaPredictions();
  },

  async scan() {
    /* Pre-fetch weather for every unique 1-degree cell across all tracked areas.
       Runs in parallel; each cell refreshes at most every 20 min.             */
    await WeatherCache.prefetch(Object.keys(AREA_BANDS));
    this._rebuildState();
    const now = new Date(), h = now.getHours(), d = now.getDay();
    const nowMs = Date.now();

    /* Pass 1: evaluate ALL areas, collect candidates with their probability.
       No early break here — every area gets assessed every scan cycle so
       high-priority areas in new DISCOs are never starved by shuffle luck. */
    const candidates = [];
    for (const area of Object.keys(AREA_BANDS)) {
      if (this._areaState[area] === 'out') continue;
      if (nowMs - (this._lastFired[area] || 0) < AI_MIN_REFIRE_MS) continue;

      const { prob, groundTruth } = predictOutage(area, h, d);
      if (prob < AI_CONFIDENCE_THRESH) continue;

      const hasHistory     = PredictHistory.getAreaRate(area) !== null;
      const hasGroundTruth = !!groundTruth && groundTruth.reportCount >= 1;
      let isBootstrap = false;
      if (!hasHistory && !hasGroundTruth) {
        /* Cold-start: only allow very high signal, known DISCO, 6-h cooldown */
        if (prob < AI_BOOTSTRAP_THRESH
          || !_AREA_DISCO[area]
          || nowMs - (this._lastFired[area] || 0) < AI_BOOTSTRAP_COOLDOWN_MS
        ) continue;
        isBootstrap = true;
      }

      if (groundTruth?.hasFreshHuman && groundTruth.prob < 0.4) continue;

      const recentRestore = (typeof reports !== 'undefined') &&
        reports.some(r =>
          (r.area === area || (typeof AREA_PARENT !== 'undefined' && AREA_PARENT[r.area] === area))
          && r.type === 'bck' && !r.isAI && r.userId !== AI_USER_ID
          && (now - r.time) < 45 * 60000);
      if (recentRestore) continue;

      candidates.push({ area, prob, isBootstrap });
    }

    /* Pass 2: sort highest-probability first, then fire top N.
       Bootstrap slots are limited to AI_MAX_BOOTSTRAP_PER_SCAN within the run. */
    candidates.sort((a, b) => b.prob - a.prob);
    let firedCount = 0, bootstrapFired = 0;
    for (const { area, prob, isBootstrap } of candidates) {
      if (firedCount >= AI_MAX_PER_SCAN) break;
      if (isBootstrap && bootstrapFired >= AI_MAX_BOOTSTRAP_PER_SCAN) continue;
      if (firedCount > 0) await new Promise(res => setTimeout(res, 800));
      await this._fire(area, 'out', prob);
      firedCount++;
      if (isBootstrap) bootstrapFired++;
    }
  },

  async scanRestorations() {
    if (typeof reports==='undefined') return;
    this._rebuildState();
    const nowMs = Date.now();
    const now   = new Date(nowMs);
    const h = now.getHours(), d = now.getDay();
    const outAreas = Object.entries(this._areaState)
      .filter(([, state]) => state === 'out')
      .map(([area]) => area);
    let firedCount = 0;

    for (const area of outAreas) {
      if (firedCount >= AI_MAX_PER_SCAN) break;
      if (!AREA_BANDS[area]) continue;

      // O(n) per area — anchor on last HUMAN 'out' only so an AI 'out' filed
      // after a human 'bck' (race condition) doesn't invalidate the restoration
      const lastHumanOut = reports
        .filter(r => r.area === area && r.type === 'out' && !r.isAI && r.userId !== AI_USER_ID)
        .sort((a, b) => b.time - a.time)[0];
      const alreadyRestored = reports.some(x =>
        x.area === area && x.type === 'bck'
        && (lastHumanOut ? x.time > lastHumanOut.time : true)
      );
      if (alreadyRestored) { this._areaState[area] = 'bck'; continue; }

      const { prob, groundTruth } = predictOutage(area, h, d);

      /* ── PATH 1: Fresh human report says power is back — act immediately ── */
      if (groundTruth?.hasFreshHuman && groundTruth.prob < 0.40) {
        const recentBck = reports.some(x => x.area===area && x.type==='bck' && (nowMs-x.time)<15*60000);
        if (!recentBck) {
          if (firedCount > 0) await new Promise(res => setTimeout(res, 800));
          await this._fire(area, 'bck', 1-prob);
          firedCount++;
        }
        continue;
      }

      /* ── PATH 2: Probability dropped below restoration threshold ── */
      const outageReport = [...reports]
        .filter(r => r.area===area && r.type==='out')
        .sort((a,b) => b.time - a.time)[0];
      const outageAge = outageReport ? (nowMs - outageReport.time) : 0;

      /* ── PATH 3: STALE OUTAGE — no human confirmation, been out too long
         Typical Nigerian DISCO rotation: Band A ~2h, Band E ~12h.
         If AI said 'out' and zero humans have confirmed it in that window,
         the prediction was probably wrong — auto-restore to clean up the feed. */
      const band = AREA_BANDS[area] || 'C';
      const maxOutMs = _getBandMaxOutMs(area)[band];
      const humanConfirmsForOutage = reports.filter(r =>
        r.area===area && r.type==='out' && !r.isAI && r.userId!==AI_USER_ID &&
        (nowMs - r.time) < maxOutMs
      ).length;

      const isStale = outageAge > maxOutMs && humanConfirmsForOutage === 0;
      if (isStale) {
        console.log(`[NEPAWatch AI] Stale outage in ${area} (${Math.round(outageAge/3600000)}h, 0 human confirms) — auto-restoring`);
        if (firedCount > 0) await new Promise(res => setTimeout(res, 800));
        await this._fire(area, 'bck', 0.65);
        firedCount++;
        continue;
      }

      /* Probability path: only if prob dropped below threshold */
      if (prob >= AI_RESTORE_THRESH) continue;

      /* Minimum wait before probability-based restoration (prevents fast oscillation) */
      const minWait = groundTruth?.confidence === 'high' ? 90*60000 : 3*60*60000;
      if (outageAge < minWait) continue;

      /* Respect per-area rate limit */
      if (nowMs - (this._lastFired[area]||0) < AI_MIN_REFIRE_MS) continue;

      if (firedCount > 0) await new Promise(res => setTimeout(res, 800));
      await this._fire(area, 'bck', 1-prob);
      firedCount++;
    }
  },

  async _fire(area, type, prob) {
    // Update state machine — this is the source of truth
    this._areaState[area] = type;
    this._lastFired[area] = Date.now();
    this._saveFiredState(); // persist so rate-limit survives page reloads

    // Pick the most specific location name we can:
    // 1. Most recent human report for this area that has a real street name → use that
    // 2. Otherwise fall back to the area name itself
    let locName = area;
    if (typeof reports !== 'undefined') {
      const SIX_HRS = 6 * 3600 * 1000;
      const now = Date.now();
      // Get human reports for this area (exact area or children) from last 6hrs
      const humanReports = reports.filter(r =>
        !r.isAI && r.userId !== AI_USER_ID &&
        (r.area === area ||
          (typeof AREA_PARENT !== 'undefined' && AREA_PARENT[r.area] === area)) &&
        (now - r.time) < SIX_HRS &&
        r.name && r.name !== r.area // has a real street name, not just area
      ).sort((a, b) => b.time - a.time);

      if (humanReports.length > 0) {
        // Use the most recently reported specific street
        locName = humanReports[0].name;
        // If that report was filed under a child area, use that child area
        // so the report is properly localized (e.g. "Akoka Road" under "Akoka" not "Yaba")
        const streetArea = humanReports[0].area || area;
        // Only override area if it's a child of our area (more specific)
        if (typeof AREA_PARENT !== 'undefined' && AREA_PARENT[streetArea] === area) {
          // File under the more specific child area
          this._areaState[streetArea] = type;
        }
      }
    }

    // Ensure this area exists in LOCS so it's findable in search and saved places
    if (typeof LOCS !== 'undefined' && !LOCS.find(l => l.name === area && !l.street)) {
      if (typeof sl === 'function') {
        LOCS.push({ id: sl(area), name: area, area, street: null, label: area, custom: false });
      }
    }

    /* Optimistic local insert */
    const tempId = `ai-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    if (typeof reports!=='undefined') {
      reports.unshift({ id:tempId, name:locName, area, type, time:Date.now(), confirms:1, userId:AI_USER_ID, isAI:true, aiProb:prob });
      // Trim to 500 — only remove old non-AI reports from the tail
      /* launch: keep up to 2000 reports — don't trim */
      if (reports.length > 2000) reports.splice(2000, 1);
      if (typeof renderStats==='function') renderStats();
      if (typeof prependReportCard==='function') prependReportCard(reports[0],'liveFeed');
      if (typeof renderDiscos==='function') renderDiscos();
    }

    /* Toast */
    if (typeof toast==='function') {
      const loc = locName !== area ? `${locName}, ${area}` : area;
      const msg = type==='out'
        ? `NEPAWatch AI: Outage predicted — ${loc}`
        : `NEPAWatch AI: Power restored — ${loc}`;
      toast(msg, type==='out'?'err':'ok');
    }

    console.log(`[NEPAWatch AI] Filing ${type} — ${locName} (${area}) @ ${(prob*100).toFixed(0)}%`);

    /* ── PERSIST: direct Supabase insert (primary path) ──────────────────
       Saving directly via the client is reliable and doesn't depend on the
       edge function handling the ai_report mode correctly.  Notifications
       are only sent AFTER a confirmed DB save so users never get a push
       for a report that isn't actually in the feed.                        */
    const _anonKey = typeof SUPA_ANON !== 'undefined' ? SUPA_ANON : '';
    let saved = false;
    let savedRepId = null;
    let _predPromise = null; // resolves to ai_predictions row id after DB log

    if (typeof sb !== 'undefined') {
      try {
        /* Try with ai_prob column first (requires migration to have run) */
        let insertRes = await sb.from('reports').insert({
          user_id: AI_USER_ID,
          location_name: locName,
          location_area: area,
          type,
          confirms: 1,
          ai_prob: parseFloat(prob.toFixed(3)),
        }).select('id,user_id,location_name,location_area,type,confirms,created_at,ai_prob,wrong_votes').single();

        if (insertRes.error && (
          insertRes.error.code === '42703' ||
          (insertRes.error.message||'').includes('column') ||
          (insertRes.error.message||'').includes('ai_prob')
        )) {
          /* ai_prob column not yet added — insert without it */
          console.warn('[NEPAWatch AI] ai_prob column missing, inserting without it. Run migration SQL.');
          insertRes = await sb.from('reports').insert({
            user_id: AI_USER_ID,
            location_name: locName,
            location_area: area,
            type,
            confirms: 1,
          }).select('id,user_id,location_name,location_area,type,confirms,created_at').single();
        }

        if (!insertRes.error && insertRes.data) {
          const dbRow = insertRes.data;
          this._replaceLocal(tempId, dbRow, prob);
          savedRepId = String(dbRow.id);
          saved = true;
          console.log('[NEPAWatch AI] Report saved to DB, id:', dbRow.id);
          _predPromise = sb.from('ai_predictions').insert({
            report_id: savedRepId, area, disco: _getAreaDisco(area),
            type, probability: parseFloat(prob.toFixed(4)),
          }).select('id').single().then(r => r.data?.id ?? null).catch(() => null);
        } else if (insertRes.error) {
          const ec = insertRes.error.code;
          if (ec === '22P02') {
            console.error('[NEPAWatch AI] UUID type error — AI_USER_ID is not a valid UUID. Run ai-reports-fix.sql.');
          } else if (ec === '42501' || ec === 'PGRST301') {
            console.error('[NEPAWatch AI] RLS denied insert — add reports_insert_ai policy. Run ai-reports-fix.sql.');
          } else {
            console.warn('[NEPAWatch AI] Direct insert failed:', insertRes.error.code, insertRes.error.message);
          }
        }
      } catch(e) {
        console.warn('[NEPAWatch AI] Direct insert error:', e?.message);
      }
    }

    /* ── BACKUP: edge function (if direct insert failed) ──────────────── */
    if (!saved) {
      try {
        const res = await fetch(
          'https://djurokbkkqrmpafcxlez.supabase.co/functions/v1/send-alert',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': _anonKey,
              'Authorization': `Bearer ${_anonKey}`,
            },
            body: JSON.stringify({
              mode: 'ai_report',
              location_name: locName,
              location_area: area,
              type,
              ai_prob: parseFloat(prob.toFixed(3)),
            }),
          }
        );
        if (res.ok) {
          const result = await res.json();
          if (result?.report) {
            this._replaceLocal(tempId, result.report, prob);
            savedRepId = String(result.report.id);
            saved = true;
            console.log('[NEPAWatch AI] Report saved via edge fn, id:', result.report.id);
          }
        } else {
          console.warn(`[NEPAWatch AI] Edge fn HTTP ${res.status}`);
        }
      } catch(e) {
        console.warn('[NEPAWatch AI] Edge fn backup failed:', e?.message);
      }
    }

    /* ── NOTIFICATIONS: only fire after confirmed DB save ─────────────── */
    if (saved) {
      /* Push + email alerts for subscribers in the area */
      if (typeof sendAreaAlerts === 'function') {
        sendAreaAlerts(locName, area, type, true).catch(() => {});
      }

      /* Refresh AI report count on Predict page */
      const aiBanner = document.querySelector('.pred-ai-sub strong');
      if (aiBanner && typeof reports !== 'undefined') {
        const cnt = reports.filter(r => r.isAI || r.userId === AI_USER_ID).length;
        aiBanner.textContent = `${cnt} AI report${cnt !== 1 ? 's' : ''}`;
      }

      /* Trigger in-app feedback popup for users in the same area */
      if (typeof window.showAIFeedbackPopup === 'function') {
        const savedRep = typeof reports !== 'undefined'
          ? reports.find(r => String(r.id) === savedRepId)
          : null;
        if (savedRep) setTimeout(() => window.showAIFeedbackPopup(savedRep), 1200);
      }

      /* Accuracy feedback: 15 min after filing, check wrong_votes and confirms.
         Adjust per-area multiplier so the model self-corrects from its mistakes. */
      if (type === 'out') {
        const _area = area, _id = savedRepId, _pp = _predPromise;
        setTimeout(async () => {
          if (typeof reports === 'undefined' || !_id) return;
          const r = reports.find(x => String(x.id) === _id);
          if (!r) return;
          const wrongVotes = r.wrong_votes || 0;
          const humanConfirms = Math.max(0, (r.confirms || 1) - 1); // subtract AI's own +1
          const cur = _aiAreaAccuracy[_area] || 1.0;
          let outcome = 'unresolved';
          if (wrongVotes >= 2) {
            _aiAreaAccuracy[_area] = Math.max(0.35, cur * 0.82);
            console.log(`[NEPAWatch AI] Misfire: ${_area} (${wrongVotes} wrong votes) → accuracy factor ${_aiAreaAccuracy[_area].toFixed(2)}`);
            _saveAiAccuracy();
            outcome = 'wrong';
          } else if (humanConfirms >= 2) {
            _aiAreaAccuracy[_area] = Math.min(1.25, cur * 1.06);
            console.log(`[NEPAWatch AI] Confirmed: ${_area} (${humanConfirms} confirms) → accuracy factor ${_aiAreaAccuracy[_area].toFixed(2)}`);
            _saveAiAccuracy();
            outcome = 'correct';
          }
          if (typeof sb !== 'undefined' && _pp) {
            const predId = await _pp;
            if (predId) {
              sb.from('ai_predictions').update({
                outcome, human_confirms: humanConfirms, human_wrong_votes: wrongVotes,
                outcome_checked_at: new Date().toISOString(),
              }).eq('id', predId).then(() => {}).catch(() => {});
            }
          }
        }, 15 * 60 * 1000);
      }
    } else {
      console.warn('[NEPAWatch AI] Report not saved — notifications suppressed to avoid ghost alerts.');
    }
  },

  _replaceLocal(tempId, dbRow, prob) {
    if (typeof reports==='undefined') return;
    const idx = reports.findIndex(r=>r.id===tempId);
    if (idx!==-1) reports[idx] = {
      id: String(dbRow.id), name: dbRow.location_name, area: dbRow.location_area,
      type: dbRow.type, time: new Date(dbRow.created_at).getTime(),
      confirms: dbRow.confirms||1, userId: AI_USER_ID, isAI:true, aiProb:prob,
    };
    if (typeof render==='function') render();
    if (typeof renderSavedPlacesHome==='function') renderSavedPlacesHome();
    if (typeof renderMyPlacesList==='function') renderMyPlacesList();
  },

  start() {
    // AI runs server-side now. No browser timers needed.
    // loadAreaPredictions() is called directly from app.js on boot.
    loadModelStatus();
  },
};

/* ─── NEXT POWER EVENT PREDICTION ────────────────────────────────────── */
/**
 * Predicts when power will next turn ON or OFF for a given area.
 * Scans the next 24 hours using the statistical model + ground truth.
 *
 * Returns:
 *  { eventType, hoursUntil, estimatedTime, estimatedHour, prob, confidence,
 *    currentlyOut, allHours }
 */
function predictNextEvent(area) {
  const now = new Date();
  const h = now.getHours();
  const d = now.getDay();

  /* Determine current power status */
  const gt = getGroundTruth(area);
  const currentProb = predictOutage(area, h, d).prob;

  /* currentlyOut: true if power is likely out right now */
  let currentlyOut;
  if (gt && gt.confidence !== 'low') {
    currentlyOut = gt.prob > 0.55;
  } else {
    currentlyOut = currentProb > 0.55;
  }

  /* Compute hourly probabilities for next 24 hours */
  const allHours = [];
  for (let i = 0; i < 24; i++) {
    const checkH = (h + i) % 24;
    const checkD = (d + Math.floor((h + i) / 24)) % 7;
    const { prob: p } = predictOutage(area, checkH, checkD);
    allHours.push({ offset: i, hour: checkH, prob: p });
  }

  /* Find the next transition */
  let eventType = null, hoursUntil = null, estimatedHour = null, eventProb = null;

  if (currentlyOut) {
    /* Looking for power RESTORATION: prob drops below 0.40 */
    for (const { offset, hour, prob } of allHours) {
      if (offset === 0) continue; // skip current hour
      if (prob < 0.40) {
        eventType = 'on';
        hoursUntil = offset;
        estimatedHour = hour;
        eventProb = prob;
        break;
      }
    }
    if (!eventType) {
      /* No restoration found — show best (lowest prob) hour */
      const best = allHours.reduce((a, b) => a.prob < b.prob ? a : b);
      eventType = 'on';
      hoursUntil = best.offset;
      estimatedHour = best.hour;
      eventProb = best.prob;
    }
  } else {
    /* Looking for next OUTAGE: prob rises above 0.60 */
    for (const { offset, hour, prob } of allHours) {
      if (offset === 0) continue;
      if (prob > 0.60) {
        eventType = 'off';
        hoursUntil = offset;
        estimatedHour = hour;
        eventProb = prob;
        break;
      }
    }
    if (!eventType) {
      /* No outage found — show worst (highest prob) hour */
      const worst = allHours.reduce((a, b) => a.prob > b.prob ? a : b);
      eventType = 'off';
      hoursUntil = worst.offset;
      estimatedHour = worst.hour;
      eventProb = worst.prob;
    }
  }

  const estimatedTime = new Date(now.getTime() + hoursUntil * 3600000);
  const confidence = gt ? gt.confidence : 'low';

  return {
    eventType,       /* 'on' = power coming | 'off' = power going out */
    hoursUntil,
    estimatedTime,
    estimatedHour,
    prob: eventProb,
    confidence,
    currentlyOut,
    allHours,
  };
}

/* Format a time label for predicted event */
function fmtEventTime(estimatedTime) {
  const h = estimatedTime.getHours();
  const m = estimatedTime.getMinutes();
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 || 12;
  return m > 0 ? `${h12}:${String(m).padStart(2,'0')}${ampm}` : `${h12}${ampm}`;
}

/* ─── PREDICT PAGE ───────────────────────────────────────────────────────── */
function renderPredictPage() {
  const page = document.getElementById('page-predict');
  if (!page) return;
  const now=new Date(), h=now.getHours(), d=now.getDay();
  const fmtH = x=>`${x%12||12}${x<12?'am':'pm'}`;
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const DFULL= ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const area = (typeof PR!=='undefined'&&PR?.location_area) ? PR.location_area : Object.keys(AREA_BANDS)[0];
  const { prob, confidence, band, bandSupplyHours } = predictOutage(area,h,d);
  const risk = getRiskLevel(prob);
  const duration = predictDuration(area, h);
  let bH=0,bP=1; for(let i=0;i<24;i++){const{prob:p}=predictOutage(area,i,d);if(p<bP){bP=p;bH=i;}}
  const aiCount = (typeof reports!=='undefined') ? reports.filter(r=>r.userId===AI_USER_ID).length : 0;

  /* ── Next Power Event ── */
  const nxt = predictNextEvent(area);
  const nxtFmtH = x=>`${x%12||12}${x<12?'am':'pm'}`;
  const nxtColor = nxt.eventType==='on' ? '#AAFF00' : '#FF3D57';
  const nxtIcon = nxt.eventType==='on' ? '↗' : '↘';
  const nxtLabel = nxt.eventType==='on' ? 'Power may return' : 'Power may cut';
  const nxtTime = nxt.hoursUntil===0 ? 'Now' : nxt.hoursUntil===1 ? 'In ~1 hour' : `In ~${nxt.hoursUntil}h (${nxtFmtH(nxt.estimatedHour)})`;
  const nxtConf = nxt.confidence==='high' ? 'High confidence' : nxt.confidence==='medium' ? 'Medium confidence' : 'Statistical estimate';
  const nxtCurrentStatus = nxt.currentlyOut
    ? `<span style="color:#FF3D57;font-weight:600">Currently OUT</span>`
    : `<span style="color:#AAFF00;font-weight:600">Currently ON</span>`;

  const hourBars = Array.from({length:24},(_,i)=>{
    const{prob:p}=predictOutage(area,i,d); const r=getRiskLevel(p); const isNow=i===h;
    return `<div class="pred-bar-col${isNow?' pred-bar-now':''}" title="${fmtH(i)}: ${Math.round(p*100)}%">
      <div class="pred-bar-fill" style="height:${Math.round(p*100)}%;background:${r.color}${isNow?'':'55'};border-radius:2px 2px 0 0"></div>
      ${isNow?'<div class="pred-bar-tick"></div>':''}
    </div>`;
  }).join('');

  const weekBars = DAYS.map((day,i)=>{
    const isToday=i===d; const{prob:p}=predictOutage(area,h,i,!isToday); const r=getRiskLevel(p);
    return `<div class="pred-week-col${isToday?' pred-week-today':''}">
      <div class="pred-week-bar-wrap"><div class="pred-week-fill" style="height:${Math.round(p*100)}%;background:${r.color}${isToday?'':'99'}"></div></div>
      <div class="pred-week-pct" style="color:${r.color}">${Math.round(p*100)}%</div>
      <div class="pred-week-day">${day}</div>
    </div>`;
  }).join('');

  const areaRows = Object.keys(AREA_BANDS)
    .map(a=>({a,p:predictOutage(a,h,d).prob,b:AREA_BANDS[a]}))
    .sort((x,y)=>x.p-y.p).slice(0,8)
    .map(({a,p,b})=>{
      const r=getRiskLevel(p); const sel=a===area;
      return `<div class="pred-area-row${sel?' pred-area-selected':''}" onclick="switchPredictArea('${a.replace(/'/g,"\\'")}')">
        <div class="pred-area-dot" style="background:${r.color};box-shadow:0 0 5px ${r.color}66"></div>
        <div class="pred-area-name">${a}</div>
        <span class="pred-band-badge" style="color:${BAND_COLOR[b]};border-color:${BAND_COLOR[b]}44;background:${BAND_COLOR[b]}11">B${b}</span>
        <div class="pred-area-bar"><div class="pred-area-fill" style="width:${Math.round(p*100)}%;background:${r.color}88"></div></div>
        <div class="pred-area-pct" style="color:${r.color}">${Math.round(p*100)}%</div>
      </div>`;
    }).join('');

  const confMap={high:['●','High confidence — based on live report history'],medium:['◑','Medium confidence — area history + SBT model'],low:['○','Statistical model — NERC band + demand patterns']};
  const[cDot,cNote]=confMap[confidence]||confMap.low;

  page.innerHTML=`<div class="pred-wrap">
    <div class="pred-area-select-wrap">
      <div class="pred-area-label">Predicting for</div>
      <div id="predictAreaPicker"></div>
    </div>

    <div class="pred-hero" style="border-color:${risk.color}44" id="predHeroCard">
      <div class="pred-hero-glow" style="background:radial-gradient(ellipse at top right,${risk.color}14 0%,transparent 70%)"></div>
      <div class="pred-hero-left">
        <div class="pred-hero-label">Outage chance right now</div>
        <div class="pred-hero-prob" style="color:${risk.color}" id="predHeroProb">${Math.round(prob*100)}%</div>
        <div class="pred-risk-badge" style="color:${risk.color};background:${risk.color}18;border-color:${risk.color}33" id="predRiskBadge">${risk.label}</div>
        <div class="pred-hero-time">${DFULL[d]}, ${fmtH(h)} · Band ${band}</div>
      </div>
      <div class="pred-hero-right">
        <div class="pred-stat-box"><div class="pred-stat-val" id="predDuration">${duration}h</div><div class="pred-stat-lbl">Est. duration</div></div>
        <div class="pred-stat-box"><div class="pred-stat-val" style="color:#69B4FF">${bandSupplyHours}h</div><div class="pred-stat-lbl">Daily target</div></div>
        <div class="pred-stat-box"><div class="pred-stat-val" style="color:#B794F6" id="predBestWindow">${fmtH(bH)}–${fmtH((bH+3)%24)}</div><div class="pred-stat-lbl">Best window</div></div>
      </div>
    </div>

    <div class="pred-conf" id="predConf"><span class="pred-conf-dot">${cDot}</span><div><div class="pred-conf-title">${cNote}</div></div></div>

    <!-- Next Power Event Prediction -->
    <div class="pred-next-event-card" id="predNextEventCard" style="border-color:${nxtColor}33;background:${nxtColor}08">
      <div class="pred-next-event-header">
        <div class="pred-next-event-icon" style="color:${nxtColor}">${nxtIcon}</div>
        <div class="pred-next-event-title">
          <div class="pred-next-event-label" style="color:${nxtColor}">${nxtLabel}</div>
          <div class="pred-next-event-time" id="predNextEventTime">${nxtTime}</div>
        </div>
        <div class="pred-next-event-right">
          <div class="pred-next-event-status">${nxtCurrentStatus}</div>
          <div class="pred-next-event-conf" id="predNextEventConf">${nxtConf}</div>
        </div>
      </div>
      <div class="pred-next-event-timeline" id="predNextEventTimeline">
        ${nxt.allHours.slice(0,12).map(({offset,hour,prob})=>{
          const r=getRiskLevel(prob);
          const isEvent=offset===nxt.hoursUntil;
          return `<div class="pred-net-col${isEvent?' pred-net-event':''}">
            <div class="pred-net-bar" style="height:${Math.round(prob*100)}%;background:${r.color}${isEvent?'':'66'};${isEvent?`box-shadow:0 0 6px ${r.color}88`:''};"></div>
            <div class="pred-net-label" style="${isEvent?`color:${r.color};font-weight:600`:''}">${nxtFmtH(hour)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="pred-ai-banner">
      <div class="pred-ai-icon"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.1"/><path d="M4 7.5L5.5 5 7 7.5M4.7 6.5h2.6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg></div>
      <div class="pred-ai-body">
        <div class="pred-ai-title">NEPAWatch AI is active</div>
        <div class="pred-ai-sub">Server-side · above ${Math.round(AI_CONFIDENCE_THRESH*100)}% threshold · <strong style="color:var(--p)">${aiCount} AI report${aiCount!==1?'s':''}</strong>${_modelStatus?.summary?.accuracy_pct != null ? ` · <strong style="color:var(--p)">${_modelStatus.summary.accuracy_pct}%</strong> accurate (30d)` : ''}</div>
      </div>
      <div class="pred-ai-dot"></div>
    </div>

    <div class="slbl">24-Hour Forecast</div>
    <div class="pred-chart-wrap">
      <div class="pred-chart-y"><span>100%</span><span>50%</span><span>0%</span></div>
      <div class="pred-bars" id="pred24Bars">${hourBars}</div>
    </div>
    <div class="pred-chart-footer"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>

    <div class="slbl">This Week</div>
    <div class="pred-week" id="predWeekBars">${weekBars}</div>

    <div class="slbl">Safest Areas Right Now</div>
    <div class="pred-area-list" id="predAreaList">${areaRows}</div>

    <div class="slbl">How It Works</div>
    <div class="pred-model-card">
      <div class="pred-model-row">
        <div class="pred-model-ico"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.1"/><path d="M4 7.5L5.5 5 7 7.5M4.7 6.5h2.6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg></div>
        <div><div class="pred-model-title">Auto-reports on your behalf</div>
        <div class="pred-model-text">When the model detects outage probability above ${Math.round(AI_CONFIDENCE_THRESH*100)}% in any area across Nigeria, NEPAWatch AI automatically files a report — tagged as AI-generated in the live feed. No input needed from anyone.</div></div>
      </div>
      <div class="pred-model-row">
        <div class="pred-model-ico"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="6" width="2" height="4" rx=".5" fill="currentColor"/><rect x="5" y="3.5" width="2" height="6.5" rx=".5" fill="currentColor"/><rect x="9" y="1.5" width="2" height="8.5" rx=".5" fill="currentColor"/></svg></div>
        <div><div class="pred-model-title">Powered by NERC bands + crowd history</div>
        <div class="pred-model-text">Combines SBT tariff band supply targets with hourly demand-spike patterns — peaks at 5am and 7pm (Energy for Growth Hub, 2025). Accuracy improves the more users report.</div></div>
      </div>
      <div class="pred-model-row" style="border-bottom:none">
        <div class="pred-model-ico"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 1.5h6v5a3 3 0 0 1-6 0V1.5z" stroke="currentColor" stroke-width="1.1"/><path d="M6 9.5v1.5M4 11h4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/><path d="M3 3H1.5a1.5 1.5 0 0 0 1.5 1.5M9 3h1.5a1.5 1.5 0 0 1-1.5 1.5" stroke="currentColor" stroke-width="1"/></svg></div>
        <div><div class="pred-model-title">NEPAWatch AI on the leaderboard</div>
        <div class="pred-model-text">AI-filed reports appear under "NEPAWatch AI" on the community leaderboard. Human confirmations on AI reports further improve prediction accuracy over time.</div></div>
      </div>
    </div>
  </div>`;

  _predictPicker = initAreaPicker('predictAreaPicker', Object.keys(AREA_BANDS), area, switchPredictArea);
}

/* Handle to the predict page picker so switchPredictArea can sync its label
   when the area changes from somewhere else (e.g. the nearby-areas list). */
let _predictPicker = null;

function switchPredictArea(area) {
  if (_predictPicker) _predictPicker.set(area);
  const now=new Date(),h=now.getHours(),d=now.getDay();
  const fmtH=x=>`${x%12||12}${x<12?'am':'pm'}`;
  const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const{prob,confidence,band,bandSupplyHours}=predictOutage(area,h,d);
  const risk=getRiskLevel(prob); const duration=predictDuration(area,h);
  let bH=0,bP=1; for(let i=0;i<24;i++){const{prob:p}=predictOutage(area,i,d);if(p<bP){bP=p;bH=i;}}
  const ge=id=>document.getElementById(id);
  if(ge('predHeroProb')){ge('predHeroProb').textContent=`${Math.round(prob*100)}%`;ge('predHeroProb').style.color=risk.color;}
  if(ge('predRiskBadge')){ge('predRiskBadge').textContent=risk.label;ge('predRiskBadge').style.color=risk.color;ge('predRiskBadge').style.background=risk.color+'18';ge('predRiskBadge').style.borderColor=risk.color+'33';}
  if(ge('predDuration')) ge('predDuration').textContent=`${duration}h`;
  if(ge('predBestWindow')) ge('predBestWindow').textContent=`${fmtH(bH)}–${fmtH((bH+3)%24)}`;
  if(ge('predHeroCard')) ge('predHeroCard').style.borderColor=risk.color+'44';
  const glow=document.querySelector('.pred-hero-glow'); if(glow) glow.style.background=`radial-gradient(ellipse at top right,${risk.color}14 0%,transparent 70%)`;
  const confMap={high:['●','High confidence — based on live report history'],medium:['◑','Medium confidence — area history + SBT model'],low:['○','Statistical model — NERC band + demand patterns']};
  const[cDot,cNote]=confMap[confidence]||confMap.low;
  if(ge('predConf')) ge('predConf').innerHTML=`<span class="pred-conf-dot">${cDot}</span><div><div class="pred-conf-title">${cNote}</div></div>`;
  if(ge('pred24Bars')) ge('pred24Bars').innerHTML=Array.from({length:24},(_,i)=>{const{prob:p}=predictOutage(area,i,d);const r=getRiskLevel(p);const isNow=i===h;return`<div class="pred-bar-col${isNow?' pred-bar-now':''}" title="${fmtH(i)}: ${Math.round(p*100)}%"><div class="pred-bar-fill" style="height:${Math.round(p*100)}%;background:${r.color}${isNow?'':'55'};border-radius:2px 2px 0 0"></div>${isNow?'<div class="pred-bar-tick"></div>':''}</div>`;}).join('');
  if(ge('predWeekBars')) ge('predWeekBars').innerHTML=DAYS.map((day,i)=>{const isT=i===d;const{prob:p}=predictOutage(area,h,i,!isT);const r=getRiskLevel(p);return`<div class="pred-week-col${isT?' pred-week-today':''}"><div class="pred-week-bar-wrap"><div class="pred-week-fill" style="height:${Math.round(p*100)}%;background:${r.color}${isT?'':'99'}"></div></div><div class="pred-week-pct" style="color:${r.color}">${Math.round(p*100)}%</div><div class="pred-week-day">${day}</div></div>`;}).join('');
  if(ge('predAreaList')) ge('predAreaList').innerHTML=Object.keys(AREA_BANDS).map(a=>({a,p:predictOutage(a,h,d).prob,b:AREA_BANDS[a]})).sort((x,y)=>x.p-y.p).slice(0,8).map(({a,p,b})=>{const r=getRiskLevel(p);const sel=a===area;return`<div class="pred-area-row${sel?' pred-area-selected':''}" onclick="switchPredictArea('${a.replace(/'/g,"\\'")}')"><div class="pred-area-dot" style="background:${r.color};box-shadow:0 0 5px ${r.color}66"></div><div class="pred-area-name">${a}</div><span class="pred-band-badge" style="color:${BAND_COLOR[b]};border-color:${BAND_COLOR[b]}44;background:${BAND_COLOR[b]}11">B${b}</span><div class="pred-area-bar"><div class="pred-area-fill" style="width:${Math.round(p*100)}%;background:${r.color}88"></div></div><div class="pred-area-pct" style="color:${r.color}">${Math.round(p*100)}%</div></div>`;}).join('');

  /* Update next event card */
  const nxt2=predictNextEvent(area);
  const nxtFmtH2=x=>`${x%12||12}${x<12?'am':'pm'}`;
  const nxtColor2=nxt2.eventType==='on'?'#AAFF00':'#FF3D57';
  const nxtIcon2=nxt2.eventType==='on'?'↗':'↘';
  const nxtLabel2=nxt2.eventType==='on'?'Power may return':'Power may cut';
  const nxtTime2=nxt2.hoursUntil===0?'Now':nxt2.hoursUntil===1?'In ~1 hour':`In ~${nxt2.hoursUntil}h (${nxtFmtH2(nxt2.estimatedHour)})`;
  const nxtConf2=nxt2.confidence==='high'?'High confidence':nxt2.confidence==='medium'?'Medium confidence':'Statistical estimate';
  const card=ge('predNextEventCard');
  if(card){
    card.style.borderColor=nxtColor2+'33';card.style.background=nxtColor2+'08';
    card.querySelector('.pred-next-event-icon').textContent=nxtIcon2;
    card.querySelector('.pred-next-event-icon').style.color=nxtColor2;
    card.querySelector('.pred-next-event-label').textContent=nxtLabel2;
    card.querySelector('.pred-next-event-label').style.color=nxtColor2;
    if(ge('predNextEventTime'))ge('predNextEventTime').textContent=nxtTime2;
    if(ge('predNextEventConf'))ge('predNextEventConf').textContent=nxtConf2;
    const tl=ge('predNextEventTimeline');
    if(tl)tl.innerHTML=nxt2.allHours.slice(0,12).map(({offset,hour,prob})=>{const r=getRiskLevel(prob);const isEv=offset===nxt2.hoursUntil;return`<div class="pred-net-col${isEv?' pred-net-event':''}"><div class="pred-net-bar" style="height:${Math.round(prob*100)}%;background:${r.color}${isEv?'':'66'};${isEv?`box-shadow:0 0 6px ${r.color}88`:''};"></div><div class="pred-net-label" style="${isEv?`color:${r.color};font-weight:600`:''}">${nxtFmtH2(hour)}</div></div>`;}).join('');
  }
}

function renderMyAreaPredictWidget() {
  const el=document.getElementById('myAreaPredictWidget'); if(!el) return;
  const area=(typeof PR!=='undefined'&&PR?.location_area)||null; if(!area){el.innerHTML='';return;}
  const now=new Date(),h=now.getHours(),d=now.getDay();
  const fmtH=x=>`${x%12||12}${x<12?'am':'pm'}`;
  const{prob}=predictOutage(area,h,d); const risk=getRiskLevel(prob);
  const duration=predictDuration(area,h);
  let bH=0,bP=1; for(let i=0;i<24;i++){const{prob:p}=predictOutage(area,i,d);if(p<bP){bP=p;bH=i;}}
  /* Next event */
  const nxt=predictNextEvent(area);
  const nxtC=nxt.eventType==='on'?'#AAFF00':'#FF3D57';
  const nxtIcon=nxt.eventType==='on'?'↗':'↘';
  const nxtLbl=nxt.eventType==='on'?'Power coming':'Power cutting';
  const nxtT=nxt.hoursUntil===0?'Now':nxt.hoursUntil===1?'~1h':`~${nxt.hoursUntil}h (${fmtH(nxt.estimatedHour)})`;
  el.innerHTML=`<div class="pred-widget" style="border-color:${risk.color}22" onclick="go('predict')">
    <div class="pred-widget-left">
      <div class="pred-widget-label">AI Prediction · ${area}</div>
      <div class="pred-widget-prob" style="color:${risk.color}">${Math.round(prob*100)}%</div>
      <div class="pred-widget-risk" style="background:${risk.color}18;color:${risk.color}">${risk.label}</div>
    </div>
    <div class="pred-widget-right">
      <div class="pred-widget-stat"><span>${duration}h</span><small>if it cuts</small></div>
      <div class="pred-widget-stat"><span style="color:#B794F6">${fmtH(bH)}–${fmtH((bH+3)%24)}</span><small>best window</small></div>
      <div class="pred-widget-stat" style="margin-top:2px"><span style="color:${nxtC}">${nxtIcon} ${nxtT}</span><small>${nxtLbl}</small></div>
    </div>
    <div class="pred-widget-arrow">›</div>
  </div>`;
}
