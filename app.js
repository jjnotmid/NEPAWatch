/* ===== NEPAWatch Lagos — app.js ===== */
/* Kill BroadcastChannel before Supabase to prevent cross-tab conflicts */
try { window.BroadcastChannel = undefined; } catch (e) {}

/* ===== CONFIG ===== */
const SUPA_URL = 'https://djurokbkkqrmpafcxlez.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdXJva2Jra3FybXBhZmN4bGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzE5OTUsImV4cCI6MjA4ODE0Nzk5NX0.ZLOtWFB7qy_J0mitjb_pcZ88wxmRjMe-3OdbQCRL8xE';
const EMAIL_FN = `${SUPA_URL}/functions/v1/send-alert`;
const APP_URL = 'https://nepawatch.app';
const APP_LOGO_URL = APP_URL + '/logo2.jpg';

const sb = supabase.createClient(SUPA_URL, SUPA_ANON, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});

/* ===== LAGOS AREA DATA ===== */
const LAGOS = {
  "Ikeja GRA": ["Isaac John Street","Oduduwa Crescent","Joel Ogunnaike Street","Oba Akinjobi Road","Aromire Avenue","Mobolaji Bank Anthony Way","Adeniyi Jones Avenue","Rev Ogunbiyi Street","Olowopo Street","Sobo Arobiodu Street"],
  "Ikeja (Allen/Opebi)": ["Allen Avenue","Toyin Street","Opebi Road","Oregun Road","Obafemi Awolowo Way Ikeja","Computer Village","Alausa Secretariat","Agidingbi Road","Lateef Jakande Road","Mobolaji Johnson Avenue","Kudirat Abiola Way","Salvation Road"],
  "Maryland/Anthony": ["Anthony Village","Ikorodu Road Maryland","Palmgrove Estate","Onipanu Street","Jibowu Street","Oworonshoki Expressway","Cemetery Road Anthony","Gani Fawehinmi Way","Ikosi Road"],
  "Ogba": ["Ogba Estate","Ifako Road","Command Road Ogba","Abeokuta Expressway Ogba","Ijaiye Road","Acme Road Ogba","MCC Road Ogba"],
  "Agege": ["Agege Stadium Road","Oko Oba Road","Dopemu Road","Orile Agege","Papa Ajao","Abule Egba","Abeokuta Expressway Agege","Old Abeokuta Road","Pen Cinema Road"],
  "Alimosho/Ipaja": ["Idimu Road","Egbe Road","Iyana Ipaja","Ayobo Road","Akowonjo Road","Shasha Road","Jakande Estate Isolo","Igando Road","Baruwa Road"],
  "Ojodu/Omole": ["Ojodu Berger","Isheri Road","Omole Phase 1","Omole Phase 2","CMD Road Ojodu","Fagba Road","Berger Expressway"],
  "Kosofe/Ketu": ["Ketu Mile 12","Ogudu Road","Ojota Interchange","Alapere Road","Mile 12 Market","Kosofe Road","Agboyi Road","Magodo Phase 1","Magodo Phase 2"],
  "Gbagada": ["Gbagada Phase 1","Gbagada Phase 2","Pedro Road","Tigris Crescent","Soluyi Avenue","Ifako Gbagada","Gbagada Express","Keffi Street Gbagada"],
  "Ilupeju": ["Ilupeju Estate Road","Ilupeju Bypass","Commercial Avenue Ilupeju","Simbiat Abiola Road","Harvey Road","Oregun Road Ilupeju"],
  "Mushin": ["Agege Motor Road Mushin","Ladipo Street","Idi Oro Road","Apata Street","Fadeyi Road","Mushin Market Road","Ejigbo Road Mushin","Town Planning Way"],
  "Surulere": ["Adeniran Ogunsanya Street","Bode Thomas Street","Ogunlana Drive","Ojuelegba Road","Eric Moore Road","Western Avenue Surulere","Itire Road","Masha Road","Randle Avenue","Akerele Street","Lawanson Road"],
  "Yaba": ["Herbert Macaulay Way","Akoka Road","Iwaya Road","Sabo Road Yaba","Jibowu Yaba","Tejuosho Road","University of Lagos Road","Makoko Road"],
  "Oshodi/Isolo": ["International Airport Road","Bolade Road","Oshodi Market","Ago Palace Way","Okota Road","Cele Expressway","Ilasamaja Road","Ejigbo Road"],
  "Shomolu/Bariga": ["Shomolu Road","Bariga Road","Onigbongbo","Obanikoro Road","Fadeyi Shomolu","Pedro Shomolu"],
  "Ebute Metta": ["Ebute Metta East","Ebute Metta West","Willoughby Street","Oyingbo Market Road","Olawale Street"],
  "Apapa": ["Apapa GRA","Creek Road","Commercial Road Apapa","Liverpool Road","Marine Beach Road","Kirikiri Road","Burma Road"],
  "Lagos Island": ["Broad Street","Marina Lagos","Nnamdi Azikiwe Street","Tinubu Square","Balogun Market Area","Idumota","Ereko Street","Custom Street","Lagos Island GRA"],
  "Ikoyi": ["Bourdillon Road","Osborne Road","Alexander Road","Kingsway Road Ikoyi","Awolowo Road","Gerrard Road","Banana Island","Parkview Estate","Lugard Avenue"],
  "Victoria Island": ["Adeola Odeku Street","Akin Adesola Street","Ozumba Mbadiwe Avenue","Idejo Street","Ahmadu Bello Way VI","Ligali Ayorinde Street","Sanusi Fafunwa Street","Kofo Abayomi Street","Ademola Adetokunbo Street","Oniru Estate Road"],
  "Obalende/CMS": ["Obalende Road","Race Course Road","Hawley Street","Campbell Street","Awolowo Road Obalende","Igbosere Road"],
  "Lekki Phase 1": ["Admiralty Way","Fola Osibo Road","Adewunmi Adebimpe Drive","Omorinre Johnson Street","Bisola Durosinmi-Etti Drive","Adebayo Doherty Road","Freedom Way Lekki","T.F. Kuboye Road","Jakande Road Lekki"],
  "Lekki Phase 2/Ikota": ["Crown Estate Road","Orchid Road Lekki","Ikota Shopping Complex Road","VGC Road","Megamound Road","Abraham Adesanya Road","Thomas Estate Road Ikota"],
  "Ajah": ["Abraham Adesanya Estate","Jakande Estate Ajah","Badore Road","Ilaje Road Ajah","Thomas Estate Road","Sangotedo Road","Addo Road Ajah","Monastery Road"],
  "Chevron/Lekki-Epe Expressway": ["Chevron Alternative Route","Chevron Drive","Palace Road Lekki","Osapa London","Ikate-Elegushi Road","Oral Estate Road","Mobil Road Lekki"],
  "Igbo Efon/Ilasan": ["Igbo Efon Road","Ilasan Road","Agungi Road Igbo Efon","Ologolo Road","Lekki Conservation Road"],
  "Ibeju-Lekki": ["Lekki Free Trade Zone Road","Awoyaya Road","Bogije Road","Akodo Road","Epe Expressway Ibeju","Eleko Road"],
  "Festac Town": ["1st Avenue Festac","2nd Avenue Festac","21 Road Festac","22 Road Festac","D Close Festac","FESTAC Expressway","6th Avenue Festac","7th Avenue Festac"],
  "Amuwo Odofin": ["Apple Junction Road","Mile 2 Road","Kirikiri Industrial Road","Satellite Town Road","Amuwo Odofin Estate","Alakija Road"],
  "Ojo/Alaba": ["Alaba International Market","Navy Town Road Ojo","Volkswagen Road Ojo","Trade Fair Complex Road","Ojo Barracks Road","LASU Road Ojo"],
  "Badagry": ["Badagry Expressway","Seme Border Road","Agbara Estate Road","Ajangbadi Road","Badagry Town","Topo Road Badagry","Marina Road Badagry"],
  "Ikorodu": ["Lagos Road Ikorodu","Agric Road Ikorodu","Benson Road Ikorodu","Ikorodu GRA","Owutu Road","Imota Road","Ijede Road"],
  "Magodo": ["Magodo Phase 1 Road","Magodo Phase 2 Road","GRA Shangisha Road","Magodo Estate Road","CMD Road Magodo"],
  "Ojota/Oregun": ["Ojota Road","Oregun Road","Kudirat Abiola Way","Oregun Industrial Estate Road","Ojota Market Road"],
  "Onikan/Lagos Mainland": ["Onikan Stadium Road","Bishop Oluwole Street","Broad Street Onikan","King George V Road"],
  "Epe": ["Epe Town Road","Lagos-Epe Expressway","Epe GRA Road","Poka Road","Mojoda Road"],
};

const DISCO = [
  { name: "Ikeja Electric", lgas: ["Ikeja GRA","Ikeja (Allen/Opebi)","Maryland/Anthony","Ogba","Agege","Alimosho/Ipaja","Ojodu/Omole","Kosofe/Ketu","Gbagada","Ilupeju","Mushin","Oshodi/Isolo","Shomolu/Bariga","Ikorodu","Magodo","Ojota/Oregun"] },
  { name: "Eko Electric", lgas: ["Lagos Island","Ikoyi","Victoria Island","Obalende/CMS","Ebute Metta","Apapa","Surulere","Yaba","Lekki Phase 1","Lekki Phase 2/Ikota","Ajah","Chevron/Lekki-Epe Expressway","Igbo Efon/Ilasan","Ibeju-Lekki","Festac Town","Amuwo Odofin","Ojo/Alaba","Badagry","Onikan/Lagos Mainland","Epe"] },
];

const AREA_COORDS = {
  "Lekki Phase 1": { lat: 6.4281, lng: 3.4219 }, "Victoria Island": { lat: 6.4281, lng: 3.4219 },
  "Ikoyi": { lat: 6.4480, lng: 3.4308 }, "Ajah": { lat: 6.4705, lng: 3.5805 },
  "Ikeja GRA": { lat: 6.5843, lng: 3.3360 }, "Ikeja (Allen/Opebi)": { lat: 6.6018, lng: 3.3515 },
  "Surulere": { lat: 6.4969, lng: 3.3583 }, "Yaba": { lat: 6.5095, lng: 3.3726 },
  "Gbagada": { lat: 6.5495, lng: 3.3928 }, "Maryland/Anthony": { lat: 6.5701, lng: 3.3620 },
  "Lekki Phase 2/Ikota": { lat: 6.4350, lng: 3.5400 }, "Chevron/Lekki-Epe Expressway": { lat: 6.4357, lng: 3.5060 },
  "Igbo Efon/Ilasan": { lat: 6.4500, lng: 3.4900 }, "Apapa": { lat: 6.4491, lng: 3.3660 },
  "Lagos Island": { lat: 6.4550, lng: 3.3941 }, "Mushin": { lat: 6.5283, lng: 3.3542 },
  "Oshodi/Isolo": { lat: 6.5478, lng: 3.3230 }, "Festac Town": { lat: 6.4670, lng: 3.2770 },
  "Amuwo Odofin": { lat: 6.4700, lng: 3.3000 }, "Badagry": { lat: 6.4174, lng: 2.8852 },
  "Ikorodu": { lat: 6.6194, lng: 3.5053 }, "Kosofe/Ketu": { lat: 6.5994, lng: 3.3908 },
  "Ojodu/Omole": { lat: 6.6284, lng: 3.3542 }, "Ogba": { lat: 6.6043, lng: 3.3372 },
  "Agege": { lat: 6.6167, lng: 3.3167 }, "Alimosho/Ipaja": { lat: 6.6038, lng: 3.2513 },
  "Shomolu/Bariga": { lat: 6.5507, lng: 3.3916 }, "Ebute Metta": { lat: 6.4973, lng: 3.3724 },
  "Obalende/CMS": { lat: 6.4578, lng: 3.4004 }, "Ilupeju": { lat: 6.5540, lng: 3.3602 },
  "Ibeju-Lekki": { lat: 6.4372, lng: 3.7239 }, "Ojo/Alaba": { lat: 6.4693, lng: 3.1758 },
  "Magodo": { lat: 6.6050, lng: 3.4000 }, "Ojota/Oregun": { lat: 6.5750, lng: 3.3800 },
  "Onikan/Lagos Mainland": { lat: 6.4560, lng: 3.3850 }, "Epe": { lat: 6.5847, lng: 3.9814 },
};

function sl(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"); }

const LOCS = [];
function buildBaseLocs() {
  Object.keys(LAGOS).forEach(area => {
    LOCS.push({ id: sl(area), name: area, area, street: null, label: area, custom: false });
    LAGOS[area].forEach(st => LOCS.push({ id: sl(area + st), name: st, area, street: st, label: `${st} — ${area}`, custom: false }));
  });
}
buildBaseLocs();

/* ===== STATE ===== */
let reports = [], filterArea = "", mType = null, mSel = null, CU = null, PR = null, emailLog = [];
let savedPlaces = [];
let _placeSel = null, _placeType = "home", _editPlaceId = null;
let _userCount = 0;
let _nearbyAreas = [];
let _userLat = null, _userLng = null;
let _pollTimer = null;
let googleMapsReady = false;
let googleMapsLoading = false;
let map = null;
let userMarker = null;
let powerMarkers = [];
let userExactLat = null, userExactLng = null;
let placesAutocomplete = null;

/* ===== INLINE SVG ICONS ===== */
const IC = {
  out: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 4V7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="7" cy="10" r=".55" fill="currentColor"/></svg>`,
  bck: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5L3.5 7.5H6.5L5.5 12.5L10.5 6.5H7.5L7 1.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  chk: `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ok: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  err: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  inf: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M6 5.5V8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="6" cy="3.8" r=".55" fill="currentColor"/></svg>`,
  user: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="4.5" r="2.2" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 11c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  home: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 7L7 1.5L12.5 7V12.5H9V9H5V12.5H1.5V7Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  work: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="5" width="11" height="7" rx="1.2" stroke="currentColor" stroke-width="1.3"/><path d="M4 5V3.5a3 3 0 0 1 6 0V5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  school: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 4.5l6 3.5 6-3.5L7 1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3 7v3.5c0 .8 1.8 1.5 4 1.5s4-.7 4-1.5V7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  custom: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 4.5V7l1.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  pin: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 .8A2.3 2.3 0 0 0 2.7 3.1C2.7 5.3 5 9.2 5 9.2S7.3 5.3 7.3 3.1A2.3 2.3 0 0 0 5 .8z" stroke="currentColor" stroke-width="1.1"/><circle cx="5" cy="3.1" r=".9" fill="currentColor"/></svg>`,
  edit: `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 8.5L8 2.5l1.5 1.5-6 6L1 10l1-1.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  del: `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 2l7 7M9 2L2 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
};

const PLACE_ICONS = { home: IC.home, work: IC.work, school: IC.school, custom: IC.custom };

/* ===== THEME ===== */
const MOON_SVG = `<path fill-rule="evenodd" clip-rule="evenodd" d="M8.5 2a6.5 6.5 0 1 0 5.18 10.38A5 5 0 0 1 6.5 5a5 5 0 0 1 2.83-4.48A6.6 6.6 0 0 0 8.5 2z" fill="currentColor"/>`;
const SUN_SVG = `<circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.58 3.58l1.41 1.41M11.01 11.01l1.41 1.41M3.58 12.42l1.41-1.41M11.01 4.99l1.41-1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;

function toggleTheme() {
  const h = document.documentElement;
  const isDark = h.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  h.setAttribute("data-theme", next);
  document.getElementById("themeIcon").innerHTML = next === "dark" ? MOON_SVG : SUN_SVG;
  try { localStorage.setItem("nw-theme", next); } catch (e) {}
}
function initTheme() {
  let saved; try { saved = localStorage.getItem("nw-theme"); } catch (e) {}
  const pref = window.matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light";
  const t = saved || pref;
  document.documentElement.setAttribute("data-theme", t);
  document.getElementById("themeIcon").innerHTML = t === "dark" ? MOON_SVG : SUN_SVG;
}

/* ===== TOAST ===== */
function toast(msg, cls = "ok") {
  const t = document.getElementById("toast");
  const ico = { ok: IC.ok, err: IC.err, info: IC.inf }[cls] || "";
  t.innerHTML = ico + `<span>${msg}</span>`;
  t.className = `toast ${cls} show`;
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.className = "toast", cls === "err" ? 7000 : 3600);
}

/* ===== AUTH ===== */
async function initAuth() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    CU = session?.user || null;
    if (CU) await loadProfile();
  } catch (e) {}
  updateBanner();
  sb.auth.onAuthStateChange(async (event, session) => {
    CU = session?.user || null;
    if (CU) { if (event === "SIGNED_IN" || event === "USER_UPDATED" || !PR) { await loadProfile(); } }
    else { PR = null; document.getElementById("locTag").classList.remove("on"); }
    updateBanner(); renderAccount();
    if (CU) loadSavedPlaces();
  });
}

async function loadProfile() {
  if (!CU) return;
  try {
    const { data, error } = await sb.from("profiles").select("*").eq("id", CU.id).single();
    if (!error && data) {
      PR = data;
      if (PR.location_id) {
        document.getElementById("locTag").classList.add("on");
        document.getElementById("locLabel").textContent = PR.location_label || PR.location_name;
      }
    } else if (error && error.code === "PGRST116") {
      const name = CU.user_metadata?.name || CU.email.split("@")[0];
      await sb.from("profiles").upsert({ id: CU.id, email: CU.email, name, notif_on: true }, { onConflict: "id" });
      PR = { id: CU.id, email: CU.email, name, notif_on: true, location_id: null };
    }
  } catch (e) {}
}

async function doRegister(name, email, pass) {
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { name }, emailRedirectTo: window.location.origin + window.location.pathname + "?mode=reset" } });
  if (error) {
    if (error.message?.toLowerCase().includes("rate limit") || error.message?.toLowerCase().includes("over_email_send_rate_limit")) throw new Error("RATE_LIMIT");
    throw new Error(error.message);
  }
  if (data.user) { await sb.from("profiles").upsert({ id: data.user.id, email, name, notif_on: true }, { onConflict: "id" }); }
  if (data.session) { CU = data.user; await loadProfile(); renderAccount(); updateBanner(); toast(`Welcome, ${name}!`, "ok"); }
  sendEmail(email, "Welcome to NEPAWatch Lagos",
    `Hi ${name},\n\nWelcome to NEPAWatch Lagos!\n\nYou will receive real-time email alerts whenever power goes out or is restored near your street.\n\nOpen the app and set your location to activate alerts.\n\nStay powered,\nNEPAWatch Lagos`);
  return data;
}

async function doLogin(email, pass) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) throw new Error(error.message);
  return data;
}

async function doLogout() {
  try { await sb.auth.signOut(); } catch (e) {}
  CU = null; PR = null; savedPlaces = [];
  document.getElementById("locTag").classList.remove("on");
  updateBanner(); renderAccount();
  toast("Signed out", "info");
}

/* ===== SAVED PLACES ===== */
async function loadSavedPlaces() {
  if (!CU) return;
  try {
    const { data, error } = await sb.from("saved_places").select("*").eq("user_id", CU.id).order("created_at", { ascending: true });
    if (!error && data) savedPlaces = data;
  } catch (e) {
    savedPlaces = [];
  }
  renderSavedPlacesHome();
  renderMyPlacesList();
}

async function savePlaceToDB(placeObj) {
  if (!CU) return null;
  try {
    if (placeObj.id && !String(placeObj.id).startsWith("local-")) {
      const { data, error } = await sb.from("saved_places").update({
        type: placeObj.type, custom_label: placeObj.custom_label,
        location_id: placeObj.location_id, location_name: placeObj.location_name,
        location_area: placeObj.location_area, location_label: placeObj.location_label,
        notif_on: placeObj.notif_on !== false,
      }).eq("id", placeObj.id).select().single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await sb.from("saved_places").insert({
        user_id: CU.id, type: placeObj.type, custom_label: placeObj.custom_label || null,
        location_id: placeObj.location_id, location_name: placeObj.location_name,
        location_area: placeObj.location_area, location_label: placeObj.location_label,
        notif_on: true,
      }).select().single();
      if (error) throw error;
      return data;
    }
  } catch (e) {
    return { id: "local-" + Date.now(), ...placeObj };
  }
}

async function deleteSavedPlace(id) {
  savedPlaces = savedPlaces.filter(p => p.id !== id);
  if (!String(id).startsWith("local-")) {
    try { await sb.from("saved_places").delete().eq("id", id); } catch (e) {}
  }
  renderSavedPlacesHome(); renderMyPlacesList();
  toast("Place removed", "info");
}

async function togglePlaceNotif(id) {
  const p = savedPlaces.find(x => x.id === id);
  if (!p) return;
  p.notif_on = !p.notif_on;
  if (!String(id).startsWith("local-")) {
    try { await sb.from("saved_places").update({ notif_on: p.notif_on }).eq("id", id); } catch (e) {}
  }
  toast(p.notif_on ? "Alerts on for this place" : "Alerts off for this place", "info");
  renderMyPlacesList();
}

function getPlaceDisplayName(p) {
  if (p.custom_label) return p.custom_label;
  const names = { home: "Home", work: "Work", school: "School", custom: "My Place" };
  return names[p.type] || "My Place";
}

function getPlaceStatus(area) {
  if (!area) return "unk";
  const r = reports.filter(x => x.area === area);
  if (!r.length) return "unk";
  return r[0].type === "out" ? "out" : "on";
}

function renderSavedPlacesHome() {
  const el = document.getElementById("savedPlacesHome");
  if (!savedPlaces.length) { el.innerHTML = ""; return; }
  const cards = savedPlaces.map(p => {
    const status = getPlaceStatus(p.location_area);
    const statusCls = status === "out" ? "s-out" : status === "on" ? "s-on" : "s-unk";
    const statusTxt = status === "out" ? "Power out" : status === "on" ? "Power on" : "Unknown";
    const statusIco = status === "out" ? IC.out : status === "on" ? IC.bck : IC.pin;
    const cardCls = status === "out" ? "sp-out" : status === "on" ? "sp-on" : "";
    return `<div class="sp-card ${cardCls}" onclick="jumpToArea('${p.location_area || ""}')">
      <div class="sp-label">${getPlaceDisplayName(p)}</div>
      <div class="sp-name">${p.location_name}</div>
      <div class="sp-status ${statusCls}">${statusIco}&nbsp;${statusTxt}</div>
    </div>`;
  }).join("");
  el.innerHTML = `<div class="slbl">Saved Places</div><div class="saved-places"><div class="sp-scroll">${cards}<button class="sp-add" onclick="openPlaceModal()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Add Place</button></div></div>`;
}

function renderMyPlacesList() {
  const el = document.getElementById("myPlacesList");
  if (!el) return;
  if (!savedPlaces.length) {
    el.innerHTML = `<div class="empty"><div class="empty-ico">${IC.pin}</div><p>No saved places yet. Add your home, work or school to track their power status.</p></div>`;
    return;
  }
  const typeClsMap = { home: "mpl-home", work: "mpl-work", school: "mpl-school", custom: "mpl-custom" };
  el.innerHTML = savedPlaces.map(p => {
    const status = getPlaceStatus(p.location_area);
    const statusCls = status === "out" ? "s-out" : status === "on" ? "s-on" : "s-unk";
    const statusTxt = status === "out" ? "Power Out" : status === "on" ? "Power On" : "Unknown";
    const statusIco = status === "out" ? IC.out : status === "on" ? IC.bck : IC.pin;
    const ico = PLACE_ICONS[p.type] || IC.custom;
    const typeCls = typeClsMap[p.type] || "mpl-custom";
    return `<div class="mpl-card">
      <div class="mpl-type-ico ${typeCls}">${ico}</div>
      <div class="mpl-body">
        <div class="mpl-lbl">${getPlaceDisplayName(p)}</div>
        <div class="mpl-name">${p.location_name}</div>
        <div class="mpl-area">${p.location_area || ""}</div>
      </div>
      <div class="mpl-status ${statusCls}">${statusIco}&nbsp;${statusTxt}</div>
      <div class="mpl-actions">
        <button class="mpl-edit-btn" onclick="editSavedPlace('${p.id}')" title="Edit">${IC.edit}</button>
        <button class="mpl-del-btn" onclick="deleteSavedPlace('${p.id}')" title="Remove">${IC.del}</button>
      </div>
    </div>`;
  }).join("");
}

function jumpToArea(area) {
  if (!area) return;
  filterArea = area;
  const sel = document.getElementById("areaFilter");
  if (sel) sel.value = area;
  go("home");
  renderFeed("liveFeed");
  toast(`Filtered to ${area}`, "info");
}

/* ===== PLACE MODAL ===== */
let _placeSearchQ = "";

function openPlaceModal(editId) {
  _editPlaceId = editId || null;
  _placeSel = null; _placeType = "home";
  document.getElementById("placeShTitle").textContent = editId ? "Edit Saved Place" : "Add Saved Place";
  document.getElementById("customPlaceName").value = "";
  document.getElementById("placeSearch").value = "";

  if (editId) {
    const existing = savedPlaces.find(p => p.id === editId);
    if (existing) {
      _placeType = existing.type || "home";
      document.getElementById("customPlaceName").value = existing.custom_label || "";
      const loc = LOCS.find(l => l.id === existing.location_id) || { id: existing.location_id, name: existing.location_name, area: existing.location_area, label: existing.location_label };
      _placeSel = loc;
      document.getElementById("placeSearch").value = existing.location_name || "";
    }
  }

  document.querySelectorAll(".pt-btn").forEach(b => b.classList.toggle("selected", b.dataset.type === _placeType));
  renderPlaceList(LOCS.slice(0, 60));
  const btn = document.getElementById("placeBtn");
  if (_placeSel) { btn.disabled = false; btn.textContent = editId ? "Save Changes" : "Add Place"; }
  else { btn.disabled = true; btn.textContent = "Select a location first"; }

  document.getElementById("placeOverlay").classList.add("open");
  setTimeout(() => document.getElementById("placeSearch").focus(), 280);
}

function editSavedPlace(id) { openPlaceModal(id); }

function closePlaceModal() {
  document.getElementById("placeOverlay").classList.remove("open");
  _placeSel = null; _placeType = "home"; _editPlaceId = null;
}

function selectPlaceType(btn, type) {
  _placeType = type;
  document.querySelectorAll(".pt-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
}

function filterPlaceList() {
  const q = document.getElementById("placeSearch").value.trim().toLowerCase();
  if (!q) { renderPlaceList(LOCS.slice(0, 60)); return; }
  renderPlaceList(LOCS.filter(l => l.label.toLowerCase().includes(q)).slice(0, 50));
}

function renderPlaceList(locs) {
  const el = document.getElementById("placeList");
  if (!locs.length) { el.innerHTML = `<div class="mopt" style="color:var(--ink3);cursor:default;justify-content:center;padding:18px">No results found</div>`; return; }
  el.innerHTML = locs.map(l => `<div class="mopt ${_placeSel?.id === l.id ? "sel" : ""}" onclick="selectPlaceLoc('${l.id}')"><span>${l.name}</span><span class="mopt-sub">${l.street ? l.area : "Area"}</span></div>`).join("");
}

function selectPlaceLoc(id) {
  _placeSel = LOCS.find(l => l.id === id);
  const q = document.getElementById("placeSearch").value.trim().toLowerCase();
  renderPlaceList(q ? LOCS.filter(l => l.label.toLowerCase().includes(q)).slice(0, 50) : LOCS.slice(0, 60));
  const btn = document.getElementById("placeBtn");
  if (_placeSel) { btn.disabled = false; btn.textContent = _editPlaceId ? "Save Changes" : "Add Place"; }
}

async function submitSavedPlace() {
  if (!CU) { toast("Sign in to save places", "info"); closePlaceModal(); go("account"); return; }
  if (!_placeSel) { toast("Select a location", "info"); return; }
  const customLabel = document.getElementById("customPlaceName").value.trim() || null;
  const btn = document.getElementById("placeBtn");
  btn.innerHTML = `Saving... <span class="spin"></span>`; btn.disabled = true;

  const placeObj = {
    id: _editPlaceId || null, type: _placeType, custom_label: customLabel,
    location_id: _placeSel.id, location_name: _placeSel.name,
    location_area: _placeSel.area, location_label: _placeSel.label, notif_on: true,
  };

  const saved = await savePlaceToDB(placeObj);
  if (saved) {
    if (_editPlaceId) {
      const idx = savedPlaces.findIndex(p => p.id === _editPlaceId);
      if (idx !== -1) savedPlaces[idx] = { ...savedPlaces[idx], ...saved };
    } else {
      savedPlaces.push(saved);
    }
    renderSavedPlacesHome(); renderMyPlacesList();
    toast(_editPlaceId ? "Place updated" : "Place saved", "ok");
  }
  btn.innerHTML = _editPlaceId ? "Save Changes" : "Add Place"; btn.disabled = false;
  closePlaceModal();
}

/* ===== GEOLOCATION — HIGH ACCURACY ===== */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestAreas(lat, lng, count = 8) {
  return Object.entries(AREA_COORDS)
    .map(([area, coords]) => ({ area, dist: haversine(lat, lng, coords.lat, coords.lng) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count);
}

function reverseGeocode(lat, lng) {
  if (!googleMapsReady) return;
  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ location: { lat, lng } }, (results, status) => {
    if (status === "OK" && results[0]) {
      const addrComp = results[0].address_components;
      let precise = "";
      for (let comp of addrComp) {
        if (comp.types.includes("neighborhood")) {
          precise = comp.long_name;
          break;
        } else if (comp.types.includes("sublocality") && !precise) {
          precise = comp.long_name;
        } else if (comp.types.includes("locality") && !precise) {
          precise = comp.long_name;
        }
      }
      if (precise) {
        const txt = document.getElementById("geoBtnTxt");
        txt.textContent = precise.length > 12 ? precise.substring(0, 12) + "..." : precise;
        toast(`📍 You are at ${precise}`, "ok");
      }
    }
  });
}

async function detectLocation() {
  const btn = document.getElementById("geoBtn");
  const txt = document.getElementById("geoBtnTxt");
  if (!navigator.geolocation) { toast("Geolocation not supported", "err"); return; }
  txt.textContent = "Locating..."; btn.disabled = true;

  /* Try high-accuracy first, fall back to low accuracy if it times out */
  const tryGeo = (highAccuracy, timeoutMs) => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: highAccuracy,
      timeout: timeoutMs,
      maximumAge: highAccuracy ? 10000 : 60000,
    });
  });

  let pos;
  try {
    pos = await tryGeo(true, 12000);
  } catch (e1) {
    try {
      pos = await tryGeo(false, 8000);
    } catch (e2) {
      const msg = e2.code === 1 ? "Location access denied" : e2.code === 2 ? "Could not get location" : "Location request timed out";
      toast(msg, "err"); txt.textContent = "Locate Me"; btn.disabled = false;
      return;
    }
  }

  const { latitude: lat, longitude: lng, accuracy } = pos.coords;
  _userLat = lat; _userLng = lng;
  userExactLat = lat; userExactLng = lng;  // store exact coordinates for map

  _nearbyAreas = findNearestAreas(lat, lng, 8);
  const nearest = _nearbyAreas[0]?.area;

  if (!nearest) {
    toast("Could not match your location to a Lagos area", "err");
    txt.textContent = "Locate Me"; btn.disabled = false;
    return;
  }

  const sel = document.getElementById("areaFilter");
  sel.value = nearest; filterArea = nearest; renderFeed("liveFeed");
  btn.classList.add("active");
  btn.disabled = false;

  const accStr = accuracy < 100 ? `±${Math.round(accuracy)}m` : "";
  toast(`📍 Located near ${nearest}${accStr ? " " + accStr : ""}`, "ok");

  // Set button text (will be updated by reverse geocode if available)
  txt.textContent = nearest.length > 12 ? nearest.substring(0, 12) + "..." : nearest;

  renderNearbyDashboard();

  // Show the map container and render the map
  document.getElementById('mapContainer').classList.add('show');
  if (googleMapsReady) {
    showPreciseLocation(lat, lng);
    reverseGeocode(lat, lng);
  } else {
    // Map will be shown when initGoogleMaps runs, and reverse geocode then
  }

  if (CU && PR && !PR.location_id) {
    const loc = LOCS.find(l => l.name === nearest && !l.street);
    if (loc) await saveLocation(loc);
  }
}

function initGoogleMaps() {
  googleMapsReady = true;
  // If we were waiting to show a map after location detection, do it now
  if (userExactLat && userExactLng) {
    showPreciseLocation(userExactLat, userExactLng);
    reverseGeocode(userExactLat, userExactLng);
  }
}

function showPreciseLocation(lat, lng) {
  if (!googleMapsReady) return;

  const mapDiv = document.getElementById('mapContainer');
  if (!map) {
    map = new google.maps.Map(mapDiv, {
      center: { lat, lng },
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      styles: [ /* optional custom map style */ ]
    });
  } else {
    map.setCenter({ lat, lng });
    map.setZoom(15);
  }

  // Clear old markers
  if (userMarker) userMarker.setMap(null);
  powerMarkers.forEach(m => m.setMap(null));
  powerMarkers = [];

  // User marker
  userMarker = new google.maps.Marker({
    position: { lat, lng },
    map: map,
    title: "You are here",
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "#4285F4",
      fillOpacity: 1,
      strokeColor: "white",
      strokeWeight: 2,
    }
  });

  // Find nearby areas with power status
  const nearby = findNearbyPowerSpots(lat, lng, 5);
  nearby.forEach(spot => {
    const marker = new google.maps.Marker({
      position: spot.coords,
      map: map,
      title: spot.area,
      icon: {
        url: spot.status === 'on' 
          ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' 
          : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
      }
    });

    // Info window with directions button
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div class="map-info">
          <strong>${spot.area}</strong><br>
          Power: ${spot.status === 'on' ? '✅ On' : '❌ Out'}<br>
          ${spot.dist < 1 ? (spot.dist*1000).toFixed(0)+'m' : spot.dist.toFixed(1)+'km'} away
          <button onclick="window.open('https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${spot.coords.lat},${spot.coords.lng}', '_blank')">
            🧭 Directions
          </button>
        </div>
      `
    });

    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });

    powerMarkers.push(marker);
  });
}

function findNearbyPowerSpots(lat, lng, limit = 5) {
  const spots = [];
  Object.entries(AREA_COORDS).forEach(([area, coords]) => {
    const dist = haversine(lat, lng, coords.lat, coords.lng);
    // Only include areas within 10 km
    if (dist <= 10) {
      const status = getPlaceStatus(area);
      spots.push({ area, status, coords, dist });
    }
  });
  // Sort by distance, then return nearest 'limit' items
  return spots.sort((a, b) => a.dist - b.dist).slice(0, limit);
}

function clearLoc() {
  filterArea = "";
  const sel = document.getElementById("areaFilter");
  if (sel) sel.value = "";
  document.getElementById("locTag").classList.remove("on");
  document.getElementById("geoBtn").classList.remove("active");
  document.getElementById("geoBtnTxt").textContent = "Locate Me";
  _nearbyAreas = []; _userLat = null; _userLng = null;
  userExactLat = userExactLng = null;
  document.getElementById('mapContainer').classList.remove('show');
  if (userMarker) userMarker.setMap(null);
  powerMarkers.forEach(m => m.setMap(null));
  powerMarkers = [];
  renderNearbyDashboard();
  renderFeed("liveFeed");
  if (CU && PR) {
    PR.location_id = null; PR.location_name = null; PR.location_area = null; PR.location_label = null;
    sb.from("profiles").update({ location_id: null, location_name: null, location_area: null, location_label: null }).eq("id", CU.id).then(() => {}).catch(() => {});
  }
}

function renderNearbyDashboard() {
  const el = document.getElementById("nearbyDashboard");
  if (!_nearbyAreas.length) { el.innerHTML = ""; return; }
  const cards = _nearbyAreas.slice(0, 6).map(({ area, dist }) => {
    const status = getPlaceStatus(area);
    const statusCls = status === "out" ? "nb-status s-out" : status === "on" ? "nb-status s-on" : "nb-status s-unk";
    const statusTxt = status === "out" ? "Power Out" : status === "on" ? "Power On" : "No reports";
    const statusIco = status === "out" ? IC.out : status === "on" ? IC.bck : IC.pin;
    const distStr = dist < 1 ? `${Math.round(dist * 1000)}m away` : `${dist.toFixed(1)}km away`;
    return `<div class="nb-card" onclick="jumpToArea('${area}')">
      <div class="nb-area">${area}</div>
      <div class="nb-dist">${distStr}</div>
      <div class="${statusCls}">${statusIco}&nbsp;${statusTxt}</div>
    </div>`;
  }).join("");
  el.innerHTML = `<div class="slbl">Nearby Areas</div><div class="nearby-grid">${cards}</div>`;
}

/* ===== USER COUNT ===== */
async function loadUserCount() {
  try {
    const { count, error } = await sb.from("profiles").select("id", { count: "exact", head: true });
    if (!error && count != null) {
      _userCount = count;
      const pill = document.getElementById("userCountPill");
      const num = document.getElementById("userCountNum");
      if (pill && num && count >= 2) {
        num.textContent = count.toLocaleString();
        pill.style.display = "flex";
      }
    }
  } catch (e) {}
}

/* ===== PROFILE ===== */
async function saveLocation(loc) {
  if (!CU) return;
  const u = { location_id: loc.id, location_name: loc.name, location_area: loc.area, location_label: loc.label };
  try { await sb.from("profiles").update(u).eq("id", CU.id); } catch (e) {}
  PR = { ...PR, ...u };
  document.getElementById("locTag").classList.add("on");
  document.getElementById("locLabel").textContent = loc.label;
  updateBanner();
  toast(`Location set — ${loc.name}`, "ok");
}

async function toggleNotif() {
  if (!CU || !PR) return;
  const next = !PR.notif_on;
  try { await sb.from("profiles").update({ notif_on: next }).eq("id", CU.id); } catch (e) {}
  PR.notif_on = next;
  const btn = document.getElementById("notifToggle");
  if (btn) btn.classList.toggle("on", next);
  toast(next ? "Email alerts enabled" : "Email alerts disabled", "info");
}

async function loadCustomLocations() {
  try {
    const { data, error } = await sb.from("custom_locations").select("*").order("created_at", { ascending: true });
    if (!error && data && data.length) {
      data.forEach(loc => {
        if (!LOCS.find(l => l.id === loc.id)) {
          LOCS.unshift({ id: loc.id, name: loc.street_name, area: loc.area_name, street: loc.street_name, label: `${loc.street_name} — ${loc.area_name}`, custom: true });
        }
      });
      buildFilter();
    }
  } catch (e) {}
}

async function submitCustomLocation(street, area) {
  if (!CU) return null;
  const id = sl(area + street);
  try {
    const { data, error } = await sb.from("custom_locations").upsert({ id, street_name: street, area_name: area, added_by: CU.id }, { onConflict: "id" }).select().single();
    if (error) throw error;
    const newLoc = { id, name: street, area, street, label: `${street} — ${area}`, custom: true };
    if (!LOCS.find(l => l.id === id)) LOCS.unshift(newLoc);
    toast(`"${data.street_name}" added for everyone!`, "ok");
    return newLoc;
  } catch (e) { toast(e.message || "Could not add location", "err"); return null; }
}

/* ===== REPORTS ===== */
async function loadReports() {
  try {
    const { data, error } = await sb.from("reports").select("id,user_id,location_name,location_area,type,confirms,created_at").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    if (!data || data.length === 0) { reports = []; }
    else {
      const dbReports = data.map(r => ({ id: r.id, name: r.location_name, area: r.location_area, type: r.type, time: new Date(r.created_at).getTime(), confirms: r.confirms || 1, userId: r.user_id }));
      const pending = reports.filter(r => String(r.id).startsWith("local-"));
      reports = [...pending, ...dbReports];
    }
  } catch (e) { if (reports.length === 0) seedFallback(); }
  render();
  if (_nearbyAreas.length) renderNearbyDashboard();
}

async function pollReports() {
  try {
    const { data, error } = await sb.from("reports").select("id,user_id,location_name,location_area,type,confirms,created_at").order("created_at", { ascending: false }).limit(100);
    if (error || !data) return;
    const dbReports = data.map(r => ({ id: r.id, name: r.location_name, area: r.location_area, type: r.type, time: new Date(r.created_at).getTime(), confirms: r.confirms || 1, userId: r.user_id }));
    const pending = reports.filter(r => String(r.id).startsWith("local-"));
    const newList = [...pending, ...dbReports];
    const oldIds = reports.filter(r => !String(r.id).startsWith("local-")).map(r => r.id + r.confirms).join(",");
    const newIds = dbReports.map(r => r.id + r.confirms).join(",");
    if (oldIds !== newIds) {
      reports = newList;
      render();
      if (_nearbyAreas.length) renderNearbyDashboard();
      renderSavedPlacesHome(); renderMyPlacesList();
    }
  } catch (e) {}
}

function startPolling() {
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(pollReports, 8000);
}

async function pushReport(loc, type) {
  if (!CU) { toast("Sign in to submit a report", "info"); go("account"); return; }
  const tid = "local-" + Date.now();
  reports.unshift({ id: tid, name: loc.name, area: loc.area, type, time: Date.now(), confirms: 1 });
  if (reports.length > 100) reports.pop();
  render();
  try {
    const { data, error } = await sb.from("reports").insert({ user_id: CU.id, location_name: loc.name, location_area: loc.area, type, confirms: 1 }).select().single();
    if (error) {
      const idx = reports.findIndex(r => r.id === tid);
      if (idx !== -1) reports.splice(idx, 1);
      render();
      toast(`Could not save report: ${error.message}`, "err");
      return;
    }
    const idx = reports.findIndex(r => r.id === tid);
    if (idx !== -1) reports[idx] = { id: data.id, name: data.location_name, area: data.location_area, type: data.type, time: new Date(data.created_at).getTime(), confirms: data.confirms || 1, userId: data.user_id };
    render();
    toast(type === "out" ? `Outage reported — ${loc.name}` : `Power restored — ${loc.name}`, type === "out" ? "err" : "ok");
    if (PR && !PR.location_id) await saveLocation(loc);
    await sendAreaAlerts(loc.name, loc.area, type);
    setTimeout(loadReports, 2000);
  } catch (e) {
    const idx = reports.findIndex(r => r.id === tid);
    if (idx !== -1) reports.splice(idx, 1);
    render(); toast("Could not save report — check your connection", "err");
  }
}

async function addConfirm(repId) {
  const r = reports.find(x => x.id === repId); if (!r) return;
  r.confirms++;
  const isReal = !String(repId).startsWith("local-") && !String(repId).startsWith("s");
  if (isReal) { try { await sb.from("reports").update({ confirms: r.confirms }).eq("id", repId); } catch (e) {} }
  renderFeed("liveFeed");
  toast("Confirmation added", "ok");
  if (r.confirms === 3) await sendAreaAlerts(r.name, r.area, r.type);
}

function seedFallback() {
  reports = [
    { id: "s1", name: "Adeola Odeku Street", area: "Victoria Island", type: "out", time: Date.now() - 7 * 60000, confirms: 14 },
    { id: "s2", name: "Allen Avenue", area: "Ikeja (Allen/Opebi)", type: "out", time: Date.now() - 22 * 60000, confirms: 9 },
    { id: "s3", name: "Admiralty Way", area: "Lekki Phase 1", type: "bck", time: Date.now() - 5 * 60000, confirms: 18 },
    { id: "s4", name: "Adeniran Ogunsanya St", area: "Surulere", type: "out", time: Date.now() - 35 * 60000, confirms: 6 },
    { id: "s5", name: "Bourdillon Road", area: "Ikoyi", type: "bck", time: Date.now() - 12 * 60000, confirms: 11 },
    { id: "s6", name: "Agege Motor Road", area: "Mushin", type: "out", time: Date.now() - 55 * 60000, confirms: 7 },
    { id: "s7", name: "Agric Road Ikorodu", area: "Ikorodu", type: "out", time: Date.now() - 80 * 60000, confirms: 4 },
    { id: "s8", name: "Badore Road", area: "Ajah", type: "bck", time: Date.now() - 10 * 60000, confirms: 8 },
  ];
}

/* ===== EMAIL ALERTS ===== */
async function sendEmail(to, subject, body) {
  if (!to || !subject) return;
  try {
    await fetch(EMAIL_FN, { method: "POST", headers: { "Content-Type": "application/json", "apikey": SUPA_ANON, "Authorization": `Bearer ${SUPA_ANON}` }, body: JSON.stringify({ to, subject, body, mode: "direct" }) });
  } catch (e) {}
}
// TEMP: Always send email to myself for testing
if (CU && CU.email) {
  await sendEmail(CU.email, "Test from NEPAWatch", "This is a test email to confirm Resend works.");
}

async function sendAreaAlerts(repName, repArea, repType) {
  if (!repArea) return;
  try {
    const subject = repType === "out" ? `Power Outage — ${repArea}, Lagos` : `Power Restored — ${repArea}, Lagos`;
    const time = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
    const body = `${repType === "out" ? "Power outage" : "Power restored"} near ${repName}, ${repArea}.\n\nTime: ${time}\n\nSee live updates: ${APP_URL}\n\n— NEPAWatch Lagos`;

    let edgeSent = false;
    try {
      const res = await fetch(EMAIL_FN, { method: "POST", headers: { "Content-Type": "application/json", "apikey": SUPA_ANON, "Authorization": `Bearer ${SUPA_ANON}` }, body: JSON.stringify({ mode: "area_alert", area: repArea, repName, repType, subject, body, time }) });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const count = json.sent || 0; edgeSent = true;
        if (count > 0) { emailLog.unshift({ subject, to: `${count} watcher${count !== 1 ? "s" : ""} in ${repArea}`, time }); if (emailLog.length > 8) emailLog.pop(); }
      }
    } catch (fe) {}

    /* Email users who have this area saved as a favourite place with notif_on */
    if (CU && savedPlaces.length) {
      const matchingPlaces = savedPlaces.filter(p => p.location_area === repArea && p.notif_on !== false);
      if (matchingPlaces.length && CU.email && !edgeSent) {
        const placeNames = matchingPlaces.map(p => getPlaceDisplayName(p)).join(", ");
        const placeBody = `Hi ${PR?.name || "there"},\n\n${body}\n\nThis affects your saved place(s): ${placeNames}`;
        await sendEmail(CU.email, subject, placeBody);
        emailLog.unshift({ subject, to: CU.email + "  (saved place)", time }); if (emailLog.length > 8) emailLog.pop();
        toast("Alert sent for your saved place", "ok");
        if (document.getElementById("page-account").classList.contains("active")) renderAccount();
      }
    } else if (!edgeSent && CU && PR && PR.location_area === repArea && PR.notif_on && CU.email) {
      const userBody = `Hi ${PR.name || "there"},\n\n${body}`;
      await sendEmail(CU.email, subject, userBody);
      emailLog.unshift({ subject, to: CU.email, time }); if (emailLog.length > 8) emailLog.pop();
      toast("Alert sent to your email", "ok");
      if (document.getElementById("page-account").classList.contains("active")) renderAccount();
    }
  } catch (e) {}
}

/* ===== REPORT MODAL ===== */
function openModal(type) {
  mType = type; mSel = null;
  document.getElementById("shTitle").textContent = type === "out" ? "Report Power Outage" : "Report Power Restored";
  document.getElementById("shDesc").textContent = type === "out" ? "Search your street or area in Lagos." : "Great news! Tell your community.";
  const btn = document.getElementById("mBtn");
  btn.textContent = type === "out" ? "Confirm Outage" : "Confirm Restored";
  btn.className = "mconfirm " + (type === "out" ? "out" : "bck");
  btn.disabled = true;
  document.getElementById("mSearch").value = "";
  if (PR?.location_id) {
    mSel = LOCS.find(l => l.id === PR.location_id) || null;
    if (mSel) { btn.disabled = false; btn.textContent = type === "out" ? `Report — ${mSel.name}` : `Restored — ${mSel.name}`; }
  }
  renderMList(LOCS.slice(0, 60));
  document.getElementById("repOverlay").classList.add("open");
  setTimeout(() => { document.getElementById("mSearch").focus(); }, 280);
}
function closeModal() { document.getElementById("repOverlay").classList.remove("open"); mType = null; mSel = null; }

function filterList() {
  const q = document.getElementById("mSearch").value.trim().toLowerCase();
  if (!q) { renderMList(LOCS.slice(0, 60)); return; }
  renderMList(LOCS.filter(l => l.label.toLowerCase().includes(q)).slice(0, 50));
}

function renderMList(locs) {
  const el = document.getElementById("mList");
  if (!locs.length) { el.innerHTML = `<div class="mopt" style="color:var(--ink3);cursor:default;justify-content:center;padding:18px">No results found</div>`; return; }
  el.innerHTML = locs.map(l => `<div class="mopt ${mSel?.id === l.id ? "sel" : ""}" onclick="selectLoc('${l.id}')"><span>${l.name}</span><span class="mopt-sub">${l.street ? l.area : "Area"}</span></div>`).join("");
}

function selectLoc(id) {
  mSel = LOCS.find(l => l.id === id);
  const q = document.getElementById("mSearch").value.trim().toLowerCase();
  renderMList(q ? LOCS.filter(l => l.label.toLowerCase().includes(q)).slice(0, 50) : LOCS.slice(0, 60));
  const btn = document.getElementById("mBtn");
  if (mSel) { btn.disabled = false; btn.textContent = mType === "out" ? `Report — ${mSel.name}` : `Restored — ${mSel.name}`; }
}

async function submitReport() {
  if (!mSel) { toast("Please select a location", "info"); return; }
  const loc = mSel, type = mType; closeModal(); await pushReport(loc, type);
}

/* ===== SUGGEST LOCATION ===== */
function buildFilter() {
  const sel = document.getElementById("areaFilter"); if (!sel) return;
  const areas = new Set(); LOCS.forEach(l => areas.add(l.area));
  sel.innerHTML = `<option value="">All Lagos areas</option>`;
  [...areas].sort().forEach(a => { const o = document.createElement("option"); o.value = a; o.textContent = a; sel.appendChild(o); });
  const dl = document.getElementById("areaList"); if (dl) { dl.innerHTML = ""; [...areas].sort().forEach(a => { const o = document.createElement("option"); o.value = a; dl.appendChild(o); }); }
}
function applyFilter() { filterArea = document.getElementById("areaFilter").value; renderFeed("liveFeed"); }

function toggleSuggestLoc() {
  const form = document.getElementById("suggestLocForm"); const txt = document.getElementById("suggestLocToggleTxt"); if (!form) return;
  const show = form.style.display === "none"; form.style.display = show ? "block" : "none";
  txt.textContent = show ? "Hide" : "+ Cannot find your street? Add it for everyone";
  if (show) {
    setTimeout(() => {
      document.getElementById("suggestStreet")?.focus();
      // Initialize Places Autocomplete on the street input
      if (googleMapsReady && !placesAutocomplete) {
        const streetInput = document.getElementById('suggestStreet');
        placesAutocomplete = new google.maps.places.Autocomplete(streetInput, {
          types: ['address'],
          componentRestrictions: { country: 'NG' },
          fields: ['address_components', 'formatted_address', 'geometry']
        });
        placesAutocomplete.addListener('place_changed', () => {
          const place = placesAutocomplete.getPlace();
          if (place.geometry) {
            // Fill the area input based on address components
            const components = place.address_components;
            let street = '', area = '';
            for (let comp of components) {
              if (comp.types.includes('route')) street = comp.long_name;
              if (comp.types.includes('sublocality') || comp.types.includes('locality')) area = comp.long_name;
            }
            document.getElementById('suggestStreet').value = street || place.formatted_address;
            if (area) document.getElementById('suggestArea').value = area;
          }
        });
      }
    }, 200);
  }
}

async function handleSuggestLoc() {
  if (!CU) { toast("Sign in to add a location", "info"); closeModal(); go("account"); return; }
  const street = (document.getElementById("suggestStreet")?.value || "").trim();
  const area = (document.getElementById("suggestArea")?.value || "").trim();
  if (!street) { toast("Enter a street name", "info"); return; } if (!area) { toast("Enter the area name", "info"); return; }
  const btn = document.querySelector("#suggestLocForm .mconfirm");
  if (btn) { btn.innerHTML = 'Saving... <span class="spin"></span>'; btn.disabled = true; }
  const newLoc = await submitCustomLocation(street, area);
  if (btn) { btn.innerHTML = "Save and Use This Location"; btn.disabled = false; }
  if (newLoc) {
    mSel = newLoc; const mBtn = document.getElementById("mBtn");
    if (mBtn) { mBtn.disabled = false; mBtn.textContent = mType === "out" ? `Report — ${newLoc.name}` : `Restored — ${newLoc.name}`; }
    buildFilter();
    const q = document.getElementById("mSearch")?.value.trim().toLowerCase() || "";
    renderMList(q ? LOCS.filter(l => l.label.toLowerCase().includes(q)).slice(0, 50) : LOCS.slice(0, 60));
    const form = document.getElementById("suggestLocForm"); if (form) form.style.display = "none";
    const txt = document.getElementById("suggestLocToggleTxt"); if (txt) txt.textContent = "+ Cannot find your street? Add it for everyone";
  }
}

/* ===== BANNER ===== */
function updateBanner() {
  const b = document.getElementById("mainBanner"), t = document.getElementById("bannerTxt");
  if (!CU) { t.textContent = "Sign in to receive email alerts when power changes in your area."; b.classList.add("show"); }
  else if (PR && !PR.location_id) { t.textContent = `Hi ${PR.name} — tap Locate Me or report your street to set your location.`; b.classList.add("show"); }
  else { b.classList.remove("show"); }
}

/* ===== HELPERS ===== */
function ago(ts) { const d = Math.floor((Date.now() - ts) / 1000); if (d < 60) return `${d}s`; if (d < 3600) return `${Math.floor(d / 60)}m`; return `${Math.floor(d / 3600)}h`; }
function areaStatus(a) { const r = reports.filter(x => x.area === a); if (!r.length) return "unknown"; return r[0].type === "out" ? "out" : "on"; }

/* ===== RENDER ===== */
function renderStats() {
  const out = new Set(), bck = new Set();
  reports.forEach(r => r.type === "out" ? out.add(r.area) : bck.add(r.area));
  animateNum("s-out", out.size); animateNum("s-bck", bck.size); animateNum("s-rep", reports.length);
}
function animateNum(id, target) {
  const el = document.getElementById(id); const current = parseInt(el.textContent) || 0;
  if (current === target) { el.textContent = target; return; }
  let start = null; const dur = 400;
  const step = ts => { if (!start) start = ts; const p = Math.min((ts - start) / dur, 1); el.textContent = Math.round(current + (target - current) * p); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function renderFeed(id = "liveFeed", aF = null) {
  const el = document.getElementById(id); if (!el) return;
  const fa = aF !== null ? aF : (id === "liveFeed" ? filterArea : null);
  const data = fa ? reports.filter(r => r.area === fa) : reports;
  if (!data.length) {
    el.innerHTML = `<div class="empty"><div class="empty-ico">${IC.bck}</div><p>${fa ? `No reports for ${fa} yet.` : "No reports yet — be the first to report!"}</p></div>`; return;
  }
  el.innerHTML = data.slice(0, 16).map((r, i) => `
    <div class="fc ${r.type}" style="animation-delay:${i * 30}ms">
      <div class="fc-bar"></div>
      <div class="fc-dot">${r.type === "out" ? IC.out : IC.bck}</div>
      <div class="fc-body">
        <div class="fc-loc">${r.name}</div>
        <div class="fc-area">${r.area}</div>
        <div class="fc-meta">${r.confirms} confirmation${r.confirms !== 1 ? "s" : ""}</div>
      </div>
      <div class="fc-r">
        <div class="fc-time">${ago(r.time)} ago</div>
        <button class="same-btn" onclick="addConfirm('${r.id}')">${IC.chk} Same</button>
      </div>
    </div>`).join("");
}

function renderDiscos() {
  const el = document.getElementById("discoZones"); if (!el) return;
  el.innerHTML = DISCO.map(d => {
    const outN = d.lgas.filter(a => areaStatus(a) === "out").length;
    const rel = Math.max(10, Math.round(100 - (outN / Math.max(d.lgas.length, 1)) * 100));
    const c = rel > 70 ? "var(--p)" : rel > 40 ? "var(--am)" : "var(--rd)";
    const dot = outN > d.lgas.length * .5 ? "var(--rd)" : outN > 0 ? "var(--am)" : "var(--p)";
    return `<div class="zc"><div class="zdot" style="background:${dot}"></div><div class="zb"><div class="zn">${d.name}<span>${d.lgas.slice(0, 3).join(" · ")}...</span></div><div class="zt"><div class="zf" style="width:${rel}%;background:${c}"></div></div></div><div class="zp" style="color:${c}">${rel}%</div></div>`;
  }).join("");
}

function renderMyArea() {
  const loc = PR?.location_id ? LOCS.find(l => l.id === PR.location_id) : null;
  const days7 = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const now = Date.now(); const dayMs = 86400000;
  let hrs = days7.map((_, i) => {
    if (!loc) return null;
    const dayStart = now - (6 - i) * dayMs; const dayEnd = dayStart + dayMs;
    const dayReps = reports.filter(r => r.area === loc.area && r.time >= dayStart && r.time < dayEnd);
    if (!dayReps.length) return null;
    const outage = dayReps.filter(r => r.type === "out").length;
    const restored = dayReps.filter(r => r.type === "bck").length;
    return Math.min(23, Math.max(1, 12 - (outage * 3) + (restored * 1.5)));
  });
  const hasData = hrs.some(h => h !== null);
  if (!hasData) {
    document.getElementById("myScore").innerHTML = `—<span class="score-u">h/day</span>`;
    document.getElementById("myDesc").textContent = loc ? `No reports yet for ${loc.area}. Be the first!` : "Set your location on Home or tap Locate Me.";
    document.getElementById("weekGrid").innerHTML = days7.map(d => `<div class="dr"><div class="dl">${d}</div><div class="dtr"><div class="df" style="width:0%;background:var(--ink3)"></div></div><div class="dh" style="color:var(--ink3)">—</div></div>`).join("");
    renderFeed("myFeed", loc?.area || null);
    renderMyPlacesList(); return;
  }
  const known = hrs.filter(h => h !== null);
  const knownAvg = known.reduce((a, b) => a + b, 0) / known.length;
  hrs = hrs.map(h => h === null ? parseFloat(knownAvg.toFixed(1)) : h);
  const avg = (hrs.reduce((a, b) => a + b, 0) / 7).toFixed(1);
  document.getElementById("myScore").innerHTML = `${avg}<span class="score-u">h/day</span>`;
  const pa = parseFloat(avg);
  document.getElementById("myDesc").textContent = loc ? (pa > 16 ? `Excellent supply in ${loc.area} this week` : pa > 12 ? `Good supply in ${loc.area} this week` : pa > 8 ? `Moderate supply in ${loc.area} this week` : pa > 4 ? `Unstable supply near ${loc.name}` : `Very poor supply in ${loc.area}`) : "Set your location on Home or tap Locate Me.";
  document.getElementById("weekGrid").innerHTML = days7.map((d, i) => {
    const h = hrs[i], p = (h / 24) * 100, c = h > 16 ? "var(--p)" : h > 10 ? "var(--am)" : "var(--rd)";
    return `<div class="dr"><div class="dl">${d}</div><div class="dtr"><div class="df" style="width:0%;background:${c}" data-w="${p}"></div></div><div class="dh">${h}h</div></div>`;
  }).join("");
  setTimeout(() => { document.querySelectorAll("#weekGrid .df").forEach(bar => { bar.style.width = bar.dataset.w + "%"; }); }, 50);
  renderFeed("myFeed", loc?.area || null);
  renderMyPlacesList();
}

async function renderCommunity() {
  document.getElementById("lbList").innerHTML = `<div class="loading-row"><div class="spin w"></div>Loading leaderboard...</div>`;
  try {
    const { data: repData, error: repErr } = await sb.from("reports").select("user_id,location_name,location_area,type,created_at").not("user_id", "is", null).order("created_at", { ascending: false }).limit(300);
    if (repErr) throw repErr;
    if (repData && repData.length > 0) {
      const counts = {};
      repData.forEach(r => { if (!r.user_id) return; if (!counts[r.user_id]) counts[r.user_id] = { uid: r.user_id, count: 0 }; counts[r.user_id].count++; });
      const uids = Object.keys(counts).slice(0, 20);
      const { data: profData } = await sb.from("profiles").select("id,name,email").in("id", uids);
      const profMap = {}; (profData || []).forEach(p => profMap[p.id] = p.name || p.email?.split("@")[0] || "Reporter");
      const reporters = Object.values(counts).map(c => ({ name: profMap[c.uid] || "Reporter", count: c.count })).sort((a, b) => b.count - a.count).slice(0, 6);
      if (reporters.length > 0) {
        const rankClass = ["gold", "silver", "bronze", "", "", ""];
        document.getElementById("lbList").innerHTML = reporters.map((r, i) => `<div class="lbi"><div class="lbr ${rankClass[i] || ""}">${i + 1}</div><div style="flex:1"><div class="lbi-n">${r.name}</div><div class="lbi-a">${IC.user}&nbsp;Community reporter</div></div><div class="lbi-c">${r.count}<small>report${r.count !== 1 ? "s" : ""}</small></div></div>`).join("");
      } else { renderFallbackLeaderboard(); }
    } else { renderFallbackLeaderboard(); }
  } catch (e) { renderFallbackLeaderboard(); }

  const areas = Object.keys(LAGOS).map(a => {
    const aReps = reports.filter(r => r.area === a);
    const outN = aReps.filter(r => r.type === "out").length; const bckN = aReps.filter(r => r.type === "bck").length; const total = aReps.length;
    if (total === 0) return { name: a, score: null, reports: 0 };
    const score = Math.max(5, Math.min(98, 80 - (outN * 15) + (bckN * 10)));
    return { name: a, score, reports: total };
  }).sort((a, b) => { if (a.score === null && b.score === null) return 0; if (a.score === null) return 1; if (b.score === null) return -1; return b.score - a.score; });

  document.getElementById("areaRank").innerHTML = areas.slice(0, 16).map((a, i) => {
    const hasData = a.score !== null;
    const c = !hasData ? "var(--ink3)" : a.score > 70 ? "var(--p)" : a.score > 45 ? "var(--am)" : "var(--rd)";
    return `<div class="zc" style="animation:pgIn .2s ease ${i * 20}ms both"><div style="font-size:.68rem;color:var(--ink3);font-weight:700;width:22px;flex-shrink:0;text-align:center">${i + 1}</div><div class="zb"><div class="zn">${a.name}<span>${a.reports ? a.reports + " report" + (a.reports !== 1 ? "s" : "") : "No reports yet"}</span></div><div class="zt"><div class="zf" style="width:${hasData ? a.score : 0}%;background:${c}"></div></div></div><div class="zp" style="color:${c}">${hasData ? `${a.score}%` : "—"}</div></div>`;
  }).join("");
  document.getElementById("commNote").style.display = "block";
}

function renderFallbackLeaderboard() {
  document.getElementById("lbList").innerHTML = `<div class="empty" style="padding:24px 18px"><div class="empty-ico">${IC.user}</div><p>Be the first to report! Top reporters will appear here.</p></div>`;
}

function renderAccount() {
  const el = document.getElementById("authWrap");
  if (CU && PR) renderProfile(el);
  else if (CU && !PR) el.innerHTML = `<div class="loading-row"><div class="spin w"></div>Loading profile...</div>`;
  else renderAuthForm(el, "login");
}

const LOGO_IMG_TAG = `<img src="logo.jpg" alt="NEPAWatch" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;

function renderAuthForm(el, mode) {
  el.innerHTML = `<div class="auth-wrap">
    <div class="auth-logo">
      <div class="auth-logo-icon">${LOGO_IMG_TAG}</div>
      <span class="auth-logo-name">NEPA<em>Watch</em></span>
    </div>
    <h2>${mode === "login" ? "Welcome back" : mode === "forgot" ? "Reset password" : "Join NEPAWatch"}</h2>
    <p class="auth-sub">${mode === "login" ? "Sign in to report outages and get email alerts." : mode === "forgot" ? "Enter your email to receive a password reset link." : "Get free real-time power alerts for your Lagos street."}</p>
    <div class="msg err" id="authErr"></div><div class="msg ok" id="authOk"></div>
    ${mode === "register" ? `<div class="fld"><label>Your Name</label><input id="inp-name" type="text" placeholder="e.g. Chidi" autocomplete="name"></div>` : ""}
    <div class="fld"><label>Email</label><input id="inp-email" type="email" placeholder="you@example.com" autocomplete="email"></div>
    ${mode !== "forgot" ? `<div class="fld"><label>Password</label><input id="inp-pass" type="password" placeholder="Min 6 characters" autocomplete="${mode === "login" ? "current-password" : "new-password"}"></div>` : ""}
    <button class="auth-btn" id="authBtn" onclick="handleAuth('${mode}')">${mode === "login" ? "Sign In" : mode === "forgot" ? "Send Reset Link" : "Create Account"}</button>
    <div class="auth-switch">${mode === "login" ? `No account? <a onclick="renderAuthForm(document.getElementById('authWrap'),'register')">Register free</a><br><span style="display:block;margin-top:8px"><a onclick="renderAuthForm(document.getElementById('authWrap'),'forgot')">Forgot password?</a></span>` : mode === "register" ? `Have an account? <a onclick="renderAuthForm(document.getElementById('authWrap'),'login')">Sign in</a>` : `Remember it? <a onclick="renderAuthForm(document.getElementById('authWrap'),'login')">Back to sign in</a>`}</div>
  </div>`;
  setTimeout(() => {
    el.querySelectorAll("input").forEach(inp => inp.addEventListener("keydown", e => { if (e.key === "Enter") handleAuth(mode); }));
    document.getElementById("inp-email")?.focus();
  }, 80);
}

async function handleAuth(mode) {
  const errEl = document.getElementById("authErr"), okEl = document.getElementById("authOk"), btn = document.getElementById("authBtn");
  const email = (document.getElementById("inp-email")?.value || "").trim();
  const pass = document.getElementById("inp-pass")?.value || "";
  const name = (document.getElementById("inp-name")?.value || "").trim();
  errEl.classList.remove("show"); okEl.classList.remove("show");
  if (!email || !email.includes("@") || !email.includes(".")) { errEl.textContent = "Please enter a valid email address."; errEl.classList.add("show"); return; }
  if (mode !== "forgot" && pass.length < 6) { errEl.textContent = "Password must be at least 6 characters."; errEl.classList.add("show"); return; }
  if (mode === "register" && !name) { errEl.textContent = "Please enter your name."; errEl.classList.add("show"); return; }
  btn.innerHTML = `${mode === "login" ? "Signing in" : mode === "forgot" ? "Sending link" : "Creating account"}&nbsp;<span class="spin"></span>`; btn.disabled = true;
  try {
    if (mode === "register") {
      await doRegister(name, email, pass);
      okEl.textContent = "Account created! Check your email to confirm, then sign in."; okEl.classList.add("show");
      btn.innerHTML = "Create Account"; btn.disabled = false;
      setTimeout(() => renderAuthForm(document.getElementById("authWrap"), "login"), 2800);
    } else if (mode === "forgot") {
      await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname + "?mode=reset" });
      okEl.textContent = "Reset link sent! Check your inbox (and spam folder)."; okEl.classList.add("show");
      btn.innerHTML = "Send Reset Link"; btn.disabled = false;
    } else {
      await doLogin(email, pass);
    }
  } catch (e) {
    let msg = e.message || "Something went wrong.";
    if (msg.toLowerCase().includes("invalid login") || msg.toLowerCase().includes("invalid credentials")) msg = "Incorrect email or password. Please try again.";
    if (msg.toLowerCase().includes("email not confirmed")) msg = "Please confirm your email first — check your inbox.";
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("user already registered")) msg = "This email is already registered. Please sign in instead.";
    if (msg === "RATE_LIMIT" || msg.toLowerCase().includes("rate limit")) msg = "Too many sign-up attempts. Please wait about 1 hour before trying again.";
    errEl.textContent = msg; errEl.classList.add("show");
    btn.innerHTML = mode === "login" ? "Sign In" : mode === "forgot" ? "Send Reset Link" : "Create Account"; btn.disabled = false;
  }
}

function renderProfile(el) {
  const locText = PR.location_label || PR.location_name || "Not set";
  const notifOn = PR.notif_on !== false;
  const savedCount = savedPlaces.length;
  el.innerHTML = `<div class="ph"><h2>Account</h2><p>Manage your alerts and locations</p></div>
  <div class="profile-card">
    <div class="pc-top">
      <div class="pc-av">${(PR.name || "?")[0].toUpperCase()}</div>
      <div><div class="pc-name">${PR.name || "User"}</div><div class="pc-email">${PR.email || CU.email}</div></div>
    </div>
    <div class="pc-row">
      <div class="pc-rl-wrap">
        <div class="pc-ico"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1A3 3 0 0 0 4 4C4 7.5 7 12 7 12S10 7.5 10 4A3 3 0 0 0 7 1z" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="4" r="1.2" fill="currentColor"/></svg></div>
        <div><div class="pc-rl">Watching area</div><div class="pc-rs">${locText}</div></div>
      </div>
      ${PR.location_id ? `<button onclick="clearLoc()" style="font-size:.65rem;font-weight:600;color:var(--ink3);background:none;border:1px solid var(--bd);border-radius:6px;padding:4px 9px;cursor:pointer">Clear</button>` : ""}
    </div>
    <div class="pc-row">
      <div class="pc-rl-wrap">
        <div class="pc-ico"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 7L7 1.5L12.5 7V12.5H9V9H5V12.5H1.5V7Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></div>
        <div><div class="pc-rl">Saved Places</div><div class="pc-rs">${savedCount} place${savedCount !== 1 ? "s" : ""} saved</div></div>
      </div>
      <button onclick="go('myarea')" style="font-size:.65rem;font-weight:600;color:var(--p);background:var(--pp);border:1px solid var(--pb);border-radius:6px;padding:4px 9px;cursor:pointer">Manage</button>
    </div>
    <div class="pc-row">
      <div class="pc-rl-wrap">
        <div class="pc-ico"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M1 5L7 8.5L13 5" stroke="currentColor" stroke-width="1.3"/></svg></div>
        <div><div class="pc-rl">Email Alerts</div><div class="pc-rs">${notifOn ? "On — receiving alerts" : "Off — tap to enable"}</div></div>
      </div>
      <button class="toggle ${notifOn ? "on" : ""}" id="notifToggle" onclick="toggleNotif()"></button>
    </div>
    <div class="pc-row">
      <div class="pc-rl-wrap">
        <div class="pc-ico"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M1.5 13c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></div>
        <div><div class="pc-rl">Alert address</div><div class="pc-rs">${CU.email}</div></div>
      </div>
    </div>
    ${emailLog.length ? `<div class="email-log"><div class="email-log-hd">Recent Alerts Sent</div>${emailLog.map(e => `<div class="ei"><div class="ei-s">${e.subject}</div><div class="ei-m">${e.to} &middot; ${e.time}</div></div>`).join("")}</div>` : ""}
    <button class="logout-btn" onclick="doLogout()">Sign Out</button>
  </div>`;
}

/* ===== NAV ===== */
function go(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".ni").forEach(n => n.classList.remove("active"));
  const pg = document.getElementById(`page-${page}`);
  pg.classList.add("active"); pg.classList.remove("page-enter");
  void pg.offsetWidth; pg.classList.add("page-enter");
  document.getElementById(`nav-${page}`).classList.add("active");
  if (page === "myarea") renderMyArea();
  if (page === "community") renderCommunity();
  if (page === "account") renderAccount();
}

function render() { renderStats(); renderFeed("liveFeed"); renderDiscos(); }

/* ===== REALTIME ===== */
let _rtChannel = null;
let _recentAlerts = new Set();

function startRealtime() {
  try {
    if (_rtChannel) { try { sb.removeChannel(_rtChannel); } catch (e) {} }
    _rtChannel = sb.channel("realtime-reports-" + Date.now())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, payload => {
        try {
          const r = payload.new;
          if (!r || reports.find(x => String(x.id) === String(r.id))) return;
          reports.unshift({ id: String(r.id), name: String(r.location_name || ""), area: String(r.location_area || ""), type: String(r.type || ""), time: new Date(r.created_at).getTime(), confirms: Number(r.confirms) || 1, userId: r.user_id });
          if (reports.length > 100) reports.pop();
          render();
          if (_nearbyAreas.length) renderNearbyDashboard();
          renderSavedPlacesHome(); renderMyPlacesList();
          if (r.user_id && r.user_id !== CU?.id) {
            const alertKey = r.id + r.type;
            if (!_recentAlerts.has(alertKey)) { _recentAlerts.add(alertKey); setTimeout(() => _recentAlerts.delete(alertKey), 30000); sendAreaAlerts(r.location_name, r.location_area, r.type); }
          }
        } catch (e) {}
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reports" }, payload => {
        try {
          const r = payload.new; const existing = reports.find(x => String(x.id) === String(r.id));
          if (existing) { existing.confirms = Number(r.confirms) || 1; renderFeed("liveFeed"); renderFeed("myFeed", PR?.location_area || null); }
        } catch (e) {}
      })
      .subscribe();
  } catch (e) {}
}

async function shareApp() {
  const shareData = { title: "NEPAWatch Lagos — Live Power Tracker", text: "Know when light don go or come back in your Lagos area. Real-time crowd-sourced reports + email alerts. Free!", url: APP_URL };
  if (navigator.share) {
    try { await navigator.share(shareData); } catch (e) { if (e.name !== "AbortError") { try { await navigator.clipboard.writeText(APP_URL); toast("Link copied!", "ok"); } catch (ce) { toast(APP_URL, "info"); } } }
  } else {
    try { await navigator.clipboard.writeText(APP_URL); toast("Link copied!", "ok"); } catch (e) { toast(APP_URL + " — share this link", "info"); }
  }
}

/* ===== INIT ===== */
window.addEventListener("load", async () => {
  initTheme();
  buildFilter();

  /* Wire up modal close listeners */
  document.getElementById("repOverlay").addEventListener("click", e => { if (e.target === document.getElementById("repOverlay")) closeModal(); });
  document.getElementById("placeOverlay").addEventListener("click", e => { if (e.target === document.getElementById("placeOverlay")) closePlaceModal(); });

  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
  const isReset = (urlParams.get("mode") === "reset") || (hashParams.get("type") === "recovery");

  await initAuth();
  await Promise.all([loadReports(), loadCustomLocations()]);
  if (CU) loadSavedPlaces();
  loadUserCount();
  updateBanner();
  startRealtime();
  startPolling();
  renderMyArea();

  if (isReset) {
    go("account");
    setTimeout(() => {
      const el = document.getElementById("authWrap");
      el.innerHTML = `<div class="auth-wrap">
        <div class="auth-logo"><div class="auth-logo-icon" style="background:var(--p)">${LOGO_IMG_TAG}</div><span class="auth-logo-name">NEPA<em>Watch</em></span></div>
        <h2>Set new password</h2><p class="auth-sub">Choose a strong new password for your account.</p>
        <div class="msg err" id="authErr"></div><div class="msg ok" id="authOk"></div>
        <div class="fld"><label>New Password</label><input id="inp-newpass" type="password" placeholder="Min 6 characters" autocomplete="new-password"></div>
        <div class="fld"><label>Confirm Password</label><input id="inp-confpass" type="password" placeholder="Repeat password" autocomplete="new-password"></div>
        <button class="auth-btn" id="authBtn" onclick="doPasswordReset()">Update Password</button>
      </div>`;
    }, 500);
  }
});

async function doPasswordReset() {
  const errEl = document.getElementById("authErr"), okEl = document.getElementById("authOk"), btn = document.getElementById("authBtn");
  const np = (document.getElementById("inp-newpass")?.value || "").trim();
  const cp = (document.getElementById("inp-confpass")?.value || "").trim();
  errEl.classList.remove("show"); okEl.classList.remove("show");
  if (np.length < 6) { errEl.textContent = "Password must be at least 6 characters."; errEl.classList.add("show"); return; }
  if (np !== cp) { errEl.textContent = "Passwords do not match."; errEl.classList.add("show"); return; }
  btn.innerHTML = 'Updating&nbsp;<span class="spin"></span>'; btn.disabled = true;
  try {
    const { error } = await sb.auth.updateUser({ password: np });
    if (error) throw error;
    okEl.textContent = "Password updated! You are now signed in."; okEl.classList.add("show");
    btn.innerHTML = "Update Password"; btn.disabled = false;
    setTimeout(() => { window.history.replaceState({}, "", window.location.pathname); go("home"); }, 2000);
  } catch (e) {
    errEl.textContent = e.message || "Could not update password."; errEl.classList.add("show");
    btn.innerHTML = "Update Password"; btn.disabled = false;
  }
}
