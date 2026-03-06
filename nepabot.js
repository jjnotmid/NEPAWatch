/* =============================================================
   NEPAWatch Lagos — nepabot.js  (v4 — Claude API + Live Data)

   Architecture:
   - Each message fetches fresh live data from the app (reports,
     reliability, saved places, area bands, user count)
   - Data is injected into Claude's system prompt as context
   - Full conversation history is sent for multi-turn memory
   - Graceful fallback if API is unavailable
   ============================================================= */

/* ─── SAFE ACCESSORS ─────────────────────────────────────────────── */
const BOT = {
  reports()     { return (typeof reports !== 'undefined' && Array.isArray(reports)) ? reports : []; },
  areaBands()   { return (typeof AREA_BANDS !== 'undefined') ? AREA_BANDS : {}; },
  allAreas()    { return Object.keys(this.areaBands()); },
  discos()      { return (typeof DISCO !== 'undefined' && Array.isArray(DISCO)) ? DISCO : []; },
  profile()     { return (typeof PR !== 'undefined') ? PR : null; },
  savedPlaces() { return (typeof savedPlaces !== 'undefined' && Array.isArray(savedPlaces)) ? savedPlaces : []; },
  predict(area) {
    if (typeof predictOutage === 'function') {
      const now = new Date();
      return predictOutage(area, now.getHours(), now.getDay());
    }
    return null;
  },
  userArea() {
    const pr = this.profile();
    if (pr && pr.location_area) return pr.location_area;
    const home = this.savedPlaces().find(p => p.type === 'home');
    return home ? home.location_area : null;
  },
  outageCount() {
    const seen = new Set();
    this.reports().filter(r => r.type === 'out').forEach(r => { if (r.area) seen.add(r.area); });
    return seen.size;
  },
  areasCurrentlyOut(n = 3) {
    const seen = new Set();
    return this.reports()
      .filter(r => r.type === 'out' && r.area && !seen.has(r.area) && seen.add(r.area))
      .slice(0, n).map(r => r.area);
  },
  latestForArea(area) {
    if (!area) return null;
    const lower = area.toLowerCase();
    return this.reports().find(r => r.area && r.area.toLowerCase().includes(lower)) || null;
  },
  isOut(area) {
    const r = this.latestForArea(area);
    if (!r) return null;
    return r.type === 'out';
  },
  ago(ts) {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60)   return d + 's ago';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    return Math.floor(d / 3600) + 'h ago';
  },
};

/* ─── LIVE CONTEXT BUILDER ───────────────────────────────────────── */
async function buildLiveContext() {
  const lines = [];

  /* Current time */
  const now = new Date();
  lines.push('CURRENT TIME: ' + now.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }) + ' (Lagos time, ' + now.toLocaleString('en-US', { weekday: 'long', timeZone: 'Africa/Lagos' }) + ')');

  /* User profile */
  const pr = BOT.profile();
  lines.push('\nUSER PROFILE:');
  if (pr) {
    lines.push('  Name: ' + (pr.name || 'unknown'));
    lines.push('  Home area: ' + (pr.location_area || 'not set'));
    lines.push('  Home label: ' + (pr.location_label || pr.location_name || 'not set'));
    lines.push('  Email alerts: ' + (pr.notif_on ? 'ON' : 'OFF'));
    lines.push('  Email: ' + (pr.email || 'unknown'));
  } else {
    lines.push('  Not logged in / profile not loaded');
  }

  /* Saved places */
  const places = BOT.savedPlaces();
  if (places.length) {
    lines.push('\nSAVED PLACES (' + places.length + '):');
    places.forEach(function(p) {
      var label  = p.custom_label || p.type || 'place';
      var area   = p.location_area || 'unknown';
      var isOut  = BOT.isOut(area);
      var status = isOut === true ? 'POWER OUT' : isOut === false ? 'POWER ON' : 'no recent data';
      lines.push('  - ' + label + ': ' + p.location_name + ' (' + area + ') — ' + status);
    });
  } else {
    lines.push('\nSAVED PLACES: None saved');
  }

  /* Live outage feed */
  var allReps = BOT.reports();
  var outAreas = [], onAreas = [], seenOut = new Set(), seenOn = new Set();
  allReps.forEach(function(r) {
    if (r.type === 'out' && r.area && !seenOut.has(r.area)) {
      seenOut.add(r.area);
      outAreas.push({ area: r.area, ago: BOT.ago(r.time), confirms: r.confirms || 0 });
    }
    if (r.type === 'bck' && r.area && !seenOn.has(r.area)) {
      seenOn.add(r.area);
      onAreas.push({ area: r.area, ago: BOT.ago(r.time) });
    }
  });

  lines.push('\nLIVE OUTAGE FEED (' + allReps.length + ' total reports in feed):');
  lines.push('  Areas currently REPORTING OUTAGE (' + outAreas.length + '):');
  outAreas.slice(0, 20).forEach(function(a) {
    lines.push('    - ' + a.area + ' (reported ' + a.ago + ', ' + a.confirms + ' confirms)');
  });
  if (outAreas.length === 0) lines.push('    None — power may be stable');

  lines.push('  Areas with POWER RESTORED (' + onAreas.length + '):');
  onAreas.slice(0, 12).forEach(function(a) {
    lines.push('    - ' + a.area + ' (restored ' + a.ago + ')');
  });
  if (onAreas.length === 0) lines.push('    None reported yet');

  /* 24h stats */
  var cutoff24h = Date.now() - 86400000;
  var reps24h = allReps.filter(function(r) { return r.time > cutoff24h; });
  var outLast24 = reps24h.filter(function(r) { return r.type === 'out'; }).length;
  var bckLast24 = reps24h.filter(function(r) { return r.type === 'bck'; }).length;
  lines.push('\nLAST 24H STATS: ' + reps24h.length + ' reports total, ' + outLast24 + ' outages, ' + bckLast24 + ' restorations');

  /* Area bands */
  var bands = BOT.areaBands();
  var bandGroups = { A: [], B: [], C: [], D: [], E: [] };
  Object.entries(bands).forEach(function(entry) {
    if (bandGroups[entry[1]]) bandGroups[entry[1]].push(entry[0]);
  });
  lines.push('\nNERC SUPPLY BANDS:');
  lines.push('  Band A (20-24h/day target): ' + (bandGroups.A.join(', ') || 'none'));
  lines.push('  Band B (16-20h/day target): ' + (bandGroups.B.join(', ') || 'none'));
  lines.push('  Band C (12-16h/day target): ' + (bandGroups.C.join(', ') || 'none'));
  lines.push('  Band D (8-12h/day target):  ' + (bandGroups.D.join(', ') || 'none'));
  lines.push('  Band E (4-8h/day target):   ' + (bandGroups.E.join(', ') || 'none'));

  /* AI predictions */
  var predLines = [];
  BOT.allAreas().slice(0, 25).forEach(function(area) {
    var p = BOT.predict(area);
    if (p) predLines.push('  ' + area + ' (Band ' + (bands[area] || '?') + '): ' + Math.round(p.prob * 100) + '% outage risk right now');
  });
  if (predLines.length) {
    lines.push('\nAI OUTAGE PREDICTIONS (this hour):');
    lines.push.apply(lines, predLines);
  }

  /* DISCOs */
  var discos = BOT.discos();
  if (discos.length) {
    lines.push('\nDISCO COVERAGE:');
    discos.forEach(function(d) {
      lines.push('  ' + d.name + ': ' + (d.lgas || []).join(', '));
    });
  }

  /* Area reliability from report data */
  var reliMap = {};
  allReps.forEach(function(r) {
    if (!r.area) return;
    if (!reliMap[r.area]) reliMap[r.area] = { out: 0, bck: 0 };
    if (r.type === 'out') reliMap[r.area].out++;
    if (r.type === 'bck') reliMap[r.area].bck++;
  });
  var reliLines = Object.entries(reliMap)
    .filter(function(e) { return e[1].out + e[1].bck >= 2; })
    .map(function(e) {
      var total = e[1].out + e[1].bck;
      var pct   = Math.round((e[1].out / total) * 100);
      return '  ' + e[0] + ': ' + pct + '% outage rate (' + total + ' crowd reports)';
    }).slice(0, 20);
  if (reliLines.length) {
    lines.push('\nAREA RELIABILITY SCORES:');
    lines.push.apply(lines, reliLines);
  }

  /* App user count from Supabase */
  try {
    if (typeof sb !== 'undefined') {
      var result = await sb.from('profiles').select('id', { count: 'exact', head: true });
      if (result.count) lines.push('\nAPP STATS: ' + result.count + ' registered NEPAWatch users');
    }
  } catch(e) { /* silent */ }

  return lines.join('\n');
}

/* ─── SYSTEM PROMPT ──────────────────────────────────────────────── */
function buildSystemPrompt(liveContext) {
  return `You are NEPAWatch AI — a helpful, friendly Lagos power outage assistant built into the NEPAWatch app. You help Lagosians understand the live power situation in their city, make sense of outage patterns, and take action.

PERSONALITY & TONE:
- Friendly, direct, and Lagos-aware. You understand Nigerian English and pidgin naturally.
- "Light don go" = power outage. "Light don come" = power restored. "NEPA" = general slang for electricity/grid.
- Be concise. Use **bold** for key facts. Use line breaks for readability.
- You genuinely care about helping people deal with Lagos electricity challenges.

YOUR CAPABILITIES (from live data):
- Report real-time power status for any Lagos area
- Show which areas have outages and which have been restored
- Share AI outage risk predictions by area
- Explain NERC supply bands (A through E)
- Check the user's saved places and home area status
- Give DISCO contact info and complaint procedures
- Explain how NEPAWatch works (reporting, email alerts, leaderboard)
- Answer general questions about Lagos electricity infrastructure

DISCO CONTACTS:
Ikeja Electric (IE) — mainland Lagos:
  Hotline: 0800-453-52-353
  Email: customercare@ikejaelectric.com
  Twitter: @ikejaelectric
  Web: ikejaelectric.com

Eko Electricity Distribution Company (EKEDC) — Lagos Island, Lekki, Surulere, Yaba, Festac, Apapa, Badagry, Epe, Obalende, Amuwo Odofin, Ajah:
  Hotline: 07080601000
  Email: customercare@ekedp.com
  Twitter: @ekedc_official
  Web: ekedp.com

HOW TO REPORT ON NEPAWATCH:
1. Tap "Light Don Go" (or "Light Don Come") on the Home screen
2. Search your street, estate or area
3. Select and tap confirm — report goes live instantly
4. Other users can tap "Same" to confirm your report

HOW EMAIL ALERTS WORK:
- Create a free account → go to Account tab
- Set your location (or use Locate Me)
- Toggle Email Alerts ON
- Alerts fire within seconds of any crowd report near your saved places

RULES:
- Only cite area status if it appears in the live data below
- If an area has no reports, say there's no data — never guess or invent outage status
- If asked about areas not in the data, tell the user there are no reports for that area yet
- Keep responses focused. Don't repeat the same info unless asked.
- For multi-turn conversation, remember what was discussed earlier in this chat.

LIVE APP DATA (fetched right now from Supabase):
${liveContext}`;
}

/* ─── CONVERSATION HISTORY (multi-turn memory) ───────────────────── */
var BotHistory = {
  messages: [],
  add: function(role, content) {
    this.messages.push({ role: role, content: content });
    if (this.messages.length > 24) this.messages = this.messages.slice(-24);
  },
  get: function() { return this.messages.slice(); },
  clear: function() { this.messages = []; },
};

/* ─── CLAUDE API CALL ────────────────────────────────────────────── */
async function callClaudeAPI(userMessage) {
  var liveContext  = await buildLiveContext();
  var systemPrompt = buildSystemPrompt(liveContext);

  BotHistory.add('user', userMessage);

  var response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: BotHistory.get(),
    }),
  });

  if (!response.ok) {
    var errBody = {};
    try { errBody = await response.json(); } catch(e) {}
    throw new Error(errBody.error && errBody.error.message ? errBody.error.message : 'API error ' + response.status);
  }

  var data  = await response.json();
  var reply = data.content
    .filter(function(b) { return b.type === 'text'; })
    .map(function(b) { return b.text; })
    .join('');

  BotHistory.add('assistant', reply);
  return reply;
}

/* ─── SUGGESTION CHIPS ───────────────────────────────────────────── */
function getBotSuggestions() {
  var userArea = BOT.userArea();
  var outAreas = BOT.areasCurrentlyOut(2);

  if (userArea) {
    return [
      'Is there light in ' + userArea + '?',
      'When will light return in ' + userArea + '?',
      'How long has ' + userArea + ' been out?',
      'What band is ' + userArea + '?',
    ];
  }
  if (outAreas.length) {
    return [
      'Is there light in ' + outAreas[0] + '?',
      "What's happening in Lagos right now?",
      'Safest areas right now',
      'How do I get email alerts?',
    ];
  }
  return [
    "What's happening in Lagos?",
    'Safest areas right now',
    'How do I get email alerts?',
    'Why does light go so much?',
  ];
}

/* ─── CHAT UI ────────────────────────────────────────────────────── */
var NepaBot = {
  _open: false,
  _booted: false,
  _msgCount: 0,

  init: function() {
    if (this._booted) return;
    this._booted = true;
    this._injectStyles();
    this._buildDOM();
    var self = this;
    setTimeout(function() { self._showNotif(); }, 5000);
  },

  _injectStyles: function() {
    var s = document.createElement('style');
    s.textContent = [
      '#nepaBotBubble{position:fixed;bottom:88px;right:16px;z-index:500;width:54px;height:54px;border-radius:50%;background:var(--p,#00E676);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,.5);transition:transform .2s,background .2s;animation:botpulse 3s ease infinite;}',
      '#nepaBotBubble:hover{transform:scale(1.08);}',
      '#nepaBotBubble.open{animation:none;background:var(--sf,#141714);border:1px solid var(--bd,#232823);}',
      '.bbl-ico{transition:all .15s;position:absolute;}',
      '.bbl-ico.hide{opacity:0;transform:scale(.4);}',
      '.bbl-close{opacity:0;transform:scale(.4) rotate(-90deg);transition:all .15s;position:absolute;}',
      '.bbl-close.show{opacity:1;transform:scale(1) rotate(0);}',
      '@keyframes botpulse{0%,100%{box-shadow:0 0 0 0 rgba(0,230,118,.4),0 4px 20px rgba(0,0,0,.4);}50%{box-shadow:0 0 0 12px rgba(0,230,118,0),0 4px 20px rgba(0,0,0,.4);}}',
      '#botNotif{position:fixed;bottom:152px;right:16px;z-index:499;background:var(--sf,#141714);border:1px solid var(--bd,#232823);border-radius:14px 14px 4px 14px;padding:10px 30px 10px 12px;max-width:215px;font-size:.72rem;color:var(--ink,#EEF4EE);font-family:var(--font-body,sans-serif);box-shadow:0 4px 24px rgba(0,0,0,.5);opacity:0;transform:translateY(8px) scale(.95);transition:opacity .28s,transform .28s;pointer-events:none;line-height:1.5;}',
      '#botNotif.show{opacity:1;transform:none;pointer-events:auto;}',
      '#botNotif strong{color:var(--p,#00E676);}',
      '.bn-close{position:absolute;top:6px;right:8px;background:none;border:none;cursor:pointer;color:var(--ink3,#5A705A);font-size:.65rem;padding:2px 4px;}',
      '#botWin{position:fixed;bottom:152px;right:16px;z-index:498;width:calc(100vw - 32px);max-width:385px;max-height:72vh;background:var(--sf,#141714);border:1px solid var(--bd,#232823);border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 48px rgba(0,0,0,.65),0 0 0 1px rgba(0,230,118,.07);opacity:0;transform:translateY(16px) scale(.97);transition:opacity .22s,transform .22s;pointer-events:none;}',
      '#botWin.open{opacity:1;transform:none;pointer-events:auto;}',
      '.bw-header{padding:12px 14px 10px;background:var(--sf2,#1A1E1A);border-bottom:1px solid var(--bd,#232823);display:flex;align-items:center;gap:10px;flex-shrink:0;}',
      '.bw-av{width:32px;height:32px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,var(--p,#00E676) 0%,#00BFA5 100%);display:flex;align-items:center;justify-content:center;font-size:.9rem;box-shadow:0 0 10px rgba(0,230,118,.25);}',
      '.bw-name{font-size:.78rem;font-weight:700;color:var(--ink,#EEF4EE);font-family:var(--font-body,sans-serif);}',
      '.bw-sub{display:flex;align-items:center;gap:4px;font-size:.58rem;color:var(--ink3,#5A705A);font-family:var(--font-body,sans-serif);}',
      '.bw-pip{width:5px;height:5px;border-radius:50%;background:var(--p,#00E676);animation:botpulse 2.5s ease infinite;}',
      '.bw-msgs{flex:1;overflow-y:auto;padding:12px 10px;display:flex;flex-direction:column;gap:9px;scroll-behavior:smooth;}',
      '.bw-msgs::-webkit-scrollbar{width:2px;}',
      '.bw-msgs::-webkit-scrollbar-thumb{background:var(--bd);border-radius:1px;}',
      '.bm{display:flex;gap:6px;max-width:92%;animation:msgIn .2s ease;}',
      '@keyframes msgIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:none;}}',
      '.bm.user{align-self:flex-end;flex-direction:row-reverse;}',
      '.bm-av{width:24px;height:24px;border-radius:50%;flex-shrink:0;margin-top:2px;background:linear-gradient(135deg,var(--p,#00E676),#00BFA5);display:flex;align-items:center;justify-content:center;font-size:.65rem;}',
      '.bm-av.u{background:var(--sf2,#1A1E1A);border:1px solid var(--bd);color:var(--ink2);font-size:.58rem;font-weight:700;}',
      '.bm-bubble{background:var(--sf2,#1A1E1A);border:1px solid var(--bd,#232823);border-radius:4px 14px 14px 14px;padding:8px 11px;font-size:.75rem;color:var(--ink,#EEF4EE);font-family:var(--font-body,sans-serif);line-height:1.65;word-break:break-word;}',
      '.bm.user .bm-bubble{background:var(--p,#00E676);border-color:transparent;color:#0A0C0A;border-radius:14px 14px 4px 14px;font-weight:500;}',
      '.bm-bubble strong{font-weight:700;color:var(--p,#00E676);}',
      '.bm.user .bm-bubble strong{color:#0A0C0A;}',
      '.bm-bubble em{font-style:italic;color:var(--ink2);}',
      '.bm.user .bm-bubble em{color:rgba(0,0,0,.65);}',
      '.bm-typing .bm-bubble{padding:10px 14px;display:flex;gap:4px;align-items:center;}',
      '.bt-dot{width:6px;height:6px;border-radius:50%;background:var(--ink3);animation:bounce .9s ease infinite;}',
      '.bt-dot:nth-child(2){animation-delay:.15s;}',
      '.bt-dot:nth-child(3){animation-delay:.3s;}',
      '@keyframes bounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-5px);background:var(--p,#00E676);}}',
      '.bw-sugs{padding:7px 10px 8px;display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;border-top:1px solid var(--bd);background:var(--sf2,#1A1E1A);flex-shrink:0;}',
      '.bw-sugs::-webkit-scrollbar{display:none;}',
      '.bw-sug{font-size:.6rem;font-weight:600;color:var(--ink2);background:var(--sf,#141714);border:1px solid var(--bd);border-radius:99px;padding:5px 10px;cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0;font-family:var(--font-body,sans-serif);}',
      '.bw-sug:hover{border-color:var(--p,#00E676);color:var(--p,#00E676);}',
      '.bw-inp-row{display:flex;gap:7px;align-items:center;padding:8px 10px 10px;border-top:1px solid var(--bd);background:var(--sf,#141714);flex-shrink:0;}',
      '.bw-inp{flex:1;background:var(--sf2,#1A1E1A);border:1px solid var(--bd);border-radius:9px;padding:9px 11px;font-size:.76rem;color:var(--ink,#EEF4EE);font-family:var(--font-body,sans-serif);outline:none;transition:border-color .2s;}',
      '.bw-inp::placeholder{color:var(--ink3);}',
      '.bw-inp:focus{border-color:var(--p,#00E676);}',
      '.bw-inp:disabled{opacity:.5;}',
      '.bw-send{width:34px;height:34px;border-radius:9px;background:var(--p,#00E676);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#0A0C0A;transition:all .15s;}',
      '.bw-send:hover{background:#00ff7f;transform:scale(1.06);}',
      '.bw-send:active{transform:scale(.94);}',
      '.bw-send:disabled{opacity:.4;cursor:not-allowed;transform:none;}',
    ].join('');
    document.head.appendChild(s);
  },

  _buildDOM: function() {
    var notif = document.createElement('div');
    notif.id = 'botNotif';
    notif.innerHTML = '<button class="bn-close" onclick="NepaBot.closeNotif()">✕</button><span>Ask <strong>NEPAWatch AI</strong> about light in your area!</span>';
    document.body.appendChild(notif);

    var win = document.createElement('div');
    win.id = 'botWin';
    win.innerHTML = '' +
      '<div class="bw-header">' +
        '<div class="bw-av">⚡</div>' +
        '<div style="flex:1">' +
          '<div class="bw-name">NEPAWatch AI</div>' +
          '<div class="bw-sub"><div class="bw-pip"></div>Powered by Claude · Live Lagos data</div>' +
        '</div>' +
      '</div>' +
      '<div class="bw-msgs" id="botMsgs"></div>' +
      '<div class="bw-sugs" id="botSugs"></div>' +
      '<div class="bw-inp-row">' +
        '<input class="bw-inp" id="botInp" placeholder="Ask about any Lagos area…" autocomplete="off" maxlength="350">' +
        '<button class="bw-send" id="botSendBtn" onclick="NepaBot.send()">' +
          '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12.5 7L1.5 1.5L4 7L1.5 12.5L12.5 7Z" fill="currentColor"/></svg>' +
        '</button>' +
      '</div>';
    document.body.appendChild(win);

    var bubble = document.createElement('button');
    bubble.id = 'nepaBotBubble';
    bubble.setAttribute('aria-label', 'Chat with NEPAWatch AI');
    bubble.innerHTML = '' +
      '<div class="bbl-ico" id="bblOpen">' +
        '<svg width="22" height="22" viewBox="0 0 22 22" fill="none">' +
          '<path d="M11 2C6.58 2 3 5.13 3 9c0 2.02 1 3.84 2.64 5.15L5 19l4.36-2.18C10.22 16.93 10.6 17 11 17c4.42 0 8-3.13 8-7s-3.58-7-8-7z" fill="currentColor" opacity=".15"/>' +
          '<path d="M11 2C6.58 2 3 5.13 3 9c0 2.02 1 3.84 2.64 5.15L5 19l4.36-2.18C10.22 16.93 10.6 17 11 17c4.42 0 8-3.13 8-7s-3.58-7-8-7z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
          '<circle cx="8" cy="9" r="1" fill="currentColor"/>' +
          '<circle cx="11" cy="9" r="1" fill="currentColor"/>' +
          '<circle cx="14" cy="9" r="1" fill="currentColor"/>' +
        '</svg>' +
      '</div>' +
      '<div class="bbl-close" id="bblClose">' +
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
      '</div>';
    bubble.onclick = function() { NepaBot.toggle(); };
    document.body.appendChild(bubble);

    document.getElementById('botInp').addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); NepaBot.send(); }
    });

    this._renderSugs();
  },

  _renderSugs: function() {
    var el = document.getElementById('botSugs');
    if (!el) return;
    el.innerHTML = getBotSuggestions()
      .map(function(s) {
        return '<button class="bw-sug" onclick="NepaBot.sendText(\'' + s.replace(/'/g, "\\'") + '\')">' + s + '</button>';
      }).join('');
  },

  _showNotif: function() {
    var el = document.getElementById('botNotif');
    if (el && !this._open) {
      el.classList.add('show');
      setTimeout(function() { el.classList.remove('show'); }, 7000);
    }
  },

  closeNotif: function() { var el = document.getElementById('botNotif'); if (el) el.classList.remove('show'); },
  toggle:     function() { this._open ? this.close() : this.open(); },

  open: function() {
    this._open = true;
    this.closeNotif();
    var win    = document.getElementById('botWin');
    var bubble = document.getElementById('nepaBotBubble');
    var ico    = document.getElementById('bblOpen');
    var cls    = document.getElementById('bblClose');
    if (win)    win.classList.add('open');
    if (bubble) bubble.classList.add('open');
    if (ico)    ico.classList.add('hide');
    if (cls)    cls.classList.add('show');
    var inp = document.getElementById('botInp');
    setTimeout(function() { if (inp) inp.focus(); }, 250);
    if (this._msgCount === 0) this._welcome();
  },

  close: function() {
    this._open = false;
    var win    = document.getElementById('botWin');
    var bubble = document.getElementById('nepaBotBubble');
    var ico    = document.getElementById('bblOpen');
    var cls    = document.getElementById('bblClose');
    if (win)    win.classList.remove('open');
    if (bubble) bubble.classList.remove('open');
    if (ico)    ico.classList.remove('hide');
    if (cls)    cls.classList.remove('show');
  },

  _welcome: function() {
    var pr       = BOT.profile();
    var name     = pr && pr.name ? ', ' + pr.name.split(' ')[0] : '';
    var outN     = BOT.outageCount();
    var total    = BOT.reports().length;
    var userArea = BOT.userArea();

    var situation = outN > 0
      ? 'Right now, **' + outN + ' area' + (outN !== 1 ? 's' : '') + '** in Lagos are reporting outages.'
      : total > 0 ? 'Power looks relatively stable across Lagos right now.' : 'Loading live data…';

    var personalNote = '';
    if (userArea) {
      var isOut = BOT.isOut(userArea);
      personalNote = isOut === true
        ? '\n\nYour area **' + userArea + '** is currently reporting a power outage.'
        : isOut === false
        ? '\n\nPower is on in **' + userArea + '** per the latest reports.'
        : '\n\nAsk me about **' + userArea + '** for live status and predictions!';
    }

    this._addBot('Hey' + name + '! I\'m **NEPAWatch AI** — powered by Claude and connected to live Lagos power data.\n\n' + situation + personalNote + '\n\nAsk me anything about power in any Lagos area!');
  },

  sendText: function(text) {
    var inp = document.getElementById('botInp');
    if (inp) inp.value = text;
    this.send();
  },

  send: async function() {
    var inp  = document.getElementById('botInp');
    var text = (inp && inp.value || '').trim();
    if (!text) return;

    inp.value = '';
    this._setDisabled(true);
    this._addUser(text);
    this._showTyping();

    try {
      var reply = await callClaudeAPI(text);
      this._hideTyping();
      this._addBot(reply);
    } catch(err) {
      this._hideTyping();
      console.error('[NEPAWatch AI]', err);
      var msg = err.message || '';
      var errReply = msg.indexOf('429') !== -1
        ? 'Too many messages right now — please wait a moment and try again!'
        : msg.indexOf('5') === 0 || msg.indexOf('50') !== -1
        ? 'The AI is having a moment. Please try again shortly.'
        : 'Couldn\'t connect right now. Check your internet and try again.\n\n*(' + (msg.slice(0, 80) || 'unknown error') + ')*';
      this._addBot(errReply);
    }

    this._setDisabled(false);
    this._renderSugs();
    var finalInp = document.getElementById('botInp');
    setTimeout(function() { if (finalInp) finalInp.focus(); }, 100);
  },

  _setDisabled: function(disabled) {
    var inp = document.getElementById('botInp');
    var btn = document.getElementById('botSendBtn');
    if (inp) inp.disabled = disabled;
    if (btn) btn.disabled = disabled;
  },

  _addUser: function(text) {
    var pr = BOT.profile();
    var av = pr && pr.name ? pr.name[0].toUpperCase() : '?';
    this._appendMsg('user', this._esc(text), av);
  },

  _addBot: function(text) {
    this._msgCount++;
    this._appendMsg('bot', this._fmt(text), '⚡');
  },

  _appendMsg: function(role, html, av) {
    var el = document.getElementById('botMsgs');
    if (!el) return;
    var isUser = role === 'user';
    var div = document.createElement('div');
    div.className = 'bm' + (isUser ? ' user' : '');
    div.innerHTML = '<div class="bm-av' + (isUser ? ' u' : '') + '">' + av + '</div><div class="bm-bubble">' + html + '</div>';
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  },

  _showTyping: function() {
    var el = document.getElementById('botMsgs');
    if (!el || document.getElementById('botTyping')) return;
    var div = document.createElement('div');
    div.id = 'botTyping'; div.className = 'bm bm-typing';
    div.innerHTML = '<div class="bm-av">⚡</div><div class="bm-bubble"><div class="bt-dot"></div><div class="bt-dot"></div><div class="bt-dot"></div></div>';
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  },

  _hideTyping: function() {
    var el = document.getElementById('botTyping');
    if (el) el.remove();
  },

  _fmt: function(text) {
    return this._esc(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g,     '<em>$1</em>')
      .replace(/`(.*?)`/g,       '<code style="background:rgba(0,230,118,.1);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:.82em">$1</code>')
      .replace(/\n/g,            '<br>');
  },

  _esc: function(t) {
    return String(t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },
};

/* ─── AUTO-INIT ──────────────────────────────────────────────────── */
(function boot() {
  function tryInit() {
    if (document.getElementById('page-home')) {
      NepaBot.init();
    } else {
      setTimeout(tryInit, 400);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
})();

/* ─── PATCH go() — show bubble only on Home page ─────────────────── */
(function patchGo() {
  var wait = setInterval(function() {
    if (typeof go === 'function') {
      clearInterval(wait);
      var _orig = go;
      window.go = function(page) {
        _orig(page);
        var bubble = document.getElementById('nepaBotBubble');
        var notif  = document.getElementById('botNotif');
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
