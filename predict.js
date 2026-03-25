/* ===== NEPAWatch Lagos — predict.js ===== */
/* AI Auto-Reporter: predicts outages and auto-submits reports attributed to  */
/* "NEPAWatch AI". No external APIs — pure statistical model, 100% free.      */
/*                                                                             */
/* Research grounding:                                                         */
/*  - Energy for Growth Hub (2025): outage peaks 5am & 7pm; ~60% load shedding*/
/*  - NERC SBT tariff bands: Band A=20-24h supply, Band E=4-8h supply target  */
/*  - Sensors/MDPI (2024): XGBoost 98.4% accuracy on outage duration           */

/* ─── IDENTITY ──────────────────────────────────────────────────────────── */
const AI_USER_ID            = 'nepawatch-ai';
const AI_USER_NAME          = 'NEPAWatch AI';
const AI_CONFIDENCE_THRESH  = 0.65;   /* min prob to auto-file an outage report */
const AI_SCAN_INTERVAL_MS   = 5 * 60 * 1000;   /* scan every 5 min */
/* AI_COOLDOWN_MS removed — replaced by per-area state machine in AIReporter */
const AI_RESTORE_THRESH     = 0.25;   /* below this → file restoration report */
const AI_MAX_PER_SCAN       = 3;      /* max new AI reports fired per scan cycle */
const AI_MIN_REFIRE_MS      = 2 * 60 * 60 * 1000; /* min 2h between AI reports for same area */

/* ─── BAND CLASSIFICATION ────────────────────────────────────────────────── */
const AREA_BANDS = {
  "Victoria Island":"A","Ikoyi":"A","Lekki Phase 1":"A","Ikeja GRA":"A","Lekki Phase 2/Ikota":"A",
  "Chevron/Lekki-Epe Expressway":"B","Igbo Efon/Ilasan":"B","Magodo":"B","Ojodu/Omole":"B","Gbagada":"B",
  "Maryland/Anthony":"C","Kosofe/Ketu":"C","Surulere":"C","Yaba":"C","Ilupeju":"C",
  "Shomolu/Bariga":"C","Ojota/Oregun":"C","Ebute Metta":"C","Ogba":"C",
  "Agege":"D","Mushin":"D","Oshodi/Isolo":"D","Festac Town":"D","Amuwo Odofin":"D",
  "Lagos Island":"D","Obalende/CMS":"D","Apapa":"D","Onikan/Lagos Mainland":"D","Ajah":"D",
  "Alimosho/Ipaja":"E","Ikorodu":"E","Badagry":"E","Ojo/Alaba":"E","Ibeju-Lekki":"E","Epe":"E",
  // Additional areas not previously in AREA_BANDS
  "Ajah":"D","Sangotedo":"D","Abraham Adesanya":"D","Awoyaya":"D","Bogije":"E","Abijo":"E",
  "Lekki Phase 2/Ikota":"B","Chevron/Lekki-Epe Expressway":"B","Igbo Efon/Ilasan":"B",
  "Osapa London":"B","Agungi":"B","Jakande Estate Lekki":"B","VGC":"B",
  "Obalende/CMS":"D","Onikan/Lagos Mainland":"D","Lagos Island":"D",
  "Ebute Metta":"C","Oyingbo":"C","Makoko":"D","Iwaya":"C","Akoka":"C",
  "FCE Akoka":"C","UNILAG":"C","YABATECH":"C","LUTH":"C",
  "Festac Town":"D","Amuwo Odofin":"D","Mile 2":"D","Satellite Town":"D",
  "Apapa":"D","Apapa GRA":"C","Tin Can Island":"D",
  "Oshodi/Isolo":"D","Mushin":"D","Ilupeju":"C","Okota":"D",
  "Ikorodu GRA":"D","Agric Ikorodu":"E",
};

const BAND_BASELINE      = { A:0.18, B:0.28, C:0.42, D:0.58, E:0.74 };
const BAND_SUPPLY_HOURS  = { A:22,   B:18,   C:14,   D:10,   E:6    };
const BAND_COLOR         = { A:"#00E676", B:"#69F0AE", C:"#FFB300", D:"#FF7043", E:"#FF3D57" };

/* Hourly demand-risk multipliers — Energy for Growth Hub (2025) dual peaks */
const HOURLY_FACTOR = [
  0.90,0.80,0.72,0.68,0.72,1.38,1.22,1.10,
  0.98,0.88,0.82,0.80,0.82,0.86,0.90,0.95,
  1.05,1.12,1.38,1.55,1.45,1.30,1.18,1.05,
];
const DAY_FACTOR = [0.88,1.06,1.06,1.03,1.00,0.97,0.90]; /* 0=Sun */

/* ─── HISTORY ENGINE ────────────────────────────────────────────────────── */
const PredictHistory = {
  _data: {},
  _liveAdded: 0,  // count of live-added reports since last full ingest
  ingest(rows) {
    this._data = {};
    this._liveAdded = 0;
    rows.forEach(r => {
      if (!r.location_area) return;
      const t = new Date(r.created_at || r.time);
      const k = `${r.location_area}|${t.getHours()}|${t.getDay()}`;
      if (!this._data[k]) this._data[k] = { out:0, total:0, confirms:0 };
      this._data[k].total++;
      if (r.type === 'out') this._data[k].out++;
      // Weight confirmed reports more — they represent stronger ground truth
      this._data[k].confirms += (r.confirms||1);
    });
  },
  // Live-train from a single new report (called on every real-time INSERT)
  addReport(r) {
    if (!r.location_area && !r.area) return;
    const area = r.location_area || r.area;
    const t = new Date(r.created_at || r.time);
    const k = `${area}|${t.getHours()}|${t.getDay()}`;
    if (!this._data[k]) this._data[k] = { out:0, total:0, confirms:0 };
    this._data[k].total++;
    if ((r.type||'') === 'out') this._data[k].out++;
    this._data[k].confirms += (r.confirms||1);
    this._liveAdded++;
  },
  getRate(area, hour, day) {
    const b = this._data[`${area}|${hour}|${day}`];
    if (!b || b.total < 3) return null;
    // Boost accuracy when many confirmations exist (each confirm = another data point)
    const confirmBoost = Math.min(0.15, (b.confirms / (b.total * 3)) * 0.15);
    const raw = b.out / b.total;
    return Math.min(0.97, raw + (raw > 0.5 ? confirmBoost : -confirmBoost));
  },
  getAreaRate(area) {
    let out=0, total=0;
    for (const [k,v] of Object.entries(this._data))
      if (k.startsWith(area+'|')) { out+=v.out; total+=v.total; }
    return total >= 5 ? out/total : null;
  },
};

/* ─── WEATHER MODULE (Open-Meteo, free, no API key) ─────────────────────── */
const WeatherState = {
  code: null,       // WMO weather code
  rain: 0,          // mm precipitation
  wind: 0,          // km/h wind
  lastFetch: 0,
  FETCH_INTERVAL: 15 * 60 * 1000, // every 15 min

  async refresh(lat, lng) {
    if (Date.now() - this.lastFetch < this.FETCH_INTERVAL) return;
    /* Use provided coords or default to Nigeria centroid (approx Abuja) */
    const la = lat ?? 9.0765;
    const lo = lng ?? 7.3986;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=weathercode,precipitation,windspeed_10m&timezone=Africa%2FLagos`;
      const res = await fetch(url);
      const d = await res.json();
      const c = d.current || {};
      this.code = c.weathercode ?? null;
      this.rain = c.precipitation ?? 0;
      this.wind = c.windspeed_10m ?? 0;
      this.lastFetch = Date.now();
    } catch(e) { /* silent — model works without weather */ }
  },

  // Returns outage probability multiplier based on current weather
  // WMO codes: 51-67 = rain, 80-82 = showers, 95-99 = thunderstorm
  getRiskMultiplier() {
    const c = this.code;
    if (c === null) return 1.0;
    if (c >= 95) return 1.85;             // thunderstorm — big spike
    if (c >= 80 || (c >= 51 && c <= 67)) {
      if (this.rain > 10) return 1.65;    // heavy rain
      if (this.rain > 3)  return 1.40;    // moderate rain
      return 1.20;                         // light rain
    }
    if (this.wind > 40) return 1.30;      // high winds
    return 1.0;
  },

  getLabel() {
    const c = this.code;
    if (c === null) return null;
    if (c >= 95) return 'Thunderstorm';
    if (c >= 80) return 'Rain showers';
    if (c >= 51 && c <= 67) return `Rain (${this.rain}mm)`;
    if (c >= 1 && c <= 3) return 'Cloudy';
    if (c === 0) return 'Clear';
    return null;
  }
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
function predictOutage(area, hour, dayOfWeek) {
  const band   = AREA_BANDS[area] || 'C';
  const base   = BAND_BASELINE[band];
  const hProb  = Math.min(0.95, base * HOURLY_FACTOR[hour]);
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

  // Weather multiplier
  const wx = WeatherState.getRiskMultiplier();
  statProb = Math.min(0.97, statProb * wx);
  if (wx > 1.3) confidence = confidence === 'low' ? 'medium' : 'high';

  // Ground truth from live reports — this DOMINATES the statistical model
  const gt = getGroundTruth(area);
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

  return {
    prob: Math.min(0.97, Math.max(0.03, prob)),
    confidence,
    band,
    bandSupplyHours: BAND_SUPPLY_HOURS[band],
    weather: WeatherState.getLabel(),
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

/* ─── AI AUTO-REPORTER ───────────────────────────────────────────────────── */
const _AI_FIRED_KEY = 'nw_ai_lastfired_v2';

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

  // Rebuild state from AI-only reports — human reports must NOT reset this
  // state machine or scan() will re-fire an AI "out" every time humans say bck
  _rebuildState() {
    if (typeof reports === 'undefined') return;
    this._areaState = {};
    // Include both confirmed DB rows AND local optimistic ai- inserts
    const sorted = [...reports]
      .filter(r => r.isAI || r.userId === AI_USER_ID || String(r.id).startsWith('ai-'))
      .sort((a,b) => a.time - b.time);
    for (const r of sorted) {
      if (!r.area) continue;
      this._areaState[r.area] = r.type;
    }
  },

  async loadHistory() {
    this._loadFiredState(); // restore _lastFired from localStorage before first scan
    try {
      const { data, error } = await sb
        .from('reports')
        .select('location_area, type, created_at')
        .order('created_at', { ascending:false })
        .limit(2000);
      if (!error && data?.length) {
        PredictHistory.ingest(data);
        console.log(`[NEPAWatch AI] History loaded: ${data.length} reports ingested.`);
      }
    } catch(e) { console.warn('[NEPAWatch AI] History load failed, using baseline model.'); }
    this._rebuildState();
  },

  async scan() {
    /* Pass approximate coordinates for weather: default to Nigeria centroid */
    const firstArea = Object.keys(AREA_BANDS)[0];
    const coords = (typeof AREA_COORDS !== 'undefined' && AREA_COORDS[firstArea])
      ? AREA_COORDS[firstArea] : null;
    await WeatherState.refresh(coords?.lat, coords?.lng);
    this._rebuildState();
    const now=new Date(), h=now.getHours(), d=now.getDay();
    let firedCount = 0;
    const areas = Object.keys(AREA_BANDS);
    // Shuffle to avoid always picking same areas first
    for (let i = areas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [areas[i], areas[j]] = [areas[j], areas[i]];
    }
    for (const area of areas) {
      if (firedCount >= AI_MAX_PER_SCAN) break;
      const { prob, groundTruth } = predictOutage(area, h, d);
      if (prob < AI_CONFIDENCE_THRESH) continue;
      const currentState = this._areaState[area];
      if (currentState === 'out') continue;
      // Rate-limit: don't re-fire same area too soon
      const lastFiredAt = this._lastFired[area] || 0;
      if (Date.now() - lastFiredAt < AI_MIN_REFIRE_MS) continue;
      // If ground truth has a fresh human bck report, power is on — skip
      if (groundTruth?.hasFreshHuman && groundTruth.prob < 0.4) continue;
      const recentRestore = (typeof reports!=='undefined') &&
        reports.some(r =>
          (r.area===area || (typeof AREA_PARENT!=='undefined' && AREA_PARENT[r.area]===area))
          && r.type==='bck' && (now-r.time) < 30*60000);
      if (recentRestore) continue;
      // Stagger fires: small delay between each to avoid burst
      if (firedCount > 0) await new Promise(res => setTimeout(res, 800));
      await this._fire(area, 'out', prob);
      firedCount++;
    }
  },

  async scanRestorations() {
    if (typeof reports==='undefined') return;
    this._rebuildState();
    const now=new Date(), h=now.getHours(), d=now.getDay();
    const outAreas = Object.entries(this._areaState)
      .filter(([area, state]) => state === 'out')
      .map(([area]) => area);
    let firedCount = 0;
    for (const area of outAreas) {
      if (firedCount >= AI_MAX_PER_SCAN) break;
      if (!AREA_BANDS[area]) continue;
      const { prob, groundTruth } = predictOutage(area, h, d);
      // Fresh human bck report — act fast, dont wait
      if (groundTruth?.hasFreshHuman && groundTruth.prob < 0.35) {
        const alreadyRestored = reports.some(x => x.area===area && x.type==='bck' && (now-x.time)<15*60000);
        if (!alreadyRestored) {
          if (firedCount > 0) await new Promise(res => setTimeout(res, 800));
          await this._fire(area, 'bck', 1-prob);
          firedCount++;
        }
        continue;
      }
      if (prob >= AI_RESTORE_THRESH) continue;
      const outageReport = [...reports]
        .filter(r => r.area===area && r.type==='out')
        .sort((a,b) => b.time - a.time)[0];
      // Must wait at least 90min since the outage was filed before auto-restoring
      // (prevents the out→bck→out→bck loop on each scan cycle)
      const minWait = (groundTruth?.confidence === 'high') ? 90*60000 : 3*60*60000;
      if (outageReport && (now - outageReport.time) < minWait) continue;
      // Also respect _lastFired rate-limit for the area
      const lastFiredAt = this._lastFired[area] || 0;
      if (Date.now() - lastFiredAt < AI_MIN_REFIRE_MS) continue;
      const alreadyRestored = reports.some(x =>
        x.area===area && x.type==='bck' &&
        (outageReport ? x.time > outageReport.time : true));
      if (alreadyRestored) continue;
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
      if (reports.length > 500) {
        const tail = reports.slice(400); // check beyond 400
        const firstDeletable = tail.findIndex(r => !r.isAI && r.userId !== AI_USER_ID && !String(r.id).startsWith('local-'));
        if (firstDeletable !== -1) reports.splice(400 + firstDeletable, 1);
      }
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

    /* Fire push + email alerts immediately — don't wait for DB persistence.
       Notifications should go out the moment the AI makes a call, not contingent
       on the edge function returning a report object. */
    if (typeof sendAreaAlerts === 'function') {
      sendAreaAlerts(locName, area, type).catch(() => {});
    }

    /* Persist via edge function — uses service role key, bypasses RLS */
    try {
      const res = await fetch(
        'https://djurokbkkqrmpafcxlez.supabase.co/functions/v1/send-alert',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'ai_report',
            location_name: locName,
            location_area: area,
            type,
            ai_prob: parseFloat(prob.toFixed(3)),
          }),
        }
      );
      const result = await res.json();
      if (result?.report) {
        this._replaceLocal(tempId, result.report, prob);
        /* Refresh predict page AI count if visible */
        const aiBanner = document.querySelector('.pred-ai-sub strong');
        if (aiBanner && typeof reports!=='undefined') {
          const cnt = reports.filter(r=>r.isAI||r.userId===AI_USER_ID).length;
          aiBanner.textContent = `${cnt} AI report${cnt!==1?'s':''}`;
        }
        console.log('[NEPAWatch AI] Report persisted via edge fn, id:', result.report.id);
      } else {
        console.warn('[NEPAWatch AI] Edge fn response (no report returned):', result);
      }
    } catch(e) { console.warn('[NEPAWatch AI] Report persist failed:', e?.message); }
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
    if (this._timer) clearInterval(this._timer);
    if (this._retrainTimer) clearInterval(this._retrainTimer);
    setTimeout(()=>{ this.scan(); this.scanRestorations(); }, 60000); /* wait 60s after boot */
    this._timer = setInterval(()=>{ this.scan(); this.scanRestorations(); }, AI_SCAN_INTERVAL_MS);
    // Re-ingest full history every 2 hours so model stays fresh with all DB reports
    this._retrainTimer = setInterval(()=>{
      this.loadHistory().then(()=>{
        console.log(`[NEPAWatch AI] Periodic re-training complete. Live updates since last ingest: ${PredictHistory._liveAdded}`);
      });
    }, 2 * 60 * 60 * 1000);
    console.log('[NEPAWatch AI] Auto-reporter started. Model trains on every live report.');
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
    const{prob:p}=predictOutage(area,h,i); const r=getRiskLevel(p); const isToday=i===d;
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
      <select class="pred-area-select" id="predictAreaSelect" onchange="switchPredictArea(this.value)">
        ${Object.keys(AREA_BANDS).map(a=>`<option value="${a}"${a===area?' selected':''}>${a}</option>`).join('')}
      </select>
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
        <div class="pred-ai-sub">Auto-reports when probability exceeds ${Math.round(AI_CONFIDENCE_THRESH*100)}% · <strong style="color:var(--p)">${aiCount} AI report${aiCount!==1?'s':''}</strong> filed</div>
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
}

function switchPredictArea(area) {
  const sel=document.getElementById('predictAreaSelect'); if(sel) sel.value=area;
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
  if(ge('predWeekBars')) ge('predWeekBars').innerHTML=DAYS.map((day,i)=>{const{prob:p}=predictOutage(area,h,i);const r=getRiskLevel(p);const isT=i===d;return`<div class="pred-week-col${isT?' pred-week-today':''}"><div class="pred-week-bar-wrap"><div class="pred-week-fill" style="height:${Math.round(p*100)}%;background:${r.color}${isT?'':'99'}"></div></div><div class="pred-week-pct" style="color:${r.color}">${Math.round(p*100)}%</div><div class="pred-week-day">${day}</div></div>`;}).join('');
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
