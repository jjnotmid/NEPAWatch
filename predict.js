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
const AI_CONFIDENCE_THRESH  = 0.72;   /* min prob to auto-file an outage report */
const AI_SCAN_INTERVAL_MS   = 12 * 60 * 1000;  /* scan every 12 min */
const AI_COOLDOWN_MS        = 60 * 60 * 1000;  /* 1 hr per area cooldown */
const AI_RESTORE_THRESH     = 0.25;   /* below this → file restoration report */

/* ─── BAND CLASSIFICATION ────────────────────────────────────────────────── */
const AREA_BANDS = {
  "Victoria Island":"A","Ikoyi":"A","Lekki Phase 1":"A","Ikeja GRA":"A","Lekki Phase 2/Ikota":"A",
  "Chevron/Lekki-Epe Expressway":"B","Igbo Efon/Ilasan":"B","Magodo":"B","Ojodu/Omole":"B","Gbagada":"B",
  "Maryland/Anthony":"C","Kosofe/Ketu":"C","Surulere":"C","Yaba":"C","Ilupeju":"C",
  "Shomolu/Bariga":"C","Ojota/Oregun":"C","Ebute Metta":"C","Ogba":"C",
  "Agege":"D","Mushin":"D","Oshodi/Isolo":"D","Festac Town":"D","Amuwo Odofin":"D",
  "Lagos Island":"D","Obalende/CMS":"D","Apapa":"D","Onikan/Lagos Mainland":"D","Ajah":"D",
  "Alimosho/Ipaja":"E","Ikorodu":"E","Badagry":"E","Ojo/Alaba":"E","Ibeju-Lekki":"E","Epe":"E",
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
  ingest(rows) {
    this._data = {};
    rows.forEach(r => {
      if (!r.location_area) return;
      const t = new Date(r.created_at);
      const k = `${r.location_area}|${t.getHours()}|${t.getDay()}`;
      if (!this._data[k]) this._data[k] = { out:0, total:0 };
      this._data[k].total++;
      if (r.type === 'out') this._data[k].out++;
    });
  },
  getRate(area, hour, day) {
    const b = this._data[`${area}|${hour}|${day}`];
    return (b && b.total >= 3) ? b.out / b.total : null;
  },
  getAreaRate(area) {
    let out=0, total=0;
    for (const [k,v] of Object.entries(this._data))
      if (k.startsWith(area+'|')) { out+=v.out; total+=v.total; }
    return total >= 5 ? out/total : null;
  },
};

/* ─── CORE PREDICTION ────────────────────────────────────────────────────── */
function predictOutage(area, hour, dayOfWeek) {
  const band   = AREA_BANDS[area] || 'C';
  const base   = BAND_BASELINE[band];
  const hProb  = Math.min(0.95, base * HOURLY_FACTOR[hour]);
  const dAdj   = DAY_FACTOR[dayOfWeek];
  const hist   = PredictHistory.getRate(area, hour, dayOfWeek);
  const aHist  = PredictHistory.getAreaRate(area);
  let prob, confidence;
  if (hist !== null) {
    prob=hist*0.55+hProb*0.25+base*dAdj*0.20; confidence='high';
  } else if (aHist !== null) {
    prob=aHist*0.35+hProb*0.35+base*dAdj*0.30; confidence='medium';
  } else {
    prob=base*0.45+hProb*0.35+(base*dAdj-base)*0.20; confidence='low';
  }
  return { prob:Math.min(0.97,Math.max(0.03,prob)), confidence, band, bandSupplyHours:BAND_SUPPLY_HOURS[band] };
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
const AIReporter = {
  _cooldowns: {},
  _timer: null,

  async loadHistory() {
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
  },

  async scan() {
    const now=new Date(), h=now.getHours(), d=now.getDay();
    for (const area of Object.keys(AREA_BANDS)) {
      const { prob } = predictOutage(area, h, d);
      if (prob < AI_CONFIDENCE_THRESH) continue;
      if (now - (this._cooldowns[area]||0) < AI_COOLDOWN_MS) continue;
      /* Don't override a recent human restoration */
      const recentRestore = (typeof reports!=='undefined') &&
        reports.some(r => r.area===area && r.type==='bck' && (now-r.time)<30*60000);
      if (recentRestore) continue;
      await this._fire(area, 'out', prob);
    }
  },

  async scanRestorations() {
    if (typeof reports==='undefined') return;
    const now=new Date(), h=now.getHours(), d=now.getDay();
    const recentAIOut = reports.filter(r =>
      r.userId===AI_USER_ID && r.type==='out' && (now-r.time)<4*3600000);
    for (const r of recentAIOut) {
      const { prob } = predictOutage(r.area, h, d);
      if (prob >= AI_RESTORE_THRESH) continue;
      const alreadyRestored = reports.some(x => x.area===r.area && x.type==='bck' && x.time>r.time);
      if (alreadyRestored) continue;
      await this._fire(r.area, 'bck', 1-prob);
    }
  },

  async _fire(area, type, prob) {
    this._cooldowns[area] = Date.now();
    const streets = (typeof LAGOS!=='undefined' && LAGOS[area]) ? LAGOS[area] : [];
    const locName = streets.length
      ? streets[Math.floor(Math.random()*Math.min(3,streets.length))]
      : area;

    /* Optimistic local insert */
    const tempId = `ai-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    if (typeof reports!=='undefined') {
      reports.unshift({ id:tempId, name:locName, area, type, time:Date.now(), confirms:1, userId:AI_USER_ID, isAI:true, aiProb:prob });
      if (reports.length>100) reports.pop();
      if (typeof render==='function') render();
    }

    /* Toast */
    if (typeof toast==='function') {
      const msg = type==='out'
        ? `🤖 NEPAWatch AI: Outage predicted in ${area}`
        : `🤖 NEPAWatch AI: Power restored in ${area}`;
      toast(msg, type==='out'?'err':'ok');
    }

    console.log(`[NEPAWatch AI] Filing ${type} report — ${area} (${(prob*100).toFixed(0)}%)`);

    /* Persist to Supabase */
    try {
      /* Try with AI columns first */
      let { data, error } = await sb.from('reports').insert({
        user_id: AI_USER_ID, location_name: locName, location_area: area,
        type, confirms: 1, ai_generated: true, ai_prob: parseFloat(prob.toFixed(3)),
      }).select().single();

      /* Fallback without AI columns if schema doesn't have them yet */
      if (error && (error.message?.includes('ai_generated') || error.message?.includes('ai_prob'))) {
        ({ data, error } = await sb.from('reports').insert({
          user_id: AI_USER_ID, location_name: locName, location_area: area, type, confirms: 1,
        }).select().single());
      }

      if (!error && data) {
        this._replaceLocal(tempId, data, prob);
        /* Alert is handled by the realtime INSERT listener in app.js */
        /* Refresh predict page AI count if visible */
        const aiBanner = document.querySelector('.pred-ai-sub strong');
        if (aiBanner && typeof reports!=='undefined') {
          const cnt = reports.filter(r=>r.userId===AI_USER_ID).length;
          aiBanner.textContent = `${cnt} AI report${cnt!==1?'s':''}`;
        }
      }
    } catch(e) { console.warn('[NEPAWatch AI] Supabase insert failed:', e); }
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
    setTimeout(()=>{ this.scan(); this.scanRestorations(); }, 9000);
    this._timer = setInterval(()=>{ this.scan(); this.scanRestorations(); }, AI_SCAN_INTERVAL_MS);
    console.log('[NEPAWatch AI] Auto-reporter started.');
  },
};

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

    <div class="pred-ai-banner">
      <div class="pred-ai-icon">🤖</div>
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
        <div class="pred-model-ico">🤖</div>
        <div><div class="pred-model-title">Auto-reports on your behalf</div>
        <div class="pred-model-text">When the model detects outage probability above ${Math.round(AI_CONFIDENCE_THRESH*100)}% in any Lagos area, NEPAWatch AI automatically files a report — tagged as AI-generated in the live feed. No input needed from anyone.</div></div>
      </div>
      <div class="pred-model-row">
        <div class="pred-model-ico">📊</div>
        <div><div class="pred-model-title">Powered by NERC bands + crowd history</div>
        <div class="pred-model-text">Combines SBT tariff band supply targets with hourly demand-spike patterns — peaks at 5am and 7pm (Energy for Growth Hub, 2025). Accuracy improves the more users report.</div></div>
      </div>
      <div class="pred-model-row" style="border-bottom:none">
        <div class="pred-model-ico">🏆</div>
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
}

function renderMyAreaPredictWidget() {
  const el=document.getElementById('myAreaPredictWidget'); if(!el) return;
  const area=(typeof PR!=='undefined'&&PR?.location_area)||null; if(!area){el.innerHTML='';return;}
  const now=new Date(),h=now.getHours(),d=now.getDay();
  const fmtH=x=>`${x%12||12}${x<12?'am':'pm'}`;
  const{prob}=predictOutage(area,h,d); const risk=getRiskLevel(prob);
  const duration=predictDuration(area,h);
  let bH=0,bP=1; for(let i=0;i<24;i++){const{prob:p}=predictOutage(area,i,d);if(p<bP){bP=p;bH=i;}}
  el.innerHTML=`<div class="pred-widget" style="border-color:${risk.color}22" onclick="go('predict')">
    <div class="pred-widget-left">
      <div class="pred-widget-label">AI Prediction</div>
      <div class="pred-widget-prob" style="color:${risk.color}">${Math.round(prob*100)}%</div>
      <div class="pred-widget-risk" style="background:${risk.color}18;color:${risk.color}">${risk.label}</div>
    </div>
    <div class="pred-widget-right">
      <div class="pred-widget-stat"><span>${duration}h</span><small>if it cuts</small></div>
      <div class="pred-widget-stat"><span style="color:#B794F6">${fmtH(bH)}–${fmtH((bH+3)%24)}</span><small>best window</small></div>
    </div>
    <div class="pred-widget-arrow">›</div>
  </div>`;
}
