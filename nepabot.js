/* =============================================================
   NEPAWatch Lagos — nepabot.js  (v2 — Full Data Integration)
   
   The bot now reads EVERYTHING from the live app:
   - reports[]         live outage/restoration feed
   - AREA_BANDS{}      tariff band per area
   - DISCO[]           zone info
   - LAGOS{}           streets per area
   - PR               logged-in user profile + saved location
   - savedPlaces[]     user's home/work/school
   - predictOutage()   AI probability engine
   - PredictHistory    historical outage rates
   
   NLP approach:
   - Intent scoring across 30+ intent categories
   - Entity extraction: area names, street names, time references
   - Context memory: last area, last topic, conversation turn
   - Live data fusion: every answer pulls real numbers
   ============================================================= */

/* ── SAFE ACCESSORS ────────────────────────────────────────── */
/* These wrapper functions safely read globals from app.js      */
/* even if they haven't loaded yet                              */
const BOT = {

  /* Get the live reports array */
  reports() {
    return (typeof reports !== 'undefined' && Array.isArray(reports)) ? reports : [];
  },

  /* Get area → band map */
  areaBands() {
    return (typeof AREA_BANDS !== 'undefined') ? AREA_BANDS : {};
  },

  /* Get all known area names */
  allAreas() {
    return Object.keys(this.areaBands());
  },

  /* Get DISCO array */
  discos() {
    return (typeof DISCO !== 'undefined' && Array.isArray(DISCO)) ? DISCO : [];
  },

  /* Get streets for an area */
  streets(area) {
    if (typeof LAGOS !== 'undefined' && LAGOS[area]) return LAGOS[area];
    return [];
  },

  /* Get user profile */
  profile() {
    return (typeof PR !== 'undefined') ? PR : null;
  },

  /* Get saved places */
  savedPlaces() {
    return (typeof savedPlaces !== 'undefined' && Array.isArray(savedPlaces)) ? savedPlaces : [];
  },

  /* Get AI prediction for area */
  predict(area) {
    if (typeof predictOutage === 'function') {
      const now = new Date();
      return predictOutage(area, now.getHours(), now.getDay());
    }
    return null;
  },

  /* Get predicted outage duration */
  predictDur(area) {
    if (typeof predictDuration === 'function') {
      return predictDuration(area, new Date().getHours());
    }
    return null;
  },

  /* Get risk label */
  riskLevel(prob) {
    if (typeof getRiskLevel === 'function') return getRiskLevel(prob);
    if (prob < 0.25) return { label: 'Low Risk', color: '#00E676' };
    if (prob < 0.50) return { label: 'Moderate', color: '#FFB300' };
    if (prob < 0.72) return { label: 'High Risk', color: '#FF7043' };
    return { label: 'Critical', color: '#FF3D57' };
  },

  /* Find the most recent report for an area */
  latestForArea(area) {
    const lower = area.toLowerCase();
    return this.reports().find(r => r.area && r.area.toLowerCase().includes(lower)) || null;
  },

  /* Get all reports for area (last 24h) */
  areaReports24h(area) {
    const lower = area.toLowerCase();
    const cutoff = Date.now() - 86400000;
    return this.reports().filter(r =>
      r.area && r.area.toLowerCase().includes(lower) && r.time > cutoff
    );
  },

  /* Count outages vs restorations for area */
  areaStats(area) {
    const reps = this.areaReports24h(area);
    const out = reps.filter(r => r.type === 'out');
    const bck = reps.filter(r => r.type === 'bck');
    return { total: reps.length, outCount: out.length, bckCount: bck.length, reports: reps };
  },

  /* Is a given area currently out based on latest report? */
  isOut(area) {
    const r = this.latestForArea(area);
    if (!r) return null; // unknown
    return r.type === 'out';
  },

  /* How long has it been out? (if out) */
  outDuration(area) {
    const r = this.latestForArea(area);
    if (!r || r.type !== 'out') return null;
    return Date.now() - r.time;
  },

  /* Format duration in ms to readable */
  fmtDuration(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m} minute${m !== 1 ? 's' : ''}`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h} hour${h !== 1 ? 's' : ''}`;
  },

  /* Time ago string */
  ago(ts) {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60)   return `${d}s ago`;
    if (d < 3600) return `${Math.floor(d / 60)}m ago`;
    return `${Math.floor(d / 3600)}h ago`;
  },

  /* Format hour to "3pm" */
  fmtH(h) {
    return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
  },

  /* DISCO name for area */
  discoFor(area) {
    const discos = this.discos();
    for (const d of discos) {
      if (d.lgas && d.lgas.some(a => a.toLowerCase().includes(area.toLowerCase()) || area.toLowerCase().includes(a.toLowerCase()))) {
        return d.name;
      }
    }
    return null;
  },

  /* Band info */
  bandInfo(band) {
    const INFO = {
      A: { hours: '20–24h/day', desc: 'Premium supply', tier: 'best' },
      B: { hours: '16–20h/day', desc: 'Good supply',    tier: 'good' },
      C: { hours: '12–16h/day', desc: 'Moderate supply',tier: 'moderate' },
      D: { hours: '8–12h/day',  desc: 'Unstable supply',tier: 'poor' },
      E: { hours: '4–8h/day',   desc: 'Poorest supply', tier: 'very poor' },
    };
    return INFO[band] || null;
  },

  /* Get top N areas currently out */
  areasCurrentlyOut(n = 5) {
    const seen = new Set();
    return this.reports()
      .filter(r => r.type === 'out' && r.area && !seen.has(r.area) && seen.add(r.area))
      .slice(0, n)
      .map(r => ({ area: r.area, time: r.time, confirms: r.confirms }));
  },

  /* Get top N areas currently restored */
  areasCurrentlyOn(n = 5) {
    const seen = new Set();
    return this.reports()
      .filter(r => r.type === 'bck' && r.area && !seen.has(r.area) && seen.add(r.area))
      .slice(0, n)
      .map(r => ({ area: r.area, time: r.time, confirms: r.confirms }));
  },

  /* Total unique areas reporting outages right now */
  outageCount() {
    const seen = new Set();
    this.reports().filter(r => r.type === 'out').forEach(r => { if (r.area) seen.add(r.area); });
    return seen.size;
  },

  /* Get the safest areas right now (low AI risk + no outage report) */
  safestAreas(n = 4) {
    return this.allAreas()
      .map(area => {
        const pred = this.predict(area);
        const isOut = this.isOut(area);
        return { area, prob: pred ? pred.prob : 0.5, isOut };
      })
      .filter(a => a.isOut !== true)
      .sort((a, b) => a.prob - b.prob)
      .slice(0, n);
  },

  /* Get highest-risk areas */
  riskiestAreas(n = 4) {
    return this.allAreas()
      .map(area => {
        const pred = this.predict(area);
        return { area, prob: pred ? pred.prob : 0.3 };
      })
      .sort((a, b) => b.prob - a.prob)
      .slice(0, n);
  },

  /* User's current area (from profile or saved home place) */
  userArea() {
    const pr = this.profile();
    if (pr && pr.location_area) return pr.location_area;
    const places = this.savedPlaces();
    const home = places.find(p => p.type === 'home');
    if (home) return home.location_area;
    return null;
  },

  /* Match a raw string to a known area name */
  matchArea(str) {
    const lower = str.toLowerCase();
    const areas = this.allAreas();
    // Exact match first
    let found = areas.find(a => a.toLowerCase() === lower);
    if (found) return found;
    // Partial — longest match wins
    let best = null, bestLen = 0;
    for (const area of areas) {
      const aLow = area.toLowerCase();
      if (lower.includes(aLow) || aLow.includes(lower)) {
        if (aLow.length > bestLen) { best = area; bestLen = aLow.length; }
      }
    }
    // Also check individual words
    if (!best) {
      const words = lower.split(/\s+/);
      for (const area of areas) {
        const aLow = area.toLowerCase();
        if (words.some(w => w.length > 3 && aLow.includes(w))) {
          if (!best || aLow.length > best.length) best = area;
        }
      }
    }
    return best || null;
  },
};

/* ── CONTEXT MEMORY ────────────────────────────────────────── */
const BotCtx = {
  lastArea: null,
  lastTopic: null,
  turnCount: 0,
  set(area, topic) {
    if (area) this.lastArea = area;
    if (topic) this.lastTopic = topic;
    this.turnCount++;
  },
};

/* ── INTENT CLASSIFIER ─────────────────────────────────────── */
function classifyIntent(msg) {
  const m = msg.toLowerCase();
  const has = (...words) => words.some(w => m.includes(w));

  if (has('hello','hi ','hey','good morning','good evening','good afternoon','morning','evening','afternoon','yo ','sup ','ello'))
    return 'greeting';
  if (has('thank','thanks','thank you','cheers','helpful','great ','nice one','perfect','awesome'))
    return 'thanks';
  if (has('bye','goodbye','later','cya','take care','see you'))
    return 'bye';

  /* User's own area/places */
  if (has('my area','my place','my house','my home','my location','my street','where i live','my nepa','my light'))
    return 'my_area';
  if (has('my work','my office','my job'))
    return 'my_work';
  if (has('my school','my uni','my college'))
    return 'my_school';
  if (has('my saved','saved place','all my place'))
    return 'my_places';

  /* Status / current situation */
  if (has('is there light','any light','have light','light dey','current','right now','status','situation','how is','how\'s','what\'s happening','what is happening','still out','still no light','when did','last report'))
    return 'area_status';
  if (has('which area','where is light','where get light','which place','which part'))
    return 'where_has_light';
  if (has('how many area','how many report','total','overview','summary','whats going on','what\'s going on','entire lagos','all of lagos','across lagos'))
    return 'lagos_overview';

  /* Predictions */
  if (has('predict','forecast','when will','when light come','come back','return','probability','chance','likely','risk','what time will','what time'))
    return 'prediction';
  if (has('best time','safest time','good time','when to','low risk','when can i','run gen','when generator'))
    return 'best_time';
  if (has('safest area','which area safe','better area','least outage','most stable','reliable area'))
    return 'safest_areas';
  if (has('worst area','most outage','most cut','bad area','unreliable'))
    return 'riskiest_areas';

  /* Bands */
  if (has('band','tariff','sbt','supply hour','how many hour','daily supply'))
    return 'band_info';

  /* DISCO / contact */
  if (has('ikeja electric','ie ','ikeja elec'))
    return 'disco_ikeja';
  if (has('eko electric','ekedc','eko elec','eko disco'))
    return 'disco_eko';
  if (has('which disco','my disco','who supply','electricity company','which company','who manage'))
    return 'which_disco';
  if (has('complain','complaint','number','hotline','call','contact','phone','email','twitter','report fault'))
    return 'contact';

  /* Reporting */
  if (has('how report','how to report','report outage','report light','submit report','how do i report'))
    return 'how_report';
  if (has('confirm','same','verify','confirm report'))
    return 'how_confirm';

  /* Alerts */
  if (has('alert','notification','email','notify','get notified','inform me','tell me when','set up alert'))
    return 'alerts';

  /* Why / causes */
  if (has('why','cause','reason','happen','fault','problem') && has('light','power','outage','nepa','current'))
    return 'causes';

  /* How long */
  if (has('how long','duration','how many hour','been out','since when','start'))
    return 'duration';

  /* History */
  if (has('histor','last week','yesterday','last time','pattern','usually','always','frequent','often'))
    return 'history';

  /* About app */
  if (has('nepawatch','about','what is this','how does','app work','what can you','who made','built by'))
    return 'about';

  /* Generator / backup */
  if (has('generator','gen','inverter','solar','fuel','backup','battery'))
    return 'backup';

  /* NEPA history */
  if (has('what is nepa','what is phcn','nepa stand for','phcn stand','history of nepa'))
    return 'nepa_history';

  /* Leaderboard */
  if (has('leaderboard','top reporter','ranking','community','who report most','badge','points'))
    return 'leaderboard';

  return 'unknown';
}

/* ── AREA EXTRACTOR ────────────────────────────────────────── */
function extractArea(msg) {
  const lower = msg.toLowerCase();
  /* First try direct match against all known areas */
  const direct = BOT.matchArea(lower);
  if (direct) return direct;
  /* Try common shorthand */
  const aliases = {
    'vi':'Victoria Island','v.i':'Victoria Island','v.i.':'Victoria Island',
    'lekki':'Lekki Phase 1','lekki 1':'Lekki Phase 1','lekki 2':'Lekki Phase 2/Ikota',
    'ikeja':'Ikeja GRA','allen':'Ikeja (Allen/Opebi)','opebi':'Ikeja (Allen/Opebi)',
    'cms':'Obalende/CMS','cms area':'Obalende/CMS',
    'isale eko':'Lagos Island','island':'Lagos Island',
    'berger':'Ojodu/Omole','festac':'Festac Town',
    'mile 12':'Kosofe/Ketu','ketu':'Kosofe/Ketu',
    'ojuelegba':'Surulere','bode thomas':'Surulere',
  };
  for (const [alias, full] of Object.entries(aliases)) {
    if (lower.includes(alias)) return full;
  }
  return null;
}

/* ── REPLY BUILDERS ────────────────────────────────────────── */

function replyAreaStatus(area) {
  const report = BOT.latestForArea(area);
  const band   = BOT.areaBands()[area] || 'C';
  const bInfo  = BOT.bandInfo(band);
  const pred   = BOT.predict(area);
  const disco  = BOT.discoFor(area);
  const stats  = BOT.areaStats(area);

  let status;
  if (!report) {
    status = `📭 No reports for **${area}** yet — can't confirm current status.`;
  } else if (report.type === 'out') {
    const dur = BOT.outDuration(area);
    const durStr = dur ? ` for about **${BOT.fmtDuration(dur)}**` : '';
    status = `🔴 **Power is currently OUT** in ${area}${durStr}.\nReported ${BOT.ago(report.time)} · ${report.confirms} confirmation${report.confirms !== 1 ? 's' : ''}.`;
  } else {
    status = `🟢 **Power is ON** in ${area}.\nRestored ${BOT.ago(report.time)} · ${report.confirms} confirmation${report.confirms !== 1 ? 's' : ''}.`;
  }

  let predLine = '';
  if (pred) {
    const risk = BOT.riskLevel(pred.prob);
    predLine = `\n\n📊 **AI Risk right now:** ${Math.round(pred.prob * 100)}% (${risk.label}) — Band ${band}, target ${bInfo?.hours}`;
  }

  let statsLine = '';
  if (stats.total > 0) {
    statsLine = `\n📋 **Last 24h:** ${stats.total} report${stats.total !== 1 ? 's' : ''} — ${stats.outCount} outage${stats.outCount !== 1 ? 's' : ''}, ${stats.bckCount} restoration${stats.bckCount !== 1 ? 's' : ''}.`;
  }

  let discoLine = disco ? `\n🏢 **Managed by:** ${disco}` : '';

  return `${status}${predLine}${statsLine}${discoLine}`;
}

function replyMyArea() {
  const area = BOT.userArea();
  if (!area) {
    return `I don't know your area yet! 📍\n\nTo let me help you better:\n• Tap **Locate Me** (top right) to auto-detect your area\n• Or go to your **Profile** and set your location\n\nOnce set, I can tell you exactly what's happening on your street!`;
  }
  BotCtx.set(area, 'my_area');
  return `Here's what's happening at your location:\n\n` + replyAreaStatus(area);
}

function replyPrediction(area) {
  const pred = BOT.predict(area);
  if (!pred) return `I couldn't generate a prediction for **${area}** right now. Try the **Predict tab** in the bottom nav for full forecasts!`;

  const band  = BOT.areaBands()[area] || 'C';
  const bInfo = BOT.bandInfo(band);
  const risk  = BOT.riskLevel(pred.prob);
  const dur   = BOT.predictDur(area);
  const now   = new Date();

  /* Best window in next 12 hours */
  let bestH = now.getHours(), bestP = 1;
  for (let i = 0; i < 12; i++) {
    const h = (now.getHours() + i) % 24;
    const p = BOT.predict(area);
    if (p && p.prob < bestP) { bestP = p.prob; bestH = h; }
  }

  const isOut = BOT.isOut(area);
  const liveNote = isOut === true
    ? `⚠️ Power is currently **OUT** in ${area} per latest reports.\n\n`
    : isOut === false
    ? `✅ Power is currently **ON** in ${area} per latest reports.\n\n`
    : '';

  return `${liveNote}**AI Prediction for ${area}:**\n\n🎯 **Outage chance right now:** ${Math.round(pred.prob * 100)}% — ${risk.label}\n⏱️ **If it cuts:** likely **${dur}h** based on Band ${band} history\n📋 **Band ${band}:** ${bInfo?.hours} target daily supply\n\n💡 **Best window to run appliances:** around **${BOT.fmtH(bestH)}** (lowest risk in next 12h)\n\n_Model confidence: ${pred.confidence}. Check the **Predict tab** for a full 24h hourly chart._`;
}

function replyBestTime(area) {
  if (!area) {
    return `Tell me which area you want the best time for and I'll calculate it! E.g. "Best time for Surulere" 💡`;
  }
  const now = new Date();
  let bestH = -1, bestP = 1;
  for (let i = 0; i < 24; i++) {
    const h = (now.getHours() + i) % 24;
    const p = BOT.predict(area);
    if (p && p.prob < bestP) { bestP = p.prob; bestH = h; }
  }
  const risk = BOT.riskLevel(bestP);
  return `⏰ **Best time to run appliances in ${area}:**\n\nAround **${BOT.fmtH(bestH)}** — outage risk is only **${Math.round(bestP * 100)}%** (${risk.label}) at that time.\n\n💡 _This is calculated from NERC Band ${BOT.areaBands()[area] || 'C'} data and crowd report patterns. Open the **Predict tab** to see the full 24-hour chart!_`;
}

function replyLagosOverview() {
  const outAreas  = BOT.areasCurrentlyOut(6);
  const onAreas   = BOT.areasCurrentlyOn(5);
  const total     = BOT.reports().length;
  const outCount  = BOT.outageCount();
  const pr        = BOT.profile();

  let out = outAreas.length
    ? outAreas.map(a => `🔴 **${a.area}** — ${BOT.ago(a.time)}, ${a.confirms} confirm${a.confirms !== 1 ? 's' : ''}`).join('\n')
    : '🟢 No active outages in the feed right now!';

  let on = onAreas.length
    ? onAreas.map(a => `🟢 **${a.area}**`).join(' · ')
    : '';

  const greeting = pr?.name ? `Here's the current Lagos power situation, ${pr.name.split(' ')[0]}:` : `Here's the current Lagos power situation:`;

  return `${greeting}\n\n⚡ **${outCount} area${outCount !== 1 ? 's' : ''}** currently reporting outages\n📋 **${total} total** reports in the live feed\n\n**Areas currently out:**\n${out}${on ? `\n\n**Power restored in:**\n${on}` : ''}\n\n_Tap the **Home** tab to see the full live feed or filter by area._`;
}

function replySafestAreas() {
  const areas = BOT.safestAreas(5);
  if (!areas.length) return `I need more prediction data — check the **Predict tab** for area-by-area risk scores!`;
  const list = areas.map((a, i) => {
    const band = BOT.areaBands()[a.area] || 'C';
    return `${i + 1}. **${a.area}** — ${Math.round(a.prob * 100)}% risk · Band ${band}`;
  }).join('\n');
  return `🟢 **Safest areas in Lagos right now** (lowest outage risk):\n\n${list}\n\nThese areas have the lowest predicted outage probability right now based on NERC band data and crowd reports.`;
}

function replyRiskiestAreas() {
  const areas = BOT.riskiestAreas(5);
  if (!areas.length) return `Check the **Predict tab** for a full area risk ranking!`;
  const list = areas.map((a, i) => {
    const band = BOT.areaBands()[a.area] || 'C';
    const isOut = BOT.isOut(a.area);
    const tag = isOut === true ? ' 🔴 *currently out*' : '';
    return `${i + 1}. **${a.area}** — ${Math.round(a.prob * 100)}% risk · Band ${band}${tag}`;
  }).join('\n');
  return `🔴 **Highest-risk areas in Lagos right now:**\n\n${list}\n\nThese areas have the highest predicted outage probability right now. Mostly Band D & E areas.`;
}

function replyBandInfo(area) {
  const band  = BOT.areaBands()[area] || null;
  if (!band) return `I don't have band data for that area. Tell me a specific Lagos area (e.g. "What band is Surulere?") and I'll look it up!`;
  const bInfo = BOT.bandInfo(band);
  const disco = BOT.discoFor(area);
  const pred  = BOT.predict(area);
  const predLine = pred ? `\n\n📊 **Current AI risk:** ${Math.round(pred.prob * 100)}% — ${BOT.riskLevel(pred.prob).label}` : '';
  return `**${area}** is on **Band ${band}** (${bInfo?.desc}).\n\n🕐 Daily supply target: **${bInfo?.hours}**\n🏢 DISCO: ${disco || 'unknown'}${predLine}\n\nBand A areas get the best supply (20–24h); Band E the worst (4–8h). Your tariff rate is linked to your band.`;
}

function replyDuration(area) {
  const isOut = BOT.isOut(area);
  if (isOut === null) return `No recent reports for **${area}** — can't tell how long it's been out. Be the first to report if you're experiencing an outage!`;
  if (!isOut) return `Power is currently **ON** in **${area}** per the latest report. 🟢`;
  const dur = BOT.outDuration(area);
  const report = BOT.latestForArea(area);
  const durStr = dur ? `**${BOT.fmtDuration(dur)}**` : 'unknown duration';
  const predDur = BOT.predictDur(area);
  const remaining = predDur
    ? `\n\n⏱️ Band ${BOT.areaBands()[area] || 'C'} areas typically see outages of **${predDur}h** in this time slot.`
    : '';
  return `🔴 **${area}** has been out for ${durStr}.\n\nOutage reported ${BOT.ago(report.time)} · ${report.confirms} confirmation${report.confirms !== 1 ? 's' : ''}.${remaining}`;
}

function replyContact(area) {
  const disco = area ? BOT.discoFor(area) : null;
  const CONTACTS = {
    'Ikeja Electric': { hotline: '0800-453-52-353', email: 'customercare@ikejaelectric.com', twitter: '@ikejaelectric', website: 'ikejaelectric.com' },
    'Eko Electricity Distribution Company (EKEDC)': { hotline: '07080601000', email: 'customercare@ekedp.com', twitter: '@ekedc_official', website: 'ekedp.com' },
  };
  if (disco && CONTACTS[disco]) {
    const c = CONTACTS[disco];
    return `To report a fault or complain about **${area || 'your area'}**, contact **${disco}**:\n\n📞 Hotline: **${c.hotline}**\n📧 Email: ${c.email}\n🌐 Website: ${c.website}\n🐦 Twitter: ${c.twitter}\n\n💡 _Always ask for a **fault reference number** — it helps you track your complaint._`;
  }
  return `Lagos has two DISCOs:\n\n🔵 **Ikeja Electric** (mainland)\n📞 0800-453-52-353\n📧 customercare@ikejaelectric.com\n🐦 @ikejaelectric\n\n🟣 **Eko Electric / EKEDC** (Island + south mainland)\n📞 07080601000\n📧 customercare@ekedp.com\n🐦 @ekedc_official\n\n💡 Tell me your area and I'll tell you exactly which one to call!`;
}

function replyHistory(area) {
  const stats = BOT.areaStats(area);
  const pred  = BOT.predict(area);
  const band  = BOT.areaBands()[area] || 'C';
  const hist  = (typeof PredictHistory !== 'undefined') ? PredictHistory.getAreaRate(area) : null;

  let histLine = hist !== null
    ? `📈 **Historical outage rate:** ~${Math.round(hist * 100)}% of reports are outages (from NEPAWatch crowd data)`
    : `📈 **Historical data:** still building — the more people report, the better predictions get`;

  return `**${area}** power history:\n\n📋 **Last 24h:** ${stats.total} report${stats.total !== 1 ? 's' : ''} (${stats.outCount} outage${stats.outCount !== 1 ? 's' : ''}, ${stats.bckCount} restoration${stats.bckCount !== 1 ? 's' : ''})\n${histLine}\n📋 **NERC Band ${band}:** target supply ${BOT.bandInfo(band)?.hours}${pred ? `\n📊 **Current AI risk:** ${Math.round(pred.prob * 100)}%` : ''}`;
}

function replyMyPlaces() {
  const places = BOT.savedPlaces();
  if (!places.length) {
    return `You haven't saved any places yet! 📍\n\nGo to the **My Area tab** → tap **"Add Saved Place"** to save your Home, Work, or School.\n\nOnce saved, I can give you live status and predictions for each one.`;
  }
  const lines = places.map(p => {
    const label = p.custom_label || { home: 'Home', work: 'Work', school: 'School', custom: 'Place' }[p.type] || 'Place';
    const area  = p.location_area;
    const isOut = area ? BOT.isOut(area) : null;
    const dot   = isOut === true ? '🔴' : isOut === false ? '🟢' : '⚪';
    const status = isOut === true ? 'Power out' : isOut === false ? 'Power on' : 'No reports';
    const pred  = area ? BOT.predict(area) : null;
    const risk  = pred ? ` · ${Math.round(pred.prob * 100)}% AI risk` : '';
    return `${dot} **${label}** — ${p.location_name} (${area})\n   Status: ${status}${risk}`;
  }).join('\n\n');
  return `Here are all your saved places:\n\n${lines}\n\n_Tap any place card on the Home page for more details, or ask me "what's the status at my home?" etc._`;
}

/* ── MAIN REPLY FUNCTION ───────────────────────────────────── */
function nepaBotReply(raw) {
  const msg  = raw.trim();
  const lower = msg.toLowerCase();
  if (!msg) return `Go ahead and ask me anything! ⚡`;

  const intent = classifyIntent(msg);
  const area   = extractArea(msg) || BotCtx.lastArea;
  BotCtx.set(area, intent);

  /* ── GREETING ── */
  if (intent === 'greeting') {
    const pr = BOT.profile();
    const name = pr?.name ? `, ${pr.name.split(' ')[0]}` : '';
    const outN = BOT.outageCount();
    const situationNote = outN > 0
      ? ` There are currently **${outN} area${outN !== 1 ? 's' : ''}** reporting outages in Lagos.`
      : ` Power looks relatively stable across Lagos right now.`;
    return `Hey${name}! 👋 I'm **NEPAWatch AI** — your Lagos power assistant.${situationNote}\n\nAsk me about any area, current outages, predictions, or how to use the app!`;
  }

  /* ── THANKS ── */
  if (intent === 'thanks') {
    const replies = [
      `Happy to help! ⚡ Let me know if anything changes with your power.`,
      `No problem! 💚 Stay powered, Lagos!`,
      `Anytime! 🤖 If light goes, you know where to report it 😄`,
      `Glad that helped! Ask me anything else about Lagos power.`,
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  /* ── BYE ── */
  if (intent === 'bye') return `Take care! 💚 Stay powered and remember to report when light goes — your community depends on it! ⚡`;

  /* ── MY AREA / LOCATION ── */
  if (intent === 'my_area') return replyMyArea();
  if (intent === 'my_work') {
    const place = BOT.savedPlaces().find(p => p.type === 'work');
    if (!place) return `You haven't saved a Work location yet. Go to **My Area tab** → Add Saved Place → Work.`;
    BotCtx.set(place.location_area, 'work');
    return `**Work** (${place.location_name}):\n\n` + replyAreaStatus(place.location_area);
  }
  if (intent === 'my_school') {
    const place = BOT.savedPlaces().find(p => p.type === 'school');
    if (!place) return `You haven't saved a School location yet. Go to **My Area tab** → Add Saved Place → School.`;
    BotCtx.set(place.location_area, 'school');
    return `**School** (${place.location_name}):\n\n` + replyAreaStatus(place.location_area);
  }
  if (intent === 'my_places') return replyMyPlaces();

  /* ── AREA STATUS ── */
  if (intent === 'area_status') {
    if (!area) {
      const userArea = BOT.userArea();
      if (userArea) return `Here's the status for your area:\n\n` + replyAreaStatus(userArea);
      return `Which area would you like to check? E.g. "Is there light in Surulere?" or "Lekki light situation"`;
    }
    return replyAreaStatus(area);
  }

  /* ── PREDICTION ── */
  if (intent === 'prediction') {
    if (!area) {
      const userArea = BOT.userArea();
      if (userArea) return replyPrediction(userArea);
      return `Which area should I predict for? E.g. "When will light come back in Yaba?"`;
    }
    return replyPrediction(area);
  }

  /* ── BEST TIME ── */
  if (intent === 'best_time') return replyBestTime(area);

  /* ── OVERVIEW ── */
  if (intent === 'lagos_overview') return replyLagosOverview();
  if (intent === 'where_has_light') {
    const onAreas = BOT.areasCurrentlyOn(6);
    if (!onAreas.length) return `No recent restoration reports in the feed yet. Check back soon or be the first to report! 🟢`;
    const list = onAreas.map(a => `🟢 **${a.area}** — restored ${BOT.ago(a.time)}`).join('\n');
    return `Areas with power restored recently:\n\n${list}\n\n_This is based on live community reports. Tap **Home** to see the full feed._`;
  }

  /* ── SAFEST / RISKIEST ── */
  if (intent === 'safest_areas')  return replySafestAreas();
  if (intent === 'riskiest_areas') return replyRiskiestAreas();

  /* ── BAND INFO ── */
  if (intent === 'band_info') {
    if (!area) return `Tell me which area and I'll tell you its NERC tariff band! E.g. "What band is Mushin?"\n\n🟢 **Band A** — 20–24h/day (VI, Ikoyi, Lekki Phase 1)\n🟢 **Band B** — 16–20h/day (Chevron, Magodo)\n🟡 **Band C** — 12–16h/day (Surulere, Yaba)\n🟠 **Band D** — 8–12h/day (Mushin, Oshodi)\n🔴 **Band E** — 4–8h/day (Alimosho, Ikorodu)`;
    return replyBandInfo(area);
  }

  /* ── DURATION ── */
  if (intent === 'duration') {
    if (!area) {
      const userArea = BOT.userArea();
      if (userArea) return replyDuration(userArea);
      return `Which area are you asking about? E.g. "How long has Agege been out?"`;
    }
    return replyDuration(area);
  }

  /* ── HISTORY ── */
  if (intent === 'history') {
    if (!area) {
      const userArea = BOT.userArea();
      if (userArea) return replyHistory(userArea);
      return `Which area would you like history for?`;
    }
    return replyHistory(area);
  }

  /* ── DISCO ── */
  if (intent === 'disco_ikeja') return `**Ikeja Electric (IE)**\n\n📍 Covers mainland Lagos — Ikeja, Agege, Alimosho, Mushin, Oshodi, Ikorodu, Kosofe, Gbagada, Magodo, Shomolu, Maryland, Ilupeju, Ogba\n📞 Hotline: **0800-453-52-353**\n📧 customercare@ikejaelectric.com\n🌐 ikejaelectric.com\n🐦 @ikejaelectric`;
  if (intent === 'disco_eko')   return `**Eko Electricity Distribution Company (EKEDC)**\n\n📍 Covers Lagos Island, VI, Ikoyi, Lekki, Surulere, Yaba, Festac, Apapa, Badagry, Epe, Obalende, Amuwo Odofin, Ajah\n📞 Hotline: **07080601000**\n📧 customercare@ekedp.com\n🌐 ekedp.com\n🐦 @ekedc_official`;
  if (intent === 'which_disco') {
    if (!area) return `Tell me your area and I'll confirm which DISCO covers you! Lagos has two:\n\n🔵 **Ikeja Electric** — most of the mainland\n🟣 **Eko Electric (EKEDC)** — the Island corridor and south mainland`;
    const disco = BOT.discoFor(area);
    return disco
      ? `**${area}** is managed by **${disco}**. 🏢`
      : `I couldn't confirm the DISCO for that area. For mainland areas it's usually Ikeja Electric; for Island/south it's Eko Electric.`;
  }
  if (intent === 'contact') return replyContact(area);

  /* ── HOW TO REPORT ── */
  if (intent === 'how_report') return `To report an outage on NEPAWatch:\n\n1️⃣ Tap **"Light Don Go"** on the Home page\n2️⃣ Search your street or estate\n3️⃣ Select it and confirm\n\nYour report hits the live feed **instantly**. Everyone in your area sees it. The AI also learns from it for future predictions! 🙌`;

  /* ── HOW TO CONFIRM ── */
  if (intent === 'how_confirm') return `When you see a report that matches your situation, tap the **"Same"** button on it.\n\nEach confirmation boosts the report's credibility. Reports with **10+ confirmations** are treated as highly reliable by the system and trigger stronger alerts. 🙌`;

  /* ── ALERTS ── */
  if (intent === 'alerts') {
    const pr = BOT.profile();
    if (pr && !pr.notif_on) return `Your email alerts are currently **OFF**! 📧\n\nTo turn them on:\n1️⃣ Go to **Account tab**\n2️⃣ Toggle **Email Alerts** to ON\n\nYou'll get instant emails when power changes near **${pr.location_label || pr.location_name || 'your area'}**.`;
    if (pr && pr.notif_on) return `Your email alerts are already **ON** and pointing to **${pr.email}**. 📧✅\n\nYou'll get an email within seconds of any outage or restoration near your saved locations.`;
    return `To get free email alerts:\n1️⃣ Create a free account (Account tab)\n2️⃣ Set your location\n3️⃣ Make sure **Email Alerts** is ON in your profile\n\nAlerts fire within seconds of any report near you. 📧`;
  }

  /* ── CAUSES ── */
  if (intent === 'causes') return `Power outages in Lagos happen for several reasons:\n\n⚡ **Load shedding** — ~60% of outages. NERC orders cuts when generation can't meet demand.\n🔧 **Equipment faults** — transformers exploding, cables cut, fallen poles.\n🌩️ **Weather** — heavy rain, flooding and lightning knock out lines.\n🏗️ **Vandalism / theft** — cable theft is rampant in some areas.\n🔌 **TCN grid failures** — transmission issues upstream of your DISCO.\n📋 **Scheduled maintenance** — DISCOs are supposed to give 24h notice but often don't.`;

  /* ── BACKUP POWER ── */
  if (intent === 'backup') return `Backup power options for Lagos:\n\n⛽ **Petrol generator** — most common, loud and expensive to run\n🔋 **Inverter + battery bank** — quiet, great for lights, fans, phones\n☀️ **Solar + battery** — best long-term value, especially in Band D/E areas\n🔌 **Power banks** — for devices only\n\n_With Band E areas like Alimosho and Ikorodu getting only 4–8h/day, solar-inverter setups often pay off within 2–3 years._`;

  /* ── NEPA HISTORY ── */
  if (intent === 'nepa_history') return `**NEPA** (National Electric Power Authority) was Nigeria's national power monopoly — dissolved in 2005.\n\n**PHCN** (Power Holding Company of Nigeria) replaced it and was then **privatised in 2013** into 11 distribution companies (DISCOs).\n\nIn Lagos that means:\n🔵 **Ikeja Electric** — mainland\n🟣 **Eko Electric (EKEDC)** — Island & south\n\n"NEPA" stuck as Naija slang forever though — that's why we're called NEPAWatch! ⚡😄`;

  /* ── LEADERBOARD ── */
  if (intent === 'leaderboard') return `The **Community tab** shows the top Lagos reporters this week! 🏆\n\n🥇 Gold — #1 most reports\n🥈 Silver — #2\n🥉 Bronze — #3\n\n**NEPAWatch AI** also appears on the leaderboard when it auto-files reports. Every report you make helps thousands of people — and the more you report, the smarter the AI gets! 💚`;

  /* ── ABOUT ── */
  if (intent === 'about') {
    const total = BOT.reports().length;
    return `**NEPAWatch Lagos** is a free, crowd-sourced power outage tracker for Lagos.\n\n📊 **${total} reports** in the live feed right now\n🏙️ Covers **${BOT.allAreas().length}** Lagos areas\n🤖 AI auto-reporter predicts and files reports automatically\n📧 Free email alerts — yours the second power changes near you\n🏆 Community leaderboard rewards top reporters\n\nWe built it because Lagos deserves real-time electricity visibility. No ads, no fees, forever free. 💚`;
  }

  /* ── AREA MENTIONED BUT NO CLEAR INTENT ── */
  if (area && intent === 'unknown') {
    BotCtx.set(area, 'area_status');
    return replyAreaStatus(area);
  }

  /* ── CONTEXT FOLLOW-UP (no area mentioned, referring to last area) ── */
  if (!area && BotCtx.lastArea && (lower.includes('there') || lower.includes('it') || lower.includes('same area') || lower.includes('that area'))) {
    return replyAreaStatus(BotCtx.lastArea);
  }

  /* ── FALLBACK ── */
  const userArea = BOT.userArea();
  const situationLine = BOT.outageCount() > 0
    ? `⚡ Right now, **${BOT.outageCount()} area${BOT.outageCount() !== 1 ? 's' : ''}** in Lagos are reporting outages.`
    : `⚡ Power looks relatively stable across Lagos right now.`;

  return `${situationLine}\n\nI can help you with:\n• **"Is there light in [area]?"** — live status\n• **"How long has [area] been out?"** — outage duration\n• **"When will light come back in [area]?"** — AI prediction\n• **"What's happening in Lagos?"** — full overview\n• **"My area"** — status for your saved location\n• **"Safest areas right now"** — where power is stable\n• **"Ikeja Electric number"** — DISCO contacts\n\nJust ask! 💬`;
}

/* ── SUGGESTIONS (context-aware) ────────────────────────────── */
function getBotSuggestions() {
  const area = BotCtx.lastArea || BOT.userArea();
  const base = [
    "What's happening in Lagos?",
    "Safest areas right now",
    "How do I get email alerts?",
    "Why does light go so much?",
  ];
  if (area) {
    return [
      `Is there light in ${area}?`,
      `How long has ${area} been out?`,
      `When will light return in ${area}?`,
      `What band is ${area}?`,
    ];
  }
  const outAreas = BOT.areasCurrentlyOut(2);
  if (outAreas.length) {
    return [
      `Is there light in ${outAreas[0].area}?`,
      "What's happening in Lagos?",
      "Safest areas right now",
      "How do I get email alerts?",
    ];
  }
  return base;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CHAT UI — floating bubble, window, messages
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const NepaBot = {
  _open: false,
  _booted: false,
  _typingTimer: null,
  _msgCount: 0,

  init() {
    if (this._booted) return;
    this._booted = true;
    this._injectStyles();
    this._buildDOM();
    setTimeout(() => this._showNotif(), 5000);
  },

  _injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
    #nepaBotBubble{
      position:fixed;bottom:88px;right:16px;z-index:500;
      width:54px;height:54px;border-radius:50%;
      background:var(--p,#00E676);border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 20px rgba(0,0,0,.5);
      transition:transform .2s,box-shadow .2s,background .2s;
      animation:botpulse 3s ease infinite;
    }
    #nepaBotBubble:hover{transform:scale(1.08);}
    #nepaBotBubble.open{animation:none;background:var(--sf,#141714);border:1px solid var(--bd,#232823);}
    .bbl-ico{transition:all .15s;position:absolute;}
    .bbl-ico.hide{opacity:0;transform:scale(.4);}
    .bbl-close{opacity:0;transform:scale(.4) rotate(-90deg);transition:all .15s;position:absolute;}
    .bbl-close.show{opacity:1;transform:scale(1) rotate(0);}
    @keyframes botpulse{0%,100%{box-shadow:0 0 0 0 rgba(0,230,118,.4),0 4px 20px rgba(0,0,0,.4);}50%{box-shadow:0 0 0 12px rgba(0,230,118,0),0 4px 20px rgba(0,0,0,.4);}}

    #botNotif{
      position:fixed;bottom:152px;right:16px;z-index:499;
      background:var(--sf,#141714);border:1px solid var(--bd,#232823);
      border-radius:14px 14px 4px 14px;padding:10px 30px 10px 12px;
      max-width:210px;font-size:.72rem;color:var(--ink,#EEF4EE);
      font-family:var(--font-body,'DM Sans',sans-serif);
      box-shadow:0 4px 24px rgba(0,0,0,.5);
      opacity:0;transform:translateY(8px) scale(.95);
      transition:opacity .28s,transform .28s;pointer-events:none;line-height:1.5;
    }
    #botNotif.show{opacity:1;transform:none;pointer-events:auto;}
    #botNotif strong{color:var(--p,#00E676);}
    .bn-close{position:absolute;top:6px;right:8px;background:none;border:none;cursor:pointer;color:var(--ink3,#5A705A);font-size:.65rem;padding:2px 4px;}

    #botWin{
      position:fixed;bottom:152px;right:16px;z-index:498;
      width:calc(100vw - 32px);max-width:360px;max-height:70vh;
      background:var(--sf,#141714);border:1px solid var(--bd,#232823);
      border-radius:18px;display:flex;flex-direction:column;overflow:hidden;
      box-shadow:0 8px 48px rgba(0,0,0,.65),0 0 0 1px rgba(0,230,118,.07);
      opacity:0;transform:translateY(16px) scale(.97);
      transition:opacity .22s,transform .22s;pointer-events:none;
    }
    #botWin.open{opacity:1;transform:none;pointer-events:auto;}

    .bw-header{
      padding:12px 14px 10px;
      background:var(--sf2,#1A1E1A);border-bottom:1px solid var(--bd,#232823);
      display:flex;align-items:center;gap:10px;flex-shrink:0;
    }
    .bw-av{
      width:32px;height:32px;border-radius:50%;flex-shrink:0;
      background:linear-gradient(135deg,var(--p,#00E676) 0%,#00BFA5 100%);
      display:flex;align-items:center;justify-content:center;font-size:.9rem;
      box-shadow:0 0 10px rgba(0,230,118,.25);
    }
    .bw-name{font-size:.78rem;font-weight:700;color:var(--ink,#EEF4EE);font-family:var(--font-body,'DM Sans',sans-serif);}
    .bw-status{display:flex;align-items:center;gap:4px;font-size:.6rem;color:var(--ink3,#5A705A);font-family:var(--font-body,'DM Sans',sans-serif);}
    .bw-pip{width:5px;height:5px;border-radius:50%;background:var(--p,#00E676);animation:botpulse 2.5s ease infinite;}

    .bw-msgs{
      flex:1;overflow-y:auto;padding:12px 10px;
      display:flex;flex-direction:column;gap:9px;scroll-behavior:smooth;
    }
    .bw-msgs::-webkit-scrollbar{width:2px;}
    .bw-msgs::-webkit-scrollbar-thumb{background:var(--bd);border-radius:1px;}

    .bm{display:flex;gap:6px;max-width:90%;animation:msgIn .2s ease;}
    @keyframes msgIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:none;}}
    .bm.user{align-self:flex-end;flex-direction:row-reverse;}
    .bm-av{
      width:24px;height:24px;border-radius:50%;flex-shrink:0;margin-top:2px;
      background:linear-gradient(135deg,var(--p,#00E676),#00BFA5);
      display:flex;align-items:center;justify-content:center;font-size:.65rem;
    }
    .bm-av.u{background:var(--sf2,#1A1E1A);border:1px solid var(--bd);color:var(--ink2);font-size:.58rem;font-weight:700;font-family:var(--font-body,'DM Sans',sans-serif);}
    .bm-bubble{
      background:var(--sf2,#1A1E1A);border:1px solid var(--bd,#232823);
      border-radius:4px 14px 14px 14px;
      padding:8px 11px;font-size:.75rem;color:var(--ink,#EEF4EE);
      font-family:var(--font-body,'DM Sans',sans-serif);line-height:1.6;
    }
    .bm.user .bm-bubble{
      background:var(--p,#00E676);border-color:transparent;
      color:#0A0C0A;border-radius:14px 14px 4px 14px;font-weight:500;
    }
    .bm-bubble strong{font-weight:700;color:var(--p,#00E676);}
    .bm.user .bm-bubble strong{color:#0A0C0A;}

    .bm-typing .bm-bubble{padding:10px 14px;display:flex;gap:4px;align-items:center;}
    .bt-dot{width:6px;height:6px;border-radius:50%;background:var(--ink3);animation:bounce .9s ease infinite;}
    .bt-dot:nth-child(2){animation-delay:.15s;}
    .bt-dot:nth-child(3){animation-delay:.3s;}
    @keyframes bounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-5px);background:var(--p,#00E676);}}

    .bw-sugs{
      padding:7px 10px 8px;display:flex;gap:6px;flex-wrap:nowrap;
      overflow-x:auto;border-top:1px solid var(--bd);
      background:var(--sf2,#1A1E1A);flex-shrink:0;
    }
    .bw-sugs::-webkit-scrollbar{display:none;}
    .bw-sug{
      font-size:.6rem;font-weight:600;color:var(--ink2);
      background:var(--sf,#141714);border:1px solid var(--bd);
      border-radius:99px;padding:5px 10px;cursor:pointer;
      transition:all .15s;white-space:nowrap;flex-shrink:0;
      font-family:var(--font-body,'DM Sans',sans-serif);
    }
    .bw-sug:hover{border-color:var(--p,#00E676);color:var(--p,#00E676);}

    .bw-inp-row{
      display:flex;gap:7px;align-items:center;
      padding:8px 10px 10px;border-top:1px solid var(--bd);
      background:var(--sf,#141714);flex-shrink:0;
    }
    .bw-inp{
      flex:1;background:var(--sf2,#1A1E1A);border:1px solid var(--bd);
      border-radius:9px;padding:9px 11px;font-size:.76rem;
      color:var(--ink,#EEF4EE);font-family:var(--font-body,'DM Sans',sans-serif);outline:none;
      transition:border-color .2s;
    }
    .bw-inp::placeholder{color:var(--ink3);}
    .bw-inp:focus{border-color:var(--p,#00E676);}
    .bw-send{
      width:34px;height:34px;border-radius:9px;background:var(--p,#00E676);
      border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
      flex-shrink:0;color:#0A0C0A;transition:all .15s;
    }
    .bw-send:hover{background:#00ff7f;transform:scale(1.06);}
    .bw-send:active{transform:scale(.94);}
    `;
    document.head.appendChild(s);
  },

  _buildDOM() {
    /* Notification */
    const notif = document.createElement('div');
    notif.id = 'botNotif';
    notif.innerHTML = `<button class="bn-close" onclick="NepaBot.closeNotif()">✕</button>
      <span>👋 Ask <strong>NEPAWatch AI</strong> about light in your area!</span>`;
    document.body.appendChild(notif);

    /* Chat window */
    const win = document.createElement('div');
    win.id = 'botWin';
    win.innerHTML = `
      <div class="bw-header">
        <div class="bw-av">🤖</div>
        <div style="flex:1">
          <div class="bw-name">NEPAWatch AI</div>
          <div class="bw-status"><div class="bw-pip"></div>Live data · Always ready</div>
        </div>
      </div>
      <div class="bw-msgs" id="botMsgs"></div>
      <div class="bw-sugs" id="botSugs"></div>
      <div class="bw-inp-row">
        <input class="bw-inp" id="botInp" placeholder="Ask about light in any area…" autocomplete="off" maxlength="200">
        <button class="bw-send" onclick="NepaBot.send()">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12.5 7L1.5 1.5L4 7L1.5 12.5L12.5 7Z" fill="currentColor"/>
          </svg>
        </button>
      </div>`;
    document.body.appendChild(win);

    /* Bubble */
    const bubble = document.createElement('button');
    bubble.id = 'nepaBotBubble';
    bubble.setAttribute('aria-label','Chat with NEPAWatch AI');
    bubble.innerHTML = `
      <div class="bbl-ico" id="bblOpen">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 2C6.58 2 3 5.13 3 9c0 2.02 1 3.84 2.64 5.15L5 19l4.36-2.18C10.22 16.93 10.6 17 11 17c4.42 0 8-3.13 8-7s-3.58-7-8-7z" fill="currentColor" opacity=".15"/>
          <path d="M11 2C6.58 2 3 5.13 3 9c0 2.02 1 3.84 2.64 5.15L5 19l4.36-2.18C10.22 16.93 10.6 17 11 17c4.42 0 8-3.13 8-7s-3.58-7-8-7z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
          <circle cx="8" cy="9" r="1" fill="currentColor"/>
          <circle cx="11" cy="9" r="1" fill="currentColor"/>
          <circle cx="14" cy="9" r="1" fill="currentColor"/>
        </svg>
      </div>
      <div class="bbl-close" id="bblClose">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>`;
    bubble.onclick = () => this.toggle();
    document.body.appendChild(bubble);

    document.getElementById('botInp').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.send();
    });

    this._renderSugs();
  },

  _renderSugs() {
    const el = document.getElementById('botSugs');
    if (!el) return;
    el.innerHTML = getBotSuggestions()
      .map(s => `<button class="bw-sug" onclick="NepaBot.sendText('${s.replace(/'/g,"\\'")}')">${s}</button>`)
      .join('');
  },

  _showNotif() {
    const el = document.getElementById('botNotif');
    if (el && !this._open) {
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 7000);
    }
  },

  closeNotif() {
    document.getElementById('botNotif')?.classList.remove('show');
  },

  toggle() { this._open ? this.close() : this.open(); },

  open() {
    this._open = true;
    this.closeNotif();
    document.getElementById('botWin')?.classList.add('open');
    document.getElementById('nepaBotBubble')?.classList.add('open');
    document.getElementById('bblOpen')?.classList.add('hide');
    document.getElementById('bblClose')?.classList.add('show');
    setTimeout(() => document.getElementById('botInp')?.focus(), 250);
    if (this._msgCount === 0) this._welcome();
  },

  close() {
    this._open = false;
    document.getElementById('botWin')?.classList.remove('open');
    document.getElementById('nepaBotBubble')?.classList.remove('open');
    document.getElementById('bblOpen')?.classList.remove('hide');
    document.getElementById('bblClose')?.classList.remove('show');
  },

  _welcome() {
    const pr      = BOT.profile();
    const name    = pr?.name ? `, ${pr.name.split(' ')[0]}` : '';
    const outN    = BOT.outageCount();
    const total   = BOT.reports().length;
    const userArea = BOT.userArea();

    let situation = outN > 0
      ? `Right now, **${outN} area${outN !== 1 ? 's' : ''}** in Lagos are reporting outages.`
      : total > 0
      ? `Power looks relatively stable across Lagos right now.`
      : `Loading live data…`;

    let personalNote = userArea
      ? (() => {
          const isOut = BOT.isOut(userArea);
          return isOut === true
            ? `\n\n⚠️ Your area **${userArea}** is currently reporting a power outage.`
            : isOut === false
            ? `\n\n✅ Power is on in your area **${userArea}** per the latest reports.`
            : `\n\nI can check live status for your area **${userArea}** — just ask!`;
        })()
      : '';

    this._addBot(`Hey${name}! 👋 I'm **NEPAWatch AI** — powered by the live app data.\n\n${situation}${personalNote}\n\nAsk me about any Lagos area, predictions, outage causes, DISCO contacts, or your saved places!`);
  },

  sendText(text) {
    const inp = document.getElementById('botInp');
    if (inp) inp.value = text;
    this.send();
  },

  send() {
    const inp  = document.getElementById('botInp');
    const text = (inp?.value || '').trim();
    if (!text) return;
    inp.value = '';
    this._addUser(text);
    const delay = Math.min(500 + text.length * 15, 1400);
    this._showTyping();
    clearTimeout(this._typingTimer);
    this._typingTimer = setTimeout(() => {
      this._hideTyping();
      const reply = nepaBotReply(text);
      this._addBot(reply);
      this._renderSugs();
    }, delay);
  },

  _addUser(text) {
    const pr = BOT.profile();
    const av = pr?.name ? pr.name[0].toUpperCase() : '👤';
    this._appendMsg('user', this._esc(text), av);
  },

  _addBot(text) {
    this._msgCount++;
    this._appendMsg('bot', this._fmt(text), '🤖');
  },

  _appendMsg(role, html, av) {
    const el = document.getElementById('botMsgs');
    if (!el) return;
    const isUser = role === 'user';
    const div = document.createElement('div');
    div.className = `bm${isUser ? ' user' : ''}`;
    div.innerHTML = `<div class="bm-av${isUser ? ' u' : ''}">${av}</div><div class="bm-bubble">${html}</div>`;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  },

  _showTyping() {
    const el = document.getElementById('botMsgs');
    if (!el || document.getElementById('botTyping')) return;
    const div = document.createElement('div');
    div.id = 'botTyping'; div.className = 'bm bm-typing';
    div.innerHTML = `<div class="bm-av">🤖</div><div class="bm-bubble"><div class="bt-dot"></div><div class="bt-dot"></div><div class="bt-dot"></div></div>`;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  },

  _hideTyping() { document.getElementById('botTyping')?.remove(); },

  _fmt(text) {
    return this._esc(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  },
  _esc(t) {
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
};

/* ── AUTO-INIT ───────────────────────────────────────────────── */
(function boot() {
  const tryInit = () => {
    if (document.getElementById('page-home')) {
      NepaBot.init();
    } else {
      setTimeout(tryInit, 400);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryInit);
  else tryInit();
})();

/* ── PATCH go() — show bubble only on Home ───────────────────── */
(function patchGo() {
  const wait = setInterval(() => {
    if (typeof go === 'function') {
      clearInterval(wait);
      const _orig = go;
      window.go = function(page) {
        _orig(page);
        const bubble = document.getElementById('nepaBotBubble');
        const notif  = document.getElementById('botNotif');
        if (!bubble) return;
        if (page === 'home') {
          bubble.style.display = 'flex';
        } else {
          bubble.style.display = 'none';
          if (notif) notif.classList.remove('show');
          if (NepaBot._open) NepaBot.close();
        }
      };
    }
  }, 80);
})();
