/* ================================================================
   NEPAWatch Lagos — nepabot.js
   Floating AI chatbot bubble for the Home page.

   100% self-contained — no external API, no cost.
   The bot is powered by a rule-based NLP engine with:
   - Intent classification (pattern matching + keyword scoring)
   - Entity extraction (area names, times, DISCO names)
   - Context memory (tracks last area/topic mentioned)
   - Rich knowledge base covering Lagos power topics
   - Dynamic answers using live `reports` array from app.js
   - Typing animation with realistic variable delay
   ================================================================ */

/* ── KNOWLEDGE BASE ────────────────────────────────────────────── */
const NEPABOT_KB = {

  /* ── DISCO / OPERATOR INFO ─────────────────────────────────── */
  disco: {
    ikeja: {
      name: "Ikeja Electric (IE)",
      areas: ["Ikeja","Agege","Alimosho","Ojodu","Kosofe","Ketu","Gbagada","Maryland","Mushin","Oshodi","Ikorodu","Magodo","Shomolu","Ilupeju","Ogba"],
      hotline: "0800-IKEJA-ELECTRIC (0800-453-52-353)",
      email: "customercare@ikejaelectric.com",
      website: "ikejaelectric.com",
      twitter: "@ikejaelectric",
      zones: "Ikeja Electric covers most of mainland Lagos and extends to Ikorodu.",
    },
    eko: {
      name: "Eko Electricity Distribution Company (EKEDC)",
      areas: ["Lagos Island","Ikoyi","Victoria Island","Surulere","Yaba","Lekki","Ajah","Festac","Amuwo Odofin","Apapa","Badagry","Epe","Obalende"],
      hotline: "07080601000",
      email: "customercare@ekedp.com",
      website: "ekedp.com",
      twitter: "@ekedc_official",
      zones: "Eko Electric covers Lagos Island, the Island corridor (VI, Ikoyi, Lekki), and parts of the mainland south.",
    },
  },

  /* ── SBT TARIFF BANDS ──────────────────────────────────────── */
  bands: {
    A: { hours: "20–24 hours/day", desc: "Premium areas — best supply", examples: "Victoria Island, Ikoyi, Lekki Phase 1, Ikeja GRA" },
    B: { hours: "16–20 hours/day", desc: "Good supply", examples: "Chevron, Magodo, Gbagada, Ojodu" },
    C: { hours: "12–16 hours/day", desc: "Moderate supply", examples: "Surulere, Yaba, Maryland, Kosofe, Ebute Metta" },
    D: { hours: "8–12 hours/day", desc: "Unstable supply", examples: "Mushin, Agege, Oshodi, Festac, Lagos Island, Apapa" },
    E: { hours: "4–8 hours/day",  desc: "Poorest supply", examples: "Alimosho, Ikorodu, Badagry, Ojo, Ibeju-Lekki, Epe" },
  },

  /* ── AREAS → BAND MAPPING ──────────────────────────────────── */
  areaBands: {
    "victoria island":"A","ikoyi":"A","lekki phase 1":"A","ikeja gra":"A","lekki phase 2":"A","lekki ikota":"A",
    "chevron":"B","igbo efon":"B","ilasan":"B","magodo":"B","ojodu":"B","omole":"B","gbagada":"B",
    "maryland":"C","anthony":"C","kosofe":"C","ketu":"C","surulere":"C","yaba":"C","ilupeju":"C",
    "shomolu":"C","bariga":"C","ojota":"C","oregun":"C","ebute metta":"C","ogba":"C",
    "agege":"D","mushin":"D","oshodi":"D","isolo":"D","festac":"D","amuwo odofin":"D",
    "lagos island":"D","obalende":"D","cms":"D","apapa":"D","onikan":"D","ajah":"D",
    "alimosho":"E","ipaja":"E","ikorodu":"E","badagry":"E","ojo":"E","alaba":"E","ibeju":"E","epe":"E",
  },

  /* ── COMMON OUTAGE CAUSES ──────────────────────────────────── */
  causes: [
    { trigger: ["why","cause","reason","happen","fault","problem"], answer: `Power outages in Lagos happen for several reasons:\n\n⚡ **Load shedding** — NERC mandates planned cuts when generation is insufficient (about 60% of outages).\n🔧 **Equipment faults** — transformer failures, cable faults, fallen lines.\n🌩️ **Weather** — heavy rain, thunderstorms and flooding knock out lines.\n🏗️ **Vandalism / theft** — cables stolen or tampered with.\n🔌 **Transmission loss** — TCN grid issues upstream of your DISCO.\n📋 **Maintenance** — scheduled upgrades (DISCOs should notify 24hrs ahead).` },
  ],

  /* ── FREQUENTLY ASKED QUESTIONS ───────────────────────────── */
  faqs: [
    {
      intents: ["report","how report","submit report","report outage","report light"],
      answer: `To report an outage on NEPAWatch:\n\n1️⃣ Tap **"Light Don Go"** on the Home page\n2️⃣ Search your street or estate name\n3️⃣ Tap your location to confirm\n\nYour report goes live instantly for your whole community to see! 🙌`,
    },
    {
      intents: ["alert","email","notification","notify","tell me","inform"],
      answer: `NEPAWatch sends **free email alerts** to your inbox the moment power changes near you.\n\nTo activate:\n1️⃣ Create a free account (tap Account tab)\n2️⃣ Set your location\n3️⃣ Make sure email alerts are turned ON in your profile\n\nYou'll get an email within seconds of any report in your area. 📧`,
    },
    {
      intents: ["predict","prediction","forecast","when light","when will","what time","come back","return"],
      answer: `The **AI Predict tab** gives you:\n\n📊 Outage probability right now (0–100%)\n🕐 24-hour hourly forecast\n📅 This week's risk by day\n⏰ Best window to run appliances\n\nTap the **Predict** tab in the bottom nav to see forecasts for any Lagos area. The model uses NERC tariff band data + crowd report history — no internet needed, totally free!`,
    },
    {
      intents: ["band","tariff","sbt","service band"],
      answer: `NERC's **Service-Based Tariff (SBT)** classifies areas into 5 bands:\n\n🟢 **Band A** — 20–24h/day (VI, Ikoyi, Lekki Phase 1)\n🟢 **Band B** — 16–20h/day (Chevron, Magodo, Gbagada)\n🟡 **Band C** — 12–16h/day (Surulere, Yaba, Maryland)\n🟠 **Band D** — 8–12h/day (Mushin, Oshodi, Festac)\n🔴 **Band E** — 4–8h/day (Alimosho, Ikorodu, Badagry)\n\nHigher band = more supply hours + higher tariff rate.`,
    },
    {
      intents: ["generator","gen","fuel","inverter","solar","backup","alternative"],
      answer: `While waiting for NEPA, Lagos residents use several backup options:\n\n⛽ **Petrol generator** — most common, but expensive and noisy\n🔋 **Inverter + battery** — great for lights & phones, quiet\n☀️ **Solar panels** — best long-term ROI, no fuel cost\n🔌 **Power banks** — for phones and small devices\n\nWith Band E areas getting only 4–8h/day, solar inverter combos are increasingly popular in places like Alimosho and Ikorodu.`,
    },
    {
      intents: ["complain","complaint","report fault","cable","transformer","fallen","pole"],
      answer: `To report a fault to your DISCO:\n\n**Ikeja Electric:** 0800-453-52-353 or customercare@ikejaelectric.com\n**Eko Electric:** 07080601000 or customercare@ekedp.com\n\nAlways get a **fault reference number** when you call — it's how you track resolution.\n\nYou can also tweet at them: @ikejaelectric or @ekedc_official — public pressure on social media often speeds things up! 😅`,
    },
    {
      intents: ["nerc","regulator","regulation","electricity law","regulation"],
      answer: `**NERC** (Nigerian Electricity Regulatory Commission) is the independent body that regulates electricity in Nigeria.\n\nThey set:\n📋 Tariff rates per band\n⏰ Minimum supply hours per band\n📏 Quality of service standards\n⚖️ Consumer protection rules\n\nYou can complain to NERC at nerc.gov.ng if your DISCO persistently fails to meet band targets.`,
    },
    {
      intents: ["cost","tariff rate","price","how much","bill","electricity bill","pay"],
      answer: `Electricity tariff rates in Lagos (2024–2025 approximate ranges):\n\n🟢 **Band A** — ₦225–₦270/kWh\n🟢 **Band B** — ₦195–₦225/kWh\n🟡 **Band C** — ₦160–₦195/kWh\n🟠 **Band D** — ₦130–₦160/kWh\n🔴 **Band E** — ₦100–₦130/kWh\n\nHigher bands pay more but receive better supply. Rates are indexed and reviewed by NERC periodically.`,
    },
    {
      intents: ["nepawatch","about","what is","how does","app","platform","who made"],
      answer: `**NEPAWatch Lagos** is a free, crowd-sourced power outage tracker built for Lagos residents.\n\n🤝 Anyone can report an outage or restoration\n📍 Reports are location-tagged to streets and estates\n📧 Free email alerts when power changes near you\n🤖 AI auto-reporter files reports on your behalf when it detects high outage probability\n🏆 Community leaderboard rewards top reporters\n\nWe built it because Lagos deserves better electricity visibility! 💚`,
    },
    {
      intents: ["confirm","same","verify","confirm report","how confirm"],
      answer: `When you see a report in the live feed, tap **"Same"** if you're also experiencing the same situation (outage or restoration).\n\nEach confirmation adds credibility to the report. Reports with 10+ confirmations are considered highly reliable. The more people confirm, the faster the community is alerted! 🙌`,
    },
    {
      intents: ["safe place","saved place","save","home work school","track place"],
      answer: `**Saved Places** lets you track power at your Home, Work, School or any custom location.\n\n1️⃣ Go to the **My Area** tab\n2️⃣ Tap **"Add Saved Place"**\n3️⃣ Choose Home / Work / School / Other\n4️⃣ Search and select your location\n\nYou'll see real-time power status for all your saved places on the Home page, and get alerts for each one. 📍`,
    },
    {
      intents: ["leaderboard","top reporter","community","ranking","points"],
      answer: `The **Community tab** shows the top reporters in Lagos this week!\n\n🥇 Gold — #1 most reports\n🥈 Silver — #2\n🥉 Bronze — #3\n\n**NEPAWatch AI** also appears on the leaderboard when it auto-files reports. The more you report, the higher you climb — your reports help thousands of Lagosians! 💚`,
    },
    {
      intents: ["locate","location","gps","detect","my location","find me"],
      answer: `Tap the **"Locate Me"** button in the top-right corner of the Home page.\n\nNEPAWatch will use your GPS to:\n📍 Find your nearest area\n🗺️ Show a live map with power status nearby\n📊 Filter the feed to reports near you\n\nYour location is never stored unless you choose to save it to your profile. 🔒`,
    },
  ],

  /* ── GREETINGS ──────────────────────────────────────────────── */
  greetings: [
    "hello","hi","hey","good morning","good afternoon","good evening",
    "good day","howdy","yo","sup","ello","hiya","morning","evening","afternoon",
  ],

  greetingReplies: [
    "Hey! 👋 I'm NEPAWatch AI. Ask me anything about Lagos power — outages, your area's band, how to report, or how to set up alerts!",
    "Hello! ⚡ I'm here to help with all your Lagos electricity questions. What would you like to know?",
    "Hi there! 💚 Ask me about your area's power situation, tariff bands, how to get alerts, or anything electricity in Lagos!",
    "Hey Lagos! 🤖 NEPAWatch AI at your service. Power questions? I've got answers!",
  ],

  /* ── THANKS ─────────────────────────────────────────────────── */
  thanks: ["thank","thanks","thank you","cheers","great","nice","helpful","perfect","good","awesome","wonderful","brilliant"],
  thanksReplies: [
    "Happy to help! ⚡ Let me know if you have more questions.",
    "No problem at all! 💚 Stay powered!",
    "Anytime! 🤖 That's what I'm here for.",
    "Glad that helped! If your light goes out, you know where to report it 😄",
  ],
};

/* ── NLP ENGINE ────────────────────────────────────────────────── */
const NepaBotEngine = {
  context: { lastArea: null, lastTopic: null },

  /* Extract area name from message */
  extractArea(msg) {
    const lower = msg.toLowerCase();
    for (const [area, band] of Object.entries(NEPABOT_KB.areaBands)) {
      if (lower.includes(area)) return { area, band };
    }
    /* Also check full area names from AREA_BANDS global */
    if (typeof AREA_BANDS !== 'undefined') {
      for (const [area, band] of Object.entries(AREA_BANDS)) {
        if (lower.includes(area.toLowerCase())) return { area, band };
      }
    }
    return null;
  },

  /* Score a message against an intent list */
  scoreIntent(msg, intents) {
    const lower = msg.toLowerCase();
    let score = 0;
    for (const intent of intents) {
      if (lower.includes(intent)) score += intent.split(' ').length * 2;
    }
    return score;
  },

  /* Get live area status from reports array */
  getLiveStatus(area) {
    if (typeof reports === 'undefined' || !reports.length) return null;
    const areaLower = area.toLowerCase();
    const areaReports = reports.filter(r =>
      r.area && r.area.toLowerCase().includes(areaLower)
    );
    if (!areaReports.length) return null;
    return areaReports[0].type === 'out'
      ? { status: 'out', name: areaReports[0].area, time: areaReports[0].time, confirms: areaReports[0].confirms }
      : { status: 'on',  name: areaReports[0].area, time: areaReports[0].time, confirms: areaReports[0].confirms };
  },

  /* Format time ago */
  ago(ts) {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return `${d}s ago`;
    if (d < 3600) return `${Math.floor(d / 60)}m ago`;
    return `${Math.floor(d / 3600)}h ago`;
  },

  /* Main reply function */
  getReply(msg) {
    const lower = msg.trim().toLowerCase();
    if (!lower) return "Please type a question! I'm listening. ⚡";

    /* ── GREETING ── */
    if (NEPABOT_KB.greetings.some(g => lower === g || lower.startsWith(g + ' ') || lower.endsWith(' ' + g))) {
      return NEPABOT_KB.greetingReplies[Math.floor(Math.random() * NEPABOT_KB.greetingReplies.length)];
    }

    /* ── THANKS ── */
    if (NEPABOT_KB.thanks.some(t => lower.includes(t))) {
      return NEPABOT_KB.thanksReplies[Math.floor(Math.random() * NEPABOT_KB.thanksReplies.length)];
    }

    /* ── AREA-SPECIFIC QUERY ── */
    const areaMatch = this.extractArea(lower);
    if (areaMatch) {
      this.context.lastArea = areaMatch.area;
      const band = areaMatch.band.toUpperCase();
      const bandInfo = NEPABOT_KB.bands[band];
      const live = this.getLiveStatus(areaMatch.area);

      /* Find canonical area name */
      let canonArea = areaMatch.area;
      if (typeof AREA_BANDS !== 'undefined') {
        const found = Object.keys(AREA_BANDS).find(a => a.toLowerCase().includes(areaMatch.area));
        if (found) canonArea = found;
      }

      const liveStr = live
        ? live.status === 'out'
          ? `\n\n🔴 **Live:** Power is currently **OUT** in ${live.name} (reported ${this.ago(live.time)}, ${live.confirms} confirmation${live.confirms !== 1 ? 's' : ''})`
          : `\n\n🟢 **Live:** Power is currently **ON** in ${live.name} (restored ${this.ago(live.time)}, ${live.confirms} confirmation${live.confirms !== 1 ? 's' : ''})`
        : `\n\n📭 No recent reports for this area yet — be the first to report!`;

      /* Is asking about current status */
      if (/light|power|current|now|today|status|situation|how|what/.test(lower)) {
        return `**${canonArea}** is on **Band ${band}** — ${bandInfo.desc}.\n\n🕐 Target supply: **${bandInfo.hours}**${liveStr}\n\nCheck the **Predict tab** for hourly forecasts for this area.`;
      }

      /* Generic area query */
      return `Here's what I know about **${canonArea}**:\n\n📋 **Tariff Band:** ${band} — ${bandInfo.desc}\n🕐 **Daily supply target:** ${bandInfo.hours}${liveStr}\n\nFor live hourly predictions, check the **Predict tab**! 📊`;
    }

    /* ── DISCO QUERY ── */
    if (/ikeja electric|ikeja electricity|ie\b/.test(lower)) {
      const d = NEPABOT_KB.disco.ikeja;
      return `**${d.name}**\n\n📍 Covers: ${d.zones}\n📞 Hotline: ${d.hotline}\n📧 Email: ${d.email}\n🌐 Website: ${d.website}\n🐦 Twitter: ${d.twitter}`;
    }
    if (/eko electric|ekedc|eko electricity|eko disco/.test(lower)) {
      const d = NEPABOT_KB.disco.eko;
      return `**${d.name}**\n\n📍 Covers: ${d.zones}\n📞 Hotline: ${d.hotline}\n📧 Email: ${d.email}\n🌐 Website: ${d.website}\n🐦 Twitter: ${d.twitter}`;
    }
    if (/which disco|my disco|who supplies|which company|electricity company/.test(lower)) {
      return `Lagos has two electricity DISCOs:\n\n🔵 **Ikeja Electric** — covers most of mainland Lagos (Ikeja, Agege, Ikorodu, Mushin, etc.)\n\n🟣 **Eko Electric (EKEDC)** — covers the Island and south mainland (VI, Ikoyi, Lekki, Surulere, Yaba, Festac, etc.)\n\nTell me your area and I'll confirm which DISCO covers you!`;
    }

    /* ── SCORE AGAINST FAQs ── */
    let bestScore = 0, bestFaq = null;
    for (const faq of NEPABOT_KB.faqs) {
      const score = this.scoreIntent(lower, faq.intents);
      if (score > bestScore) { bestScore = score; bestFaq = faq; }
    }
    if (bestFaq && bestScore >= 2) return bestFaq.answer;

    /* ── OUTAGE CAUSES ── */
    if (/why|cause|reason|fault|problem|happen/.test(lower) && /light|power|outage|nepa|phcn/.test(lower)) {
      return NEPABOT_KB.causes[0].answer;
    }

    /* ── LIVE FEED SUMMARY ── */
    if (/how many|total|count|reports|latest|recent|news|update/.test(lower)) {
      if (typeof reports !== 'undefined' && reports.length) {
        const outN = [...new Set(reports.filter(r => r.type === 'out').map(r => r.area))].length;
        const bckN = [...new Set(reports.filter(r => r.type === 'bck').map(r => r.area))].length;
        const recent = reports.slice(0, 3).map(r =>
          `${r.type === 'out' ? '🔴' : '🟢'} **${r.name}**, ${r.area} (${this.ago(r.time)})`
        ).join('\n');
        return `Here's the current live situation across Lagos:\n\n🔴 **${outN}** area${outN !== 1 ? 's' : ''} reporting outages\n🟢 **${bckN}** area${bckN !== 1 ? 's' : ''} with power restored\n\n**3 most recent reports:**\n${recent}\n\nSee full live feed on the Home tab!`;
      }
    }

    /* ── WHAT IS NEPA ── */
    if (/what is nepa|what is phcn|who is nepa|nepa stand/.test(lower)) {
      return `**NEPA** (National Electric Power Authority) was Nigeria's national electricity monopoly — it was dissolved in 2005 as part of power sector reforms.\n\n**PHCN** (Power Holding Company of Nigeria) replaced it, and was then privatised into 11 DISCOs (Distribution Companies) in 2013.\n\nToday in Lagos, **Ikeja Electric** and **Eko Electric (EKEDC)** are the two DISCOs. But "NEPA" has stuck as slang — that's why we're called NEPAWatch! ⚡😄`;
    }

    /* ── CONTEXT FOLLOW-UP ── */
    if (this.context.lastArea && /same|that area|there|it/.test(lower)) {
      const band = NEPABOT_KB.areaBands[this.context.lastArea.toLowerCase()];
      if (band) {
        const live = this.getLiveStatus(this.context.lastArea);
        const liveStr = live
          ? live.status === 'out' ? `\n\n🔴 Currently **OUT** (${this.ago(live.time)})` : `\n\n🟢 Currently **ON** (${this.ago(live.time)})`
          : '';
        return `Still talking about **${this.context.lastArea}** — Band ${band.toUpperCase()}, target ${NEPABOT_KB.bands[band.toUpperCase()].hours}${liveStr}.\n\nAnything specific you want to know?`;
      }
    }

    /* ── FALLBACK ── */
    const fallbacks = [
      `Hmm, I'm not sure about that one. Try asking me about:\n\n💡 Your area's power status (e.g. "What's the light situation in Surulere?")\n📊 Tariff bands ("What band is Lekki?")\n📧 Setting up alerts\n🤖 How AI predictions work\n📞 DISCO contact numbers`,
      `I didn't quite catch that! You can ask me things like:\n\n• "Is there light in Ikeja?"\n• "What band is Mushin?"\n• "How do I report an outage?"\n• "How do I get email alerts?"\n• "Why does light go so much?"`,
      `Not sure I understood that. 🤔 Try asking about a specific Lagos area, your tariff band, how to get alerts, or why outages happen!`,
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  },
};

/* ── SUGGESTED QUICK QUESTIONS ─────────────────────────────────── */
const NEPABOT_SUGGESTIONS = [
  "Is there light in VI right now?",
  "What band is Surulere?",
  "How do I get email alerts?",
  "Why is there no light?",
  "How does AI prediction work?",
  "Who is Ikeja Electric?",
  "How do I report an outage?",
  "What's the live situation in Lagos?",
];

/* ── CHAT BUBBLE UI ────────────────────────────────────────────── */
const NepaBot = {
  _open: false,
  _msgs: [],
  _typingTimer: null,
  _initialized: false,
  _notifShown: false,

  init() {
    if (this._initialized) return;
    this._initialized = true;
    this._injectStyles();
    this._buildDOM();
    /* Show notification bubble after 4 seconds */
    setTimeout(() => this._showNotif(), 4000);
  },

  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* ── BUBBLE BUTTON ─────────────────────────────── */
      #nepaBotBubble {
        position: fixed;
        bottom: 88px; /* above the bottom nav */
        right: 16px;
        z-index: 500;
        width: 52px; height: 52px;
        border-radius: 50%;
        background: var(--p, #00E676);
        border: none;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 0 0 0 rgba(0,230,118,.4), 0 4px 20px rgba(0,0,0,.5);
        transition: transform .2s, box-shadow .2s;
        animation: botpulse 3s ease infinite;
      }
      #nepaBotBubble:hover {
        transform: scale(1.08);
        box-shadow: 0 0 0 8px rgba(0,230,118,.15), 0 6px 28px rgba(0,0,0,.5);
      }
      #nepaBotBubble.open { animation: none; background: var(--sf, #141714); border: 1px solid var(--bd, #232823); }
      @keyframes botpulse {
        0%,100% { box-shadow: 0 0 0 0 rgba(0,230,118,.35), 0 4px 20px rgba(0,0,0,.4); }
        50%      { box-shadow: 0 0 0 10px rgba(0,230,118,0), 0 4px 20px rgba(0,0,0,.4); }
      }
      .bot-bubble-icon { transition: opacity .15s, transform .15s; }
      .bot-bubble-icon.hide { opacity: 0; transform: scale(.5); position: absolute; }
      .bot-bubble-close { transition: opacity .15s, transform .15s; opacity: 0; transform: scale(.5) rotate(-90deg); position: absolute; }
      .bot-bubble-close.show { opacity: 1; transform: scale(1) rotate(0deg); }

      /* ── NOTIFICATION BADGE ────────────────────────── */
      #nepaBotNotif {
        position: fixed;
        bottom: 148px;
        right: 16px;
        z-index: 499;
        background: var(--sf, #141714);
        border: 1px solid var(--bd, #232823);
        border-radius: 14px 14px 4px 14px;
        padding: 10px 13px;
        max-width: 200px;
        font-size: .73rem;
        color: var(--ink, #F0F5F0);
        font-family: var(--font-body, 'DM Sans', sans-serif);
        box-shadow: 0 4px 20px rgba(0,0,0,.5);
        opacity: 0; transform: translateY(8px) scale(.95);
        transition: opacity .3s, transform .3s;
        pointer-events: none;
        line-height: 1.5;
      }
      #nepaBotNotif.show { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
      #nepaBotNotif strong { color: var(--p, #00E676); }
      .bot-notif-close {
        position: absolute; top: 6px; right: 8px;
        background: none; border: none; cursor: pointer;
        color: var(--ink3, #5A705A); font-size: .7rem; line-height: 1;
        padding: 2px 4px;
      }

      /* ── CHAT WINDOW ───────────────────────────────── */
      #nepaBotWindow {
        position: fixed;
        bottom: 150px;
        right: 16px;
        z-index: 498;
        width: calc(100vw - 32px);
        max-width: 360px;
        max-height: 68vh;
        background: var(--sf, #141714);
        border: 1px solid var(--bd, #232823);
        border-radius: 18px;
        display: flex; flex-direction: column;
        overflow: hidden;
        box-shadow: 0 8px 48px rgba(0,0,0,.6), 0 0 0 1px rgba(0,230,118,.08);
        opacity: 0; transform: translateY(16px) scale(.97);
        transition: opacity .25s, transform .25s;
        pointer-events: none;
      }
      #nepaBotWindow.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

      /* Header */
      .bot-header {
        padding: 14px 16px 12px;
        background: var(--sf2, #1A1E1A);
        border-bottom: 1px solid var(--bd, #232823);
        display: flex; align-items: center; gap: 10px;
        flex-shrink: 0;
      }
      .bot-header-avatar {
        width: 34px; height: 34px; border-radius: 50%;
        background: linear-gradient(135deg, var(--p, #00E676) 0%, var(--g2, #00BFA5) 100%);
        display: flex; align-items: center; justify-content: center;
        font-size: 1rem; flex-shrink: 0;
        box-shadow: 0 0 12px rgba(0,230,118,.3);
      }
      .bot-header-body { flex: 1; }
      .bot-header-name {
        font-size: .8rem; font-weight: 700;
        color: var(--ink, #F0F5F0);
        font-family: var(--font-body, sans-serif);
      }
      .bot-header-status {
        display: flex; align-items: center; gap: 5px;
        font-size: .62rem; color: var(--ink3, #5A705A);
        font-family: var(--font-body, sans-serif);
      }
      .bot-online-dot {
        width: 5px; height: 5px; border-radius: 50%;
        background: var(--p, #00E676);
        animation: botpulse 2.5s ease infinite;
      }

      /* Messages area */
      .bot-msgs {
        flex: 1; overflow-y: auto;
        padding: 14px 12px;
        display: flex; flex-direction: column; gap: 10px;
        scroll-behavior: smooth;
      }
      .bot-msgs::-webkit-scrollbar { width: 3px; }
      .bot-msgs::-webkit-scrollbar-thumb { background: var(--bd, #232823); border-radius: 2px; }

      /* Message bubbles */
      .bot-msg { display: flex; gap: 7px; max-width: 88%; animation: msgIn .22s ease; }
      @keyframes msgIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
      .bot-msg.user { align-self: flex-end; flex-direction: row-reverse; }
      .bot-msg-avatar {
        width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
        background: linear-gradient(135deg, var(--p, #00E676) 0%, #00BFA5 100%);
        display: flex; align-items: center; justify-content: center;
        font-size: .65rem; margin-top: 2px;
      }
      .bot-msg-avatar.user-av {
        background: var(--sf2, #1A1E1A);
        border: 1px solid var(--bd, #232823);
        color: var(--ink2, #A8BBA8); font-size: .6rem; font-weight: 700;
        font-family: var(--font-body, sans-serif);
      }
      .bot-msg-bubble {
        background: var(--sf2, #1A1E1A);
        border: 1px solid var(--bd, #232823);
        border-radius: 4px 14px 14px 14px;
        padding: 9px 12px;
        font-size: .76rem;
        color: var(--ink, #F0F5F0);
        font-family: var(--font-body, sans-serif);
        line-height: 1.6;
        white-space: pre-wrap;
      }
      .bot-msg.user .bot-msg-bubble {
        background: var(--p, #00E676);
        border-color: transparent;
        color: #0A0C0A;
        border-radius: 14px 14px 4px 14px;
        font-weight: 500;
      }
      /* Bold markdown inside bot bubbles */
      .bot-msg-bubble b, .bot-msg-bubble strong { font-weight: 700; color: var(--p, #00E676); }
      .bot-msg.user .bot-msg-bubble b,
      .bot-msg.user .bot-msg-bubble strong { color: #0A0C0A; }

      /* Typing indicator */
      .bot-typing .bot-msg-bubble {
        padding: 12px 16px;
        display: flex; gap: 4px; align-items: center;
      }
      .bot-typing-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: var(--ink3, #5A705A);
        animation: typingBounce .9s ease infinite;
      }
      .bot-typing-dot:nth-child(2) { animation-delay: .15s; }
      .bot-typing-dot:nth-child(3) { animation-delay: .3s; }
      @keyframes typingBounce {
        0%,60%,100% { transform: translateY(0); }
        30% { transform: translateY(-5px); background: var(--p, #00E676); }
      }

      /* Suggestions */
      .bot-suggestions {
        padding: 8px 12px 10px;
        display: flex; gap: 6px; flex-wrap: wrap;
        border-top: 1px solid var(--bd, #232823);
        background: var(--sf2, #1A1E1A);
        flex-shrink: 0;
      }
      .bot-sug {
        font-size: .63rem; font-weight: 600;
        color: var(--ink2, #A8BBA8);
        background: var(--sf, #141714);
        border: 1px solid var(--bd, #232823);
        border-radius: 99px; padding: 5px 10px;
        cursor: pointer; transition: all .15s;
        font-family: var(--font-body, sans-serif);
        white-space: nowrap;
      }
      .bot-sug:hover { border-color: var(--p, #00E676); color: var(--p, #00E676); }

      /* Input area */
      .bot-input-row {
        display: flex; gap: 8px; align-items: center;
        padding: 10px 12px 12px;
        border-top: 1px solid var(--bd, #232823);
        background: var(--sf, #141714);
        flex-shrink: 0;
      }
      .bot-input {
        flex: 1;
        background: var(--sf2, #1A1E1A);
        border: 1px solid var(--bd, #232823);
        border-radius: 10px;
        padding: 9px 12px;
        font-size: .78rem;
        color: var(--ink, #F0F5F0);
        font-family: var(--font-body, sans-serif);
        outline: none;
        transition: border-color .2s;
      }
      .bot-input::placeholder { color: var(--ink3, #5A705A); }
      .bot-input:focus { border-color: var(--p, #00E676); }
      .bot-send {
        width: 36px; height: 36px; border-radius: 10px;
        background: var(--p, #00E676);
        border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        transition: all .15s;
        color: #0A0C0A;
      }
      .bot-send:hover { background: #00FF88; transform: scale(1.05); }
      .bot-send:active { transform: scale(.96); }
    `;
    document.head.appendChild(style);
  },

  _buildDOM() {
    /* Notification badge */
    const notif = document.createElement('div');
    notif.id = 'nepaBotNotif';
    notif.innerHTML = `<button class="bot-notif-close" onclick="NepaBot.dismissNotif()">✕</button>👋 Ask <strong>NEPAWatch AI</strong> about your area's light situation!`;
    document.body.appendChild(notif);

    /* Chat window */
    const win = document.createElement('div');
    win.id = 'nepaBotWindow';
    win.innerHTML = `
      <div class="bot-header">
        <div class="bot-header-avatar">🤖</div>
        <div class="bot-header-body">
          <div class="bot-header-name">NEPAWatch AI</div>
          <div class="bot-header-status"><div class="bot-online-dot"></div>Online — always ready</div>
        </div>
      </div>
      <div class="bot-msgs" id="botMsgs"></div>
      <div class="bot-suggestions" id="botSuggestions"></div>
      <div class="bot-input-row">
        <input class="bot-input" id="botInput" placeholder="Ask about Lagos power…" autocomplete="off" maxlength="200">
        <button class="bot-send" onclick="NepaBot.send()" title="Send">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M13.5 7.5L2 2L4.5 7.5L2 13L13.5 7.5Z" fill="currentColor" stroke="currentColor" stroke-width=".5" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(win);

    /* Floating bubble button */
    const bubble = document.createElement('button');
    bubble.id = 'nepaBotBubble';
    bubble.setAttribute('aria-label', 'Open NEPAWatch AI Chat');
    bubble.innerHTML = `
      <div class="bot-bubble-icon" id="botIconOpen">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="7" stroke="#0A0C0A" stroke-width="1.5"/>
          <path d="M8 9.5C8 8.5 9.5 7.5 11 7.5s3 1 3 2c0 1.5-1.5 2-3 2v1.5" stroke="#0A0C0A" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="11" cy="15" r=".8" fill="#0A0C0A"/>
        </svg>
      </div>
      <div class="bot-bubble-close" id="botIconClose">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
    `;
    bubble.onclick = () => this.toggle();
    document.body.appendChild(bubble);

    /* Enter key handler */
    document.getElementById('botInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.send();
    });

    /* Render suggestions */
    this._renderSuggestions();
  },

  _renderSuggestions() {
    const el = document.getElementById('botSuggestions');
    if (!el) return;
    const pick = NEPABOT_SUGGESTIONS.sort(() => Math.random() - .5).slice(0, 4);
    el.innerHTML = pick.map(s =>
      `<button class="bot-sug" onclick="NepaBot.sendText('${s.replace(/'/g, "\\'")}')">${s}</button>`
    ).join('');
  },

  _showNotif() {
    const el = document.getElementById('nepaBotNotif');
    if (!el || this._open) return;
    el.classList.add('show');
    this._notifShown = true;
    setTimeout(() => el.classList.remove('show'), 6000);
  },

  dismissNotif() {
    const el = document.getElementById('nepaBotNotif');
    if (el) el.classList.remove('show');
  },

  toggle() {
    this._open ? this.close() : this.open();
  },

  open() {
    this._open = true;
    this.dismissNotif();
    document.getElementById('nepaBotWindow')?.classList.add('open');
    document.getElementById('nepaBotBubble')?.classList.add('open');
    document.getElementById('botIconOpen')?.classList.add('hide');
    document.getElementById('botIconClose')?.classList.add('show');
    document.getElementById('botInput')?.focus();

    /* Show welcome message if first open */
    if (this._msgs.length === 0) {
      this._addBotMsg("👋 Hey! I'm **NEPAWatch AI**.\n\nAsk me anything about power in Lagos — your area's band, why light goes, how to get alerts, DISCO contacts, and more!\n\nWhat would you like to know?");
    }
  },

  close() {
    this._open = false;
    document.getElementById('nepaBotWindow')?.classList.remove('open');
    document.getElementById('nepaBotBubble')?.classList.remove('open');
    document.getElementById('botIconOpen')?.classList.remove('hide');
    document.getElementById('botIconClose')?.classList.remove('show');
  },

  sendText(text) {
    const inp = document.getElementById('botInput');
    if (inp) inp.value = text;
    this.send();
  },

  send() {
    const inp = document.getElementById('botInput');
    const text = (inp?.value || '').trim();
    if (!text) return;
    inp.value = '';

    /* Add user message */
    this._addUserMsg(text);
    this._msgs.push({ role: 'user', text });

    /* Show typing indicator then reply */
    const delay = 600 + Math.min(text.length * 18, 1200);
    this._showTyping();
    clearTimeout(this._typingTimer);
    this._typingTimer = setTimeout(() => {
      this._hideTyping();
      const reply = NepaBotEngine.getReply(text);
      this._addBotMsg(reply);
      this._msgs.push({ role: 'bot', text: reply });
      /* Refresh suggestions */
      this._renderSuggestions();
    }, delay);
  },

  _addUserMsg(text) {
    const el = document.getElementById('botMsgs');
    if (!el) return;
    const initials = (typeof PR !== 'undefined' && PR?.name) ? PR.name[0].toUpperCase() : '👤';
    const div = document.createElement('div');
    div.className = 'bot-msg user';
    div.innerHTML = `
      <div class="bot-msg-avatar user-av">${initials}</div>
      <div class="bot-msg-bubble">${this._escapeHtml(text)}</div>
    `;
    el.appendChild(div);
    this._scroll();
  },

  _addBotMsg(text) {
    const el = document.getElementById('botMsgs');
    if (!el) return;
    const div = document.createElement('div');
    div.className = 'bot-msg';
    div.innerHTML = `
      <div class="bot-msg-avatar">🤖</div>
      <div class="bot-msg-bubble">${this._formatMsg(text)}</div>
    `;
    el.appendChild(div);
    this._scroll();
  },

  _showTyping() {
    const el = document.getElementById('botMsgs');
    if (!el || document.getElementById('botTyping')) return;
    const div = document.createElement('div');
    div.id = 'botTyping';
    div.className = 'bot-msg bot-typing';
    div.innerHTML = `
      <div class="bot-msg-avatar">🤖</div>
      <div class="bot-msg-bubble">
        <div class="bot-typing-dot"></div>
        <div class="bot-typing-dot"></div>
        <div class="bot-typing-dot"></div>
      </div>
    `;
    el.appendChild(div);
    this._scroll();
  },

  _hideTyping() {
    document.getElementById('botTyping')?.remove();
  },

  _scroll() {
    const el = document.getElementById('botMsgs');
    if (el) el.scrollTop = el.scrollHeight;
  },

  /* Convert **bold** markdown and newlines to HTML */
  _formatMsg(text) {
    return this._escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  },

  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },
};

/* ── AUTO-INIT WHEN DOM IS READY ─────────────────────────────────── */
(function waitForHome() {
  const tryInit = () => {
    /* Only show on Home page */
    const homePage = document.getElementById('page-home');
    if (homePage) {
      NepaBot.init();
      /* Re-position if bottom nav height ever changes */
    } else {
      setTimeout(tryInit, 500);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
})();

/* ── SHOW/HIDE BUBBLE WITH NAV ───────────────────────────────────── */
/* Re-export original go() to auto-show/hide bubble on Home only */
(function patchGoForBot() {
  const _waitForGo = setInterval(() => {
    if (typeof go === 'function') {
      clearInterval(_waitForGo);
      const _originalGo = go;
      window.go = function(page) {
        _originalGo(page);
        const bubble = document.getElementById('nepaBotBubble');
        const notif  = document.getElementById('nepaBotNotif');
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
  }, 100);
})();
