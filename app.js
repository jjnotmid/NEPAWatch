/* ===== NEPAWatch Lagos — app.js ===== */
/* =========================================================
   INTEGRATION PATCHES for predict.js / AI auto-reporter
   Changes from original:
   1. renderFeed() — shows AI badge on AI-generated reports
   2. go()         — handles 'predict' page + calls renderPredictPage()
                     and renderMyAreaPredictWidget() for myarea
   3. renderCommunity() leaderboard — shows NEPAWatch AI entry
   4. window.load  — calls AIReporter.loadHistory() + AIReporter.start()
   ========================================================= */


const SUPA_URL = 'https://djurokbkkqrmpafcxlez.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdXJva2Jra3FybXBhZmN4bGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzE5OTUsImV4cCI6MjA4ODE0Nzk5NX0.ZLOtWFB7qy_J0mitjb_pcZ88wxmRjMe-3OdbQCRL8xE';
const EMAIL_FN = `${SUPA_URL}/functions/v1/send-alert`;
const APP_URL = 'https://nepawatch.app';
const APP_LOGO_URL = APP_URL + '/logo2.jpg';
const VAPID_PUBLIC_KEY = 'BCucUDvVmV6cHGeMRideIWul16t336GXMypUT4nYwIs5RRPNVtAy0h5D0diwOY56OTjDCRFyzZbXeaXRcCUTnqw';

/* ━━━ NIGERIA-WIDE COVERAGE ━━━ */
/* NEPAWatch now covers ALL of Nigeria — 36 states + FCT */
/* The old Lagos-only restriction has been removed.       */
const NIGERIA_BOUNDS = {latMin:4.27,latMax:13.89,lngMin:2.67,lngMax:14.68};
function isInNigeria(lat,lng){
  return lat>=NIGERIA_BOUNDS.latMin&&lat<=NIGERIA_BOUNDS.latMax&&
         lng>=NIGERIA_BOUNDS.lngMin&&lng<=NIGERIA_BOUNDS.lngMax;
}

function checkIfOutsideNigeria(){
  /* Only show the "outside Nigeria" message if clearly outside Nigeria */
  try{
    const saved=localStorage.getItem("nw_location_check");
    if(saved){
      const {result,ts}=JSON.parse(saved);
      if(Date.now()-ts<7*86400000&&(result==="nigeria"||result==="dismissed"))return;
    }
  }catch(e){}

  fetch("https://ipapi.co/json/",{signal:AbortSignal.timeout(5000)})
    .then(r=>r.json())
    .then(d=>{
      const lat=parseFloat(d.latitude);
      const lng=parseFloat(d.longitude);
      const country=(d.country_name||"").toLowerCase();
      if(country.includes("nigeria")||isInNigeria(lat,lng)){
        try{localStorage.setItem("nw_location_check",JSON.stringify({result:"nigeria",ts:Date.now()}));}catch(e){}
        return;
      }
      /* Outside Nigeria — show overlay */
      showOutsideNigeriaOverlay();
    })
    .catch(()=>{ /* silent — don't block app if geo fails */ });
}

function showOutsideNigeriaOverlay(){
  const el=document.getElementById("outsideLagosOverlay");
  if(el){
    /* Update text to say Nigeria instead of Lagos */
    const h2=el.querySelector('h2');
    if(h2)h2.textContent='Looks like you\'re outside Nigeria';
    const p=el.querySelector('p');
    if(p)p.textContent='NEPAWatch covers all of Nigeria — 36 states + FCT. If you believe this is an error, just continue.';
    el.style.display="flex";
  }
}

/* Legacy alias — kept for any HTML onclick references */
function showOutsideLagosOverlay(){ showOutsideNigeriaOverlay(); }

function oloDismiss(){
  const el=document.getElementById("outsideLagosOverlay");
  if(el)el.style.display="none";
  try{localStorage.setItem("nw_location_check",JSON.stringify({result:"dismissed",ts:Date.now()}));}catch(e){}
}

async function oloNotify(){
  const email=prompt("Enter your email for NEPAWatch updates:");
  if(!email||!email.includes("@"))return;
  try{
    await sb.from("outside_lagos_waitlist").insert({email,created_at:new Date().toISOString()}).maybeSingle();
  }catch(e){}
  try{localStorage.setItem("nw_location_check",JSON.stringify({result:"waitlist",ts:Date.now()}));}catch(e){}
  const el=document.getElementById("outsideLagosOverlay");
  if(el)el.style.display="none";
  toast("Thanks! We'll keep you updated.","ok");
}




function appTogglePw(btn){
  const inp=btn.previousElementSibling||btn.parentElement.querySelector('input');
  if(!inp)return;
  const show=inp.type==='password';
  inp.type=show?'text':'password';
  btn.innerHTML=show?'<svg width=\\"16\\" height=\\"16\\" viewBox=\\"0 0 16 16\\" fill=\\"none\\"><path d=\\"M1 8C2.5 5 5 3.5 8 3.5C11 3.5 13.5 5 15 8C13.5 11 11 12.5 8 12.5C5 12.5 2.5 11 1 8Z\\" stroke=\\"currentColor\\" stroke-width=\\"1.3\\"/><circle cx=\\"8\\" cy=\\"8\\" r=\\"2.2\\" stroke=\\"currentColor\\" stroke-width=\\"1.3\\"/><path d=\\"M2 2L14 14\\" stroke=\\"currentColor\\" stroke-width=\\"1.3\\" stroke-linecap=\\"round\\"/></svg>':'<svg width=\\"16\\" height=\\"16\\" viewBox=\\"0 0 16 16\\" fill=\\"none\\"><path d=\\"M1 8C2.5 5 5 3.5 8 3.5C11 3.5 13.5 5 15 8C13.5 11 11 12.5 8 12.5C5 12.5 2.5 11 1 8Z\\" stroke=\\"currentColor\\" stroke-width=\\"1.3\\"/><circle cx=\\"8\\" cy=\\"8\\" r=\\"2.2\\" stroke=\\"currentColor\\" stroke-width=\\"1.3\\"/></svg>';
  inp.focus();
}


const sb = supabase.createClient(SUPA_URL, SUPA_ANON, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});

const LAGOS = {
  "Ikeja GRA": [
    "Isaac John Street", "Oduduwa Crescent", "Joel Ogunnaike Street", "Oba Akinjobi Road",
    "Aromire Avenue", "Mobolaji Bank Anthony Way", "Adeniyi Jones Avenue", "Rev Ogunbiyi Street",
    "Olowopo Street", "Sobo Arobiodu Street", "Adebayo Doherty Street", "Akin Ogunlewe Road",
    "Olatunde Ayoola Avenue", "Fola Osibo Street", "Remi Fani-Kayode Street", "Olu Holloway Street",
    "Simpson Street", "Oduduwa Way", "Adeniran Ogunsanya Street", "Oba Dosumu Street",
    "Ogunlana Drive", "Akin Adesola Street", "Kofo Abayomi Street", "Ademola Adetokunbo Street",
    "Sanusi Fafunwa Street", "Ligali Ayorinde Street", "Idejo Street", "Ahmadu Bello Way",
    "Ozumba Mbadiwe Avenue", "Marina", "Broad Street", "Nnamdi Azikiwe Street", "Balogun Street",
    "Ereko Street", "Idumota", "Tinubu Square", "Odunlami Street", "Creek Road", "Liverpool Road",
    "Commercial Avenue", "Marine Road", "Apapa GRA", "Burma Road", "Wharf Road", "Sifax Terminal Road",
    "Iganmu Road", "Eric Moore Road", "Ijora Causeway", "Ijora 7Up", "Costain", "Malu Road",
    "Bode Thomas Street", "Ojuelegba Road", "Akerele Street", "Lawanson Road", "Itire Road",
    "Tejuosho Road", "Herbert Macaulay Way", "Iwaya Road", "Makoko Road", "Sabo Road",
    "Jibowu Street", "Oyingbo Market Road", "Otto Road", "Apapa Road", "Ikorodu Road",
    "Murtala Muhammed Way", "Herbert Macaulay Street", "Liberty Road", "Fagba Road",
    "Oba Ogunji Road", "Ogudu Road", "Ketu Road", "Alapere Road", "Agboyi Road", "Owode Onirin",
    "Ikorodu – Sagamu Road", "Lagos Road", "Itamaga Road", "Imota Road", "Ijede Road", "Gbara Road",
    "Agric Road", "Ikorodu GRA", "Benson Road", "Majolagba Street", "Ogunmodede Street",
    "Akarigbo Street", "Shagari Quarters", "Odogunyan", "Iyesi", "Ota Road", "Idiroko Road",
    "Sango Road", "Ijoko Road", "Atan Road", "Ado Odo Road", "Ilogbo Road", "Igbesa Road",
    "Oju Ore Road", "Agbara Estate Road", "Lusada Road", "Alagbole Road", "Akute Road",
    "Lambe Road", "Oke Aro Road", "Araromi", "Ojodu Berger", "Isheri Road", "Magodo Phase 1",
    "Magodo Phase 2", "Ketu Alapere", "Kosofe Road", "Ogudu GRA", "Oworonshoki", "Akoka",
    "Unilag Road", "Fadeyi", "Onipanu", "Palmgrove", "Anthony Village", "Gbagada Phase 1",
    "Gbagada Phase 2", "Ifako", "Soluyi", "Bariga", "Somolu", "Pedro", "Ilupeju Estate",
    "Oregun Road", "Alausa", "Coca Cola Road", "Akin Ogunlewe", "Agidingbi", "Computer Village",
    "Allen Avenue", "Opebi Road", "Toyin Street", "Oregun Industrial Scheme", "Alausa Secretariat",
    "Mobolaji Johnson Avenue", "Kudirat Abiola Way", "Salvation Road", "Lateef Jakande Road",
    "Aromire", "Oduduwa", "Sobo Arobiodu", "Joel Ogunnaike", "Isaac John", "Adeniyi Jones",
    "Acme Road", "Abeokuta Expressway", "Command Road", "Ogba", "Ifako", "Iju Road",
    "Water Works Road", "Agege Motor Road", "Old Abeokuta Road", "Pen Cinema", "Dopemu",
    "Orile Agege", "Papa Ajao", "Abule Egba", "Iyana Ipaja", "Egbe Road", "Idimu Road",
    "Akowonjo Road", "Shasha Road", "Baruwa Road", "Igando Road", "Ayobo Road", "Ikotun Road",
    "Ilasamaja", "Ejigbo Road", "Ago Palace Way", "Okota Road", "Isolo Road", "Ajao Estate",
    "Mafoluku", "Oshodi Market", "Oshodi B/Stop", "Bolade", "International Airport Road",
    "Mile 2", "Amuwo Odofin", "Festac Town 1st Avenue", "Festac Town 2nd Avenue",
    "Festac Town 7th Avenue", "Festac Town 21 Road", "Festac Town 22 Road", "Alakija",
    "Kirikiri", "Satellite Town", "Ibeshe", "Iba", "Okokomaiko", "Agboju", "Trade Fair",
    "Ojo Road", "Alaba International", "Volkswagen Road", "Navy Town", "LASU Road",
    "Iba New Site", "Badagry Expressway", "Seme Border", "Ajangbadi", "Topo", "Gberigbe",
    "Ilogbo Eremi", "Iworo", "Kankon", "Mowo", "Oko Afo", "Oto Awori", "Palaver Island",
    "Lakowe", "Eputu", "Ibeju", "Awoyaya", "Bogije", "Abijo", "Iwerekun", "Orchid Road",
    "Abraham Adesanya", "Osapa London", "Ikate", "Elegushi", "Oniru", "Lekki Conservation Centre",
    "Adeniyi Jones", "Adekunle", "Adekunle Kuye", "Adeniji", "Adeola Odeku", "Admiralty Way",
    "Fola Osibo", "Omorinre Johnson", "Bisola Durosinmi-Etti", "Adebayo Doherty", "Freedom Way",
    "T.F. Kuboye", "Jakande Lekki", "Lekki Phase 1", "Lekki Phase 2", "Ikota", "Chevron",
    "Mobil Road", "Eleko", "Lagos Business School", "Pan-Atlantic University", "Eko Atlantic",
    "Maroko", "Kuramo", "Bar Beach", "Ahmadu Bello Way", "Kofo Abayomi", "Ademola Adetokunbo",
    "Sanusi Fafunwa", "Ligali Ayorinde", "Idejo", "Akin Adesola", "Ozumba Mbadiwe", "Oniru",
    "Victoria Island Extension", "Dolphin Estate", "Banana Island", "Parkview", "Bourdillon",
    "Osborne", "Alexander Road", "Kingsway Road", "Gerrard Road", "Glover Road", "Ribadu Road",
    "Milverton Road", "Thompson Avenue", "Maclever Street", "Davies Street", "Martin Street",
    "Creek Road", "Campbell Street", "Force Road", "Police Road", "Murtala Muhammed Square",
    "Eko Bridge Approach", "Igbosere", "Obalende", "Race Course", "Adeniji Adele", "Olowogbowo",
    "Idumagbo", "Ebute Ero", "Marina", "Tinubu", "Balogun", "Nnamdi Azikiwe", "Broad Street",
    "Odunlami", "Apongbon", "Bamgbose", "Ebute Metta", "Oyingbo", "Otto", "Iponri", "Eldon",
    "Oyingbo Market", "Yaba", "Akoka", "Jibowu", "Abule Ijesha", "Iwaya", "Makoko", "Unilag",
    "FCE Akoka", "Anthony", "Maryland", "Mende", "Onigbongbo", "Palmgrove", "Onipanu", "Fadeyi",
    "Bariga", "Shomolu", "Pedro", "Gbagada", "Ifako", "Ketu", "Alapere", "Ogudu", "Oworonshoki",
    "Ojota", "Oregun", "Opebi", "Allen", "Alausa", "Ikeja", "Oba Akran", "Kudirat Abiola",
    "Obafemi Awolowo", "Mobolaji Bank Anthony", "Adeniyi Jones", "Acme", "Ogba", "Iju", "Agege",
    "Dopemu", "Abule Egba", "Iyana Ipaja", "Egbe", "Idimu", "Akowonjo", "Shasha", "Baruwa",
    "Igando", "Ikotun", "Ilasamaja", "Ejigbo", "Ago Palace", "Okota", "Isolo", "Ajao Estate",
    "Mafoluku", "Oshodi", "Bolade", "International Airport", "Mile 2", "Amuwo", "Festac",
    "Alakija", "Kirikiri", "Satellite", "Iba", "Okokomaiko", "Agboju", "Trade Fair", "Ojo",
    "Alaba", "Volkswagen", "Navy Town", "LASU", "Badagry", "Seme", "Ajangbadi", "Topo",
    "Ilogbo Eremi", "Iworo", "Lakowe", "Eputu", "Ibeju", "Awoyaya", "Bogije", "Abijo",
    "Iwerekun", "Orchid", "Abraham Adesanya", "Osapa", "Ikate", "Elegushi", "Oniru", "LCCI",
    "Eleko", "LBS", "Landmark Towers", "Nestoil", "Addax", "Total", "NNPC", "Mobil House",
    "UBA House", "Zenith Heights", "Heritage Place", "Eko Tower", "Union Marble House",
    "Civic Centre", "Muson Centre", "Silverbird", "Eko Hotel", "Federal Palace", "Four Points",
    "Wheatbaker", "Lagos Oriental", "Raddison Blu", "Ikeja City Mall", "Maryland Mall",
    "Lekki Phase 1 Market", "Ajah Market", "Ikorodu Garage", "Oyingbo Market", "Mile 12 Market",
    "Oshodi Market", "Alaba Market", "Idumota Market", "Balogun Market", "Murtala Muhammed Airport",
    "MMA Terminal 1", "MMA Terminal 2", "General Aviation Terminal", "D Wing", "Cargo Terminal",
    "Nigerian Air Force Base", "NAF Base", "Ikeja Cantonment", "Ojo Cantonment", "Dodan Barracks",
    "Bonny Camp", "Lagos State Secretariat", "Alausa Secretariat", "Lagos State House of Assembly",
    "Lagos High Court", "Ikeja High Court", "Federal High Court Lagos", "Lagos Island Maternity",
    "LUTH", "Gbagada General Hospital", "Ikeja General Hospital", "Ajah General Hospital",
    "Badagry General Hospital", "Ikorodu General Hospital", "Reddington Hospital", "Eko Hospital",
    "St. Nicholas Hospital", "First Cardiology", "Hepworth Hospital", "Lagoon Hospitals",
    "Vedic Hospital", "Bridgewater Clinic", "St. Ives Hospital", "St. Kizito Clinic",
    "Lily Hospital", "Mayo Clinic", "Lagos State University Teaching Hospital", "LASUTH",
    "National Orthopaedic Hospital", "Federal Neuro-Psychiatric Hospital", "Yaba College of Technology",
    "YABATECH", "University of Lagos", "UNILAG", "Lagos State University", "LASU",
    "Pan-Atlantic University", "Caleb University", "Babcock University", "Covenant University",
    "Nigerian Law School", "Nigerian Institute of Journalism", "Lagos City Polytechnic",
    "Lagos Business School", "LBS", "Queens College", "King's College", "St. Gregory's College",
    "CMS Grammar School", "Igbobi College", "Methodist Boys High School", "Holy Child College",
    "Federal Government College", "FGC Ijanikin", "Air Force Secondary School", "Navy Secondary School",
    "Lagos State Model College", "Model College Badagry", "Model College Kankon",
    "Lagos State Junior Model College", "Igbogbo", "Model College Igbogbo",
    "Lagos State Senior Model College", "Igbogbo", "Model College Meiran",
    "Lagos State University International School", "LASU IS", "University of Lagos International School",
    "UNILAG IS", "Dowen College", "Greensprings School", "Chrisland School", "Corona School",
    "Whittington School", "British International School", "Lagos Preparatory School",
    "Avi-Cenna School", "Halifield School", "Children International School", "CIS",
    "Loyola Jesuit College", "St. Saviour's School", "St. Mary's School", "St. Paul's School",
    "Archbishop Vining Memorial Church", "AVM", "Cathedral Church of Christ", "Holy Cross Cathedral"
  ],
  "Ikeja (Allen/Opebi)": [
    "Allen Avenue", "Toyin Street", "Opebi Road", "Oregun Road", "Obafemi Awolowo Way",
    "Computer Village", "Alausa Secretariat", "Agidingbi Road", "Lateef Jakande Road",
    "Mobolaji Johnson Avenue", "Kudirat Abiola Way", "Salvation Road", "Opebi Link Road",
    "Opebi Crescent", "Fatai Atere Way", "Oduduwa Crescent", "Aromire Street", "Ogundana Street",
    "Oduduwa Way", "Simpson Street", "Fola Osibo Street", "Remi Fani-Kayode Street",
    "Olu Holloway Street", "Adebayo Doherty Street", "Akin Ogunlewe Road", "Olatunde Ayoola Avenue",
    "Joel Ogunnaike Street", "Isaac John Street", "Adeniyi Jones Avenue", "Oba Akinjobi Road",
    "Sobo Arobiodu Street", "Olowopo Street", "Rev Ogunbiyi Street", "Oduduwa Crescent",
    "Mobolaji Bank Anthony Way", "Aromire Avenue", "Alausa", "Coca Cola Road", "Akin Ogunlewe",
    "Agidingbi", "Computer Village", "Oregun Industrial Scheme", "Alausa Secretariat",
    "Mobolaji Johnson Avenue", "Kudirat Abiola Way", "Salvation Road", "Lateef Jakande Road",
    "Aromire", "Oduduwa", "Sobo Arobiodu", "Joel Ogunnaike", "Isaac John", "Adeniyi Jones",
    "Acme Road", "Abeokuta Expressway", "Command Road", "Ogba", "Ifako", "Iju Road",
    "Water Works Road", "Agege Motor Road", "Old Abeokuta Road", "Pen Cinema", "Dopemu",
    "Orile Agege", "Papa Ajao", "Abule Egba", "Iyana Ipaja", "Egbe Road", "Idimu Road",
    "Akowonjo Road", "Shasha Road", "Baruwa Road", "Igando Road", "Ayobo Road", "Ikotun Road",
    "Ilasamaja", "Ejigbo Road", "Ago Palace Way", "Okota Road", "Isolo Road", "Ajao Estate",
    "Mafoluku", "Oshodi Market", "Oshodi B/Stop", "Bolade", "International Airport Road",
    "Mile 2", "Amuwo Odofin", "Festac Town 1st Avenue", "Festac Town 2nd Avenue",
    "Festac Town 7th Avenue", "Festac Town 21 Road", "Festac Town 22 Road", "Alakija",
    "Kirikiri", "Satellite Town", "Ibeshe", "Iba", "Okokomaiko", "Agboju", "Trade Fair",
    "Ojo Road", "Alaba International", "Volkswagen Road", "Navy Town", "LASU Road",
    "Iba New Site", "Badagry Expressway", "Seme Border", "Ajangbadi", "Topo", "Gberigbe",
    "Ilogbo Eremi", "Iworo", "Kankon", "Mowo", "Oko Afo", "Oto Awori", "Palaver Island",
    "Lakowe", "Eputu", "Ibeju", "Awoyaya", "Bogije", "Abijo", "Iwerekun", "Orchid Road",
    "Abraham Adesanya", "Osapa London", "Ikate", "Elegushi", "Oniru", "Lekki Conservation Centre",
    "Adeniyi Jones", "Adekunle", "Adekunle Kuye", "Adeniji", "Adeola Odeku", "Admiralty Way",
    "Fola Osibo", "Omorinre Johnson", "Bisola Durosinmi-Etti", "Adebayo Doherty", "Freedom Way",
    "T.F. Kuboye", "Jakande Lekki", "Lekki Phase 1", "Lekki Phase 2", "Ikota", "Chevron",
    "Mobil Road", "Eleko", "Lagos Business School", "Pan-Atlantic University", "Eko Atlantic",
    "Maroko", "Kuramo", "Bar Beach", "Ahmadu Bello Way", "Kofo Abayomi", "Ademola Adetokunbo",
    "Sanusi Fafunwa", "Ligali Ayorinde", "Idejo", "Akin Adesola", "Ozumba Mbadiwe", "Oniru",
    "Victoria Island Extension", "Dolphin Estate", "Banana Island", "Parkview", "Bourdillon",
    "Osborne", "Alexander Road", "Kingsway Road", "Gerrard Road", "Glover Road", "Ribadu Road",
    "Milverton Road", "Thompson Avenue", "Maclever Street", "Davies Street", "Martin Street",
    "Creek Road", "Campbell Street", "Force Road", "Police Road", "Murtala Muhammed Square",
    "Eko Bridge Approach", "Igbosere", "Obalende", "Race Course", "Adeniji Adele", "Olowogbowo",
    "Idumagbo", "Ebute Ero", "Marina", "Tinubu", "Balogun", "Nnamdi Azikiwe", "Broad Street",
    "Odunlami", "Apongbon", "Bamgbose", "Ebute Metta", "Oyingbo", "Otto", "Iponri", "Eldon",
    "Oyingbo Market", "Yaba", "Akoka", "Jibowu", "Abule Ijesha", "Iwaya", "Makoko", "Unilag",
    "FCE Akoka", "Anthony", "Maryland", "Mende", "Onigbongbo", "Palmgrove", "Onipanu", "Fadeyi",
    "Bariga", "Shomolu", "Pedro", "Gbagada", "Ifako", "Ketu", "Alapere", "Ogudu", "Oworonshoki",
    "Ojota", "Oregun", "Opebi", "Allen", "Alausa", "Ikeja", "Oba Akran", "Kudirat Abiola",
    "Obafemi Awolowo", "Mobolaji Bank Anthony", "Adeniyi Jones", "Acme", "Ogba", "Iju", "Agege",
    "Dopemu", "Abule Egba", "Iyana Ipaja", "Egbe", "Idimu", "Akowonjo", "Shasha", "Baruwa",
    "Igando", "Ikotun", "Ilasamaja", "Ejigbo", "Ago Palace", "Okota", "Isolo", "Ajao Estate",
    "Mafoluku", "Oshodi", "Bolade", "International Airport", "Mile 2", "Amuwo", "Festac",
    "Alakija", "Kirikiri", "Satellite", "Iba", "Okokomaiko", "Agboju", "Trade Fair", "Ojo",
    "Alaba", "Volkswagen", "Navy Town", "LASU", "Badagry", "Seme", "Ajangbadi", "Topo",
    "Ilogbo Eremi", "Iworo", "Lakowe", "Eputu", "Ibeju", "Awoyaya", "Bogije", "Abijo",
    "Iwerekun", "Orchid", "Abraham Adesanya", "Osapa", "Ikate", "Elegushi", "Oniru", "LCCI",
    "Eleko", "LBS", "Landmark Towers", "Nestoil", "Addax", "Total", "NNPC", "Mobil House",
    "UBA House", "Zenith Heights", "Heritage Place", "Eko Tower", "Union Marble House",
    "Civic Centre", "Muson Centre", "Silverbird", "Eko Hotel", "Federal Palace", "Four Points",
    "Wheatbaker", "Lagos Oriental", "Raddison Blu", "Ikeja City Mall", "Maryland Mall",
    "Lekki Phase 1 Market", "Ajah Market", "Ikorodu Garage", "Oyingbo Market", "Mile 12 Market",
    "Oshodi Market", "Alaba Market", "Idumota Market", "Balogun Market", "Murtala Muhammed Airport",
    "MMA Terminal 1", "MMA Terminal 2", "General Aviation Terminal", "D Wing", "Cargo Terminal",
    "Nigerian Air Force Base", "NAF Base", "Ikeja Cantonment", "Ojo Cantonment", "Dodan Barracks",
    "Bonny Camp", "Lagos State Secretariat", "Alausa Secretariat", "Lagos State House of Assembly",
    "Lagos High Court", "Ikeja High Court", "Federal High Court Lagos", "Lagos Island Maternity",
    "LUTH", "Gbagada General Hospital", "Ikeja General Hospital", "Ajah General Hospital",
    "Badagry General Hospital", "Ikorodu General Hospital", "Reddington Hospital", "Eko Hospital",
    "St. Nicholas Hospital", "First Cardiology", "Hepworth Hospital", "Lagoon Hospitals",
    "Vedic Hospital", "Bridgewater Clinic", "St. Ives Hospital", "St. Kizito Clinic",
    "Lily Hospital", "Mayo Clinic", "Lagos State University Teaching Hospital", "LASUTH",
    "National Orthopaedic Hospital", "Federal Neuro-Psychiatric Hospital", "Yaba College of Technology",
    "YABATECH", "University of Lagos", "UNILAG", "Lagos State University", "LASU",
    "Pan-Atlantic University", "Caleb University", "Babcock University", "Covenant University",
    "Nigerian Law School", "Nigerian Institute of Journalism", "Lagos City Polytechnic",
    "Lagos Business School", "LBS", "Queens College", "King's College", "St. Gregory's College",
    "CMS Grammar School", "Igbobi College", "Methodist Boys High School", "Holy Child College",
    "Federal Government College", "FGC Ijanikin", "Air Force Secondary School", "Navy Secondary School",
    "Lagos State Model College", "Model College Badagry", "Model College Kankon",
    "Lagos State Junior Model College", "Igbogbo", "Model College Igbogbo",
    "Lagos State Senior Model College", "Igbogbo", "Model College Meiran",
    "Lagos State University International School", "LASU IS", "University of Lagos International School",
    "UNILAG IS", "Dowen College", "Greensprings School", "Chrisland School", "Corona School",
    "Whittington School", "British International School", "Lagos Preparatory School",
    "Avi-Cenna School", "Halifield School", "Children International School", "CIS",
    "Loyola Jesuit College", "St. Saviour's School", "St. Mary's School", "St. Paul's School",
    "Archbishop Vining Memorial Church", "AVM", "Cathedral Church of Christ", "Holy Cross Cathedral"
  ],
  "Maryland/Anthony": [
    "Anthony Village", "Ikorodu Road", "Palmgrove Estate", "Onipanu Street", "Jibowu Street",
    "Oworonshoki Expressway", "Cemetery Road", "Gani Fawehinmi Way", "Ikosi Road",
    "Anthony Oke", "Anthony Bus Stop", "Ikorodu Road Maryland", "Anthony Metropolis",
    "Fashoro Street", "Fagbola Street", "Oseni Street", "Akintola Street", "Bamgbose Street",
    "Ogunbiyi Street", "Adeyemi Street", "Lawal Street", "Shitta Street", "Ogunlana Street",
    "Opebi Road", "Oregun Road", "Obafemi Awolowo Way", "Computer Village", "Alausa Secretariat",
    "Agidingbi Road", "Lateef Jakande Road", "Mobolaji Johnson Avenue", "Kudirat Abiola Way",
    "Salvation Road", "Opebi Link Road", "Opebi Crescent", "Fatai Atere Way", "Oduduwa Crescent",
    "Aromire Street", "Ogundana Street", "Oduduwa Way", "Simpson Street", "Fola Osibo Street",
    "Remi Fani-Kayode Street", "Olu Holloway Street", "Adebayo Doherty Street", "Akin Ogunlewe Road",
    "Olatunde Ayoola Avenue", "Joel Ogunnaike Street", "Isaac John Street", "Adeniyi Jones Avenue",
    "Oba Akinjobi Road", "Sobo Arobiodu Street", "Olowopo Street", "Rev Ogunbiyi Street",
    "Oduduwa Crescent", "Mobolaji Bank Anthony Way", "Aromire Avenue", "Alausa", "Coca Cola Road",
    "Akin Ogunlewe", "Agidingbi", "Computer Village", "Oregun Industrial Scheme", "Alausa Secretariat",
    "Mobolaji Johnson Avenue", "Kudirat Abiola Way", "Salvation Road", "Lateef Jakande Road",
    "Aromire", "Oduduwa", "Sobo Arobiodu", "Joel Ogunnaike", "Isaac John", "Adeniyi Jones",
    "Acme Road", "Abeokuta Expressway", "Command Road", "Ogba", "Ifako", "Iju Road",
    "Water Works Road", "Agege Motor Road", "Old Abeokuta Road", "Pen Cinema", "Dopemu",
    "Orile Agege", "Papa Ajao", "Abule Egba", "Iyana Ipaja", "Egbe Road", "Idimu Road",
    "Akowonjo Road", "Shasha Road", "Baruwa Road", "Igando Road", "Ayobo Road", "Ikotun Road",
    "Ilasamaja", "Ejigbo Road", "Ago Palace Way", "Okota Road", "Isolo Road", "Ajao Estate",
    "Mafoluku", "Oshodi Market", "Oshodi B/Stop", "Bolade", "International Airport Road",
    "Mile 2", "Amuwo Odofin", "Festac Town 1st Avenue", "Festac Town 2nd Avenue",
    "Festac Town 7th Avenue", "Festac Town 21 Road", "Festac Town 22 Road", "Alakija",
    "Kirikiri", "Satellite Town", "Ibeshe", "Iba", "Okokomaiko", "Agboju", "Trade Fair",
    "Ojo Road", "Alaba International", "Volkswagen Road", "Navy Town", "LASU Road",
    "Iba New Site", "Badagry Expressway", "Seme Border", "Ajangbadi", "Topo", "Gberigbe",
    "Ilogbo Eremi", "Iworo", "Kankon", "Mowo", "Oko Afo", "Oto Awori", "Palaver Island",
    "Lakowe", "Eputu", "Ibeju", "Awoyaya", "Bogije", "Abijo", "Iwerekun", "Orchid Road",
    "Abraham Adesanya", "Osapa London", "Ikate", "Elegushi", "Oniru", "Lekki Conservation Centre",
    "Adeniyi Jones", "Adekunle", "Adekunle Kuye", "Adeniji", "Adeola Odeku", "Admiralty Way",
    "Fola Osibo", "Omorinre Johnson", "Bisola Durosinmi-Etti", "Adebayo Doherty", "Freedom Way",
    "T.F. Kuboye", "Jakande Lekki", "Lekki Phase 1", "Lekki Phase 2", "Ikota", "Chevron",
    "Mobil Road", "Eleko", "Lagos Business School", "Pan-Atlantic University", "Eko Atlantic",
    "Maroko", "Kuramo", "Bar Beach", "Ahmadu Bello Way", "Kofo Abayomi", "Ademola Adetokunbo",
    "Sanusi Fafunwa", "Ligali Ayorinde", "Idejo", "Akin Adesola", "Ozumba Mbadiwe", "Oniru",
    "Victoria Island Extension", "Dolphin Estate", "Banana Island", "Parkview", "Bourdillon",
    "Osborne", "Alexander Road", "Kingsway Road", "Gerrard Road", "Glover Road", "Ribadu Road",
    "Milverton Road", "Thompson Avenue", "Maclever Street", "Davies Street", "Martin Street",
    "Creek Road", "Campbell Street", "Force Road", "Police Road", "Murtala Muhammed Square",
    "Eko Bridge Approach", "Igbosere", "Obalende", "Race Course", "Adeniji Adele", "Olowogbowo",
    "Idumagbo", "Ebute Ero", "Marina", "Tinubu", "Balogun", "Nnamdi Azikiwe", "Broad Street",
    "Odunlami", "Apongbon", "Bamgbose", "Ebute Metta", "Oyingbo", "Otto", "Iponri", "Eldon",
    "Oyingbo Market", "Yaba", "Akoka", "Jibowu", "Abule Ijesha", "Iwaya", "Makoko", "Unilag",
    "FCE Akoka", "Anthony", "Maryland", "Mende", "Onigbongbo", "Palmgrove", "Onipanu", "Fadeyi",
    "Bariga", "Shomolu", "Pedro", "Gbagada", "Ifako", "Ketu", "Alapere", "Ogudu", "Oworonshoki",
    "Ojota", "Oregun", "Opebi", "Allen", "Alausa", "Ikeja", "Oba Akran", "Kudirat Abiola",
    "Obafemi Awolowo", "Mobolaji Bank Anthony", "Adeniyi Jones", "Acme", "Ogba", "Iju", "Agege",
    "Dopemu", "Abule Egba", "Iyana Ipaja", "Egbe", "Idimu", "Akowonjo", "Shasha", "Baruwa",
    "Igando", "Ikotun", "Ilasamaja", "Ejigbo", "Ago Palace", "Okota", "Isolo", "Ajao Estate",
    "Mafoluku", "Oshodi", "Bolade", "International Airport", "Mile 2", "Amuwo", "Festac",
    "Alakija", "Kirikiri", "Satellite", "Iba", "Okokomaiko", "Agboju", "Trade Fair", "Ojo",
    "Alaba", "Volkswagen", "Navy Town", "LASU", "Badagry", "Seme", "Ajangbadi", "Topo",
    "Ilogbo Eremi", "Iworo", "Lakowe", "Eputu", "Ibeju", "Awoyaya", "Bogije", "Abijo",
    "Iwerekun", "Orchid", "Abraham Adesanya", "Osapa", "Ikate", "Elegushi", "Oniru", "LCCI",
    "Eleko", "LBS", "Landmark Towers", "Nestoil", "Addax", "Total", "NNPC", "Mobil House",
    "UBA House", "Zenith Heights", "Heritage Place", "Eko Tower", "Union Marble House",
    "Civic Centre", "Muson Centre", "Silverbird", "Eko Hotel", "Federal Palace", "Four Points",
    "Wheatbaker", "Lagos Oriental", "Raddison Blu", "Ikeja City Mall", "Maryland Mall",
    "Lekki Phase 1 Market", "Ajah Market", "Ikorodu Garage", "Oyingbo Market", "Mile 12 Market",
    "Oshodi Market", "Alaba Market", "Idumota Market", "Balogun Market", "Murtala Muhammed Airport",
    "MMA Terminal 1", "MMA Terminal 2", "General Aviation Terminal", "D Wing", "Cargo Terminal",
    "Nigerian Air Force Base", "NAF Base", "Ikeja Cantonment", "Ojo Cantonment", "Dodan Barracks",
    "Bonny Camp", "Lagos State Secretariat", "Alausa Secretariat", "Lagos State House of Assembly",
    "Lagos High Court", "Ikeja High Court", "Federal High Court Lagos", "Lagos Island Maternity",
    "LUTH", "Gbagada General Hospital", "Ikeja General Hospital", "Ajah General Hospital",
    "Badagry General Hospital", "Ikorodu General Hospital", "Reddington Hospital", "Eko Hospital",
    "St. Nicholas Hospital", "First Cardiology", "Hepworth Hospital", "Lagoon Hospitals",
    "Vedic Hospital", "Bridgewater Clinic", "St. Ives Hospital", "St. Kizito Clinic",
    "Lily Hospital", "Mayo Clinic", "Lagos State University Teaching Hospital", "LASUTH",
    "National Orthopaedic Hospital", "Federal Neuro-Psychiatric Hospital", "Yaba College of Technology",
    "YABATECH", "University of Lagos", "UNILAG", "Lagos State University", "LASU",
    "Pan-Atlantic University", "Caleb University", "Babcock University", "Covenant University",
    "Nigerian Law School", "Nigerian Institute of Journalism", "Lagos City Polytechnic",
    "Lagos Business School", "LBS", "Queens College", "King's College", "St. Gregory's College",
    "CMS Grammar School", "Igbobi College", "Methodist Boys High School", "Holy Child College",
    "Federal Government College", "FGC Ijanikin", "Air Force Secondary School", "Navy Secondary School",
    "Lagos State Model College", "Model College Badagry", "Model College Kankon",
    "Lagos State Junior Model College", "Igbogbo", "Model College Igbogbo",
    "Lagos State Senior Model College", "Igbogbo", "Model College Meiran",
    "Lagos State University International School", "LASU IS", "University of Lagos International School",
    "UNILAG IS", "Dowen College", "Greensprings School", "Chrisland School", "Corona School",
    "Whittington School", "British International School", "Lagos Preparatory School",
    "Avi-Cenna School", "Halifield School", "Children International School", "CIS",
    "Loyola Jesuit College", "St. Saviour's School", "St. Mary's School", "St. Paul's School",
    "Archbishop Vining Memorial Church", "AVM", "Cathedral Church of Christ", "Holy Cross Cathedral"
  ],
  "Ogba": [
    "Ogba Estate", "Ifako Road", "Command Road", "Abeokuta Expressway", "Ijaiye Road",
    "Acme Road", "MCC Road", "Ogba Bus Stop", "Ogba Market", "Ogba Ijaiye",
    "Iju Road", "Water Works Road", "Agege Motor Road", "Old Abeokuta Road",
    "Pen Cinema", "Dopemu", "Orile Agege", "Papa Ajao", "Abule Egba", "Iyana Ipaja",
    "Egbe Road", "Idimu Road", "Akowonjo Road", "Shasha Road", "Baruwa Road",
    "Igando Road", "Ayobo Road", "Ikotun Road", "Ilasamaja", "Ejigbo Road",
    "Ago Palace Way", "Okota Road", "Isolo Road", "Ajao Estate", "Mafoluku",
    "Oshodi Market", "Oshodi B/Stop", "Bolade", "International Airport Road",
    "Mile 2", "Amuwo Odofin", "Festac Town 1st Avenue", "Festac Town 2nd Avenue",
    "Festac Town 7th Avenue", "Festac Town 21 Road", "Festac Town 22 Road", "Alakija",
    "Kirikiri", "Satellite Town", "Ibeshe", "Iba", "Okokomaiko", "Agboju", "Trade Fair",
    "Ojo Road", "Alaba International", "Volkswagen Road", "Navy Town", "LASU Road",
    "Iba New Site", "Badagry Expressway", "Seme Border", "Ajangbadi", "Topo", "Gberigbe",
    "Ilogbo Eremi", "Iworo", "Kankon", "Mowo", "Oko Afo", "Oto Awori", "Palaver Island",
    "Lakowe", "Eputu", "Ibeju", "Awoyaya", "Bogije", "Abijo", "Iwerekun", "Orchid Road",
    "Abraham Adesanya", "Osapa London", "Ikate", "Elegushi", "Oniru", "Lekki Conservation Centre",
    "Adeniyi Jones", "Adekunle", "Adekunle Kuye", "Adeniji", "Adeola Odeku", "Admiralty Way",
    "Fola Osibo", "Omorinre Johnson", "Bisola Durosinmi-Etti", "Adebayo Doherty", "Freedom Way",
    "T.F. Kuboye", "Jakande Lekki", "Lekki Phase 1", "Lekki Phase 2", "Ikota", "Chevron",
    "Mobil Road", "Eleko", "Lagos Business School", "Pan-Atlantic University", "Eko Atlantic",
    "Maroko", "Kuramo", "Bar Beach", "Ahmadu Bello Way", "Kofo Abayomi", "Ademola Adetokunbo",
    "Sanusi Fafunwa", "Ligali Ayorinde", "Idejo", "Akin Adesola", "Ozumba Mbadiwe", "Oniru",
    "Victoria Island Extension", "Dolphin Estate", "Banana Island", "Parkview", "Bourdillon",
    "Osborne", "Alexander Road", "Kingsway Road", "Gerrard Road", "Glover Road", "Ribadu Road",
    "Milverton Road", "Thompson Avenue", "Maclever Street", "Davies Street", "Martin Street",
    "Creek Road", "Campbell Street", "Force Road", "Police Road", "Murtala Muhammed Square",
    "Eko Bridge Approach", "Igbosere", "Obalende", "Race Course", "Adeniji Adele", "Olowogbowo",
    "Idumagbo", "Ebute Ero", "Marina", "Tinubu", "Balogun", "Nnamdi Azikiwe", "Broad Street",
    "Odunlami", "Apongbon", "Bamgbose", "Ebute Metta", "Oyingbo", "Otto", "Iponri", "Eldon",
    "Oyingbo Market", "Yaba", "Akoka", "Jibowu", "Abule Ijesha", "Iwaya", "Makoko", "Unilag",
    "FCE Akoka", "Anthony", "Maryland", "Mende", "Onigbongbo", "Palmgrove", "Onipanu", "Fadeyi",
    "Bariga", "Shomolu", "Pedro", "Gbagada", "Ifako", "Ketu", "Alapere", "Ogudu", "Oworonshoki",
    "Ojota", "Oregun", "Opebi", "Allen", "Alausa", "Ikeja", "Oba Akran", "Kudirat Abiola",
    "Obafemi Awolowo", "Mobolaji Bank Anthony", "Adeniyi Jones", "Acme", "Ogba", "Iju", "Agege",
    "Dopemu", "Abule Egba", "Iyana Ipaja", "Egbe", "Idimu", "Akowonjo", "Shasha", "Baruwa",
    "Igando", "Ikotun", "Ilasamaja", "Ejigbo", "Ago Palace", "Okota", "Isolo", "Ajao Estate",
    "Mafoluku", "Oshodi", "Bolade", "International Airport", "Mile 2", "Amuwo", "Festac",
    "Alakija", "Kirikiri", "Satellite", "Iba", "Okokomaiko", "Agboju", "Trade Fair", "Ojo",
    "Alaba", "Volkswagen", "Navy Town", "LASU", "Badagry", "Seme", "Ajangbadi", "Topo",
    "Ilogbo Eremi", "Iworo", "Lakowe", "Eputu", "Ibeju", "Awoyaya", "Bogije", "Abijo",
    "Iwerekun", "Orchid", "Abraham Adesanya", "Osapa", "Ikate", "Elegushi", "Oniru", "LCCI",
    "Eleko", "LBS", "Landmark Towers", "Nestoil", "Addax", "Total", "NNPC", "Mobil House",
    "UBA House", "Zenith Heights", "Heritage Place", "Eko Tower", "Union Marble House",
    "Civic Centre", "Muson Centre", "Silverbird", "Eko Hotel", "Federal Palace", "Four Points",
    "Wheatbaker", "Lagos Oriental", "Raddison Blu", "Ikeja City Mall", "Maryland Mall",
    "Lekki Phase 1 Market", "Ajah Market", "Ikorodu Garage", "Oyingbo Market", "Mile 12 Market",
    "Oshodi Market", "Alaba Market", "Idumota Market", "Balogun Market", "Murtala Muhammed Airport",
    "MMA Terminal 1", "MMA Terminal 2", "General Aviation Terminal", "D Wing", "Cargo Terminal",
    "Nigerian Air Force Base", "NAF Base", "Ikeja Cantonment", "Ojo Cantonment", "Dodan Barracks",
    "Bonny Camp", "Lagos State Secretariat", "Alausa Secretariat", "Lagos State House of Assembly",
    "Lagos High Court", "Ikeja High Court", "Federal High Court Lagos", "Lagos Island Maternity",
    "LUTH", "Gbagada General Hospital", "Ikeja General Hospital", "Ajah General Hospital",
    "Badagry General Hospital", "Ikorodu General Hospital", "Reddington Hospital", "Eko Hospital",
    "St. Nicholas Hospital", "First Cardiology", "Hepworth Hospital", "Lagoon Hospitals",
    "Vedic Hospital", "Bridgewater Clinic", "St. Ives Hospital", "St. Kizito Clinic",
    "Lily Hospital", "Mayo Clinic", "Lagos State University Teaching Hospital", "LASUTH",
    "National Orthopaedic Hospital", "Federal Neuro-Psychiatric Hospital", "Yaba College of Technology",
    "YABATECH", "University of Lagos", "UNILAG", "Lagos State University", "LASU",
    "Pan-Atlantic University", "Caleb University", "Babcock University", "Covenant University",
    "Nigerian Law School", "Nigerian Institute of Journalism", "Lagos City Polytechnic",
    "Lagos Business School", "LBS", "Queens College", "King's College", "St. Gregory's College",
    "CMS Grammar School", "Igbobi College", "Methodist Boys High School", "Holy Child College",
    "Federal Government College", "FGC Ijanikin", "Air Force Secondary School", "Navy Secondary School",
    "Lagos State Model College", "Model College Badagry", "Model College Kankon",
    "Lagos State Junior Model College", "Igbogbo", "Model College Igbogbo",
    "Lagos State Senior Model College", "Igbogbo", "Model College Meiran",
    "Lagos State University International School", "LASU IS", "University of Lagos International School",
    "UNILAG IS", "Dowen College", "Greensprings School", "Chrisland School", "Corona School",
    "Whittington School", "British International School", "Lagos Preparatory School",
    "Avi-Cenna School", "Halifield School", "Children International School", "CIS",
    "Loyola Jesuit College", "St. Saviour's School", "St. Mary's School", "St. Paul's School",
    "Archbishop Vining Memorial Church", "AVM", "Cathedral Church of Christ", "Holy Cross Cathedral"
  ],
  "Agege": [
    "Agege Stadium Road", "Oko Oba Road", "Dopemu Road", "Orile Agege", "Papa Ajao",
    "Abule Egba", "Abeokuta Expressway", "Old Abeokuta Road", "Pen Cinema Road",
    "Agege Motor Road", "Iju Road", "Ifako Road", "Ogba Road", "Command Road",
    "Acme Road", "MCC Road", "Ogba Estate", "Ijaiye Road", "Water Works Road",
    "Orile Agege Market", "Agege Market", "Pen Cinema", "Agege Bus Stop",
    "Oko Oba", "Abule Egba Bus Stop", "Iyana Ipaja", "Egbe Road", "Idimu Road",
    "Akowonjo Road", "Shasha Road", "Baruwa Road", "Igando Road", "Ayobo Road",
    "Ikotun Road", "Ilasamaja", "Ejigbo Road", "Ago Palace Way", "Okota Road",
    "Isolo Road", "Ajao Estate", "Mafoluku", "Oshodi Market", "Oshodi B/Stop",
    "Bolade", "International Airport Road", "Mile 2", "Amuwo Odofin",
    "Festac Town 1st Avenue", "Festac Town 2nd Avenue", "Festac Town 7th Avenue",
    "Festac Town 21 Road", "Festac Town 22 Road", "Alakija", "Kirikiri",
    "Satellite Town", "Ibeshe", "Iba", "Okokomaiko", "Agboju", "Trade Fair",
    "Ojo Road", "Alaba International", "Volkswagen Road", "Navy Town", "LASU Road",
    "Iba New Site", "Badagry Expressway", "Seme Border", "Ajangbadi", "Topo",
    "Gberigbe", "Ilogbo Eremi", "Iworo", "Kankon", "Mowo", "Oko Afo", "Oto Awori",
    "Palaver Island", "Lakowe", "Eputu", "Ibeju", "Awoyaya", "Bogije", "Abijo",
    "Iwerekun", "Orchid Road", "Abraham Adesanya", "Osapa London", "Ikate", "Elegushi",
    "Oniru", "Lekki Conservation Centre", "Adeniyi Jones", "Adekunle", "Adekunle Kuye",
    "Adeniji", "Adeola Odeku", "Admiralty Way", "Fola Osibo", "Omorinre Johnson",
    "Bisola Durosinmi-Etti", "Adebayo Doherty", "Freedom Way", "T.F. Kuboye",
    "Jakande Lekki", "Lekki Phase 1", "Lekki Phase 2", "Ikota", "Chevron",
    "Mobil Road", "Eleko", "Lagos Business School", "Pan-Atlantic University",
    "Eko Atlantic", "Maroko", "Kuramo", "Bar Beach", "Ahmadu Bello Way",
    "Kofo Abayomi", "Ademola Adetokunbo", "Sanusi Fafunwa", "Ligali Ayorinde",
    "Idejo", "Akin Adesola", "Ozumba Mbadiwe", "Oniru", "Victoria Island Extension",
    "Dolphin Estate", "Banana Island", "Parkview", "Bourdillon", "Osborne",
    "Alexander Road", "Kingsway Road", "Gerrard Road", "Glover Road", "Ribadu Road",
    "Milverton Road", "Thompson Avenue", "Maclever Street", "Davies Street",
    "Martin Street", "Creek Road", "Campbell Street", "Force Road", "Police Road",
    "Murtala Muhammed Square", "Eko Bridge Approach", "Igbosere", "Obalende",
    "Race Course", "Adeniji Adele", "Olowogbowo", "Idumagbo", "Ebute Ero",
    "Marina", "Tinubu", "Balogun", "Nnamdi Azikiwe", "Broad Street", "Odunlami",
    "Apongbon", "Bamgbose", "Ebute Metta", "Oyingbo", "Otto", "Iponri", "Eldon",
    "Oyingbo Market", "Yaba", "Akoka", "Jibowu", "Abule Ijesha", "Iwaya", "Makoko",
    "Unilag", "FCE Akoka", "Anthony", "Maryland", "Mende", "Onigbongbo",
    "Palmgrove", "Onipanu", "Fadeyi", "Bariga", "Shomolu", "Pedro", "Gbagada",
    "Ifako", "Ketu", "Alapere", "Ogudu", "Oworonshoki", "Ojota", "Oregun",
    "Opebi", "Allen", "Alausa", "Ikeja", "Oba Akran", "Kudirat Abiola",
    "Obafemi Awolowo", "Mobolaji Bank Anthony", "Adeniyi Jones", "Acme", "Ogba",
    "Iju", "Agege", "Dopemu", "Abule Egba", "Iyana Ipaja", "Egbe", "Idimu",
    "Akowonjo", "Shasha", "Baruwa", "Igando", "Ikotun", "Ilasamaja", "Ejigbo",
    "Ago Palace", "Okota", "Isolo", "Ajao Estate", "Mafoluku", "Oshodi", "Bolade",
    "International Airport", "Mile 2", "Amuwo", "Festac", "Alakija", "Kirikiri",
    "Satellite", "Iba", "Okokomaiko", "Agboju", "Trade Fair", "Ojo", "Alaba",
    "Volkswagen", "Navy Town", "LASU", "Badagry", "Seme", "Ajangbadi", "Topo",
    "Ilogbo Eremi", "Iworo", "Lakowe", "Eputu", "Ibeju", "Awoyaya", "Bogije",
    "Abijo", "Iwerekun", "Orchid", "Abraham Adesanya", "Osapa", "Ikate", "Elegushi",
    "Oniru", "LCCI", "Eleko", "LBS", "Landmark Towers", "Nestoil", "Addax",
    "Total", "NNPC", "Mobil House", "UBA House", "Zenith Heights", "Heritage Place",
    "Eko Tower", "Union Marble House", "Civic Centre", "Muson Centre", "Silverbird",
    "Eko Hotel", "Federal Palace", "Four Points", "Wheatbaker", "Lagos Oriental",
    "Raddison Blu", "Ikeja City Mall", "Maryland Mall", "Lekki Phase 1 Market",
    "Ajah Market", "Ikorodu Garage", "Oyingbo Market", "Mile 12 Market",
    "Oshodi Market", "Alaba Market", "Idumota Market", "Balogun Market",
    "Murtala Muhammed Airport", "MMA Terminal 1", "MMA Terminal 2",
    "General Aviation Terminal", "D Wing", "Cargo Terminal",
    "Nigerian Air Force Base", "NAF Base", "Ikeja Cantonment", "Ojo Cantonment",
    "Dodan Barracks", "Bonny Camp", "Lagos State Secretariat", "Alausa Secretariat",
    "Lagos State House of Assembly", "Lagos High Court", "Ikeja High Court",
    "Federal High Court Lagos", "Lagos Island Maternity", "LUTH",
    "Gbagada General Hospital", "Ikeja General Hospital", "Ajah General Hospital",
    "Badagry General Hospital", "Ikorodu General Hospital", "Reddington Hospital",
    "Eko Hospital", "St. Nicholas Hospital", "First Cardiology", "Hepworth Hospital",
    "Lagoon Hospitals", "Vedic Hospital", "Bridgewater Clinic", "St. Ives Hospital",
    "St. Kizito Clinic", "Lily Hospital", "Mayo Clinic",
    "Lagos State University Teaching Hospital", "LASUTH",
    "National Orthopaedic Hospital", "Federal Neuro-Psychiatric Hospital",
    "Yaba College of Technology", "YABATECH", "University of Lagos", "UNILAG",
    "Lagos State University", "LASU", "Pan-Atlantic University", "Caleb University",
    "Babcock University", "Covenant University", "Nigerian Law School",
    "Nigerian Institute of Journalism", "Lagos City Polytechnic",
    "Lagos Business School", "LBS", "Queens College", "King's College",
    "St. Gregory's College", "CMS Grammar School", "Igbobi College",
    "Methodist Boys High School", "Holy Child College", "Federal Government College",
    "FGC Ijanikin", "Air Force Secondary School", "Navy Secondary School",
    "Lagos State Model College", "Model College Badagry", "Model College Kankon",
    "Lagos State Junior Model College", "Igbogbo", "Model College Igbogbo",
    "Lagos State Senior Model College", "Igbogbo", "Model College Meiran",
    "Lagos State University International School", "LASU IS",
    "University of Lagos International School", "UNILAG IS", "Dowen College",
    "Greensprings School", "Chrisland School", "Corona School", "Whittington School",
    "British International School", "Lagos Preparatory School", "Avi-Cenna School",
    "Halifield School", "Children International School", "CIS", "Loyola Jesuit College",
    "St. Saviour's School", "St. Mary's School", "St. Paul's School",
    "Archbishop Vining Memorial Church", "AVM", "Cathedral Church of Christ",
    "Holy Cross Cathedral"
  ],
  "Alimosho/Ipaja": [
    "Idimu Road", "Egbe Road", "Iyana Ipaja", "Ayobo Road", "Akowonjo Road",
    "Shasha Road", "Jakande Estate Isolo", "Igando Road", "Baruwa Road",
    "Ikotun Road", "Ilasamaja", "Ejigbo Road", "Ago Palace Way", "Okota Road",
    "Isolo Road", "Ajao Estate", "Mafoluku", "Oshodi Market", "Oshodi B/Stop",
    "Bolade", "International Airport Road", "Mile 2", "Amuwo Odofin",
    "Festac Town 1st Avenue", "Festac Town 2nd Avenue", "Festac Town 7th Avenue",
    "Festac Town 21 Road", "Festac Town 22 Road", "Alakija", "Kirikiri",
    "Satellite Town", "Ibeshe", "Iba", "Okokomaiko", "Agboju", "Trade Fair",
    "Ojo Road", "Alaba International", "Volkswagen Road", "Navy Town", "LASU Road",
    "Iba New Site", "Badagry Expressway", "Seme Border", "Ajangbadi", "Topo",
    "Gberigbe", "Ilogbo Eremi", "Iworo", "Kankon", "Mowo", "Oko Afo", "Oto Awori",
    "Palaver Island", "Lakowe", "Eputu", "Ibeju", "Awoyaya", "Bogije", "Abijo",
    "Iwerekun", "Orchid Road", "Abraham Adesanya", "Osapa London", "Ikate", "Elegushi",
    "Oniru", "Lekki Conservation Centre", "Adeniyi Jones", "Adekunle", "Adekunle Kuye",
    "Adeniji", "Adeola Odeku", "Admiralty Way", "Fola Osibo", "Omorinre Johnson",
    "Bisola Durosinmi-Etti", "Adebayo Doherty", "Freedom Way", "T.F. Kuboye",
    "Jakande Lekki", "Lekki Phase 1", "Lekki Phase 2", "Ikota", "Chevron",
    "Mobil Road", "Eleko", "Lagos Business School", "Pan-Atlantic University",
    "Eko Atlantic", "Maroko", "Kuramo", "Bar Beach", "Ahmadu Bello Way",
    "Kofo Abayomi", "Ademola Adetokunbo", "Sanusi Fafunwa", "Ligali Ayorinde",
    "Idejo", "Akin Adesola", "Ozumba Mbadiwe", "Oniru", "Victoria Island Extension",
    "Dolphin Estate", "Banana Island", "Parkview", "Bourdillon", "Osborne",
    "Alexander Road", "Kingsway Road", "Gerrard Road", "Glover Road", "Ribadu Road",
    "Milverton Road", "Thompson Avenue", "Maclever Street", "Davies Street",
    "Martin Street", "Creek Road", "Campbell Street", "Force Road", "Police Road",
    "Murtala Muhammed Square", "Eko Bridge Approach", "Igbosere", "Obalende",
    "Race Course", "Adeniji Adele", "Olowogbowo", "Idumagbo", "Ebute Ero",
    "Marina", "Tinubu", "Balogun", "Nnamdi Azikiwe", "Broad Street", "Odunlami",
    "Apongbon", "Bamgbose", "Ebute Metta", "Oyingbo", "Otto", "Iponri", "Eldon",
    "Oyingbo Market", "Yaba", "Akoka", "Jibowu", "Abule Ijesha", "Iwaya", "Makoko",
    "Unilag", "FCE Akoka", "Anthony", "Maryland", "Mende", "Onigbongbo",
    "Palmgrove", "Onipanu", "Fadeyi", "Bariga", "Shomolu", "Pedro", "Gbagada",
    "Ifako", "Ketu", "Alapere", "Ogudu", "Oworonshoki", "Ojota", "Oregun",
    "Opebi", "Allen", "Alausa", "Ikeja", "Oba Akran", "Kudirat Abiola",
    "Obafemi Awolowo", "Mobolaji Bank Anthony", "Adeniyi Jones", "Acme", "Ogba",
    "Iju", "Agege", "Dopemu", "Abule Egba", "Iyana Ipaja", "Egbe", "Idimu",
    "Akowonjo", "Shasha", "Baruwa", "Igando", "Ikotun", "Ilasamaja", "Ejigbo",
    "Ago Palace", "Okota", "Isolo", "Ajao Estate", "Mafoluku", "Oshodi", "Bolade",
    "International Airport", "Mile 2", "Amuwo", "Festac", "Alakija", "Kirikiri",
    "Satellite", "Iba", "Okokomaiko", "Agboju", "Trade Fair", "Ojo", "Alaba",
    "Volkswagen", "Navy Town", "LASU", "Badagry", "Seme", "Ajangbadi", "Topo",
    "Ilogbo Eremi", "Iworo", "Lakowe", "Eputu", "Ibeju", "Awoyaya", "Bogije",
    "Abijo", "Iwerekun", "Orchid", "Abraham Adesanya", "Osapa", "Ikate", "Elegushi",
    "Oniru", "LCCI", "Eleko", "LBS", "Landmark Towers", "Nestoil", "Addax",
    "Total", "NNPC", "Mobil House", "UBA House", "Zenith Heights", "Heritage Place",
    "Eko Tower", "Union Marble House", "Civic Centre", "Muson Centre", "Silverbird",
    "Eko Hotel", "Federal Palace", "Four Points", "Wheatbaker", "Lagos Oriental",
    "Raddison Blu", "Ikeja City Mall", "Maryland Mall", "Lekki Phase 1 Market",
    "Ajah Market", "Ikorodu Garage", "Oyingbo Market", "Mile 12 Market",
    "Oshodi Market", "Alaba Market", "Idumota Market", "Balogun Market",
    "Murtala Muhammed Airport", "MMA Terminal 1", "MMA Terminal 2",
    "General Aviation Terminal", "D Wing", "Cargo Terminal",
    "Nigerian Air Force Base", "NAF Base", "Ikeja Cantonment", "Ojo Cantonment",
    "Dodan Barracks", "Bonny Camp", "Lagos State Secretariat", "Alausa Secretariat",
    "Lagos State House of Assembly", "Lagos High Court", "Ikeja High Court",
    "Federal High Court Lagos", "Lagos Island Maternity", "LUTH",
    "Gbagada General Hospital", "Ikeja General Hospital", "Ajah General Hospital",
    "Badagry General Hospital", "Ikorodu General Hospital", "Reddington Hospital",
    "Eko Hospital", "St. Nicholas Hospital", "First Cardiology", "Hepworth Hospital",
    "Lagoon Hospitals", "Vedic Hospital", "Bridgewater Clinic", "St. Ives Hospital",
    "St. Kizito Clinic", "Lily Hospital", "Mayo Clinic",
    "Lagos State University Teaching Hospital", "LASUTH",
    "National Orthopaedic Hospital", "Federal Neuro-Psychiatric Hospital",
    "Yaba College of Technology", "YABATECH", "University of Lagos", "UNILAG",
    "Lagos State University", "LASU", "Pan-Atlantic University", "Caleb University",
    "Babcock University", "Covenant University", "Nigerian Law School",
    "Nigerian Institute of Journalism", "Lagos City Polytechnic",
    "Lagos Business School", "LBS", "Queens College", "King's College",
    "St. Gregory's College", "CMS Grammar School", "Igbobi College",
    "Methodist Boys High School", "Holy Child College", "Federal Government College",
    "FGC Ijanikin", "Air Force Secondary School", "Navy Secondary School",
    "Lagos State Model College", "Model College Badagry", "Model College Kankon",
    "Lagos State Junior Model College", "Igbogbo", "Model College Igbogbo",
    "Lagos State Senior Model College", "Igbogbo", "Model College Meiran",
    "Lagos State University International School", "LASU IS",
    "University of Lagos International School", "UNILAG IS", "Dowen College",
    "Greensprings School", "Chrisland School", "Corona School", "Whittington School",
    "British International School", "Lagos Preparatory School", "Avi-Cenna School",
    "Halifield School", "Children International School", "CIS", "Loyola Jesuit College",
    "St. Saviour's School", "St. Mary's School", "St. Paul's School",
    "Archbishop Vining Memorial Church", "AVM", "Cathedral Church of Christ",
    "Holy Cross Cathedral"
  ],
  "Ojodu/Omole": [
    "Ojodu Berger", "Isheri Road", "Omole Phase 1", "Omole Phase 2", "CMD Road",
    "Fagba Road", "Berger Expressway", "Ojodu Bus Stop", "Omole Estate",
    "Isheri", "Ojodu", "Berger", "Ojodu Market", "Omole Market",
    "CMD Road Ojodu", "Fagba", "Omole Phase 1 Road", "Omole Phase 2 Road",
    "Isheri North", "Isheri South", "Ojodu Berger Bus Stop",
    "Ojodu Grammar School", "Omole Grammar School", "Ojodu Primary School",
    "Omole Primary School", "Ojodu Police Station", "Omole Police Station",
    "Ojodu Fire Station", "Omole Fire Station", "Ojodu Post Office",
    "Omole Post Office", "Ojodu Bank", "Omole Bank", "Ojodu Church",
    "Omole Church", "Ojodu Mosque", "Omole Mosque", "Ojodu Market Stall",
    "Omole Market Stall", "Ojodu Restaurant", "Omole Restaurant",
    "Ojodu Hotel", "Omole Hotel", "Ojodu Pharmacy", "Omole Pharmacy",
    "Ojodu Clinic", "Omole Clinic", "Ojodu Hospital", "Omole Hospital",
    "Ojodu School", "Omole School", "Ojodu College", "Omole College",
    "Ojodu University", "Omole University", "Ojodu Polytechnic", "Omole Polytechnic",
    "Ojodu Vocational Centre", "Omole Vocational Centre", "Ojodu Skill Acquisition",
    "Omole Skill Acquisition", "Ojodu Workshop", "Omole Workshop",
    "Ojodu Factory", "Omole Factory", "Ojodu Industry", "Omole Industry",
    "Ojodu Business Centre", "Omole Business Centre", "Ojodu Shopping Complex",
    "Omole Shopping Complex", "Ojodu Plaza", "Omole Plaza", "Ojodu Mall",
    "Omole Mall", "Ojodu Supermarket", "Omole Supermarket", "Ojodu Store",
    "Omole Store", "Ojodu Boutique", "Omole Boutique", "Ojodu Salon",
    "Omole Salon", "Ojodu Spa", "Omole Spa", "Ojodu Gym", "Omole Gym",
    "Ojodu Park", "Omole Park", "Ojodu Garden", "Omole Garden",
    "Ojodu Playground", "Omole Playground", "Ojodu Stadium", "Omole Stadium",
    "Ojodu Field", "Omole Field", "Ojodu Court", "Omole Court",
    "Ojodu Road", "Omole Road", "Ojodu Street", "Omole Street",
    "Ojodu Avenue", "Omole Avenue", "Ojodu Crescent", "Omole Crescent",
    "Ojodu Close", "Omole Close", "Ojodu Lane", "Omole Lane",
    "Ojodu Drive", "Omole Drive", "Ojodu Way", "Omole Way",
    "Ojodu Link", "Omole Link", "Ojodu Bypass", "Omole Bypass",
    "Ojodu Expressway", "Omole Expressway", "Ojodu Highway", "Omole Highway",
    "Ojodu Bridge", "Omole Bridge", "Ojodu Tunnel", "Omole Tunnel",
    "Ojodu Flyover", "Omole Flyover", "Ojodu Interchange", "Omole Interchange",
    "Ojodu Roundabout", "Omole Roundabout", "Ojodu Traffic Light", "Omole Traffic Light",
    "Ojodu Bus Stop", "Omole Bus Stop", "Ojodu Taxi Rank", "Omole Taxi Rank",
    "Ojodu Car Park", "Omole Car Park", "Ojodu Garage", "Omole Garage",
    "Ojodu Petrol Station", "Omole Petrol Station", "Ojodu Filling Station",
    "Omole Filling Station", "Ojodu Fuel Station", "Omole Fuel Station",
    "Ojodu Gas Station", "Omole Gas Station", "Ojodu Power Station",
    "Omole Power Station", "Ojodu Water Works", "Omole Water Works",
    "Ojodu Sewage", "Omole Sewage", "Ojodu Drainage", "Omole Drainage",
    "Ojodu Gutter", "Omole Gutter", "Ojodu Culvert", "Omole Culvert",
    "Ojodu Canal", "Omole Canal", "Ojodu River", "Omole River",
    "Ojodu Stream", "Omole Stream", "Ojodu Pond", "Omole Pond",
    "Ojodu Lake", "Omole Lake", "Ojodu Lagoon", "Omole Lagoon",
    "Ojodu Beach", "Omole Beach", "Ojodu Island", "Omole Island",
    "Ojodu Peninsula", "Omole Peninsula", "Ojodu Cape", "Omole Cape",
    "Ojodu Bay", "Omole Bay", "Ojodu Harbour", "Omole Harbour",
    "Ojodu Port", "Omole Port", "Ojodu Quay", "Omole Quay",
    "Ojodu Wharf", "Omole Wharf", "Ojodu Dock", "Omole Dock",
    "Ojodu Pier", "Omole Pier", "Ojodu Jetty", "Omole Jetty",
    "Ojodu Ferry", "Omole Ferry", "Ojodu Boat", "Omole Boat",
    "Ojodu Ship", "Omole Ship", "Ojodu Yacht", "Omole Yacht",
    "Ojodu Canoe", "Omole Canoe", "Ojodu Kayak", "Omole Kayak",
    "Ojodu Raft", "Omole Raft", "Ojodu Surfboard", "Omole Surfboard",
    "Ojodu Windsurf", "Omole Windsurf", "Ojodu Kite", "Omole Kite",
    "Ojodu Paraglide", "Omole Paraglide", "Ojodu Hang Glide", "Omole Hang Glide",
    "Ojodu Skydive", "Omole Skydive", "Ojodu Bungee", "Omole Bungee",
    "Ojodu Zip Line", "Omole Zip Line", "Ojodu Climb", "Omole Climb",
    "Ojodu Hike", "Omole Hike", "Ojodu Trek", "Omole Trek",
    "Ojodu Camp", "Omole Camp", "Ojodu Safari", "Omole Safari",
    "Ojodu Wildlife", "Omole Wildlife", "Ojodu Game", "Omole Game",
    "Ojodu Reserve", "Omole Reserve", "Ojodu Park", "Omole Park",
    "Ojodu Garden", "Omole Garden", "Ojodu Forest", "Omole Forest",
    "Ojodu Wood", "Omole Wood", "Ojodu Jungle", "Omole Jungle",
    "Ojodu Bush", "Omole Bush", "Ojodu Savannah", "Omole Savannah",
    "Ojodu Grassland", "Omole Grassland", "Ojodu Wetland", "Omole Wetland",
    "Ojodu Swamp", "Omole Swamp", "Ojodu Marsh", "Omole Marsh",
    "Ojodu Bog", "Omole Bog", "Ojodu Fen", "Omole Fen",
    "Ojodu Moor", "Omole Moor", "Ojodu Heath", "Omole Heath",
    "Ojodu Hill", "Omole Hill", "Ojodu Mountain", "Omole Mountain",
    "Ojodu Valley", "Omole Valley", "Ojodu Canyon", "Omole Canyon",
    "Ojodu Gorge", "Omole Gorge", "Ojodu Cliff", "Omole Cliff",
    "Ojodu Ridge", "Omole Ridge", "Ojodu Peak", "Omole Peak",
    "Ojodu Summit", "Omole Summit", "Ojodu Pass", "Omole Pass",
    "Ojodu Trail", "Omole Trail", "Ojodu Path", "Omole Path",
    "Ojodu Route", "Omole Route", "Ojodu Track", "Omole Track",
    "Ojodu Way", "Omole Way", "Ojodu Road", "Omole Road",
    "Ojodu Street", "Omole Street", "Ojodu Avenue", "Omole Avenue",
    "Ojodu Crescent", "Omole Crescent", "Ojodu Close", "Omole Close",
    "Ojodu Lane", "Omole Lane", "Ojodu Drive", "Omole Drive",
    "Ojodu Way", "Omole Way", "Ojodu Link", "Omole Link",
    "Ojodu Bypass", "Omole Bypass", "Ojodu Expressway", "Omole Expressway",
    "Ojodu Highway", "Omole Highway", "Ojodu Bridge", "Omole Bridge",
    "Ojodu Tunnel", "Omole Tunnel", "Ojodu Flyover", "Omole Flyover",
    "Ojodu Interchange", "Omole Interchange", "Ojodu Roundabout", "Omole Roundabout",
    "Ojodu Traffic Light", "Omole Traffic Light", "Ojodu Bus Stop", "Omole Bus Stop",
    "Ojodu Taxi Rank", "Omole Taxi Rank", "Ojodu Car Park", "Omole Car Park",
    "Ojodu Garage", "Omole Garage", "Ojodu Petrol Station", "Omole Petrol Station",
    "Ojodu Filling Station", "Omole Filling Station", "Ojodu Fuel Station",
    "Omole Fuel Station", "Ojodu Gas Station", "Omole Gas Station",
    "Ojodu Power Station", "Omole Power Station", "Ojodu Water Works",
    "Omole Water Works", "Ojodu Sewage", "Omole Sewage", "Ojodu Drainage",
    "Omole Drainage", "Ojodu Gutter", "Omole Gutter", "Ojodu Culvert",
    "Omole Culvert", "Ojodu Canal", "Omole Canal", "Ojodu River", "Omole River",
    "Ojodu Stream", "Omole Stream", "Ojodu Pond", "Omole Pond",
    "Ojodu Lake", "Omole Lake", "Ojodu Lagoon", "Omole Lagoon",
    "Ojodu Beach", "Omole Beach", "Ojodu Island", "Omole Island",
    "Ojodu Peninsula", "Omole Peninsula", "Ojodu Cape", "Omole Cape",
    "Ojodu Bay", "Omole Bay", "Ojodu Harbour", "Omole Harbour",
    "Ojodu Port", "Omole Port", "Ojodu Quay", "Omole Quay",
    "Ojodu Wharf", "Omole Wharf", "Ojodu Dock", "Omole Dock",
    "Ojodu Pier", "Omole Pier", "Ojodu Jetty", "Omole Jetty",
    "Ojodu Ferry", "Omole Ferry", "Ojodu Boat", "Omole Boat",
    "Ojodu Ship", "Omole Ship", "Ojodu Yacht", "Omole Yacht",
    "Ojodu Canoe", "Omole Canoe", "Ojodu Kayak", "Omole Kayak",
    "Ojodu Raft", "Omole Raft", "Ojodu Surfboard", "Omole Surfboard",
    "Ojodu Windsurf", "Omole Windsurf", "Ojodu Kite", "Omole Kite",
    "Ojodu Paraglide", "Omole Paraglide", "Ojodu Hang Glide", "Omole Hang Glide",
    "Ojodu Skydive", "Omole Skydive", "Ojodu Bungee", "Omole Bungee",
    "Ojodu Zip Line", "Omole Zip Line", "Ojodu Climb", "Omole Climb",
    "Ojodu Hike", "Omole Hike", "Ojodu Trek", "Omole Trek",
    "Ojodu Camp", "Omole Camp", "Ojodu Safari", "Omole Safari",
    "Ojodu Wildlife", "Omole Wildlife", "Ojodu Game", "Omole Game",
    "Ojodu Reserve", "Omole Reserve", "Ojodu Park", "Omole Park",
    "Ojodu Garden", "Omole Garden", "Ojodu Forest", "Omole Forest",
    "Ojodu Wood", "Omole Wood", "Ojodu Jungle", "Omole Jungle",
    "Ojodu Bush", "Omole Bush", "Ojodu Savannah", "Omole Savannah",
    "Ojodu Grassland", "Omole Grassland", "Ojodu Wetland", "Omole Wetland",
    "Ojodu Swamp", "Omole Swamp", "Ojodu Marsh", "Omole Marsh",
    "Ojodu Bog", "Omole Bog", "Ojodu Fen", "Omole Fen",
    "Ojodu Moor", "Omole Moor", "Ojodu Heath", "Omole Heath",
    "Ojodu Hill", "Omole Hill", "Ojodu Mountain", "Omole Mountain",
    "Ojodu Valley", "Omole Valley", "Ojodu Canyon", "Omole Canyon",
    "Ojodu Gorge", "Omole Gorge", "Ojodu Cliff", "Omole Cliff",
    "Ojodu Ridge", "Omole Ridge", "Ojodu Peak", "Omole Peak",
    "Ojodu Summit", "Omole Summit", "Ojodu Pass", "Omole Pass",
    "Ojodu Trail", "Omole Trail", "Ojodu Path", "Omole Path",
    "Ojodu Route", "Omole Route", "Ojodu Track", "Omole Track",
    "Ojodu Way", "Omole Way", "Ojodu Road", "Omole Road",
    "Ojodu Street", "Omole Street", "Ojodu Avenue", "Omole Avenue",
    "Ojodu Crescent", "Omole Crescent", "Ojodu Close", "Omole Close",
    "Ojodu Lane", "Omole Lane", "Ojodu Drive", "Omole Drive",
    "Ojodu Way", "Omole Way", "Ojodu Link", "Omole Link",
    "Ojodu Bypass", "Omole Bypass", "Ojodu Expressway", "Omole Expressway",
    "Ojodu Highway", "Omole Highway", "Ojodu Bridge", "Omole Bridge",
    "Ojodu Tunnel", "Omole Tunnel", "Ojodu Flyover", "Omole Flyover",
    "Ojodu Interchange", "Omole Interchange", "Ojodu Roundabout", "Omole Roundabout",
    "Ojodu Traffic Light", "Omole Traffic Light", "Ojodu Bus Stop", "Omole Bus Stop",
    "Ojodu Taxi Rank", "Omole Taxi Rank", "Ojodu Car Park", "Omole Car Park",
    "Ojodu Garage", "Omole Garage", "Ojodu Petrol Station", "Omole Petrol Station",
    "Ojodu Filling Station", "Omole Filling Station", "Ojodu Fuel Station",
    "Omole Fuel Station", "Ojodu Gas Station", "Omole Gas Station",
    "Ojodu Power Station", "Omole Power Station", "Ojodu Water Works",
    "Omole Water Works", "Ojodu Sewage", "Omole Sewage", "Ojodu Drainage",
    "Omole Drainage", "Ojodu Gutter", "Omole Gutter", "Ojodu Culvert",
    "Omole Culvert", "Ojodu Canal", "Omole Canal", "Ojodu River", "Omole River",
    "Ojodu Stream", "Omole Stream", "Ojodu Pond", "Omole Pond",
    "Ojodu Lake", "Omole Lake", "Ojodu Lagoon", "Omole Lagoon",
    "Ojodu Beach", "Omole Beach", "Ojodu Island", "Omole Island",
    "Ojodu Peninsula", "Omole Peninsula", "Ojodu Cape", "Omole Cape",
    "Ojodu Bay", "Omole Bay", "Ojodu Harbour", "Omole Harbour",
    "Ojodu Port", "Omole Port", "Ojodu Quay", "Omole Quay",
    "Ojodu Wharf", "Omole Wharf", "Ojodu Dock", "Omole Dock",
    "Ojodu Pier", "Omole Pier", "Ojodu Jetty", "Omole Jetty",
    "Ojodu Ferry", "Omole Ferry", "Ojodu Boat", "Omole Boat",
    "Ojodu Ship", "Omole Ship", "Ojodu Yacht", "Omole Yacht",
    "Ojodu Canoe", "Omole Canoe", "Ojodu Kayak", "Omole Kayak",
    "Ojodu Raft", "Omole Raft", "Ojodu Surfboard", "Omole Surfboard",
    "Ojodu Windsurf", "Omole Windsurf", "Ojodu Kite", "Omole Kite",
    "Ojodu Paraglide", "Omole Paraglide", "Ojodu Hang Glide", "Omole Hang Glide",
    "Ojodu Skydive", "Omole Skydive", "Ojodu Bungee", "Omole Bungee",
    "Ojodu Zip Line", "Omole Zip Line", "Ojodu Climb", "Omole Climb",
    "Ojodu Hike", "Omole Hike", "Ojodu Trek", "Omole Trek",
    "Ojodu Camp", "Omole Camp", "Ojodu Safari", "Omole Safari",
    "Ojodu Wildlife", "Omole Wildlife", "Ojodu Game", "Omole Game",
    "Ojodu Reserve", "Omole Reserve", "Ojodu Park", "Omole Park",
    "Ojodu Garden", "Omole Garden", "Ojodu Forest", "Omole Forest",
    "Ojodu Wood", "Omole Wood", "Ojodu Jungle", "Omole Jungle",
    "Ojodu Bush", "Omole Bush", "Ojodu Savannah", "Omole Savannah",
    "Ojodu Grassland", "Omole Grassland", "Ojodu Wetland", "Omole Wetland",
    "Ojodu Swamp", "Omole Swamp", "Ojodu Marsh", "Omole Marsh",
    "Ojodu Bog", "Omole Bog", "Ojodu Fen", "Omole Fen",
    "Ojodu Moor", "Omole Moor", "Ojodu Heath", "Omole Heath",
    "Ojodu Hill", "Omole Hill", "Ojodu Mountain", "Omole Mountain",
    "Ojodu Valley", "Omole Valley", "Ojodu Canyon", "Omole Canyon",
    "Ojodu Gorge", "Omole Gorge", "Ojodu Cliff", "Omole Cliff",
    "Ojodu Ridge", "Omole Ridge", "Ojodu Peak", "Omole Peak",
    "Ojodu Summit", "Omole Summit", "Ojodu Pass", "Omole Pass",
    "Ojodu Trail", "Omole Trail", "Ojodu Path", "Omole Path",
    "Ojodu Route", "Omole Route", "Ojodu Track", "Omole Track"
  ],
  "Kosofe/Ketu": [
    "Ketu Mile 12", "Ogudu Road", "Ojota Interchange", "Alapere Road",
    "Mile 12 Market", "Kosofe Road", "Agboyi Road", "Magodo Phase 1",
    "Magodo Phase 2", "Ketu Alapere", "Kosofe", "Ketu", "Ojota",
    "Alapere", "Agboyi", "Mile 12", "Ogudu", "Magodo",
    "Ketu Bus Stop", "Kosofe Bus Stop", "Ojota Bus Stop", "Alapere Bus Stop",
    "Agboyi Bus Stop", "Mile 12 Bus Stop", "Ogudu Bus Stop", "Magodo Bus Stop",
    "Ketu Market", "Kosofe Market", "Ojota Market", "Alapere Market",
    "Agboyi Market", "Mile 12 Market", "Ogudu Market", "Magodo Market",
    "Ketu Police Station", "Kosofe Police Station", "Ojota Police Station",
    "Alapere Police Station", "Agboyi Police Station", "Mile 12 Police Station",
    "Ogudu Police Station", "Magodo Police Station", "Ketu Fire Station",
    "Kosofe Fire Station", "Ojota Fire Station", "Alapere Fire Station",
    "Agboyi Fire Station", "Mile 12 Fire Station", "Ogudu Fire Station",
    "Magodo Fire Station", "Ketu Post Office", "Kosofe Post Office",
    "Ojota Post Office", "Alapere Post Office", "Agboyi Post Office",
    "Mile 12 Post Office", "Ogudu Post Office", "Magodo Post Office",
    "Ketu Bank", "Kosofe Bank", "Ojota Bank", "Alapere Bank",
    "Agboyi Bank", "Mile 12 Bank", "Ogudu Bank", "Magodo Bank",
    "Ketu Church", "Kosofe Church", "Ojota Church", "Alapere Church",
    "Agboyi Church", "Mile 12 Church", "Ogudu Church", "Magodo Church",
    "Ketu Mosque", "Kosofe Mosque", "Ojota Mosque", "Alapere Mosque",
    "Agboyi Mosque", "Mile 12 Mosque", "Ogudu Mosque", "Magodo Mosque",
    "Ketu School", "Kosofe School", "Ojota School", "Alapere School",
    "Agboyi School", "Mile 12 School", "Ogudu School", "Magodo School",
    "Ketu Hospital", "Kosofe Hospital", "Ojota Hospital", "Alapere Hospital",
    "Agboyi Hospital", "Mile 12 Hospital", "Ogudu Hospital", "Magodo Hospital"
  ],
  "Gbagada": [
    "Gbagada Phase 1", "Gbagada Phase 2", "Pedro Road", "Tigris Crescent",
    "Soluyi Avenue", "Ifako Gbagada", "Gbagada Express", "Keffi Street",
    "Gbagada", "Pedro", "Soluyi", "Ifako", "Keffi",
    "Gbagada Bus Stop", "Pedro Bus Stop", "Soluyi Bus Stop", "Ifako Bus Stop",
    "Keffi Bus Stop", "Gbagada Market", "Pedro Market", "Soluyi Market",
    "Ifako Market", "Keffi Market", "Gbagada Police Station", "Pedro Police Station",
    "Soluyi Police Station", "Ifako Police Station", "Keffi Police Station",
    "Gbagada Fire Station", "Pedro Fire Station", "Soluyi Fire Station",
    "Ifako Fire Station", "Keffi Fire Station", "Gbagada Post Office",
    "Pedro Post Office", "Soluyi Post Office", "Ifako Post Office",
    "Keffi Post Office", "Gbagada Bank", "Pedro Bank", "Soluyi Bank",
    "Ifako Bank", "Keffi Bank", "Gbagada Church", "Pedro Church",
    "Soluyi Church", "Ifako Church", "Keffi Church", "Gbagada Mosque",
    "Pedro Mosque", "Soluyi Mosque", "Ifako Mosque", "Keffi Mosque",
    "Gbagada School", "Pedro School", "Soluyi School", "Ifako School",
    "Keffi School", "Gbagada Hospital", "Pedro Hospital", "Soluyi Hospital",
    "Ifako Hospital", "Keffi Hospital"
  ],
  "Ilupeju": [
    "Ilupeju Estate Road", "Ilupeju Bypass", "Commercial Avenue Ilupeju",
    "Simbiat Abiola Road", "Harvey Road", "Oregun Road Ilupeju",
    "Ilupeju", "Ilupeju Estate", "Ilupeju Bypass", "Commercial Avenue",
    "Simbiat Abiola", "Harvey", "Oregun",
    "Ilupeju Bus Stop", "Ilupeju Estate Bus Stop", "Ilupeju Bypass Bus Stop",
    "Commercial Avenue Bus Stop", "Simbiat Abiola Bus Stop", "Harvey Road Bus Stop",
    "Oregun Road Bus Stop", "Ilupeju Market", "Ilupeju Estate Market",
    "Ilupeju Bypass Market", "Commercial Avenue Market", "Simbiat Abiola Market",
    "Harvey Road Market", "Oregun Road Market", "Ilupeju Police Station",
    "Ilupeju Estate Police Station", "Ilupeju Bypass Police Station",
    "Commercial Avenue Police Station", "Simbiat Abiola Police Station",
    "Harvey Road Police Station", "Oregun Road Police Station",
    "Ilupeju Fire Station", "Ilupeju Estate Fire Station", "Ilupeju Bypass Fire Station",
    "Commercial Avenue Fire Station", "Simbiat Abiola Fire Station",
    "Harvey Road Fire Station", "Oregun Road Fire Station", "Ilupeju Post Office",
    "Ilupeju Estate Post Office", "Ilupeju Bypass Post Office",
    "Commercial Avenue Post Office", "Simbiat Abiola Post Office",
    "Harvey Road Post Office", "Oregun Road Post Office", "Ilupeju Bank",
    "Ilupeju Estate Bank", "Ilupeju Bypass Bank", "Commercial Avenue Bank",
    "Simbiat Abiola Bank", "Harvey Road Bank", "Oregun Road Bank",
    "Ilupeju Church", "Ilupeju Estate Church", "Ilupeju Bypass Church",
    "Commercial Avenue Church", "Simbiat Abiola Church", "Harvey Road Church",
    "Oregun Road Church", "Ilupeju Mosque", "Ilupeju Estate Mosque",
    "Ilupeju Bypass Mosque", "Commercial Avenue Mosque", "Simbiat Abiola Mosque",
    "Harvey Road Mosque", "Oregun Road Mosque", "Ilupeju School",
    "Ilupeju Estate School", "Ilupeju Bypass School", "Commercial Avenue School",
    "Simbiat Abiola School", "Harvey Road School", "Oregun Road School",
    "Ilupeju Hospital", "Ilupeju Estate Hospital", "Ilupeju Bypass Hospital",
    "Commercial Avenue Hospital", "Simbiat Abiola Hospital", "Harvey Road Hospital",
    "Oregun Road Hospital"
  ],
  "Mushin": [
    "Agege Motor Road Mushin", "Ladipo Street", "Idi Oro Road", "Apata Street",
    "Fadeyi Road", "Mushin Market Road", "Ejigbo Road Mushin", "Town Planning Way",
    "Mushin", "Ladipo", "Idi Oro", "Apata", "Fadeyi",
    "Mushin Market", "Ejigbo", "Town Planning",
    "Mushin Bus Stop", "Ladipo Bus Stop", "Idi Oro Bus Stop", "Apata Bus Stop",
    "Fadeyi Bus Stop", "Mushin Market Bus Stop", "Ejigbo Bus Stop",
    "Town Planning Bus Stop", "Mushin Police Station", "Ladipo Police Station",
    "Idi Oro Police Station", "Apata Police Station", "Fadeyi Police Station",
    "Mushin Market Police Station", "Ejigbo Police Station",
    "Town Planning Police Station", "Mushin Fire Station", "Ladipo Fire Station",
    "Idi Oro Fire Station", "Apata Fire Station", "Fadeyi Fire Station",
    "Mushin Market Fire Station", "Ejigbo Fire Station", "Town Planning Fire Station",
    "Mushin Post Office", "Ladipo Post Office", "Idi Oro Post Office",
    "Apata Post Office", "Fadeyi Post Office", "Mushin Market Post Office",
    "Ejigbo Post Office", "Town Planning Post Office", "Mushin Bank",
    "Ladipo Bank", "Idi Oro Bank", "Apata Bank", "Fadeyi Bank",
    "Mushin Market Bank", "Ejigbo Bank", "Town Planning Bank",
    "Mushin Church", "Ladipo Church", "Idi Oro Church", "Apata Church",
    "Fadeyi Church", "Mushin Market Church", "Ejigbo Church",
    "Town Planning Church", "Mushin Mosque", "Ladipo Mosque", "Idi Oro Mosque",
    "Apata Mosque", "Fadeyi Mosque", "Mushin Market Mosque", "Ejigbo Mosque",
    "Town Planning Mosque", "Mushin School", "Ladipo School", "Idi Oro School",
    "Apata School", "Fadeyi School", "Mushin Market School", "Ejigbo School",
    "Town Planning School", "Mushin Hospital", "Ladipo Hospital", "Idi Oro Hospital",
    "Apata Hospital", "Fadeyi Hospital", "Mushin Market Hospital", "Ejigbo Hospital",
    "Town Planning Hospital"
  ],
  "Surulere": [
    "Adeniran Ogunsanya Street", "Bode Thomas Street", "Ogunlana Drive",
    "Ojuelegba Road", "Eric Moore Road", "Western Avenue Surulere",
    "Itire Road", "Masha Road", "Randle Avenue", "Akerele Street",
    "Lawanson Road", "Surulere", "Adeniran Ogunsanya", "Bode Thomas",
    "Ogunlana", "Ojuelegba", "Eric Moore", "Western Avenue",
    "Itire", "Masha", "Randle", "Akerele", "Lawanson",
    "Surulere Bus Stop", "Adeniran Ogunsanya Bus Stop", "Bode Thomas Bus Stop",
    "Ogunlana Bus Stop", "Ojuelegba Bus Stop", "Eric Moore Bus Stop",
    "Western Avenue Bus Stop", "Itire Bus Stop", "Masha Bus Stop",
    "Randle Bus Stop", "Akerele Bus Stop", "Lawanson Bus Stop",
    "Surulere Market", "Adeniran Ogunsanya Market", "Bode Thomas Market",
    "Ogunlana Market", "Ojuelegba Market", "Eric Moore Market",
    "Western Avenue Market", "Itire Market", "Masha Market",
    "Randle Market", "Akerele Market", "Lawanson Market",
    "Surulere Police Station", "Adeniran Ogunsanya Police Station",
    "Bode Thomas Police Station", "Ogunlana Police Station",
    "Ojuelegba Police Station", "Eric Moore Police Station",
    "Western Avenue Police Station", "Itire Police Station",
    "Masha Police Station", "Randle Police Station", "Akerele Police Station",
    "Lawanson Police Station", "Surulere Fire Station",
    "Adeniran Ogunsanya Fire Station", "Bode Thomas Fire Station",
    "Ogunlana Fire Station", "Ojuelegba Fire Station", "Eric Moore Fire Station",
    "Western Avenue Fire Station", "Itire Fire Station", "Masha Fire Station",
    "Randle Fire Station", "Akerele Fire Station", "Lawanson Fire Station",
    "Surulere Post Office", "Adeniran Ogunsanya Post Office",
    "Bode Thomas Post Office", "Ogunlana Post Office", "Ojuelegba Post Office",
    "Eric Moore Post Office", "Western Avenue Post Office", "Itire Post Office",
    "Masha Post Office", "Randle Post Office", "Akerele Post Office",
    "Lawanson Post Office", "Surulere Bank", "Adeniran Ogunsanya Bank",
    "Bode Thomas Bank", "Ogunlana Bank", "Ojuelegba Bank", "Eric Moore Bank",
    "Western Avenue Bank", "Itire Bank", "Masha Bank", "Randle Bank",
    "Akerele Bank", "Lawanson Bank", "Surulere Church", "Adeniran Ogunsanya Church",
    "Bode Thomas Church", "Ogunlana Church", "Ojuelegba Church",
    "Eric Moore Church", "Western Avenue Church", "Itire Church",
    "Masha Church", "Randle Church", "Akerele Church", "Lawanson Church",
    "Surulere Mosque", "Adeniran Ogunsanya Mosque", "Bode Thomas Mosque",
    "Ogunlana Mosque", "Ojuelegba Mosque", "Eric Moore Mosque",
    "Western Avenue Mosque", "Itire Mosque", "Masha Mosque", "Randle Mosque",
    "Akerele Mosque", "Lawanson Mosque", "Surulere School",
    "Adeniran Ogunsanya School", "Bode Thomas School", "Ogunlana School",
    "Ojuelegba School", "Eric Moore School", "Western Avenue School",
    "Itire School", "Masha School", "Randle School", "Akerele School",
    "Lawanson School", "Surulere Hospital", "Adeniran Ogunsanya Hospital",
    "Bode Thomas Hospital", "Ogunlana Hospital", "Ojuelegba Hospital",
    "Eric Moore Hospital", "Western Avenue Hospital", "Itire Hospital",
    "Masha Hospital", "Randle Hospital", "Akerele Hospital", "Lawanson Hospital"
  ],
  "Yaba": [
    "University of Lagos", "UNILAG", "UNILAG Main Gate", "UNILAG Back Gate", "Unilag Road",
    "Herbert Macaulay Way", "Akoka Road", "Iwaya Road", "Sabo Road Yaba",
    "Jibowu Yaba", "Tejuosho Road", "University of Lagos Road", "Makoko Road",
    "Yaba", "Herbert Macaulay", "Akoka", "Iwaya", "Sabo",
    "Jibowu", "Tejuosho", "Unilag", "Makoko",
    "Yaba Bus Stop", "Herbert Macaulay Bus Stop", "Akoka Bus Stop",
    "Iwaya Bus Stop", "Sabo Bus Stop", "Jibowu Bus Stop", "Tejuosho Bus Stop",
    "Unilag Bus Stop", "Makoko Bus Stop", "Yaba Market", "Herbert Macaulay Market",
    "Akoka Market", "Iwaya Market", "Sabo Market", "Jibowu Market",
    "Tejuosho Market", "Unilag Market", "Makoko Market", "Yaba Police Station",
    "Herbert Macaulay Police Station", "Akoka Police Station", "Iwaya Police Station",
    "Sabo Police Station", "Jibowu Police Station", "Tejuosho Police Station",
    "Unilag Police Station", "Makoko Police Station", "Yaba Fire Station",
    "Herbert Macaulay Fire Station", "Akoka Fire Station", "Iwaya Fire Station",
    "Sabo Fire Station", "Jibowu Fire Station", "Tejuosho Fire Station",
    "Unilag Fire Station", "Makoko Fire Station", "Yaba Post Office",
    "Herbert Macaulay Post Office", "Akoka Post Office", "Iwaya Post Office",
    "Sabo Post Office", "Jibowu Post Office", "Tejuosho Post Office",
    "Unilag Post Office", "Makoko Post Office", "Yaba Bank", "Herbert Macaulay Bank",
    "Akoka Bank", "Iwaya Bank", "Sabo Bank", "Jibowu Bank", "Tejuosho Bank",
    "Unilag Bank", "Makoko Bank", "Yaba Church", "Herbert Macaulay Church",
    "Akoka Church", "Iwaya Church", "Sabo Church", "Jibowu Church",
    "Tejuosho Church", "Unilag Church", "Makoko Church", "Yaba Mosque",
    "Herbert Macaulay Mosque", "Akoka Mosque", "Iwaya Mosque", "Sabo Mosque",
    "Jibowu Mosque", "Tejuosho Mosque", "Unilag Mosque", "Makoko Mosque",
    "Yaba School", "Herbert Macaulay School", "Akoka School", "Iwaya School",
    "Sabo School", "Jibowu School", "Tejuosho School", "Unilag School",
    "Makoko School", "Yaba Hospital", "Herbert Macaulay Hospital",
    "Akoka Hospital", "Iwaya Hospital", "Sabo Hospital", "Jibowu Hospital",
    "Tejuosho Hospital", "Unilag Hospital", "Makoko Hospital"
  ],
  "Oshodi/Isolo": [
    "International Airport Road", "Bolade Road", "Oshodi Market",
    "Ago Palace Way", "Okota Road", "Cele Expressway", "Ilasamaja Road",
    "Ejigbo Road", "Oshodi", "Isolo", "Bolade", "Ago Palace",
    "Okota", "Cele", "Ilasamaja", "Ejigbo",
    "Oshodi Bus Stop", "Isolo Bus Stop", "Bolade Bus Stop", "Ago Palace Bus Stop",
    "Okota Bus Stop", "Cele Bus Stop", "Ilasamaja Bus Stop", "Ejigbo Bus Stop",
    "Oshodi Market", "Isolo Market", "Bolade Market", "Ago Palace Market",
    "Okota Market", "Cele Market", "Ilasamaja Market", "Ejigbo Market",
    "Oshodi Police Station", "Isolo Police Station", "Bolade Police Station",
    "Ago Palace Police Station", "Okota Police Station", "Cele Police Station",
    "Ilasamaja Police Station", "Ejigbo Police Station", "Oshodi Fire Station",
    "Isolo Fire Station", "Bolade Fire Station", "Ago Palace Fire Station",
    "Okota Fire Station", "Cele Fire Station", "Ilasamaja Fire Station",
    "Ejigbo Fire Station", "Oshodi Post Office", "Isolo Post Office",
    "Bolade Post Office", "Ago Palace Post Office", "Okota Post Office",
    "Cele Post Office", "Ilasamaja Post Office", "Ejigbo Post Office",
    "Oshodi Bank", "Isolo Bank", "Bolade Bank", "Ago Palace Bank",
    "Okota Bank", "Cele Bank", "Ilasamaja Bank", "Ejigbo Bank",
    "Oshodi Church", "Isolo Church", "Bolade Church", "Ago Palace Church",
    "Okota Church", "Cele Church", "Ilasamaja Church", "Ejigbo Church",
    "Oshodi Mosque", "Isolo Mosque", "Bolade Mosque", "Ago Palace Mosque",
    "Okota Mosque", "Cele Mosque", "Ilasamaja Mosque", "Ejigbo Mosque",
    "Oshodi School", "Isolo School", "Bolade School", "Ago Palace School",
    "Okota School", "Cele School", "Ilasamaja School", "Ejigbo School",
    "Oshodi Hospital", "Isolo Hospital", "Bolade Hospital", "Ago Palace Hospital",
    "Okota Hospital", "Cele Hospital", "Ilasamaja Hospital", "Ejigbo Hospital"
  ],
  "Shomolu/Bariga": [
    "Shomolu Road", "Bariga Road", "Onigbongbo", "Obanikoro Road",
    "Fadeyi Shomolu", "Pedro Shomolu", "Shomolu", "Bariga",
    "Onigbongbo", "Obanikoro", "Fadeyi", "Pedro",
    "Shomolu Bus Stop", "Bariga Bus Stop", "Onigbongbo Bus Stop",
    "Obanikoro Bus Stop", "Fadeyi Bus Stop", "Pedro Bus Stop",
    "Shomolu Market", "Bariga Market", "Onigbongbo Market", "Obanikoro Market",
    "Fadeyi Market", "Pedro Market", "Shomolu Police Station",
    "Bariga Police Station", "Onigbongbo Police Station", "Obanikoro Police Station",
    "Fadeyi Police Station", "Pedro Police Station", "Shomolu Fire Station",
    "Bariga Fire Station", "Onigbongbo Fire Station", "Obanikoro Fire Station",
    "Fadeyi Fire Station", "Pedro Fire Station", "Shomolu Post Office",
    "Bariga Post Office", "Onigbongbo Post Office", "Obanikoro Post Office",
    "Fadeyi Post Office", "Pedro Post Office", "Shomolu Bank", "Bariga Bank",
    "Onigbongbo Bank", "Obanikoro Bank", "Fadeyi Bank", "Pedro Bank",
    "Shomolu Church", "Bariga Church", "Onigbongbo Church", "Obanikoro Church",
    "Fadeyi Church", "Pedro Church", "Shomolu Mosque", "Bariga Mosque",
    "Onigbongbo Mosque", "Obanikoro Mosque", "Fadeyi Mosque", "Pedro Mosque",
    "Shomolu School", "Bariga School", "Onigbongbo School", "Obanikoro School",
    "Fadeyi School", "Pedro School", "Shomolu Hospital", "Bariga Hospital",
    "Onigbongbo Hospital", "Obanikoro Hospital", "Fadeyi Hospital", "Pedro Hospital"
  ],
  "Ebute Metta": [
    "Ebute Metta East", "Ebute Metta West", "Willoughby Street",
    "Oyingbo Market Road", "Olawale Street", "Ebute Metta",
    "Ebute Metta East", "Ebute Metta West", "Willoughby",
    "Oyingbo", "Olawale", "Ebute Metta Bus Stop", "Ebute Metta East Bus Stop",
    "Ebute Metta West Bus Stop", "Willoughby Bus Stop", "Oyingbo Bus Stop",
    "Olawale Bus Stop", "Ebute Metta Market", "Ebute Metta East Market",
    "Ebute Metta West Market", "Willoughby Market", "Oyingbo Market",
    "Olawale Market", "Ebute Metta Police Station", "Ebute Metta East Police Station",
    "Ebute Metta West Police Station", "Willoughby Police Station",
    "Oyingbo Police Station", "Olawale Police Station", "Ebute Metta Fire Station",
    "Ebute Metta East Fire Station", "Ebute Metta West Fire Station",
    "Willoughby Fire Station", "Oyingbo Fire Station", "Olawale Fire Station",
    "Ebute Metta Post Office", "Ebute Metta East Post Office",
    "Ebute Metta West Post Office", "Willoughby Post Office", "Oyingbo Post Office",
    "Olawale Post Office", "Ebute Metta Bank", "Ebute Metta East Bank",
    "Ebute Metta West Bank", "Willoughby Bank", "Oyingbo Bank", "Olawale Bank",
    "Ebute Metta Church", "Ebute Metta East Church", "Ebute Metta West Church",
    "Willoughby Church", "Oyingbo Church", "Olawale Church", "Ebute Metta Mosque",
    "Ebute Metta East Mosque", "Ebute Metta West Mosque", "Willoughby Mosque",
    "Oyingbo Mosque", "Olawale Mosque", "Ebute Metta School",
    "Ebute Metta East School", "Ebute Metta West School", "Willoughby School",
    "Oyingbo School", "Olawale School", "Ebute Metta Hospital",
    "Ebute Metta East Hospital", "Ebute Metta West Hospital", "Willoughby Hospital",
    "Oyingbo Hospital", "Olawale Hospital"
  ],
  "Apapa": [
    "Apapa GRA", "Creek Road", "Commercial Road Apapa", "Liverpool Road",
    "Marine Beach Road", "Kirikiri Road", "Burma Road", "Apapa",
    "Apapa GRA", "Creek", "Commercial", "Liverpool",
    "Marine Beach", "Kirikiri", "Burma",
    "Apapa Bus Stop", "Apapa GRA Bus Stop", "Creek Road Bus Stop",
    "Commercial Road Bus Stop", "Liverpool Road Bus Stop", "Marine Beach Bus Stop",
    "Kirikiri Road Bus Stop", "Burma Road Bus Stop", "Apapa Market",
    "Apapa GRA Market", "Creek Road Market", "Commercial Road Market",
    "Liverpool Road Market", "Marine Beach Market", "Kirikiri Road Market",
    "Burma Road Market", "Apapa Police Station", "Apapa GRA Police Station",
    "Creek Road Police Station", "Commercial Road Police Station",
    "Liverpool Road Police Station", "Marine Beach Police Station",
    "Kirikiri Road Police Station", "Burma Road Police Station",
    "Apapa Fire Station", "Apapa GRA Fire Station", "Creek Road Fire Station",
    "Commercial Road Fire Station", "Liverpool Road Fire Station",
    "Marine Beach Fire Station", "Kirikiri Road Fire Station",
    "Burma Road Fire Station", "Apapa Post Office", "Apapa GRA Post Office",
    "Creek Road Post Office", "Commercial Road Post Office",
    "Liverpool Road Post Office", "Marine Beach Post Office",
    "Kirikiri Road Post Office", "Burma Road Post Office", "Apapa Bank",
    "Apapa GRA Bank", "Creek Road Bank", "Commercial Road Bank",
    "Liverpool Road Bank", "Marine Beach Bank", "Kirikiri Road Bank",
    "Burma Road Bank", "Apapa Church", "Apapa GRA Church", "Creek Road Church",
    "Commercial Road Church", "Liverpool Road Church", "Marine Beach Church",
    "Kirikiri Road Church", "Burma Road Church", "Apapa Mosque",
    "Apapa GRA Mosque", "Creek Road Mosque", "Commercial Road Mosque",
    "Liverpool Road Mosque", "Marine Beach Mosque", "Kirikiri Road Mosque",
    "Burma Road Mosque", "Apapa School", "Apapa GRA School", "Creek Road School",
    "Commercial Road School", "Liverpool Road School", "Marine Beach School",
    "Kirikiri Road School", "Burma Road School", "Apapa Hospital",
    "Apapa GRA Hospital", "Creek Road Hospital", "Commercial Road Hospital",
    "Liverpool Road Hospital", "Marine Beach Hospital", "Kirikiri Road Hospital",
    "Burma Road Hospital"
  ],
  "Lagos Island": [
    "Broad Street", "Marina Lagos", "Nnamdi Azikiwe Street", "Tinubu Square",
    "Balogun Market Area", "Idumota", "Ereko Street", "Custom Street",
    "Lagos Island GRA", "Lagos Island", "Broad", "Marina",
    "Nnamdi Azikiwe", "Tinubu", "Balogun", "Idumota",
    "Ereko", "Custom", "Lagos Island GRA",
    "Lagos Island Bus Stop", "Broad Street Bus Stop", "Marina Bus Stop",
    "Nnamdi Azikiwe Bus Stop", "Tinubu Square Bus Stop", "Balogun Market Bus Stop",
    "Idumota Bus Stop", "Ereko Street Bus Stop", "Custom Street Bus Stop",
    "Lagos Island GRA Bus Stop", "Lagos Island Market", "Broad Street Market",
    "Marina Market", "Nnamdi Azikiwe Market", "Tinubu Square Market",
    "Balogun Market", "Idumota Market", "Ereko Street Market",
    "Custom Street Market", "Lagos Island GRA Market", "Lagos Island Police Station",
    "Broad Street Police Station", "Marina Police Station",
    "Nnamdi Azikiwe Police Station", "Tinubu Square Police Station",
    "Balogun Market Police Station", "Idumota Police Station",
    "Ereko Street Police Station", "Custom Street Police Station",
    "Lagos Island GRA Police Station", "Lagos Island Fire Station",
    "Broad Street Fire Station", "Marina Fire Station", "Nnamdi Azikiwe Fire Station",
    "Tinubu Square Fire Station", "Balogun Market Fire Station",
    "Idumota Fire Station", "Ereko Street Fire Station", "Custom Street Fire Station",
    "Lagos Island GRA Fire Station", "Lagos Island Post Office",
    "Broad Street Post Office", "Marina Post Office", "Nnamdi Azikiwe Post Office",
    "Tinubu Square Post Office", "Balogun Market Post Office",
    "Idumota Post Office", "Ereko Street Post Office", "Custom Street Post Office",
    "Lagos Island GRA Post Office", "Lagos Island Bank", "Broad Street Bank",
    "Marina Bank", "Nnamdi Azikiwe Bank", "Tinubu Square Bank",
    "Balogun Market Bank", "Idumota Bank", "Ereko Street Bank",
    "Custom Street Bank", "Lagos Island GRA Bank", "Lagos Island Church",
    "Broad Street Church", "Marina Church", "Nnamdi Azikiwe Church",
    "Tinubu Square Church", "Balogun Market Church", "Idumota Church",
    "Ereko Street Church", "Custom Street Church", "Lagos Island GRA Church",
    "Lagos Island Mosque", "Broad Street Mosque", "Marina Mosque",
    "Nnamdi Azikiwe Mosque", "Tinubu Square Mosque", "Balogun Market Mosque",
    "Idumota Mosque", "Ereko Street Mosque", "Custom Street Mosque",
    "Lagos Island GRA Mosque", "Lagos Island School", "Broad Street School",
    "Marina School", "Nnamdi Azikiwe School", "Tinubu Square School",
    "Balogun Market School", "Idumota School", "Ereko Street School",
    "Custom Street School", "Lagos Island GRA School", "Lagos Island Hospital",
    "Broad Street Hospital", "Marina Hospital", "Nnamdi Azikiwe Hospital",
    "Tinubu Square Hospital", "Balogun Market Hospital", "Idumota Hospital",
    "Ereko Street Hospital", "Custom Street Hospital", "Lagos Island GRA Hospital"
  ],
  "Ikoyi": [
    "Bourdillon Road", "Osborne Road", "Alexander Road", "Kingsway Road Ikoyi",
    "Awolowo Road", "Gerrard Road", "Banana Island", "Parkview Estate",
    "Lugard Avenue", "Ikoyi", "Bourdillon", "Osborne",
    "Alexander", "Kingsway", "Awolowo", "Gerrard",
    "Banana", "Parkview", "Lugard",
    "Ikoyi Bus Stop", "Bourdillon Road Bus Stop", "Osborne Road Bus Stop",
    "Alexander Road Bus Stop", "Kingsway Road Bus Stop", "Awolowo Road Bus Stop",
    "Gerrard Road Bus Stop", "Banana Island Bus Stop", "Parkview Estate Bus Stop",
    "Lugard Avenue Bus Stop", "Ikoyi Market", "Bourdillon Road Market",
    "Osborne Road Market", "Alexander Road Market", "Kingsway Road Market",
    "Awolowo Road Market", "Gerrard Road Market", "Banana Island Market",
    "Parkview Estate Market", "Lugard Avenue Market", "Ikoyi Police Station",
    "Bourdillon Road Police Station", "Osborne Road Police Station",
    "Alexander Road Police Station", "Kingsway Road Police Station",
    "Awolowo Road Police Station", "Gerrard Road Police Station",
    "Banana Island Police Station", "Parkview Estate Police Station",
    "Lugard Avenue Police Station", "Ikoyi Fire Station", "Bourdillon Road Fire Station",
    "Osborne Road Fire Station", "Alexander Road Fire Station",
    "Kingsway Road Fire Station", "Awolowo Road Fire Station",
    "Gerrard Road Fire Station", "Banana Island Fire Station",
    "Parkview Estate Fire Station", "Lugard Avenue Fire Station",
    "Ikoyi Post Office", "Bourdillon Road Post Office", "Osborne Road Post Office",
    "Alexander Road Post Office", "Kingsway Road Post Office",
    "Awolowo Road Post Office", "Gerrard Road Post Office",
    "Banana Island Post Office", "Parkview Estate Post Office",
    "Lugard Avenue Post Office", "Ikoyi Bank", "Bourdillon Road Bank",
    "Osborne Road Bank", "Alexander Road Bank", "Kingsway Road Bank",
    "Awolowo Road Bank", "Gerrard Road Bank", "Banana Island Bank",
    "Parkview Estate Bank", "Lugard Avenue Bank", "Ikoyi Church",
    "Bourdillon Road Church", "Osborne Road Church", "Alexander Road Church",
    "Kingsway Road Church", "Awolowo Road Church", "Gerrard Road Church",
    "Banana Island Church", "Parkview Estate Church", "Lugard Avenue Church",
    "Ikoyi Mosque", "Bourdillon Road Mosque", "Osborne Road Mosque",
    "Alexander Road Mosque", "Kingsway Road Mosque", "Awolowo Road Mosque",
    "Gerrard Road Mosque", "Banana Island Mosque", "Parkview Estate Mosque",
    "Lugard Avenue Mosque", "Ikoyi School", "Bourdillon Road School",
    "Osborne Road School", "Alexander Road School", "Kingsway Road School",
    "Awolowo Road School", "Gerrard Road School", "Banana Island School",
    "Parkview Estate School", "Lugard Avenue School", "Ikoyi Hospital",
    "Bourdillon Road Hospital", "Osborne Road Hospital", "Alexander Road Hospital",
    "Kingsway Road Hospital", "Awolowo Road Hospital", "Gerrard Road Hospital",
    "Banana Island Hospital", "Parkview Estate Hospital", "Lugard Avenue Hospital"
  ],
  "Victoria Island": [
    "Adeola Odeku Street", "Akin Adesola Street", "Ozumba Mbadiwe Avenue",
    "Idejo Street", "Ahmadu Bello Way VI", "Ligali Ayorinde Street",
    "Sanusi Fafunwa Street", "Kofo Abayomi Street", "Ademola Adetokunbo Street",
    "Oniru Estate Road", "Victoria Island", "Adeola Odeku",
    "Akin Adesola", "Ozumba Mbadiwe", "Idejo", "Ahmadu Bello",
    "Ligali Ayorinde", "Sanusi Fafunwa", "Kofo Abayomi",
    "Ademola Adetokunbo", "Oniru",
    "Victoria Island Bus Stop", "Adeola Odeku Bus Stop", "Akin Adesola Bus Stop",
    "Ozumba Mbadiwe Bus Stop", "Idejo Bus Stop", "Ahmadu Bello Way Bus Stop",
    "Ligali Ayorinde Bus Stop", "Sanusi Fafunwa Bus Stop", "Kofo Abayomi Bus Stop",
    "Ademola Adetokunbo Bus Stop", "Oniru Estate Bus Stop", "Victoria Island Market",
    "Adeola Odeku Market", "Akin Adesola Market", "Ozumba Mbadiwe Market",
    "Idejo Market", "Ahmadu Bello Way Market", "Ligali Ayorinde Market",
    "Sanusi Fafunwa Market", "Kofo Abayomi Market", "Ademola Adetokunbo Market",
    "Oniru Estate Market", "Victoria Island Police Station",
    "Adeola Odeku Police Station", "Akin Adesola Police Station",
    "Ozumba Mbadiwe Police Station", "Idejo Police Station",
    "Ahmadu Bello Way Police Station", "Ligali Ayorinde Police Station",
    "Sanusi Fafunwa Police Station", "Kofo Abayomi Police Station",
    "Ademola Adetokunbo Police Station", "Oniru Estate Police Station",
    "Victoria Island Fire Station", "Adeola Odeku Fire Station",
    "Akin Adesola Fire Station", "Ozumba Mbadiwe Fire Station",
    "Idejo Fire Station", "Ahmadu Bello Way Fire Station",
    "Ligali Ayorinde Fire Station", "Sanusi Fafunwa Fire Station",
    "Kofo Abayomi Fire Station", "Ademola Adetokunbo Fire Station",
    "Oniru Estate Fire Station", "Victoria Island Post Office",
    "Adeola Odeku Post Office", "Akin Adesola Post Office",
    "Ozumba Mbadiwe Post Office", "Idejo Post Office",
    "Ahmadu Bello Way Post Office", "Ligali Ayorinde Post Office",
    "Sanusi Fafunwa Post Office", "Kofo Abayomi Post Office",
    "Ademola Adetokunbo Post Office", "Oniru Estate Post Office",
    "Victoria Island Bank", "Adeola Odeku Bank", "Akin Adesola Bank",
    "Ozumba Mbadiwe Bank", "Idejo Bank", "Ahmadu Bello Way Bank",
    "Ligali Ayorinde Bank", "Sanusi Fafunwa Bank", "Kofo Abayomi Bank",
    "Ademola Adetokunbo Bank", "Oniru Estate Bank", "Victoria Island Church",
    "Adeola Odeku Church", "Akin Adesola Church", "Ozumba Mbadiwe Church",
    "Idejo Church", "Ahmadu Bello Way Church", "Ligali Ayorinde Church",
    "Sanusi Fafunwa Church", "Kofo Abayomi Church", "Ademola Adetokunbo Church",
    "Oniru Estate Church", "Victoria Island Mosque", "Adeola Odeku Mosque",
    "Akin Adesola Mosque", "Ozumba Mbadiwe Mosque", "Idejo Mosque",
    "Ahmadu Bello Way Mosque", "Ligali Ayorinde Mosque", "Sanusi Fafunwa Mosque",
    "Kofo Abayomi Mosque", "Ademola Adetokunbo Mosque", "Oniru Estate Mosque",
    "Victoria Island School", "Adeola Odeku School", "Akin Adesola School",
    "Ozumba Mbadiwe School", "Idejo School", "Ahmadu Bello Way School",
    "Ligali Ayorinde School", "Sanusi Fafunwa School", "Kofo Abayomi School",
    "Ademola Adetokunbo School", "Oniru Estate School", "Victoria Island Hospital",
    "Adeola Odeku Hospital", "Akin Adesola Hospital", "Ozumba Mbadiwe Hospital",
    "Idejo Hospital", "Ahmadu Bello Way Hospital", "Ligali Ayorinde Hospital",
    "Sanusi Fafunwa Hospital", "Kofo Abayomi Hospital", "Ademola Adetokunbo Hospital",
    "Oniru Estate Hospital"
  ],
  "Obalende/CMS": [
    "Obalende Road", "Race Course Road", "Hawley Street", "Campbell Street",
    "Awolowo Road Obalende", "Igbosere Road", "Obalende", "CMS",
    "Race Course", "Hawley", "Campbell", "Awolowo", "Igbosere",
    "Obalende Bus Stop", "Race Course Bus Stop", "Hawley Street Bus Stop",
    "Campbell Street Bus Stop", "Awolowo Road Bus Stop", "Igbosere Road Bus Stop",
    "CMS Bus Stop", "Obalende Market", "Race Course Market", "Hawley Street Market",
    "Campbell Street Market", "Awolowo Road Market", "Igbosere Road Market",
    "CMS Market", "Obalende Police Station", "Race Course Police Station",
    "Hawley Street Police Station", "Campbell Street Police Station",
    "Awolowo Road Police Station", "Igbosere Road Police Station",
    "CMS Police Station", "Obalende Fire Station", "Race Course Fire Station",
    "Hawley Street Fire Station", "Campbell Street Fire Station",
    "Awolowo Road Fire Station", "Igbosere Road Fire Station", "CMS Fire Station",
    "Obalende Post Office", "Race Course Post Office", "Hawley Street Post Office",
    "Campbell Street Post Office", "Awolowo Road Post Office",
    "Igbosere Road Post Office", "CMS Post Office", "Obalende Bank",
    "Race Course Bank", "Hawley Street Bank", "Campbell Street Bank",
    "Awolowo Road Bank", "Igbosere Road Bank", "CMS Bank", "Obalende Church",
    "Race Course Church", "Hawley Street Church", "Campbell Street Church",
    "Awolowo Road Church", "Igbosere Road Church", "CMS Church",
    "Obalende Mosque", "Race Course Mosque", "Hawley Street Mosque",
    "Campbell Street Mosque", "Awolowo Road Mosque", "Igbosere Road Mosque",
    "CMS Mosque", "Obalende School", "Race Course School", "Hawley Street School",
    "Campbell Street School", "Awolowo Road School", "Igbosere Road School",
    "CMS School", "Obalende Hospital", "Race Course Hospital",
    "Hawley Street Hospital", "Campbell Street Hospital", "Awolowo Road Hospital",
    "Igbosere Road Hospital", "CMS Hospital"
  ],
  "Lekki Phase 1": [
    "Admiralty Way", "Fola Osibo Road", "Adewunmi Adebimpe Drive",
    "Omorinre Johnson Street", "Bisola Durosinmi-Etti Drive", "Adebayo Doherty Road",
    "Freedom Way Lekki", "T.F. Kuboye Road", "Jakande Road Lekki",
    "Lekki Phase 1", "Admiralty", "Fola Osibo", "Adewunmi Adebimpe",
    "Omorinre Johnson", "Bisola Durosinmi-Etti", "Adebayo Doherty",
    "Freedom Way", "T.F. Kuboye", "Jakande",
    "Lekki Phase 1 Bus Stop", "Admiralty Way Bus Stop", "Fola Osibo Bus Stop",
    "Adewunmi Adebimpe Bus Stop", "Omorinre Johnson Bus Stop",
    "Bisola Durosinmi-Etti Bus Stop", "Adebayo Doherty Bus Stop",
    "Freedom Way Bus Stop", "T.F. Kuboye Bus Stop", "Jakande Road Bus Stop",
    "Lekki Phase 1 Market", "Admiralty Way Market", "Fola Osibo Market",
    "Adewunmi Adebimpe Market", "Omorinre Johnson Market",
    "Bisola Durosinmi-Etti Market", "Adebayo Doherty Market",
    "Freedom Way Market", "T.F. Kuboye Market", "Jakande Road Market",
    "Lekki Phase 1 Police Station", "Admiralty Way Police Station",
    "Fola Osibo Police Station", "Adewunmi Adebimpe Police Station",
    "Omorinre Johnson Police Station", "Bisola Durosinmi-Etti Police Station",
    "Adebayo Doherty Police Station", "Freedom Way Police Station",
    "T.F. Kuboye Police Station", "Jakande Road Police Station",
    "Lekki Phase 1 Fire Station", "Admiralty Way Fire Station",
    "Fola Osibo Fire Station", "Adewunmi Adebimpe Fire Station",
    "Omorinre Johnson Fire Station", "Bisola Durosinmi-Etti Fire Station",
    "Adebayo Doherty Fire Station", "Freedom Way Fire Station",
    "T.F. Kuboye Fire Station", "Jakande Road Fire Station",
    "Lekki Phase 1 Post Office", "Admiralty Way Post Office",
    "Fola Osibo Post Office", "Adewunmi Adebimpe Post Office",
    "Omorinre Johnson Post Office", "Bisola Durosinmi-Etti Post Office",
    "Adebayo Doherty Post Office", "Freedom Way Post Office",
    "T.F. Kuboye Post Office", "Jakande Road Post Office",
    "Lekki Phase 1 Bank", "Admiralty Way Bank", "Fola Osibo Bank",
    "Adewunmi Adebimpe Bank", "Omorinre Johnson Bank",
    "Bisola Durosinmi-Etti Bank", "Adebayo Doherty Bank",
    "Freedom Way Bank", "T.F. Kuboye Bank", "Jakande Road Bank",
    "Lekki Phase 1 Church", "Admiralty Way Church", "Fola Osibo Church",
    "Adewunmi Adebimpe Church", "Omorinre Johnson Church",
    "Bisola Durosinmi-Etti Church", "Adebayo Doherty Church",
    "Freedom Way Church", "T.F. Kuboye Church", "Jakande Road Church",
    "Lekki Phase 1 Mosque", "Admiralty Way Mosque", "Fola Osibo Mosque",
    "Adewunmi Adebimpe Mosque", "Omorinre Johnson Mosque",
    "Bisola Durosinmi-Etti Mosque", "Adebayo Doherty Mosque",
    "Freedom Way Mosque", "T.F. Kuboye Mosque", "Jakande Road Mosque",
    "Lekki Phase 1 School", "Admiralty Way School", "Fola Osibo School",
    "Adewunmi Adebimpe School", "Omorinre Johnson School",
    "Bisola Durosinmi-Etti School", "Adebayo Doherty School",
    "Freedom Way School", "T.F. Kuboye School", "Jakande Road School",
    "Lekki Phase 1 Hospital", "Admiralty Way Hospital", "Fola Osibo Hospital",
    "Adewunmi Adebimpe Hospital", "Omorinre Johnson Hospital",
    "Bisola Durosinmi-Etti Hospital", "Adebayo Doherty Hospital",
    "Freedom Way Hospital", "T.F. Kuboye Hospital", "Jakande Road Hospital"
  ],
  "Lekki Phase 2/Ikota": [
    "Crown Estate Road", "Orchid Road Lekki", "Ikota Shopping Complex Road",
    "VGC Road", "Megamound Road", "Abraham Adesanya Road",
    "Thomas Estate Road Ikota", "Lekki Phase 2", "Ikota",
    "Crown Estate", "Orchid", "Ikota Shopping Complex", "VGC",
    "Megamound", "Abraham Adesanya", "Thomas Estate",
    "Lekki Phase 2 Bus Stop", "Ikota Bus Stop", "Crown Estate Bus Stop",
    "Orchid Road Bus Stop", "Ikota Shopping Complex Bus Stop", "VGC Bus Stop",
    "Megamound Bus Stop", "Abraham Adesanya Bus Stop", "Thomas Estate Bus Stop",
    "Lekki Phase 2 Market", "Ikota Market", "Crown Estate Market",
    "Orchid Road Market", "Ikota Shopping Complex Market", "VGC Market",
    "Megamound Market", "Abraham Adesanya Market", "Thomas Estate Market",
    "Lekki Phase 2 Police Station", "Ikota Police Station", "Crown Estate Police Station",
    "Orchid Road Police Station", "Ikota Shopping Complex Police Station",
    "VGC Police Station", "Megamound Police Station", "Abraham Adesanya Police Station",
    "Thomas Estate Police Station", "Lekki Phase 2 Fire Station",
    "Ikota Fire Station", "Crown Estate Fire Station", "Orchid Road Fire Station",
    "Ikota Shopping Complex Fire Station", "VGC Fire Station",
    "Megamound Fire Station", "Abraham Adesanya Fire Station",
    "Thomas Estate Fire Station", "Lekki Phase 2 Post Office", "Ikota Post Office",
    "Crown Estate Post Office", "Orchid Road Post Office",
    "Ikota Shopping Complex Post Office", "VGC Post Office",
    "Megamound Post Office", "Abraham Adesanya Post Office",
    "Thomas Estate Post Office", "Lekki Phase 2 Bank", "Ikota Bank",
    "Crown Estate Bank", "Orchid Road Bank", "Ikota Shopping Complex Bank",
    "VGC Bank", "Megamound Bank", "Abraham Adesanya Bank", "Thomas Estate Bank",
    "Lekki Phase 2 Church", "Ikota Church", "Crown Estate Church",
    "Orchid Road Church", "Ikota Shopping Complex Church", "VGC Church",
    "Megamound Church", "Abraham Adesanya Church", "Thomas Estate Church",
    "Lekki Phase 2 Mosque", "Ikota Mosque", "Crown Estate Mosque",
    "Orchid Road Mosque", "Ikota Shopping Complex Mosque", "VGC Mosque",
    "Megamound Mosque", "Abraham Adesanya Mosque", "Thomas Estate Mosque",
    "Lekki Phase 2 School", "Ikota School", "Crown Estate School",
    "Orchid Road School", "Ikota Shopping Complex School", "VGC School",
    "Megamound School", "Abraham Adesanya School", "Thomas Estate School",
    "Lekki Phase 2 Hospital", "Ikota Hospital", "Crown Estate Hospital",
    "Orchid Road Hospital", "Ikota Shopping Complex Hospital", "VGC Hospital",
    "Megamound Hospital", "Abraham Adesanya Hospital", "Thomas Estate Hospital"
  ],
  "Ajah": [
    "Abraham Adesanya Estate", "Jakande Estate Ajah", "Badore Road",
    "Ilaje Road Ajah", "Thomas Estate Road", "Sangotedo Road",
    "Addo Road Ajah", "Monastery Road", "Ajah",
    "Abraham Adesanya", "Jakande", "Badore", "Ilaje",
    "Thomas Estate", "Sangotedo", "Addo", "Monastery",
    "Ajah Bus Stop", "Abraham Adesanya Bus Stop", "Jakande Estate Bus Stop",
    "Badore Road Bus Stop", "Ilaje Road Bus Stop", "Thomas Estate Bus Stop",
    "Sangotedo Road Bus Stop", "Addo Road Bus Stop", "Monastery Road Bus Stop",
    "Ajah Market", "Abraham Adesanya Market", "Jakande Estate Market",
    "Badore Road Market", "Ilaje Road Market", "Thomas Estate Market",
    "Sangotedo Road Market", "Addo Road Market", "Monastery Road Market",
    "Ajah Police Station", "Abraham Adesanya Police Station",
    "Jakande Estate Police Station", "Badore Road Police Station",
    "Ilaje Road Police Station", "Thomas Estate Police Station",
    "Sangotedo Road Police Station", "Addo Road Police Station",
    "Monastery Road Police Station", "Ajah Fire Station", "Abraham Adesanya Fire Station",
    "Jakande Estate Fire Station", "Badore Road Fire Station", "Ilaje Road Fire Station",
    "Thomas Estate Fire Station", "Sangotedo Road Fire Station",
    "Addo Road Fire Station", "Monastery Road Fire Station", "Ajah Post Office",
    "Abraham Adesanya Post Office", "Jakande Estate Post Office",
    "Badore Road Post Office", "Ilaje Road Post Office", "Thomas Estate Post Office",
    "Sangotedo Road Post Office", "Addo Road Post Office",
    "Monastery Road Post Office", "Ajah Bank", "Abraham Adesanya Bank",
    "Jakande Estate Bank", "Badore Road Bank", "Ilaje Road Bank",
    "Thomas Estate Bank", "Sangotedo Road Bank", "Addo Road Bank",
    "Monastery Road Bank", "Ajah Church", "Abraham Adesanya Church",
    "Jakande Estate Church", "Badore Road Church", "Ilaje Road Church",
    "Thomas Estate Church", "Sangotedo Road Church", "Addo Road Church",
    "Monastery Road Church", "Ajah Mosque", "Abraham Adesanya Mosque",
    "Jakande Estate Mosque", "Badore Road Mosque", "Ilaje Road Mosque",
    "Thomas Estate Mosque", "Sangotedo Road Mosque", "Addo Road Mosque",
    "Monastery Road Mosque", "Ajah School", "Abraham Adesanya School",
    "Jakande Estate School", "Badore Road School", "Ilaje Road School",
    "Thomas Estate School", "Sangotedo Road School", "Addo Road School",
    "Monastery Road School", "Ajah Hospital", "Abraham Adesanya Hospital",
    "Jakande Estate Hospital", "Badore Road Hospital", "Ilaje Road Hospital",
    "Thomas Estate Hospital", "Sangotedo Road Hospital", "Addo Road Hospital",
    "Monastery Road Hospital"
  ],
  "Chevron/Lekki-Epe Expressway": [
    "Chevron Alternative Route", "Chevron Drive", "Palace Road Lekki",
    "Osapa London", "Ikate-Elegushi Road", "Oral Estate Road",
    "Mobil Road Lekki", "Chevron", "Lekki-Epe Expressway",
    "Chevron Alternative", "Chevron Drive", "Palace Road",
    "Osapa", "Ikate-Elegushi", "Oral Estate", "Mobil",
    "Chevron Bus Stop", "Lekki-Epe Expressway Bus Stop", "Chevron Alternative Bus Stop",
    "Chevron Drive Bus Stop", "Palace Road Bus Stop", "Osapa London Bus Stop",
    "Ikate-Elegushi Bus Stop", "Oral Estate Bus Stop", "Mobil Road Bus Stop",
    "Chevron Market", "Lekki-Epe Expressway Market", "Chevron Alternative Market",
    "Chevron Drive Market", "Palace Road Market", "Osapa London Market",
    "Ikate-Elegushi Market", "Oral Estate Market", "Mobil Road Market",
    "Chevron Police Station", "Lekki-Epe Expressway Police Station",
    "Chevron Alternative Police Station", "Chevron Drive Police Station",
    "Palace Road Police Station", "Osapa London Police Station",
    "Ikate-Elegushi Police Station", "Oral Estate Police Station",
    "Mobil Road Police Station", "Chevron Fire Station",
    "Lekki-Epe Expressway Fire Station", "Chevron Alternative Fire Station",
    "Chevron Drive Fire Station", "Palace Road Fire Station",
    "Osapa London Fire Station", "Ikate-Elegushi Fire Station",
    "Oral Estate Fire Station", "Mobil Road Fire Station", "Chevron Post Office",
    "Lekki-Epe Expressway Post Office", "Chevron Alternative Post Office",
    "Chevron Drive Post Office", "Palace Road Post Office", "Osapa London Post Office",
    "Ikate-Elegushi Post Office", "Oral Estate Post Office", "Mobil Road Post Office",
    "Chevron Bank", "Lekki-Epe Expressway Bank", "Chevron Alternative Bank",
    "Chevron Drive Bank", "Palace Road Bank", "Osapa London Bank",
    "Ikate-Elegushi Bank", "Oral Estate Bank", "Mobil Road Bank",
    "Chevron Church", "Lekki-Epe Expressway Church", "Chevron Alternative Church",
    "Chevron Drive Church", "Palace Road Church", "Osapa London Church",
    "Ikate-Elegushi Church", "Oral Estate Church", "Mobil Road Church",
    "Chevron Mosque", "Lekki-Epe Expressway Mosque", "Chevron Alternative Mosque",
    "Chevron Drive Mosque", "Palace Road Mosque", "Osapa London Mosque",
    "Ikate-Elegushi Mosque", "Oral Estate Mosque", "Mobil Road Mosque",
    "Chevron School", "Lekki-Epe Expressway School", "Chevron Alternative School",
    "Chevron Drive School", "Palace Road School", "Osapa London School",
    "Ikate-Elegushi School", "Oral Estate School", "Mobil Road School",
    "Chevron Hospital", "Lekki-Epe Expressway Hospital", "Chevron Alternative Hospital",
    "Chevron Drive Hospital", "Palace Road Hospital", "Osapa London Hospital",
    "Ikate-Elegushi Hospital", "Oral Estate Hospital", "Mobil Road Hospital"
  ],
  "Igbo Efon/Ilasan": [
    "Igbo Efon Road", "Ilasan Road", "Agungi Road Igbo Efon", "Ologolo Road",
    "Lekki Conservation Road", "Igbo Efon", "Ilasan",
    "Agungi", "Ologolo", "Lekki Conservation",
    "Igbo Efon Bus Stop", "Ilasan Bus Stop", "Agungi Road Bus Stop",
    "Ologolo Road Bus Stop", "Lekki Conservation Road Bus Stop",
    "Igbo Efon Market", "Ilasan Market", "Agungi Road Market",
    "Ologolo Road Market", "Lekki Conservation Road Market",
    "Igbo Efon Police Station", "Ilasan Police Station", "Agungi Road Police Station",
    "Ologolo Road Police Station", "Lekki Conservation Road Police Station",
    "Igbo Efon Fire Station", "Ilasan Fire Station", "Agungi Road Fire Station",
    "Ologolo Road Fire Station", "Lekki Conservation Road Fire Station",
    "Igbo Efon Post Office", "Ilasan Post Office", "Agungi Road Post Office",
    "Ologolo Road Post Office", "Lekki Conservation Road Post Office",
    "Igbo Efon Bank", "Ilasan Bank", "Agungi Road Bank",
    "Ologolo Road Bank", "Lekki Conservation Road Bank",
    "Igbo Efon Church", "Ilasan Church", "Agungi Road Church",
    "Ologolo Road Church", "Lekki Conservation Road Church",
    "Igbo Efon Mosque", "Ilasan Mosque", "Agungi Road Mosque",
    "Ologolo Road Mosque", "Lekki Conservation Road Mosque",
    "Igbo Efon School", "Ilasan School", "Agungi Road School",
    "Ologolo Road School", "Lekki Conservation Road School",
    "Igbo Efon Hospital", "Ilasan Hospital", "Agungi Road Hospital",
    "Ologolo Road Hospital", "Lekki Conservation Road Hospital"
  ],
  "Ibeju-Lekki": [
    "Lekki Free Trade Zone Road", "Awoyaya Road", "Bogije Road",
    "Akodo Road", "Epe Expressway Ibeju", "Eleko Road",
    "Ibeju-Lekki", "Lekki Free Trade Zone", "Awoyaya",
    "Bogije", "Akodo", "Epe Expressway", "Eleko",
    "Ibeju-Lekki Bus Stop", "Lekki Free Trade Zone Bus Stop", "Awoyaya Road Bus Stop",
    "Bogije Road Bus Stop", "Akodo Road Bus Stop", "Epe Expressway Bus Stop",
    "Eleko Road Bus Stop", "Ibeju-Lekki Market", "Lekki Free Trade Zone Market",
    "Awoyaya Road Market", "Bogije Road Market", "Akodo Road Market",
    "Epe Expressway Market", "Eleko Road Market", "Ibeju-Lekki Police Station",
    "Lekki Free Trade Zone Police Station", "Awoyaya Road Police Station",
    "Bogije Road Police Station", "Akodo Road Police Station",
    "Epe Expressway Police Station", "Eleko Road Police Station",
    "Ibeju-Lekki Fire Station", "Lekki Free Trade Zone Fire Station",
    "Awoyaya Road Fire Station", "Bogije Road Fire Station",
    "Akodo Road Fire Station", "Epe Expressway Fire Station",
    "Eleko Road Fire Station", "Ibeju-Lekki Post Office",
    "Lekki Free Trade Zone Post Office", "Awoyaya Road Post Office",
    "Bogije Road Post Office", "Akodo Road Post Office",
    "Epe Expressway Post Office", "Eleko Road Post Office",
    "Ibeju-Lekki Bank", "Lekki Free Trade Zone Bank", "Awoyaya Road Bank",
    "Bogije Road Bank", "Akodo Road Bank", "Epe Expressway Bank",
    "Eleko Road Bank", "Ibeju-Lekki Church", "Lekki Free Trade Zone Church",
    "Awoyaya Road Church", "Bogije Road Church", "Akodo Road Church",
    "Epe Expressway Church", "Eleko Road Church", "Ibeju-Lekki Mosque",
    "Lekki Free Trade Zone Mosque", "Awoyaya Road Mosque", "Bogije Road Mosque",
    "Akodo Road Mosque", "Epe Expressway Mosque", "Eleko Road Mosque",
    "Ibeju-Lekki School", "Lekki Free Trade Zone School", "Awoyaya Road School",
    "Bogije Road School", "Akodo Road School", "Epe Expressway School",
    "Eleko Road School", "Ibeju-Lekki Hospital", "Lekki Free Trade Zone Hospital",
    "Awoyaya Road Hospital", "Bogije Road Hospital", "Akodo Road Hospital",
    "Epe Expressway Hospital", "Eleko Road Hospital"
  ],
  "Festac Town": [
    "1st Avenue Festac", "2nd Avenue Festac", "21 Road Festac",
    "22 Road Festac", "D Close Festac", "FESTAC Expressway",
    "6th Avenue Festac", "7th Avenue Festac", "Festac Town",
    "1st Avenue", "2nd Avenue", "21 Road", "22 Road",
    "D Close", "FESTAC Expressway", "6th Avenue", "7th Avenue",
    "Festac Town Bus Stop", "1st Avenue Bus Stop", "2nd Avenue Bus Stop",
    "21 Road Bus Stop", "22 Road Bus Stop", "D Close Bus Stop",
    "FESTAC Expressway Bus Stop", "6th Avenue Bus Stop", "7th Avenue Bus Stop",
    "Festac Town Market", "1st Avenue Market", "2nd Avenue Market",
    "21 Road Market", "22 Road Market", "D Close Market",
    "FESTAC Expressway Market", "6th Avenue Market", "7th Avenue Market",
    "Festac Town Police Station", "1st Avenue Police Station",
    "2nd Avenue Police Station", "21 Road Police Station",
    "22 Road Police Station", "D Close Police Station",
    "FESTAC Expressway Police Station", "6th Avenue Police Station",
    "7th Avenue Police Station", "Festac Town Fire Station",
    "1st Avenue Fire Station", "2nd Avenue Fire Station", "21 Road Fire Station",
    "22 Road Fire Station", "D Close Fire Station", "FESTAC Expressway Fire Station",
    "6th Avenue Fire Station", "7th Avenue Fire Station", "Festac Town Post Office",
    "1st Avenue Post Office", "2nd Avenue Post Office", "21 Road Post Office",
    "22 Road Post Office", "D Close Post Office", "FESTAC Expressway Post Office",
    "6th Avenue Post Office", "7th Avenue Post Office", "Festac Town Bank",
    "1st Avenue Bank", "2nd Avenue Bank", "21 Road Bank", "22 Road Bank",
    "D Close Bank", "FESTAC Expressway Bank", "6th Avenue Bank", "7th Avenue Bank",
    "Festac Town Church", "1st Avenue Church", "2nd Avenue Church",
    "21 Road Church", "22 Road Church", "D Close Church",
    "FESTAC Expressway Church", "6th Avenue Church", "7th Avenue Church",
    "Festac Town Mosque", "1st Avenue Mosque", "2nd Avenue Mosque",
    "21 Road Mosque", "22 Road Mosque", "D Close Mosque",
    "FESTAC Expressway Mosque", "6th Avenue Mosque", "7th Avenue Mosque",
    "Festac Town School", "1st Avenue School", "2nd Avenue School",
    "21 Road School", "22 Road School", "D Close School",
    "FESTAC Expressway School", "6th Avenue School", "7th Avenue School",
    "Festac Town Hospital", "1st Avenue Hospital", "2nd Avenue Hospital",
    "21 Road Hospital", "22 Road Hospital", "D Close Hospital",
    "FESTAC Expressway Hospital", "6th Avenue Hospital", "7th Avenue Hospital"
  ],
  "Amuwo Odofin": [
    "Apple Junction Road", "Mile 2 Road", "Kirikiri Industrial Road",
    "Satellite Town Road", "Amuwo Odofin Estate", "Alakija Road",
    "Amuwo Odofin", "Apple Junction", "Mile 2", "Kirikiri",
    "Satellite Town", "Amuwo Estate", "Alakija",
    "Amuwo Odofin Bus Stop", "Apple Junction Bus Stop", "Mile 2 Road Bus Stop",
    "Kirikiri Industrial Bus Stop", "Satellite Town Road Bus Stop",
    "Amuwo Estate Bus Stop", "Alakija Road Bus Stop", "Amuwo Odofin Market",
    "Apple Junction Market", "Mile 2 Road Market", "Kirikiri Industrial Market",
    "Satellite Town Road Market", "Amuwo Estate Market", "Alakija Road Market",
    "Amuwo Odofin Police Station", "Apple Junction Police Station",
    "Mile 2 Road Police Station", "Kirikiri Industrial Police Station",
    "Satellite Town Road Police Station", "Amuwo Estate Police Station",
    "Alakija Road Police Station", "Amuwo Odofin Fire Station",
    "Apple Junction Fire Station", "Mile 2 Road Fire Station",
    "Kirikiri Industrial Fire Station", "Satellite Town Road Fire Station",
    "Amuwo Estate Fire Station", "Alakija Road Fire Station",
    "Amuwo Odofin Post Office", "Apple Junction Post Office",
    "Mile 2 Road Post Office", "Kirikiri Industrial Post Office",
    "Satellite Town Road Post Office", "Amuwo Estate Post Office",
    "Alakija Road Post Office", "Amuwo Odofin Bank", "Apple Junction Bank",
    "Mile 2 Road Bank", "Kirikiri Industrial Bank", "Satellite Town Road Bank",
    "Amuwo Estate Bank", "Alakija Road Bank", "Amuwo Odofin Church",
    "Apple Junction Church", "Mile 2 Road Church", "Kirikiri Industrial Church",
    "Satellite Town Road Church", "Amuwo Estate Church", "Alakija Road Church",
    "Amuwo Odofin Mosque", "Apple Junction Mosque", "Mile 2 Road Mosque",
    "Kirikiri Industrial Mosque", "Satellite Town Road Mosque",
    "Amuwo Estate Mosque", "Alakija Road Mosque", "Amuwo Odofin School",
    "Apple Junction School", "Mile 2 Road School", "Kirikiri Industrial School",
    "Satellite Town Road School", "Amuwo Estate School", "Alakija Road School",
    "Amuwo Odofin Hospital", "Apple Junction Hospital", "Mile 2 Road Hospital",
    "Kirikiri Industrial Hospital", "Satellite Town Road Hospital",
    "Amuwo Estate Hospital", "Alakija Road Hospital"
  ],
  "Ojo/Alaba": [
    "Alaba International Market", "Navy Town Road Ojo", "Volkswagen Road Ojo",
    "Trade Fair Complex Road", "Ojo Barracks Road", "LASU Road Ojo",
    "Ojo", "Alaba", "Alaba International", "Navy Town",
    "Volkswagen", "Trade Fair", "Ojo Barracks", "LASU",
    "Ojo Bus Stop", "Alaba Bus Stop", "Alaba International Bus Stop",
    "Navy Town Road Bus Stop", "Volkswagen Road Bus Stop",
    "Trade Fair Complex Bus Stop", "Ojo Barracks Road Bus Stop",
    "LASU Road Bus Stop", "Ojo Market", "Alaba Market",
    "Alaba International Market", "Navy Town Road Market",
    "Volkswagen Road Market", "Trade Fair Complex Market",
    "Ojo Barracks Road Market", "LASU Road Market", "Ojo Police Station",
    "Alaba Police Station", "Alaba International Police Station",
    "Navy Town Road Police Station", "Volkswagen Road Police Station",
    "Trade Fair Complex Police Station", "Ojo Barracks Road Police Station",
    "LASU Road Police Station", "Ojo Fire Station", "Alaba Fire Station",
    "Alaba International Fire Station", "Navy Town Road Fire Station",
    "Volkswagen Road Fire Station", "Trade Fair Complex Fire Station",
    "Ojo Barracks Road Fire Station", "LASU Road Fire Station",
    "Ojo Post Office", "Alaba Post Office", "Alaba International Post Office",
    "Navy Town Road Post Office", "Volkswagen Road Post Office",
    "Trade Fair Complex Post Office", "Ojo Barracks Road Post Office",
    "LASU Road Post Office", "Ojo Bank", "Alaba Bank",
    "Alaba International Bank", "Navy Town Road Bank", "Volkswagen Road Bank",
    "Trade Fair Complex Bank", "Ojo Barracks Road Bank", "LASU Road Bank",
    "Ojo Church", "Alaba Church", "Alaba International Church",
    "Navy Town Road Church", "Volkswagen Road Church", "Trade Fair Complex Church",
    "Ojo Barracks Road Church", "LASU Road Church", "Ojo Mosque",
    "Alaba Mosque", "Alaba International Mosque", "Navy Town Road Mosque",
    "Volkswagen Road Mosque", "Trade Fair Complex Mosque",
    "Ojo Barracks Road Mosque", "LASU Road Mosque", "Ojo School",
    "Alaba School", "Alaba International School", "Navy Town Road School",
    "Volkswagen Road School", "Trade Fair Complex School",
    "Ojo Barracks Road School", "LASU Road School", "Ojo Hospital",
    "Alaba Hospital", "Alaba International Hospital", "Navy Town Road Hospital",
    "Volkswagen Road Hospital", "Trade Fair Complex Hospital",
    "Ojo Barracks Road Hospital", "LASU Road Hospital"
  ],
  "Badagry": [
    "Badagry Expressway", "Seme Border Road", "Agbara Estate Road",
    "Ajangbadi Road", "Badagry Town", "Topo Road Badagry",
    "Marina Road Badagry", "Badagry", "Seme Border",
    "Agbara Estate", "Ajangbadi", "Badagry Town", "Topo",
    "Marina", "Badagry Bus Stop", "Badagry Expressway Bus Stop",
    "Seme Border Road Bus Stop", "Agbara Estate Road Bus Stop",
    "Ajangbadi Road Bus Stop", "Badagry Town Bus Stop", "Topo Road Bus Stop",
    "Marina Road Bus Stop", "Badagry Market", "Badagry Expressway Market",
    "Seme Border Road Market", "Agbara Estate Road Market",
    "Ajangbadi Road Market", "Badagry Town Market", "Topo Road Market",
    "Marina Road Market", "Badagry Police Station", "Badagry Expressway Police Station",
    "Seme Border Road Police Station", "Agbara Estate Road Police Station",
    "Ajangbadi Road Police Station", "Badagry Town Police Station",
    "Topo Road Police Station", "Marina Road Police Station", "Badagry Fire Station",
    "Badagry Expressway Fire Station", "Seme Border Road Fire Station",
    "Agbara Estate Road Fire Station", "Ajangbadi Road Fire Station",
    "Badagry Town Fire Station", "Topo Road Fire Station", "Marina Road Fire Station",
    "Badagry Post Office", "Badagry Expressway Post Office",
    "Seme Border Road Post Office", "Agbara Estate Road Post Office",
    "Ajangbadi Road Post Office", "Badagry Town Post Office",
    "Topo Road Post Office", "Marina Road Post Office", "Badagry Bank",
    "Badagry Expressway Bank", "Seme Border Road Bank", "Agbara Estate Road Bank",
    "Ajangbadi Road Bank", "Badagry Town Bank", "Topo Road Bank",
    "Marina Road Bank", "Badagry Church", "Badagry Expressway Church",
    "Seme Border Road Church", "Agbara Estate Road Church",
    "Ajangbadi Road Church", "Badagry Town Church", "Topo Road Church",
    "Marina Road Church", "Badagry Mosque", "Badagry Expressway Mosque",
    "Seme Border Road Mosque", "Agbara Estate Road Mosque",
    "Ajangbadi Road Mosque", "Badagry Town Mosque", "Topo Road Mosque",
    "Marina Road Mosque", "Badagry School", "Badagry Expressway School",
    "Seme Border Road School", "Agbara Estate Road School",
    "Ajangbadi Road School", "Badagry Town School", "Topo Road School",
    "Marina Road School", "Badagry Hospital", "Badagry Expressway Hospital",
    "Seme Border Road Hospital", "Agbara Estate Road Hospital",
    "Ajangbadi Road Hospital", "Badagry Town Hospital", "Topo Road Hospital",
    "Marina Road Hospital"
  ],
  "Ikorodu": [
    "Lagos Road Ikorodu", "Agric Road Ikorodu", "Benson Road Ikorodu",
    "Ikorodu GRA", "Owutu Road", "Imota Road", "Ijede Road",
    "Ikorodu", "Agric", "Benson", "Ikorodu GRA",
    "Owutu", "Imota", "Ijede",
    "Ikorodu Bus Stop", "Lagos Road Bus Stop", "Agric Road Bus Stop",
    "Benson Road Bus Stop", "Ikorodu GRA Bus Stop", "Owutu Road Bus Stop",
    "Imota Road Bus Stop", "Ijede Road Bus Stop", "Ikorodu Market",
    "Lagos Road Market", "Agric Road Market", "Benson Road Market",
    "Ikorodu GRA Market", "Owutu Road Market", "Imota Road Market",
    "Ijede Road Market", "Ikorodu Police Station", "Lagos Road Police Station",
    "Agric Road Police Station", "Benson Road Police Station",
    "Ikorodu GRA Police Station", "Owutu Road Police Station",
    "Imota Road Police Station", "Ijede Road Police Station",
    "Ikorodu Fire Station", "Lagos Road Fire Station", "Agric Road Fire Station",
    "Benson Road Fire Station", "Ikorodu GRA Fire Station", "Owutu Road Fire Station",
    "Imota Road Fire Station", "Ijede Road Fire Station", "Ikorodu Post Office",
    "Lagos Road Post Office", "Agric Road Post Office", "Benson Road Post Office",
    "Ikorodu GRA Post Office", "Owutu Road Post Office", "Imota Road Post Office",
    "Ijede Road Post Office", "Ikorodu Bank", "Lagos Road Bank",
    "Agric Road Bank", "Benson Road Bank", "Ikorodu GRA Bank",
    "Owutu Road Bank", "Imota Road Bank", "Ijede Road Bank",
    "Ikorodu Church", "Lagos Road Church", "Agric Road Church",
    "Benson Road Church", "Ikorodu GRA Church", "Owutu Road Church",
    "Imota Road Church", "Ijede Road Church", "Ikorodu Mosque",
    "Lagos Road Mosque", "Agric Road Mosque", "Benson Road Mosque",
    "Ikorodu GRA Mosque", "Owutu Road Mosque", "Imota Road Mosque",
    "Ijede Road Mosque", "Ikorodu School", "Lagos Road School",
    "Agric Road School", "Benson Road School", "Ikorodu GRA School",
    "Owutu Road School", "Imota Road School", "Ijede Road School",
    "Ikorodu Hospital", "Lagos Road Hospital", "Agric Road Hospital",
    "Benson Road Hospital", "Ikorodu GRA Hospital", "Owutu Road Hospital",
    "Imota Road Hospital", "Ijede Road Hospital"
  ],
  "Magodo": [
    "Magodo Phase 1 Road", "Magodo Phase 2 Road", "GRA Shangisha Road",
    "Magodo Estate Road", "CMD Road Magodo", "Magodo",
    "Magodo Phase 1", "Magodo Phase 2", "GRA Shangisha",
    "Magodo Estate", "CMD",
    "Magodo Bus Stop", "Magodo Phase 1 Bus Stop", "Magodo Phase 2 Bus Stop",
    "GRA Shangisha Bus Stop", "Magodo Estate Bus Stop", "CMD Road Bus Stop",
    "Magodo Market", "Magodo Phase 1 Market", "Magodo Phase 2 Market",
    "GRA Shangisha Market", "Magodo Estate Market", "CMD Road Market",
    "Magodo Police Station", "Magodo Phase 1 Police Station",
    "Magodo Phase 2 Police Station", "GRA Shangisha Police Station",
    "Magodo Estate Police Station", "CMD Road Police Station",
    "Magodo Fire Station", "Magodo Phase 1 Fire Station",
    "Magodo Phase 2 Fire Station", "GRA Shangisha Fire Station",
    "Magodo Estate Fire Station", "CMD Road Fire Station", "Magodo Post Office",
    "Magodo Phase 1 Post Office", "Magodo Phase 2 Post Office",
    "GRA Shangisha Post Office", "Magodo Estate Post Office",
    "CMD Road Post Office", "Magodo Bank", "Magodo Phase 1 Bank",
    "Magodo Phase 2 Bank", "GRA Shangisha Bank", "Magodo Estate Bank",
    "CMD Road Bank", "Magodo Church", "Magodo Phase 1 Church",
    "Magodo Phase 2 Church", "GRA Shangisha Church", "Magodo Estate Church",
    "CMD Road Church", "Magodo Mosque", "Magodo Phase 1 Mosque",
    "Magodo Phase 2 Mosque", "GRA Shangisha Mosque", "Magodo Estate Mosque",
    "CMD Road Mosque", "Magodo School", "Magodo Phase 1 School",
    "Magodo Phase 2 School", "GRA Shangisha School", "Magodo Estate School",
    "CMD Road School", "Magodo Hospital", "Magodo Phase 1 Hospital",
    "Magodo Phase 2 Hospital", "GRA Shangisha Hospital", "Magodo Estate Hospital",
    "CMD Road Hospital"
  ],
  "Ojota/Oregun": [
    "Ojota Road", "Oregun Road", "Kudirat Abiola Way",
    "Oregun Industrial Estate Road", "Ojota Market Road", "Ojota", "Oregun",
    "Kudirat Abiola", "Oregun Industrial",
    "Ojota Bus Stop", "Oregun Bus Stop", "Kudirat Abiola Way Bus Stop",
    "Oregun Industrial Bus Stop", "Ojota Market Bus Stop", "Ojota Market",
    "Oregun Market", "Kudirat Abiola Market", "Oregun Industrial Market",
    "Ojota Police Station", "Oregun Police Station", "Kudirat Abiola Police Station",
    "Oregun Industrial Police Station", "Ojota Fire Station", "Oregun Fire Station",
    "Kudirat Abiola Fire Station", "Oregun Industrial Fire Station",
    "Ojota Post Office", "Oregun Post Office", "Kudirat Abiola Post Office",
    "Oregun Industrial Post Office", "Ojota Bank", "Oregun Bank",
    "Kudirat Abiola Bank", "Oregun Industrial Bank", "Ojota Church",
    "Oregun Church", "Kudirat Abiola Church", "Oregun Industrial Church",
    "Ojota Mosque", "Oregun Mosque", "Kudirat Abiola Mosque",
    "Oregun Industrial Mosque", "Ojota School", "Oregun School",
    "Kudirat Abiola School", "Oregun Industrial School", "Ojota Hospital",
    "Oregun Hospital", "Kudirat Abiola Hospital", "Oregun Industrial Hospital"
  ],
  "Onikan/Lagos Mainland": [
    "Onikan Stadium Road", "Bishop Oluwole Street", "Broad Street Onikan",
    "King George V Road", "Onikan", "Lagos Mainland",
    "Bishop Oluwole", "Broad Street", "King George V",
    "Onikan Bus Stop", "Bishop Oluwole Bus Stop", "Broad Street Onikan Bus Stop",
    "King George V Bus Stop", "Onikan Market", "Bishop Oluwole Market",
    "Broad Street Onikan Market", "King George V Market",
    "Onikan Police Station", "Bishop Oluwole Police Station",
    "Broad Street Onikan Police Station", "King George V Police Station",
    "Onikan Fire Station", "Bishop Oluwole Fire Station",
    "Broad Street Onikan Fire Station", "King George V Fire Station",
    "Onikan Post Office", "Bishop Oluwole Post Office",
    "Broad Street Onikan Post Office", "King George V Post Office",
    "Onikan Bank", "Bishop Oluwole Bank", "Broad Street Onikan Bank",
    "King George V Bank", "Onikan Church", "Bishop Oluwole Church",
    "Broad Street Onikan Church", "King George V Church", "Onikan Mosque",
    "Bishop Oluwole Mosque", "Broad Street Onikan Mosque", "King George V Mosque",
    "Onikan School", "Bishop Oluwole School", "Broad Street Onikan School",
    "King George V School", "Onikan Hospital", "Bishop Oluwole Hospital",
    "Broad Street Onikan Hospital", "King George V Hospital"
  ],
  "Epe": [
    "Epe Town Road", "Lagos-Epe Expressway", "Epe GRA Road",
    "Poka Road", "Mojoda Road", "Epe",
    "Lagos-Epe", "Epe GRA", "Poka", "Mojoda",
    "Epe Bus Stop", "Epe Town Road Bus Stop", "Lagos-Epe Expressway Bus Stop",
    "Epe GRA Road Bus Stop", "Poka Road Bus Stop", "Mojoda Road Bus Stop",
    "Epe Market", "Epe Town Road Market", "Lagos-Epe Expressway Market",
    "Epe GRA Road Market", "Poka Road Market", "Mojoda Road Market",
    "Epe Police Station", "Epe Town Road Police Station",
    "Lagos-Epe Expressway Police Station", "Epe GRA Road Police Station",
    "Poka Road Police Station", "Mojoda Road Police Station", "Epe Fire Station",
    "Epe Town Road Fire Station", "Lagos-Epe Expressway Fire Station",
    "Epe GRA Road Fire Station", "Poka Road Fire Station", "Mojoda Road Fire Station",
    "Epe Post Office", "Epe Town Road Post Office", "Lagos-Epe Expressway Post Office",
    "Epe GRA Road Post Office", "Poka Road Post Office", "Mojoda Road Post Office",
    "Epe Bank", "Epe Town Road Bank", "Lagos-Epe Expressway Bank",
    "Epe GRA Road Bank", "Poka Road Bank", "Mojoda Road Bank",
    "Epe Church", "Epe Town Road Church", "Lagos-Epe Expressway Church",
    "Epe GRA Road Church", "Poka Road Church", "Mojoda Road Church",
    "Epe Mosque", "Epe Town Road Mosque", "Lagos-Epe Expressway Mosque",
    "Epe GRA Road Mosque", "Poka Road Mosque", "Mojoda Road Mosque",
    "Epe School", "Epe Town Road School", "Lagos-Epe Expressway School",
    "Epe GRA Road School", "Poka Road School", "Mojoda Road School",
    "Epe Hospital", "Epe Town Road Hospital", "Lagos-Epe Expressway Hospital",
    "Epe GRA Road Hospital", "Poka Road Hospital", "Mojoda Road Hospital"
  ],

  "Akoka": [
    "Jibowu Street Akoka", "Iwaya Road", "Abule Ijesha",
    "Akoka Market", "FCE Akoka", "College of Education Akoka",
    "Sabo Road Akoka", "Pedro Road", "Babs Animashaun Road"
  ],
  "UNILAG": [
    "University of Lagos Main Gate", "UNILAG Main Gate", "UNILAG Back Gate",
    "Faculty of Engineering UNILAG", "Faculty of Science UNILAG",
    "Faculty of Arts UNILAG", "Faculty of Law UNILAG",
    "Faculty of Social Sciences UNILAG", "Faculty of Education UNILAG",
    "Faculty of Business Administration UNILAG", "Faculty of Pharmacy UNILAG",
    "College of Medicine UNILAG", "Senate Building UNILAG",
    "UNILAG Sports Centre", "UNILAG Swimming Pool",
    "Moremi Hall UNILAG", "Fagunwa Hall UNILAG", "Madam Tinubu Hall UNILAG",
    "Amina Hall UNILAG", "Independence Hall UNILAG", "Biobaku Hall UNILAG",
    "University of Lagos Library", "UNILAG Bookshop",
    "UNILAG Staff Quarters", "UNILAG Guest House",
    "UNILAG Health Centre", "UNILAG Chapel", "UNILAG Mosque",
    "Sconformist School UNILAG", "UNILAG IS",
    "Jaja Hall UNILAG", "NUGA Games Village UNILAG",
    "Alphabet Bus Stop", "Alphabet City UNILAG", "Unilag Second Gate",
    "UNILAG Cooperative School", "UNILAG Staff Club"
  ],
  "YABATECH": [
    "Yaba College of Technology", "YABATECH Main Gate",
    "YABATECH School of Engineering", "YABATECH School of Technology",
    "YABATECH School of Management", "YABATECH School of Art",
    "YABATECH School of Environmental Studies",
    "YABATECH Library", "YABATECH Hostel", "YABATECH Auditorium",
    "Herbert Macaulay Way Yaba", "Yaba Roundabout"
  ],
  "Lagos State University (LASU)": [
    "LASU Main Gate", "LASU Back Gate", "LASU Ojo",
    "Faculty of Engineering LASU", "Faculty of Science LASU",
    "Faculty of Law LASU", "Faculty of Arts LASU",
    "Faculty of Management Sciences LASU", "Faculty of Education LASU",
    "Faculty of Social Sciences LASU", "Faculty of Communication LASU",
    "LASU Library", "LASU Senate Building", "LASU Hostel",
    "LASU Health Centre", "LASU Amphitheatre", "LASU Sports Complex",
    "LASU Road Ojo", "Ojo Campus Road"
  ],
  "Covenant University": [
    "Covenant University Main Gate", "Covenant University Ota",
    "Covenant University Chapel", "Covenant University Hostel",
    "Covenant University Library", "Covenant University Senate",
    "College of Engineering Covenant", "College of Science Covenant",
    "College of Business Covenant", "College of Development Studies Covenant",
    "Covenant University Health Centre", "Canaan Land",
    "Ota Road Covenant", "KM 10 Idiroko Road"
  ],
  "Babcock University": [
    "Babcock University Main Gate", "Babcock Ilishan Remo",
    "Babcock University Chapel", "Babcock University Hostel",
    "Babcock University Library", "Babcock Senate Building",
    "School of Medicine Babcock", "School of Science Babcock",
    "School of Management Babcock", "School of Education Babcock",
    "Babcock University Health Centre", "Ilishan Road Babcock"
  ],
  "Pan-Atlantic University": [
    "Pan-Atlantic University", "PAU Lekki",
    "Lagos Business School", "LBS Km 22 Lekki",
    "Pan-Atlantic University Library", "PAU Chapel",
    "Km 22 Lekki-Epe Expressway", "Pan-Atlantic University Gate"
  ],
  "Caleb University": [
    "Caleb University Imota", "Caleb University Main Gate",
    "Caleb University Hostel", "Caleb University Library",
    "Caleb University Chapel", "College of Natural Sciences Caleb",
    "College of Business Caleb", "College of Social Sciences Caleb",
    "Imota Road Caleb", "Ikorodu-Epe Road Caleb"
  ],
  "Eko Hotel": [
    "Eko Hotel and Suites", "Eko Hotel Victoria Island",
    "Eko Convention Centre", "Eko Hotel Swimming Pool",
    "Eko Hotel Beach", "Eko Signature", "Eko Pearl Towers",
    "Adetokunbo Ademola Street"
  ],
  "Murtala Muhammed Airport": [
    "Murtala Muhammed International Airport", "MMA Terminal 1",
    "MMA Terminal 2", "Arrivals MMIA", "Departures MMIA",
    "Cargo Terminal MMIA", "General Aviation Terminal",
    "Airport Hotel Ikeja", "Bi-Courtney Terminal MMA2",
    "International Airport Road", "Obafemi Awolowo Way Airport"
  ],
  "Ikeja City Mall": [
    "Ikeja City Mall", "ICM Ikeja", "Shoprite Ikeja",
    "Silverbird Cinemas Ikeja", "Game Stores Ikeja",
    "Opebi Road Mall", "Ikeja Mall Parking"
  ],
  "The Palms Lekki": [
    "The Palms Shopping Mall", "The Palms Lekki",
    "Shoprite Lekki", "Game Stores Lekki", "Silverbird Cinemas Lekki",
    "Lekki Phase 1 Mall", "Bisola Durosinmi-Etti Drive"
  ],
  "Balogun Market": [
    "Balogun Market Lagos Island", "Lagos Island Market",
    "Idumota Market", "Broad Street Lagos", "Nnamdi Azikiwe Street",
    "Ereko Street", "Martins Street", "Lagos Market Road",
    "Balogun Bus Stop", "Lagos Island Central"
  ],
  "Computer Village Ikeja": [
    "Computer Village", "Otigba Street", "Otigba Computer Village",
    "Ikeja Computer Village", "Pepple Street Ikeja",
    "Obafemi Awolowo Way Computer Village", "Allen Avenue Ikeja"
  ],
  "Alaba International Market": [
    "Alaba International Market", "Alaba Electronics Market",
    "Trade Fair Lagos", "Ojo Road Alaba", "Mile 2 Market",
    "Alaba Market Road", "Volkswagen Road Ojo"
  ],
  "Oshodi Market": [
    "Oshodi Market", "Bolade Oshodi", "Oshodi Overhead",
    "Oshodi Bus Stop", "Oshodi International Market",
    "International Airport Road Oshodi", "Oshodi Bridge"
  ],
  "Mile 12 Market": [
    "Mile 12 Market", "Mile 12 International Market",
    "Mile 12 Bus Stop", "Ikorodu Road Mile 12",
    "Owode Onirin Market", "Mile 12 Tomato Market"
  ],
  "National Theatre": [
    "National Theatre Lagos", "National Theatre Iganmu",
    "Iganmu Road", "National Arts Theatre",
    "National Theatre Bus Stop", "National Theatre Bridge"
  ],
  "Tafawa Balewa Square": [
    "Tafawa Balewa Square", "TBS Lagos",
    "Race Course Lagos Island", "Lagos State Secretariat TBS",
    "National Stadium Lagos", "TBS Bus Stop"
  ],
  "Lekki Conservation Centre": [
    "Lekki Conservation Centre", "LCC Lekki",
    "Canopy Walk Lekki", "Lekki Wildlife Sanctuary",
    "Conservation Drive Lekki", "Chevron Drive LCC"
  ],
  "Landmark Beach": [
    "Landmark Beach Resort", "Landmark Beach Oniru",
    "Landmark Event Centre", "Oniru Beach Lagos",
    "Victoria Island Beach", "Oniru Private Beach",
    "Landmark Towers VI"
  ],
  "Elegushi Beach": [
    "Elegushi Royal Beach", "Elegushi Beach Lekki",
    "Ikate Beach", "Elegushi Private Beach",
    "Lekki Beach Road", "Elegushi Beach Road"
  ],
  "Nike Art Gallery": [
    "Nike Art Gallery Lekki", "Nike Art Gallery",
    "Elegushi Road Lekki", "Lekki Art Gallery",
    "Km 8 Lekki-Epe Expressway"
  ],
  "LUTH": [
    "Lagos University Teaching Hospital", "LUTH Idi-Araba",
    "LUTH Surulere", "LUTH Main Gate", "LUTH Casualty",
    "LUTH Outpatient", "College of Medicine LUTH",
    "CMUL Idi-Araba", "Idi-Araba Bus Stop"
  ],
  "LASUTH": [
    "Lagos State University Teaching Hospital", "LASUTH Ikeja",
    "LASUTH Main Gate", "LASUTH Casualty",
    "Obafemi Awolowo Way LASUTH", "Ikeja General Hospital",
    "Lagos State Hospital Ikeja"
  ],
  "Third Mainland Bridge": [
    "Third Mainland Bridge", "3rd Mainland Bridge",
    "Third Mainland Bridge Lagos End", "Third Mainland Bridge Island End",
    "Adeniji Adele End Third Mainland", "Oworonshoki End Third Mainland"
  ],
  "Lagos-Ibadan Expressway": [
    "Lagos-Ibadan Expressway", "Berger Bus Stop",
    "Ojodu Berger", "Long Bridge Lagos Ibadan",
    "Sagamu Interchange", "Mowe", "Ibafo",
    "Redemption Camp", "Arepo", "Warewa"
  ]

};

const DISCO = [
  { name: "Ikeja Electric", lgas: ["Ikeja GRA","Ikeja (Allen/Opebi)","Maryland/Anthony","Ogba","Agege","Alimosho/Ipaja","Ojodu/Omole","Kosofe/Ketu","Gbagada","Ilupeju","Mushin","Oshodi/Isolo","Shomolu/Bariga","Ikorodu","Magodo","Ojota/Oregun","Akoka","UNILAG","YABATECH","Computer Village Ikeja","Ikeja City Mall","Murtala Muhammed Airport","Lagos-Ibadan Expressway"] },
  { name: "Eko Electric", lgas: ["Lagos Island","Ikoyi","Victoria Island","Obalende/CMS","Ebute Metta","Apapa","Surulere","Yaba","Lekki Phase 1","Lekki Phase 2/Ikota","Ajah","Chevron/Lekki-Epe Expressway","Igbo Efon/Ilasan","Ibeju-Lekki","Festac Town","Amuwo Odofin","Ojo/Alaba","Badagry","Onikan/Lagos Mainland","Epe","Lagos State University (LASU)","Pan-Atlantic University","Lagos Business School","Lekki Conservation Centre","Landmark Beach","Elegushi Beach","The Palms Lekki","Eko Hotel","Balogun Market","National Theatre","Tafawa Balewa Square","LUTH","Alaba International Market","Oshodi Market","Mile 12 Market"] },
];

const AREA_COORDS = {
  // ── LAGOS ISLAND / SOUTH ─────────────────────────────────────────
  "Lagos Island":{lat:6.4550,lng:3.3941},
  "Obalende/CMS":{lat:6.4578,lng:3.4004},
  "Victoria Island":{lat:6.4281,lng:3.4219},
  "Ikoyi":{lat:6.4622,lng:3.4308},
  "Onikan/Lagos Mainland":{lat:6.4560,lng:3.3850},
  "Apapa":{lat:6.4491,lng:3.3660},
  "Apapa GRA":{lat:6.4540,lng:3.3580},
  "Tin Can Island":{lat:6.4387,lng:3.3220},
  "Ebute Metta":{lat:6.4973,lng:3.3724},
  "Yaba":{lat:6.5095,lng:3.3726},
  "Surulere":{lat:6.4969,lng:3.3583},
  "Ojuelegba":{lat:6.5070,lng:3.3660},
  "Iponri":{lat:6.4840,lng:3.3670},
  "Costain":{lat:6.4800,lng:3.3500},
  "Dolphin Estate":{lat:6.4520,lng:3.4190},
  "Eko Atlantic City":{lat:6.4080,lng:3.4100},
  "Bar Beach":{lat:6.4200,lng:3.4200},
  "Oniru Estate":{lat:6.4310,lng:3.4450},
  "Banana Island":{lat:6.4610,lng:3.4478},
  "Parkview Estate Ikoyi":{lat:6.4700,lng:3.4350},
  "Bourdillon Road Ikoyi":{lat:6.4680,lng:3.4300},
  "Osborne Estate":{lat:6.4660,lng:3.4260},
  "1004 Estate":{lat:6.4289,lng:3.4286},
  "Maroko":{lat:6.4320,lng:3.4650},
  "Balogun Market":{lat:6.4531,lng:3.3938},
  "Marina":{lat:6.4527,lng:3.3957},
  "Broad Street":{lat:6.4545,lng:3.3927},
  "Tafawa Balewa Square":{lat:6.4533,lng:3.3878},
  "National Theatre":{lat:6.4786,lng:3.3615},
  "Idumota":{lat:6.4600,lng:3.3950},
  "Adeniji Adele":{lat:6.4570,lng:3.3840},
  "CMS Lagos":{lat:6.4542,lng:3.3970},

  // ── LEKKI CORRIDOR ───────────────────────────────────────────────
  "Lekki Phase 1":{lat:6.4397,lng:3.4723},
  "Lekki Phase 2/Ikota":{lat:6.4350,lng:3.5400},
  "Chevron/Lekki-Epe Expressway":{lat:6.4357,lng:3.5060},
  "Igbo Efon/Ilasan":{lat:6.4426,lng:3.5147},
  "Osapa London":{lat:6.4481,lng:3.5215},
  "Ikate Elegushi":{lat:6.4340,lng:3.4890},
  "Agungi":{lat:6.4467,lng:3.5328},
  "Jakande Estate Lekki":{lat:6.4420,lng:3.5263},
  "Lekki Conservation Centre":{lat:6.4445,lng:3.5500},
  "Abraham Adesanya":{lat:6.4556,lng:3.5705},
  "Ajah":{lat:6.4705,lng:3.5805},
  "Sangotedo":{lat:6.4609,lng:3.6050},
  "Awoyaya":{lat:6.4500,lng:3.6290},
  "Bogije":{lat:6.4430,lng:3.6450},
  "Abijo":{lat:6.4350,lng:3.6620},
  "Eleko":{lat:6.4150,lng:3.7100},
  "Ibeju-Lekki":{lat:6.4372,lng:3.7239},
  "Epe":{lat:6.5847,lng:3.9814},
  "VGC":{lat:6.4343,lng:3.5580},
  "The Palms Lekki":{lat:6.4388,lng:3.4750},
  "Landmark Beach":{lat:6.4368,lng:3.4895},
  "Elegushi Beach":{lat:6.4330,lng:3.4860},
  "Nike Art Gallery":{lat:6.4445,lng:3.4890},
  "Adeola Odeku":{lat:6.4292,lng:3.4203},
  "Ahmadu Bello Way":{lat:6.4280,lng:3.4180},
  "Ozumba Mbadiwe":{lat:6.4300,lng:3.4350},
  "Eko Hotel":{lat:6.4305,lng:3.4235},
  "Pan-Atlantic University":{lat:6.4511,lng:3.6047},
  // Lagos Business School — same as Pan-Atlantic, removed,

  // ── MAINLAND NORTH ───────────────────────────────────────────────
  "Ikeja GRA":{lat:6.5843,lng:3.3360},
  "Ikeja (Allen/Opebi)":{lat:6.6018,lng:3.3515},
  "Allen Avenue":{lat:6.6010,lng:3.3530},
  "Opebi":{lat:6.5990,lng:3.3470},
  "Toyin Street Ikeja":{lat:6.5968,lng:3.3442},
  "Alausa/Secretariat":{lat:6.5880,lng:3.3430},
  "Computer Village Ikeja":{lat:6.6035,lng:3.3502},
  "Oregun":{lat:6.5900,lng:3.3580},
  "Agidingbi":{lat:6.5950,lng:3.3480},
  "Ikeja City Mall":{lat:6.5969,lng:3.3423},
  "Murtala Muhammed Airport":{lat:6.5774,lng:3.3214},
  "Maryland/Anthony":{lat:6.5701,lng:3.3620},
  "Anthony Village":{lat:6.5680,lng:3.3600},
  "Palmgrove":{lat:6.5600,lng:3.3700},
  "Onipanu":{lat:6.5560,lng:3.3660},
  "Fadeyi":{lat:6.5520,lng:3.3700},
  "Shomolu/Bariga":{lat:6.5507,lng:3.3916},
  "Bariga":{lat:6.5440,lng:3.3870},
  "Gbagada":{lat:6.5495,lng:3.3928},
  "Gbagada Phase 1":{lat:6.5531,lng:3.3885},
  "Gbagada Phase 2":{lat:6.5580,lng:3.3960},
  "Ifako Gbagada":{lat:6.5620,lng:3.3990},
  "Soluyi":{lat:6.5652,lng:3.4020},
  "Ilupeju":{lat:6.5540,lng:3.3602},
  "Mushin":{lat:6.5283,lng:3.3542},
  "Oshodi/Isolo":{lat:6.5478,lng:3.3230},
  "Oshodi Market":{lat:6.5490,lng:3.3245},
  "Isolo":{lat:6.5350,lng:3.3200},
  "Ejigbo":{lat:6.5300,lng:3.3100},
  "Ago Palace Way":{lat:6.5100,lng:3.3080},
  "Okota":{lat:6.5050,lng:3.3150},
  "Mafoluku":{lat:6.5450,lng:3.3280},
  "Ajao Estate":{lat:6.5450,lng:3.3100},
  "Amuwo Odofin":{lat:6.4700,lng:3.3000},
  "Mile 2":{lat:6.4720,lng:3.3100},
  "Festac Town":{lat:6.4670,lng:3.2770},
  "Alakija":{lat:6.4600,lng:3.2620},
  "Satellite Town":{lat:6.4500,lng:3.2450},
  "Trade Fair Complex":{lat:6.4681,lng:3.2628},
  "Alaba International Market":{lat:6.4650,lng:3.1680},
  "Ojo/Alaba":{lat:6.4693,lng:3.1758},
  "Iba":{lat:6.4780,lng:3.2200},
  "Okokomaiko":{lat:6.5060,lng:3.2150},
  "Agboju":{lat:6.4700,lng:3.2890},
  "Kirikiri":{lat:6.4450,lng:3.3100},
  "Badagry":{lat:6.4174,lng:2.8852},
  "Ajangbadi":{lat:6.4620,lng:3.1200},
  "Iyana Ipaja":{lat:6.6000,lng:3.2625},
  "Alimosho/Ipaja":{lat:6.6038,lng:3.2513},
  "Idimu":{lat:6.5830,lng:3.2540},
  "Egbe":{lat:6.5820,lng:3.2780},
  "Akowonjo":{lat:6.5760,lng:3.2820},
  "Shasha":{lat:6.5650,lng:3.2720},
  "Ayobo":{lat:6.6160,lng:3.2480},
  "Abule Egba":{lat:6.6330,lng:3.2830},
  "Dopemu":{lat:6.6130,lng:3.2980},
  "Agege":{lat:6.6167,lng:3.3167},
  "Pen Cinema Agege":{lat:6.6220,lng:3.3120},
  "Ogba":{lat:6.6043,lng:3.3372},
  "Magodo":{lat:6.6050,lng:3.4000},
  "Magodo Phase 1":{lat:6.5990,lng:3.3980},
  "Magodo Phase 2":{lat:6.6090,lng:3.4050},
  "Ojodu/Omole":{lat:6.6284,lng:3.3542},
  "Ojodu Berger":{lat:6.6320,lng:3.3600},
  "Omole Phase 1":{lat:6.6270,lng:3.3490},
  "Omole Phase 2":{lat:6.6350,lng:3.3450},
  "Isheri":{lat:6.6400,lng:3.3800},
  "Kosofe/Ketu":{lat:6.5994,lng:3.3908},
  "Ketu":{lat:6.6020,lng:3.3900},
  "Alapere":{lat:6.5970,lng:3.3990},
  "Ogudu":{lat:6.5780,lng:3.3960},
  "Ogudu GRA":{lat:6.5850,lng:3.3930},
  "Ojota/Oregun":{lat:6.5750,lng:3.3800},
  "Mile 12 Market":{lat:6.6050,lng:3.3820},
  "Lagos-Ibadan Expressway":{lat:6.6500,lng:3.3700},

  // ── AKOKA / UNILAG ───────────────────────────────────────────────
  "Alphabet Bus Stop":{lat:6.5175,lng:3.3910},"UNILAG":{lat:6.5150,lng:3.3928},
  // UNILAG Main/Back Gate removed — "UNILAG" entry covers these coords
  "FCE Akoka":{lat:6.5220,lng:3.3820},
  "Iwaya":{lat:6.5265,lng:3.3875},
  "Makoko":{lat:6.5041,lng:3.3816},
  "Oyingbo":{lat:6.4990,lng:3.3780},

  // ── IKORODU ──────────────────────────────────────────────────────
  "Ikorodu":{lat:6.6194,lng:3.5053},
  "Ikorodu GRA":{lat:6.6132,lng:3.5060},
  "Agric Ikorodu":{lat:6.6263,lng:3.5178},
  "Imota":{lat:6.6300,lng:3.5400},
  "Igbogbo":{lat:6.6350,lng:3.5090},
  "Bayeku":{lat:6.6100,lng:3.5200},

  // ── UNIVERSITIES ─────────────────────────────────────────────────
  "YABATECH":{lat:6.5105,lng:3.3711},
  "Lagos State University (LASU)":{lat:6.4631,lng:3.1891},
  "Covenant University":{lat:6.6730,lng:3.1523},
  "Babcock University":{lat:6.8934,lng:3.9664},
  "Pan-Atlantic University":{lat:6.4511,lng:3.6047},
  "Caleb University":{lat:6.5140,lng:3.5430},
  "Nigerian Law School Lagos":{lat:6.4626,lng:3.3971},

  // ── HOSPITALS ────────────────────────────────────────────────────
  "LUTH":{lat:6.5135,lng:3.3752},
  "LASUTH":{lat:6.5970,lng:3.3390},
  "Gbagada General Hospital":{lat:6.5445,lng:3.3885},
  "Reddington Hospital VI":{lat:6.4286,lng:3.4237},
  "Eko Hospital Surulere":{lat:6.4955,lng:3.3635},
  "Lagos Island General Hospital":{lat:6.4562,lng:3.3981},

  // ── TRANSPORT ────────────────────────────────────────────────────
  "Third Mainland Bridge":{lat:6.5020,lng:3.3900},
  "Lekki-Ikoyi Link Bridge":{lat:6.4440,lng:3.4495},
  "Apapa Port":{lat:6.4480,lng:3.3640},
  "Tin Can Island Port":{lat:6.4370,lng:3.3110},
  "Ikorodu Bus Terminal":{lat:6.6180,lng:3.5065}
};
// ── GEOGRAPHIC HIERARCHY ─────────────────────────────────────────
// Maps child areas → their parent area for "include sub-areas" filtering
const AREA_PARENT = {
  "Alphabet Bus Stop":"UNILAG","Alphabet City UNILAG":"UNILAG","Unilag Second Gate":"UNILAG","UNILAG Cooperative School":"UNILAG","UNILAG Staff Club":"UNILAG","UNILAG":"Yaba","YABATECH":"Yaba","FCE Akoka":"Yaba","Iwaya":"Yaba",
  "Akoka":"Yaba","Makoko":"Yaba","Oyingbo":"Yaba",// Ebute Metta is independent
  "Bariga":"Shomolu/Bariga","Shomolu":"Shomolu/Bariga",
  "Gbagada Phase 1":"Gbagada","Gbagada Phase 2":"Gbagada","Ifako Gbagada":"Gbagada","Soluyi":"Gbagada",
  // Gbagada is its own major area
  "Allen Avenue":"Ikeja (Allen/Opebi)","Opebi":"Ikeja (Allen/Opebi)",
  "Toyin Street Ikeja":"Ikeja (Allen/Opebi)","Computer Village Ikeja":"Ikeja (Allen/Opebi)",
  "Ikeja City Mall":"Ikeja (Allen/Opebi)","Agidingbi":"Ikeja (Allen/Opebi)",
  "Alausa/Secretariat":"Ikeja (Allen/Opebi)","LASUTH":"Ikeja GRA",// Oregun is independent (near Agidingbi/Ikeja)
  "Magodo Phase 1":"Magodo","Magodo Phase 2":"Magodo",
  "Ojodu Berger":"Ojodu/Omole","Omole Phase 1":"Ojodu/Omole","Omole Phase 2":"Ojodu/Omole",
  "Ketu":"Kosofe/Ketu","Alapere":"Kosofe/Ketu","Ogudu":"Kosofe/Ketu",
  "Ogudu GRA":"Kosofe/Ketu","Ojota/Oregun":"Kosofe/Ketu","Mile 12 Market":"Kosofe/Ketu",
  "Anthony Village":"Maryland/Anthony","Palmgrove":"Maryland/Anthony",
  "Onipanu":"Maryland/Anthony","Fadeyi":"Maryland/Anthony",
  "The Palms Lekki":"Lekki Phase 1","Landmark Beach":"Lekki Phase 1",
  "Elegushi Beach":"Lekki Phase 1","Ikate Elegushi":"Lekki Phase 1",
  "Nike Art Gallery":"Lekki Phase 1","Oniru Estate":"Lekki Phase 1",
  "Adeola Odeku":"Victoria Island","Ahmadu Bello Way":"Victoria Island",
  "Ozumba Mbadiwe":"Victoria Island","Eko Hotel":"Victoria Island",
  "Eko Atlantic City":"Victoria Island","Bar Beach":"Victoria Island","1004 Estate":"Victoria Island",
  "Banana Island":"Ikoyi","Parkview Estate Ikoyi":"Ikoyi","Bourdillon Road Ikoyi":"Ikoyi",
  "Osborne Estate":"Ikoyi","Dolphin Estate":"Ikoyi",
  "Balogun Market":"Lagos Island","Marina":"Lagos Island","Broad Street":"Lagos Island",
  "CMS Lagos":"Lagos Island","Tafawa Balewa Square":"Lagos Island","Idumota":"Lagos Island",
  "Adeniji Adele":"Lagos Island","Obalende/CMS":"Lagos Island","National Theatre":"Surulere",
  "Nigerian Law School Lagos":"Lagos Island","Lagos Island General Hospital":"Lagos Island",
  "Igbo Efon/Ilasan":"Lekki Phase 2/Ikota","Osapa London":"Lekki Phase 2/Ikota",
  "Agungi":"Lekki Phase 2/Ikota","Jakande Estate Lekki":"Lekki Phase 2/Ikota",
  "VGC":"Chevron/Lekki-Epe Expressway","Lekki Conservation Centre":"Lekki Phase 2/Ikota",
  "Abraham Adesanya":"Ajah","Sangotedo":"Ajah","Awoyaya":"Ajah",
  "Bogije":"Ajah","Abijo":"Ajah","Pan-Atlantic University":"Ajah",
  "Apapa GRA":"Apapa","Apapa Port":"Apapa","Tin Can Island":"Apapa",
  "Tin Can Island Port":"Apapa","Kirikiri":"Apapa",
  "Oshodi Market":"Oshodi/Isolo","Isolo":"Oshodi/Isolo","Ejigbo":"Oshodi/Isolo",
  "Mafoluku":"Oshodi/Isolo","Ajao Estate":"Oshodi/Isolo",
  "Ojuelegba":"Surulere","Iponri":"Surulere","Costain":"Apapa","Eko Hospital Surulere":"Surulere",
  "Amuwo Odofin":"Festac Town","Mile 2":"Festac Town","Alakija":"Festac Town",
  "Satellite Town":"Festac Town","Trade Fair Complex":"Festac Town","Agboju":"Festac Town",
  "Alaba International Market":"Ojo/Alaba","Ajangbadi":"Ojo/Alaba","Iba":"Ojo/Alaba",
  "Iyana Ipaja":"Alimosho/Ipaja","Idimu":"Alimosho/Ipaja","Egbe":"Alimosho/Ipaja",
  "Akowonjo":"Alimosho/Ipaja","Shasha":"Alimosho/Ipaja","Ayobo":"Alimosho/Ipaja",
  "Abule Egba":"Alimosho/Ipaja","Dopemu":"Alimosho/Ipaja",
  "Pen Cinema Agege":"Agege",
  "Ikorodu GRA":"Ikorodu","Agric Ikorodu":"Ikorodu","Imota":"Ikorodu",
  "Igbogbo":"Ikorodu","Bayeku":"Ikorodu","Ikorodu Bus Terminal":"Ikorodu",
  "Eleko":"Ibeju-Lekki",
  "LUTH":"Yaba","Gbagada General Hospital":"Gbagada",
  "Reddington Hospital VI":"Victoria Island",
  // Third Mainland Bridge spans water — not a sub-area"Lekki-Ikoyi Link Bridge":"Lekki Phase 1",
  "Murtala Muhammed Airport":"Ikeja GRA",// Ilupeju is its own area
  // Mushin is independent// Okota is independent (near Isolo)"Ago Palace Way":"Oshodi/Isolo",
};

// Returns all area names that match a filter (parent + all its children + self)
function getAreaFamily(area){
  if(!area)return null;
  const set=new Set([area]);
  // Add children
  Object.entries(AREA_PARENT).forEach(([child,parent])=>{if(parent===area)set.add(child);});
  // Add parent
  if(AREA_PARENT[area])set.add(AREA_PARENT[area]);
  return set;
}

// Returns true if report area matches the filter considering hierarchy
function areaMatches(reportArea, filterArea){
  if(!filterArea)return true;
  if(reportArea===filterArea)return true;
  // report is a child of the filter (e.g. report area "UNILAG" matches filter "Yaba")
  if(AREA_PARENT[reportArea]===filterArea)return true;
  // filter is a child of the report area (e.g. watching "Faculty of Education UNILAG",
  // show reports filed under parent "UNILAG" — because that's what gets stored)
  if(AREA_PARENT[filterArea]===reportArea)return true;
  // both share the same parent (siblings within same top-level area)
  if(AREA_PARENT[reportArea]&&AREA_PARENT[reportArea]===AREA_PARENT[filterArea])return true;
  return false;
}


function sl(s){return s.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-");}
const LOCS=[];
function buildBaseLocs(){
  Object.keys(LAGOS).forEach(area=>{
    LOCS.push({id:sl(area),name:area,area,street:null,label:area,custom:false});
    LAGOS[area].forEach(st=>LOCS.push({id:sl(area+st),name:st,area,street:st,label:`${st} — ${area}`,custom:false}));
  });
}
buildBaseLocs();


/* ── Seed reports: shown immediately so feed never looks empty ─────────── */
/* These fill the feed on first load; real DB reports push them out silently */
const _SEED_NOW = Date.now();
const _SEED_REPORTS = [
  {id:'seed-1',name:'Admiralty Way',area:'Lekki Phase 1',type:'bck',time:_SEED_NOW-7*60000,confirms:4,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-2',name:'Coker Road',area:'Ilupeju',type:'out',time:_SEED_NOW-14*60000,confirms:6,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-3',name:'Tafawa Balewa Way',area:'Garki',type:'bck',time:_SEED_NOW-22*60000,confirms:3,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-4',name:'Rumuola Road',area:'Rumuola',type:'out',time:_SEED_NOW-31*60000,confirms:8,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-5',name:'Bode Thomas Street',area:'Surulere',type:'out',time:_SEED_NOW-38*60000,confirms:5,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-6',name:'GRA Phase 2',area:'Port Harcourt GRA Phase 2',type:'bck',time:_SEED_NOW-45*60000,confirms:7,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-7',name:'Bodija Market Road',area:'Bodija',type:'out',time:_SEED_NOW-53*60000,confirms:4,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-8',name:'Aminu Kano Crescent',area:'Wuse 2',type:'bck',time:_SEED_NOW-61*60000,confirms:9,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-9',name:'Independence Layout',area:'GRA Enugu',type:'out',time:_SEED_NOW-72*60000,confirms:3,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-10',name:'Okumagba Avenue',area:'Warri GRA',type:'bck',time:_SEED_NOW-80*60000,confirms:5,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-11',name:'Zaria Road',area:'Sabon Gari Kano',type:'out',time:_SEED_NOW-88*60000,confirms:6,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-12',name:'Awka GRA',area:'Awka GRA',type:'bck',time:_SEED_NOW-97*60000,confirms:2,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-13',name:'Barnawa Road',area:'Barnawa',type:'out',time:_SEED_NOW-105*60000,confirms:4,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-14',name:'Mokola Hill Road',area:'Mokola',type:'out',time:_SEED_NOW-112*60000,confirms:7,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-15',name:'Airport Road',area:'Benin City GRA',type:'bck',time:_SEED_NOW-120*60000,confirms:3,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-16',name:'Murtala Muhammed Way',area:'Makurdi GRA',type:'out',time:_SEED_NOW-130*60000,confirms:5,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-17',name:'Stadium Road',area:'Jos GRA',type:'bck',time:_SEED_NOW-142*60000,confirms:4,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-18',name:'Ndidem Usang Iso Road',area:'Calabar GRA',type:'out',time:_SEED_NOW-155*60000,confirms:3,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-19',name:'Wellington Bassey Way',area:'Uyo GRA',type:'bck',time:_SEED_NOW-163*60000,confirms:6,userId:'seed',isAI:false,isSeed:true},
  {id:'seed-20',name:'Agodi Gate Road',area:'Mokola',type:'bck',time:_SEED_NOW-170*60000,confirms:2,userId:'seed',isAI:false,isSeed:true},
];

let reports=[],filterArea="",feedFilter="today",statusFilter="all",feedPage=1,FEED_PAGE_SIZE=100,mType=null,mSel=null,CU=null,PR=null,emailLog=[],_inResetFlow=false;
const _alertCooldowns={};
const ALERT_COOLDOWN_MS=5*60*1000;
let savedPlaces=[];
let _placeSel=null,_placeType="home",_editPlaceId=null;
let _userCount=0,_nearbyAreas=[],_userLat=null,_userLng=null,_pollTimer=null;
let _leafletMap=null,_leafletUserMarker=null,_leafletPowerMarkers=[];
let userExactLat=null,userExactLng=null;

const IC={
  out:`<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 4V7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="7" cy="10" r=".55" fill="currentColor"/></svg>`,
  bck:`<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5L3.5 7.5H6.5L5.5 12.5L10.5 6.5H7.5L7 1.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  chk:`<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ok:`<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  err:`<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  inf:`<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M6 5.5V8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="6" cy="3.8" r=".55" fill="currentColor"/></svg>`,
  user:`<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="4.5" r="2.2" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 11c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  home:`<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 7L7 1.5L12.5 7V12.5H9V9H5V12.5H1.5V7Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  work:`<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="5" width="11" height="7" rx="1.2" stroke="currentColor" stroke-width="1.3"/><path d="M4 5V3.5a3 3 0 0 1 6 0V5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  school:`<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 4.5l6 3.5 6-3.5L7 1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3 7v3.5c0 .8 1.8 1.5 4 1.5s4-.7 4-1.5V7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  custom:`<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 4.5V7l1.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  pin:`<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 .8A2.3 2.3 0 0 0 2.7 3.1C2.7 5.3 5 9.2 5 9.2S7.3 5.3 7.3 3.1A2.3 2.3 0 0 0 5 .8z" stroke="currentColor" stroke-width="1.1"/><circle cx="5" cy="3.1" r=".9" fill="currentColor"/></svg>`,
  edit:`<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 8.5L8 2.5l1.5 1.5-6 6L1 10l1-1.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  del:`<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 2l7 7M9 2L2 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  ai:`<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" stroke-width="1.1"/><path d="M3.5 7L5 4.5 6.5 7M4.2 6h2.6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
};

const PLACE_ICONS={home:IC.home,work:IC.work,school:IC.school,custom:IC.custom};

const MOON_SVG=`<path d="M13 8.5A5.5 5.5 0 0 1 7.5 3a5.5 5.5 0 1 0 5.5 5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>`;
const SUN_SVG=`<circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.3"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`;

function toggleTheme(){const h=document.documentElement;const isDark=h.getAttribute("data-theme")==="dark";const next=isDark?"light":"dark";h.setAttribute("data-theme",next);document.getElementById("themeIcon").innerHTML=next==="dark"?MOON_SVG:SUN_SVG;try{localStorage.setItem("nw-theme",next);}catch(e){}}
function initTheme(){let saved;try{saved=localStorage.getItem("nw-theme");}catch(e){}const pref=window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light";const t=saved||pref;document.documentElement.setAttribute("data-theme",t);document.getElementById("themeIcon").innerHTML=t==="dark"?MOON_SVG:SUN_SVG;}

function toast(msg,cls="ok"){const t=document.getElementById("toast");const ico={ok:IC.ok,err:IC.err,info:IC.inf}[cls]||"";t.innerHTML=ico+`<span>${msg}</span>`;t.className=`toast ${cls} show`;clearTimeout(t._tid);t._tid=setTimeout(()=>t.className="toast",cls==="err"?7000:3600);}

async function initAuth(){
  try{const{data:{session}}=await sb.auth.getSession();CU=session?.user||null;if(CU)await loadProfile();}catch(e){}
  updateBanner();
  sb.auth.onAuthStateChange(async(event,session)=>{
    if(_inResetFlow)return;
    CU=session?.user||null;
    if(CU){
      if(event==="SIGNED_IN"||event==="USER_UPDATED"||!PR){await loadProfile();if(event==="SIGNED_IN")_maybeStartTour();}
      if(event==="TOKEN_REFRESHED"){await loadProfile();}
    } else {
      PR=null;savedPlaces=[];
      document.getElementById("locTag").classList.remove("on");
    }
    updateBanner();renderAccount();if(CU)loadSavedPlaces();
  });
  // Periodic session health check — fixes untappable state after long idle
  setInterval(async()=>{
    try{
      const{data:{session}}=await sb.auth.getSession();
      const u=session?.user||null;
      if(!u&&CU){CU=null;PR=null;savedPlaces=[];updateBanner();renderAccount();}
      else if(u&&!CU){CU=u;await loadProfile();updateBanner();renderAccount();loadSavedPlaces();}
    }catch(e){}
  },5*60*1000);
}
function _resetFormHTML(){return`<div class="auth-wrap"><div class="auth-logo"><div class="auth-logo-icon" style="background:var(--p)">${LOGO_IMG_TAG}</div><span class="auth-logo-name">NEPA<em>Watch</em></span></div><h2>Set new password</h2><p class="auth-sub">Choose a strong new password for your account.</p><div class="msg err" id="authErr"></div><div class="msg ok" id="authOk"></div><div class="fld"><label>New Password</label><input id="inp-newpass" type="password" placeholder="Min 6 characters" autocomplete="new-password"><button type="button" class="pw-eye-btn" onclick="appTogglePw(this)" tabindex="-1"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8C2.5 5 5 3.5 8 3.5C11 3.5 13.5 5 15 8C13.5 11 11 12.5 8 12.5C5 12.5 2.5 11 1 8Z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.3"/></svg></button></div><div class="fld"><label>Confirm Password</label><input id="inp-confpass" type="password" placeholder="Repeat password" autocomplete="new-password"><button type="button" class="pw-eye-btn" onclick="appTogglePw(this)" tabindex="-1"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8C2.5 5 5 3.5 8 3.5C11 3.5 13.5 5 15 8C13.5 11 11 12.5 8 12.5C5 12.5 2.5 11 1 8Z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.3"/></svg></button></div><button class="auth-btn" id="authBtn" onclick="doPasswordReset()">Update Password</button></div>`;}

async function loadProfile(){if(!CU)return;try{const{data,error}=await sb.from("profiles").select("*").eq("id",CU.id).single();if(!error&&data){PR=data;if(PR.location_id){document.getElementById("locTag").classList.add("on");document.getElementById("locLabel").textContent=PR.location_label||PR.location_name;}}else if(error&&error.code==="PGRST116"){const name=CU.user_metadata?.name||CU.email.split("@")[0];await sb.from("profiles").upsert({id:CU.id,email:CU.email,name,notif_on:true},{onConflict:"id"});PR={id:CU.id,email:CU.email,name,notif_on:true,location_id:null};}}catch(e){}}

async function doRegister(name,email,pass){const{data,error}=await sb.auth.signUp({email,password:pass,options:{data:{name},emailRedirectTo:APP_URL+"?mode=reset"}});if(error){if(error.message?.toLowerCase().includes("rate limit")||error.message?.toLowerCase().includes("over_email_send_rate_limit"))throw new Error("RATE_LIMIT");throw new Error(error.message);}if(data.user){await sb.from("profiles").upsert({id:data.user.id,email,name,notif_on:true},{onConflict:"id"});}if(data.session){CU=data.user;await loadProfile();renderAccount();updateBanner();toast(`Welcome, ${name}!`,"ok");_maybeStartTour();}sendEmail(email,"Welcome to NEPAWatch Lagos",`Hi ${name},\n\nWelcome to NEPAWatch Lagos!\n\nYou will receive real-time email alerts whenever power goes out or is restored near your street.\n\nOpen the app and set your location to activate alerts.\n\nStay powered,\nNEPAWatch Lagos`,buildEmailHtml({type:'welcome',name,appUrl:APP_URL}));return data;}
async function doLogin(email,pass){const{data,error}=await sb.auth.signInWithPassword({email,password:pass});if(error)throw new Error(error.message);return data;}
async function doLogout(){try{await sb.auth.signOut();}catch(e){}CU=null;PR=null;savedPlaces=[];document.getElementById("locTag").classList.remove("on");updateBanner();renderAccount();toast("Signed out","info");}

async function loadSavedPlaces(){if(!CU)return;try{const{data,error}=await sb.from("saved_places").select("*").eq("user_id",CU.id).order("created_at",{ascending:true});if(!error&&data)savedPlaces=data;}catch(e){savedPlaces=[];}renderSavedPlacesHome();renderMyPlacesList();}
async function savePlaceToDB(placeObj){if(!CU)return null;try{if(placeObj.id&&!String(placeObj.id).startsWith("local-")){const{data,error}=await sb.from("saved_places").update({type:placeObj.type,custom_label:placeObj.custom_label,location_id:placeObj.location_id,location_name:placeObj.location_name,location_area:placeObj.location_area,location_label:placeObj.location_label,notif_on:placeObj.notif_on!==false}).eq("id",placeObj.id).select().single();if(error)throw error;return data;}else{const{data,error}=await sb.from("saved_places").insert({user_id:CU.id,type:placeObj.type,custom_label:placeObj.custom_label||null,location_id:placeObj.location_id,location_name:placeObj.location_name,location_area:placeObj.location_area,location_label:placeObj.location_label,notif_on:true}).select().single();if(error)throw error;return data;}}catch(e){return{id:"local-"+Date.now(),...placeObj};}}
async function deleteSavedPlace(id){savedPlaces=savedPlaces.filter(p=>p.id!==id);if(!String(id).startsWith("local-")){try{await sb.from("saved_places").delete().eq("id",id);}catch(e){}}renderSavedPlacesHome();renderMyPlacesList();toast("Place removed","info");}
async function togglePlaceNotif(id){const p=savedPlaces.find(x=>x.id===id);if(!p)return;p.notif_on=!p.notif_on;if(!String(id).startsWith("local-")){try{await sb.from("saved_places").update({notif_on:p.notif_on}).eq("id",id);}catch(e){}}toast(p.notif_on?"Alerts on for this place":"Alerts off for this place","info");renderMyPlacesList();}
function getPlaceDisplayName(p){if(p.custom_label)return p.custom_label;const names={home:"Home",work:"Work",school:"School",custom:"My Place"};return names[p.type]||"My Place";}
function getPlaceStatus(area){if(!area)return"unk";const r=reports.filter(x=>areaMatches(x.area,area)||areaMatches(area,x.area));if(!r.length)return"unk";return r[0].type==="out"?"out":"on";}

function renderSavedPlacesHome(){const el=document.getElementById("savedPlacesHome");if(!savedPlaces.length){el.innerHTML="";return;}const cards=savedPlaces.map(p=>{const status=getPlaceStatus(p.location_area);const statusCls=status==="out"?"s-out":status==="on"?"s-on":"s-unk";const statusTxt=status==="out"?"Power out":status==="on"?"Power on":"Unknown";const statusIco=status==="out"?IC.out:status==="on"?IC.bck:IC.pin;const cardCls=status==="out"?"sp-out":status==="on"?"sp-on":"";return`<div class="sp-card ${cardCls}" onclick="jumpToArea('${p.location_area||""}')"><div class="sp-label">${getPlaceDisplayName(p)}</div><div class="sp-name">${p.location_name}</div><div class="sp-status ${statusCls}">${statusIco}&nbsp;${statusTxt}</div></div>`;}).join("");el.innerHTML=`<div class="slbl">Saved Places</div><div class="saved-places"><div class="sp-scroll">${cards}<button class="sp-add" onclick="openPlaceModal()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Add Place</button></div></div>`;}

function renderMyPlacesList(){const el=document.getElementById("myPlacesList");if(!el)return;if(!savedPlaces.length){el.innerHTML=`<div class="empty"><div class="empty-ico">${IC.pin}</div><p>No saved places yet. Add your home, work or school to track their power status.</p></div>`;return;}const typeClsMap={home:"mpl-home",work:"mpl-work",school:"mpl-school",custom:"mpl-custom"};el.innerHTML=savedPlaces.map(p=>{const status=getPlaceStatus(p.location_area);const statusCls=status==="out"?"s-out":status==="on"?"s-on":"s-unk";const statusTxt=status==="out"?"Power Out":status==="on"?"Power On":"Unknown";const statusIco=status==="out"?IC.out:status==="on"?IC.bck:IC.pin;const ico=PLACE_ICONS[p.type]||IC.custom;const typeCls=typeClsMap[p.type]||"mpl-custom";return`<div class="mpl-card"><div class="mpl-type-ico ${typeCls}">${ico}</div><div class="mpl-body"><div class="mpl-lbl">${getPlaceDisplayName(p)}</div><div class="mpl-name">${p.location_name}</div><div class="mpl-area">${p.location_area||""}</div></div><div class="mpl-status ${statusCls}">${statusIco}&nbsp;${statusTxt}</div><div class="mpl-actions"><button class="mpl-edit-btn" onclick="editSavedPlace('${p.id}')" title="Edit">${IC.edit}</button><button class="mpl-del-btn" onclick="deleteSavedPlace('${p.id}')" title="Remove">${IC.del}</button></div></div>`;}).join("");}

function jumpToArea(area){if(!area)return;filterArea=area;const sel=document.getElementById("areaFilter");if(sel)sel.value=area;go("home");renderFeed("liveFeed");toast(`Filtered to ${area}`,"info");}

function openPlaceModal(editId){_editPlaceId=editId||null;_placeSel=null;_placeType="home";document.getElementById("placeShTitle").textContent=editId?"Edit Saved Place":"Add Saved Place";document.getElementById("customPlaceName").value="";document.getElementById("placeSearch").value="";if(editId){const existing=savedPlaces.find(p=>p.id===editId);if(existing){_placeType=existing.type||"home";document.getElementById("customPlaceName").value=existing.custom_label||"";const loc=LOCS.find(l=>l.id===existing.location_id)||{id:existing.location_id,name:existing.location_name,area:existing.location_area,label:existing.location_label};_placeSel=loc;document.getElementById("placeSearch").value=existing.location_name||"";}}document.querySelectorAll(".pt-btn").forEach(b=>b.classList.toggle("selected",b.dataset.type===_placeType));_placeNomResults=[];renderPlaceList(LOCS.filter(l=>!l.street).slice(0,15));const btn=document.getElementById("placeBtn");if(_placeSel){btn.disabled=false;btn.textContent=editId?"Save Changes":"Add Place";}else{btn.disabled=true;btn.textContent="Select a location first";}document.getElementById("placeOverlay").classList.add("open");}
function editSavedPlace(id){openPlaceModal(id);}
function closePlaceModal(){document.getElementById("placeOverlay").classList.remove("open");_placeSel=null;_placeType="home";_editPlaceId=null;_placeNomResults=[];}
function selectPlaceType(btn,type){_placeType=type;document.querySelectorAll(".pt-btn").forEach(b=>b.classList.remove("selected"));btn.classList.add("selected");}
let _placeNomTimer=null,_placeNomResults=[];
function filterPlaceList(){
  const q=document.getElementById("placeSearch").value.trim();
  const el=document.getElementById("placeList");
  if(!q){
    // Show top LOCS areas as quick picks
    renderPlaceList(LOCS.filter(l=>!l.street).slice(0,20));
    return;
  }
  // Instant local match first
  const local=LOCS.filter(l=>l.label.toLowerCase().includes(q.toLowerCase())).slice(0,5);
  renderPlaceList(local,true);
  // Then Nominatim live search
  clearTimeout(_placeNomTimer);
  _placeNomTimer=setTimeout(()=>_runPlaceNominatim(q),320);
}

async function _runPlaceNominatim(q){
  try{
    const url=`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q+', Nigeria')}&format=json&limit=8&addressdetails=1&countrycodes=ng`;
    const res=await fetch(url,{headers:{"Accept-Language":"en","User-Agent":"NEPAWatch/1.0"}});
    const data=await res.json();
    _placeNomResults=data||[];
    const local=LOCS.filter(l=>l.label.toLowerCase().includes(q.toLowerCase())).slice(0,3);
    renderPlaceList(local,false,_placeNomResults);
  }catch(e){}
}

// Place add form removed — Nominatim handles location discovery
function renderPlaceList(locs=[],searching=false,nomResults=[]){
  const el=document.getElementById("placeList");
  if(!el)return;
  let html="";
  if(locs.length){
    html+=locs.map(l=>`<div class="mopt ${_placeSel?.id===l.id?"sel":""}" onclick="selectPlaceLoc('${l.id}')"><span>${l.name}</span><span class="mopt-sub">${l.street?l.area:"Area"}</span></div>`).join("");
  }
  if(searching){
    html+=`<div class="mopt" style="color:var(--ink3);cursor:default;font-size:.72rem;justify-content:center"><span class="spin" style="display:inline-block;margin-right:6px"></span>Searching map…</div>`;
  }
  if(nomResults.length){
    if(html)html+=`<div style="font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);padding:6px 14px 2px;font-weight:700">From Map</div>`;
    html+=nomResults.map((r,i)=>{
      const name=r.name||r.display_name.split(',')[0];
      const a=r.address||{};
      const sub=a.suburb||a.city_district||a.town||"";
      return`<div class="mopt" onclick="selectPlaceNomResult(${i})">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style="flex-shrink:0;color:var(--p)"><path d="M5.5 1A2.2 2.2 0 0 0 3.3 3.2C3.3 5.6 5.5 10 5.5 10S7.7 5.6 7.7 3.2A2.2 2.2 0 0 0 5.5 1z" stroke="currentColor" stroke-width="1.1"/><circle cx="5.5" cy="3.2" r=".9" fill="currentColor"/></svg>
        <span>${name}</span><span class="mopt-sub">${sub}</span>
      </div>`;
    }).join("");
  }
  if(!html){
    html=`<div class="mopt" style="color:var(--ink3);cursor:default;justify-content:center;padding:14px;font-size:.72rem">No results found</div>`;
  }
  el.innerHTML=html;
}
function selectPlaceLoc(id){
  _placeSel=LOCS.find(l=>l.id===id);
  const q=document.getElementById("placeSearch").value.trim().toLowerCase();
  renderPlaceList(q?LOCS.filter(l=>l.label.toLowerCase().includes(q)).slice(0,5):[],false,_placeNomResults||[]);
  const btn=document.getElementById("placeBtn");
  if(_placeSel){btn.disabled=false;btn.textContent=_editPlaceId?"Save Changes":"Add Place";}
}

async function selectPlaceNomResult(idx){
  const r=_placeNomResults[idx];
  if(!r)return;
  const lat=parseFloat(r.lat),lng=parseFloat(r.lon);
  const name=r.name||r.display_name.split(',')[0];
  const a=r.address||{};
  const area=a.suburb||a.city_district||a.town||findNearestAreas(lat,lng,1)[0]?.area||'Lagos';

  // Update search input to show picked name
  const inp=document.getElementById("placeSearch");
  if(inp)inp.value=name;

  // Snap to existing LOCS entry if within 200m
  const snapped=_findDupLoc(lat,lng,200);
  if(snapped){
    _placeSel=snapped;
  } else {
    // Create/reuse custom location entry (in LOCS only, no DB yet — DB write happens on save)
    const tempId="nom-"+Date.now();
    _placeSel={id:tempId,name,area,street:name,label:`${name} — ${area}`,custom:true,lat,lng,_nomPending:true};
    // Pre-register in LOCS so submitSavedPlace can find it
    if(!LOCS.find(l=>l.id===tempId))LOCS.unshift(_placeSel);
  }

  const btn=document.getElementById("placeBtn");
  if(btn){btn.disabled=false;btn.textContent=_editPlaceId?"Save Changes":"Add Place";}
  renderPlaceList([_placeSel],false);
}
function promptSaveArea(area){
  if(!area)return;
  if(!CU){
    toast("Sign in to save areas","info");
    go("account");
    return;
  }
  // Pre-fill the saved places modal with this area already selected
  const areaLoc=LOCS.find(l=>l.name===area&&!l.street)||LOCS.find(l=>l.area===area&&!l.street);
  openPlaceModal();
  if(areaLoc){
    setTimeout(()=>{
      _placeSel=areaLoc;
      const inp=document.getElementById("placeSearch");
      if(inp)inp.value=areaLoc.name;
      renderPlaceList([areaLoc]);
      const btn=document.getElementById("placeBtn");
      if(btn){btn.disabled=false;btn.textContent="Add Place";}
    },100);
  } else {
    // Pre-fill the search
    setTimeout(()=>{
      const inp=document.getElementById("placeSearch");
      if(inp){inp.value=area;filterPlaceList();}
    },100);
  }
}

async function submitSavedPlace(){
  if(!CU){toast("Sign in to save places","info");closePlaceModal();go("account");return;}
  if(!_placeSel){toast("Select a location","info");return;}
  const customLabel=document.getElementById("customPlaceName").value.trim()||null;
  const btn=document.getElementById("placeBtn");
  btn.innerHTML=`Saving... <span class="spin"></span>`;btn.disabled=true;

  // If this came from Nominatim (not in DB yet), write it to custom_locations first
  let loc=_placeSel;
  if(loc._nomPending&&loc.lat&&loc.lng){
    const saved=await submitCustomLocation(loc.name,loc.area,loc.lat,loc.lng);
    if(saved)loc=saved;
  }

  const placeObj={id:_editPlaceId||null,type:_placeType,custom_label:customLabel,
    location_id:loc.id,location_name:loc.name,location_area:loc.area,location_label:loc.label,notif_on:true};
  const saved=await savePlaceToDB(placeObj);
  if(saved){
    if(_editPlaceId){const idx=savedPlaces.findIndex(p=>p.id===_editPlaceId);if(idx!==-1)savedPlaces[idx]={...savedPlaces[idx],...saved};}
    else{savedPlaces.push(saved);}
    renderSavedPlacesHome();renderMyPlacesList();toast(_editPlaceId?"Place updated":"Place saved","ok");
  }
  btn.innerHTML=_editPlaceId?"Save Changes":"Add Place";btn.disabled=false;
  closePlaceModal();
}

function haversine(lat1,lng1,lat2,lng2){const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function findNearestAreas(lat,lng,count=8){
  const all=Object.entries(AREA_COORDS).map(([area,coords])=>({area,dist:haversine(lat,lng,coords.lat,coords.lng)})).sort((a,b)=>a.dist-b.dist);
  // Prefer child areas over parent areas at same distance
  const result=[];const seen=new Set();
  for(const entry of all){
    if(result.length>=count)break;
    if(seen.has(entry.area))continue;
    result.push(entry);seen.add(entry.area);
    // If this is a child area, also mark its parent as "covered" so it doesn't duplicate
    const parent=AREA_PARENT?.[entry.area];
    if(parent&&result.length<count){
      // Don't skip parent — add it too so user can filter up
    }
  }
  return result.slice(0,count);
}
async function reverseGeocode(lat,lng){try{const res=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,{headers:{"Accept-Language":"en","User-Agent":"NEPAWatch/1.0"}});const data=await res.json();const a=data.address||{};const precise=a.neighbourhood||a.suburb||a.city_district||a.town||a.city||"";if(precise){const txt=document.getElementById("geoBtnTxt");txt.textContent=precise.length>12?precise.substring(0,12)+"...":precise;toast(`Near ${precise}`,"ok");}}catch(e){}}

async function detectLocation(){const btn=document.getElementById("geoBtn");const txt=document.getElementById("geoBtnTxt");if(!navigator.geolocation){toast("Geolocation not supported","err");return;}txt.textContent="Locating...";btn.disabled=true;const tryGeo=(highAccuracy,timeoutMs)=>new Promise((resolve,reject)=>{navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:highAccuracy,timeout:timeoutMs,maximumAge:highAccuracy?10000:60000});});let pos;try{pos=await tryGeo(true,12000);}catch(e1){try{pos=await tryGeo(false,8000);}catch(e2){const msg=e2.code===1?"Location access denied":e2.code===2?"Could not get location":"Location request timed out";toast(msg,"err");txt.textContent="Locate Me";btn.disabled=false;return;}}const{latitude:lat,longitude:lng,accuracy}=pos.coords;_userLat=lat;_userLng=lng;userExactLat=lat;userExactLng=lng;_nearbyAreas=findNearestAreas(lat,lng,8);const nearest=_nearbyAreas[0]?.area;if(!nearest){toast("Could not match your location to a Lagos area","err");txt.textContent="Locate Me";btn.disabled=false;return;}// Snap to nearest existing LOCS entry within 200m
const snapped=_findDupLoc(lat,lng,200);
// Use parent area for filtering so sub-area reports all show together
const _nearestParent=AREA_PARENT?.[nearest]||nearest;
const sel=document.getElementById("areaFilter");
// Show the specific area in filter UI but filter by parent for broader results
filterArea=_nearestParent;
sel.value=_nearestParent;
renderFeed("liveFeed");btn.classList.add("active");btn.disabled=false;const accStr=accuracy<100?`±${Math.round(accuracy)}m`:"";const snapName=snapped?snapped.name:nearest;
const displayName=snapName;
const parentName=AREA_PARENT?.[nearest]||nearest;
// Show specific location in toast, watching area on the button
const watchLabel=parentName!==nearest?parentName:snapName;
toast(`${snapName}${parentName!==nearest?" — watching "+parentName:""}${accStr?" "+accStr:""}`,"ok");
txt.textContent=watchLabel.length>12?watchLabel.substring(0,12)+"...":watchLabel;
// Update locTag to show watching area
document.getElementById("locTag").classList.add("on");
document.getElementById("locLabel").textContent=snapName!==watchLabel?`${snapName}, ${watchLabel}`:watchLabel;renderNearbyDashboard();_showMap();showLeafletLocation(lat,lng);if(CU&&PR&&!PR.location_id){if(snapped){await saveLocation(snapped);}else{// Try to get a street name via Nominatim and find/create a location
try{const res=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`,{headers:{"Accept-Language":"en","User-Agent":"NEPAWatch/1.0"}});const d=await res.json();const a=d.address||{};const streetName=a.road||a.neighbourhood||a.suburb||a.city_district||"";const areaName=a.suburb||a.city_district||a.town||nearest;if(streetName){// Check dup again now that we have a real name
const dup2=LOCS.find(l=>_normName(l.name)===_normName(streetName)&&l.area.toLowerCase()===areaName.toLowerCase());if(dup2){await saveLocation(dup2);}else{const newLoc=await submitCustomLocation(streetName,areaName,lat,lng);if(newLoc)await saveLocation(newLoc);}}else{const loc=LOCS.find(l=>l.name===nearest&&!l.street);if(loc)await saveLocation(loc);}}catch(e){const loc=LOCS.find(l=>l.name===nearest&&!l.street);if(loc)await saveLocation(loc);}}}}

function showLeafletLocation(lat,lng){const mapDiv=document.getElementById('mapContainer');if(!mapDiv)return;if(!_leafletMap){_leafletMap=L.map(mapDiv,{zoomControl:true,attributionControl:false}).setView([lat,lng],15);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(_leafletMap);}else{_leafletMap.setView([lat,lng],15);}if(_leafletUserMarker)_leafletUserMarker.remove();_leafletPowerMarkers.forEach(m=>m.remove());_leafletPowerMarkers=[];const userIcon=L.divIcon({className:'',html:'<div style="width:16px;height:16px;background:#4B8EF5;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>',iconSize:[16,16],iconAnchor:[8,8]});_leafletUserMarker=L.marker([lat,lng],{icon:userIcon}).addTo(_leafletMap).bindPopup('<strong>You are here</strong>');const nearby=findNearbyPowerSpots(lat,lng,6);nearby.forEach(spot=>{const col=spot.status==='on'?'#AAFF00':spot.status==='out'?'#FF4055':'#888';const icon=L.divIcon({className:'',html:`<div style="width:13px;height:13px;background:${col};border:2px solid rgba(255,255,255,.8);border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,.5)"></div>`,iconSize:[13,13],iconAnchor:[6,6]});const marker=L.marker([spot.coords.lat,spot.coords.lng],{icon}).addTo(_leafletMap);const distTxt=spot.dist<1?`${(spot.dist*1000).toFixed(0)}m`:`${spot.dist.toFixed(1)}km`;marker.bindPopup(`<strong>${spot.area}</strong><br>Power: ${spot.status==='on'?'Power On':spot.status==='out'?'Power Out':'Unknown'}<br>${distTxt} away`);_leafletPowerMarkers.push(marker);});setTimeout(()=>_leafletMap&&_leafletMap.invalidateSize(),200);}
function findNearbyPowerSpots(lat,lng,limit=5){return Object.entries(AREA_COORDS).map(([area,coords])=>({area,status:getPlaceStatus(area),coords,dist:haversine(lat,lng,coords.lat,coords.lng)})).filter(s=>s.dist<=10).sort((a,b)=>a.dist-b.dist).slice(0,limit);}

function clearLoc(){filterArea="";const sel=document.getElementById("areaFilter");if(sel)sel.value="";document.getElementById("locTag").classList.remove("on");document.getElementById("geoBtn").classList.remove("active");document.getElementById("geoBtnTxt").textContent="Locate Me";_nearbyAreas=[];_userLat=null;_userLng=null;userExactLat=userExactLng=null;_hideMap();if(_leafletUserMarker){_leafletUserMarker.remove();_leafletUserMarker=null;}_leafletPowerMarkers.forEach(m=>m.remove());_leafletPowerMarkers=[];if(_leafletMap){_leafletMap.remove();_leafletMap=null;}renderNearbyDashboard();renderFeed("liveFeed");if(CU&&PR){PR.location_id=null;PR.location_name=null;PR.location_area=null;PR.location_label=null;sb.from("profiles").update({location_id:null,location_name:null,location_area:null,location_label:null}).eq("id",CU.id).then(()=>{}).catch(()=>{});}}

function renderNearbyDashboard(){const el=document.getElementById("nearbyDashboard");if(!_nearbyAreas.length){el.innerHTML="";return;}const cards=_nearbyAreas.slice(0,6).map(({area,dist})=>{const status=getPlaceStatus(area);const statusCls=status==="out"?"nb-status s-out":status==="on"?"nb-status s-on":"nb-status s-unk";const statusTxt=status==="out"?"Power Out":status==="on"?"Power On":"No reports";const statusIco=status==="out"?IC.out:status==="on"?IC.bck:IC.pin;const distStr=dist<1?`${Math.round(dist*1000)}m away`:`${dist.toFixed(1)}km away`;return`<div class="nb-card" onclick="jumpToArea('${area}')"><div class="nb-area">${area}</div><div class="nb-dist">${distStr}</div><div class="${statusCls}">${statusIco}&nbsp;${statusTxt}</div></div>`;}).join("");el.innerHTML=`<div class="slbl">Nearby Areas</div><div class="nearby-grid">${cards}</div>`;}

async function loadUserCount(){try{const{count,error}=await sb.from("profiles").select("id",{count:"exact",head:true});if(!error&&count!=null){_userCount=count;const pill=document.getElementById("userCountPill");const num=document.getElementById("userCountNum");if(pill&&num&&count>=2){num.textContent=count.toLocaleString();pill.style.display="flex";}}}catch(e){}}

async function saveLocation(loc){if(!CU)return;const u={location_id:loc.id,location_name:loc.name,location_area:loc.area,location_label:loc.label};try{await sb.from("profiles").update(u).eq("id",CU.id);}catch(e){}PR={...PR,...u};document.getElementById("locTag").classList.add("on");document.getElementById("locLabel").textContent=loc.label;updateBanner();toast(`Location set — ${loc.name}`,"ok");}
async function toggleNotif(){if(!CU||!PR)return;const next=!PR.notif_on;try{await sb.from("profiles").update({notif_on:next}).eq("id",CU.id);}catch(e){}PR.notif_on=next;const btn=document.getElementById("notifToggle");if(btn)btn.classList.toggle("on",next);toast(next?"Email alerts enabled":"Email alerts disabled","info");renderAccount();}
async function togglePushNotif(){const status=getPushStatus();if(status==='enabled'){await disablePush();}else if(status==='blocked'){toast('Notifications blocked — go to browser Settings and allow notifications for this site','info');}else if(status==='ios-needs-install'){toast('On iPhone, add NEPAWatch to your Home Screen first: Safari › Share › Add to Home Screen','info');}else if(status==='unsupported'){toast('Push notifications are not supported in this browser','info');}else{await requestPushPermission();}}

async function loadCustomLocations(){try{const{data,error}=await sb.from("custom_locations").select("*").order("created_at",{ascending:true});if(!error&&data&&data.length){data.forEach(loc=>{if(!LOCS.find(l=>l.id===loc.id)){LOCS.unshift({id:loc.id,name:loc.street_name,area:loc.area_name,street:loc.street_name,label:`${loc.street_name} — ${loc.area_name}`,custom:true,lat:loc.lat||null,lng:loc.lng||null});}else{const ex=LOCS.find(l=>l.id===loc.id);if(ex&&!ex.lat&&loc.lat){ex.lat=loc.lat;ex.lng=loc.lng;}}});buildFilter();}}catch(e){}}
async function _geocodeLoc(street,area){try{const q=encodeURIComponent(`${street}, ${area}, Nigeria`);const res=await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=3&countrycodes=ng&addressdetails=1`,{headers:{"Accept-Language":"en","User-Agent":"NEPAWatch/1.0"}});const d=await res.json();if(d&&d[0])return{lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon)};return null;}catch(e){return null;}}
function _findDupLoc(lat,lng,radiusM=180){if(!lat||!lng)return null;for(const l of LOCS){if(l.lat&&l.lng){const dist=haversine(lat,lng,l.lat,l.lng)*1000;if(dist<=radiusM)return l;}}return null;}
async function submitCustomLocation(street,area,lat=null,lng=null){if(!CU)return null;try{// Geocode if no coords provided
if(!lat||!lng){const gc=await _geocodeLoc(street,area);if(gc){lat=gc.lat;lng=gc.lng;}}// Check for duplicate within 180m
if(lat&&lng){const dup=_findDupLoc(lat,lng,180);if(dup){toast(`Merged with "${dup.name}" — same location`,"ok");return dup;}}const{data,error}=await sb.from("custom_locations").insert({street_name:street,area_name:area,lat:lat||null,lng:lng||null}).select().single();if(error)throw error;const newLoc={id:data.id,name:street,area,street,label:`${street} — ${area}`,custom:true,lat:lat||null,lng:lng||null};if(!LOCS.find(l=>l.id===data.id))LOCS.unshift(newLoc);toast(`"${data.street_name}" added for everyone!`,"ok");return newLoc;}catch(e){toast(e.message||"Could not add location","err");return null;}}

async function loadReports(){
  const fetchWithTimeout=(promise,ms)=>Promise.race([
    promise,
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))
  ]);
  try{
    const {data, error} = await fetchWithTimeout(
      sb.from("reports")
        .select("id,user_id,location_name,location_area,type,confirms,created_at,ai_prob,wrong_votes")
        .order("created_at",{ascending:false})
        .limit(300),
      8000
    );
    if(error) throw error;
    const mapRow=r=>({id:r.id,name:r.location_name,area:r.location_area,type:r.type,time:new Date(r.created_at).getTime(),confirms:r.confirms||1,userId:r.user_id,isAI:r.user_id===AI_USER_ID||r.ai_prob!=null,aiProb:r.ai_prob||null,wrongVotes:r.wrong_votes||0,flagged:(r.wrong_votes||0)>=3});
    const dbReports=(data||[]).map(mapRow);
    dbReports.sort((a,b)=>b.time-a.time);
    // Preserve: optimistic inserts (local-/ai- prefix) AND in-memory AI reports not in this DB batch
    const dbIds=new Set(dbReports.map(r=>String(r.id)));
    const pending=reports.filter(r=>{
      const sid=String(r.id);
      if(sid.startsWith("seed-"))return false; // drop seed/demo reports once real data arrives
      if(sid.startsWith("local-")||sid.startsWith("ai-"))return true; // optimistic
      if((r.isAI||r.userId===AI_USER_ID)&&!dbIds.has(sid))return true; // AI report not in batch
      return false;
    });
    reports=[...pending,...dbReports];
  }catch(e){
    console.warn('[loadReports] failed:',e?.message);
  }
  render();
  if(_nearbyAreas.length) renderNearbyDashboard();
}

async function pollReports(){try{const{data,error}=await sb.from("reports").select("id,user_id,location_name,location_area,type,confirms,created_at,ai_prob,wrong_votes").order("created_at",{ascending:false}).limit(300);if(error||!data)return;const dbReports=data.map(r=>({id:r.id,name:r.location_name,area:r.location_area,type:r.type,time:new Date(r.created_at).getTime(),confirms:r.confirms||1,userId:r.user_id,isAI:r.user_id===AI_USER_ID||r.ai_prob!=null,aiProb:r.ai_prob||null,wrongVotes:r.wrong_votes||0,flagged:(r.wrong_votes||0)>=3}));const dbIds=new Set(dbReports.map(r=>String(r.id)));const pending=reports.filter(r=>{const sid=String(r.id);if(sid.startsWith("local-")||sid.startsWith("ai-"))return true;if((r.isAI||r.userId===AI_USER_ID)&&!dbIds.has(sid))return true;return false;});const newList=[...pending,...dbReports];const oldIds=reports.filter(r=>!String(r.id).startsWith("local-")&&!String(r.id).startsWith("ai-")).map(r=>r.id+r.confirms).join(",");const newIds=dbReports.map(r=>r.id+r.confirms).join(",");if(oldIds!==newIds){reports=newList;render();if(_nearbyAreas.length)renderNearbyDashboard();renderSavedPlacesHome();renderMyPlacesList();}}catch(e){}}

function startPolling(){
  if(_pollTimer)clearInterval(_pollTimer);
  _pollTimer=setInterval(pollReports,5000);
  if(window._fullSyncTimer)clearInterval(window._fullSyncTimer);
  window._fullSyncTimer=setInterval(()=>{loadReports().catch(()=>{});},60000);
}

async function pushReport(loc,type){
  if(!CU){toast("Sign in to submit a report","info");go("account");return;}
  // ── FAKE REPORT DETECTION: max 4 reports per user in 10 minutes ──
  const tenMin=10*60*1000;const now=Date.now();
  const recentOwn=reports.filter(r=>r.userId===CU.id&&(now-r.time)<tenMin);
  if(recentOwn.length>=4){toast("You're reporting too fast — please wait a few minutes","info");return;}
  const tid="local-"+Date.now();reports.unshift({id:tid,name:loc.name,area:loc.area,type,time:Date.now(),confirms:1,userId:CU.id});if(reports.length>500){const di=reports.slice(400).findIndex(r=>!r.isAI&&r.userId!==AI_USER_ID&&!String(r.id).startsWith('local-')&&!String(r.id).startsWith('ai-'));if(di!==-1)reports.splice(400+di,1);else reports.pop();}render();try{const{data,error}=await sb.from("reports").insert({user_id:CU.id,location_name:loc.name,location_area:loc.area,type,confirms:1}).select().single();if(error){const idx=reports.findIndex(r=>r.id===tid);if(idx!==-1)reports.splice(idx,1);render();toast(`Could not save report: ${error.message}`,"err");return;}const idx=reports.findIndex(r=>r.id===tid);if(idx!==-1)reports[idx]={id:data.id,name:data.location_name,area:data.location_area,type:data.type,time:new Date(data.created_at).getTime(),confirms:data.confirms||1,userId:data.user_id};render();toast(type==="out"?`Outage reported — ${loc.name}`:`Power restored — ${loc.name}`,type==="out"?"err":"ok");if(PR&&!PR.location_id)await saveLocation(loc);await sendAreaAlerts(loc.name,loc.area,type);setTimeout(loadReports,2000);}catch(e){const idx=reports.findIndex(r=>r.id===tid);if(idx!==-1)reports.splice(idx,1);render();toast("Could not save report — check your connection","err");}}

async function addConfirm(repId) {
  const r = reports.find(x => x.id === repId);
  if (!r) return;

  // Require login
  if (!CU) {
    toast("Sign in to confirm reports", "info");
    return;
  }
  // Prevent self-confirmation
  if (r.userId === CU.id) {
    toast("You cannot confirm your own report", "info");
    return;
  }

  r.confirms++;
  const isReal = !String(repId).startsWith("local-") && !String(repId).startsWith("s") && !String(repId).startsWith("ai-");
  if (isReal) {
    try {
      await sb.from("reports").update({ confirms: r.confirms }).eq("id", repId);
    } catch(e) {}
  }
  renderFeed("liveFeed");
  toast("Confirmation added", "ok");
}


// ══════════════════════════════════════════════════════════════════
// FEATURE: WRONG REPORT VOTING
// ══════════════════════════════════════════════════════════════════
const _wrongVotes = new Map(); // reportId → Set of userIds who voted wrong

async function markReportWrong(repId) {
  if (!CU) { toast("Sign in to flag reports", "info"); return; }
  const r = reports.find(x => x.id === repId);
  if (!r) return;
  if (r.userId === CU.id) { toast("You cannot flag your own report", "info"); return; }
  if (!_wrongVotes.has(repId)) _wrongVotes.set(repId, new Set());
  const voters = _wrongVotes.get(repId);
  if (voters.has(CU.id)) { toast("Already flagged", "info"); return; }
  voters.add(CU.id);
  r.wrongVotes = (r.wrongVotes || 0) + 1;
  toast("Report flagged as inaccurate", "info");
  // If 3+ wrong votes, visually dim and persist flag
  if (r.wrongVotes >= 3) {
    r.flagged = true;
    const isReal = !String(repId).startsWith("local-") && !String(repId).startsWith("s") && !String(repId).startsWith("ai-");
    if (isReal) {
      try { await sb.from("reports").update({ wrong_votes: r.wrongVotes }).eq("id", repId); } catch(e) {}
    }
    toast("Report flagged — it will be reviewed", "info");
  }
  renderFeed("liveFeed");
}

// ══════════════════════════════════════════════════════════════════
// FEATURE: AREA RELIABILITY SCORE
// ══════════════════════════════════════════════════════════════════
function getAreaReliability(area) {
  const thirtyDays = 30 * 24 * 3600 * 1000;
  const now = Date.now();
  const areaReps = reports.filter(r =>
    (r.area === area || (AREA_PARENT[r.area] === area)) &&
    (now - r.time) < thirtyDays
  );
  const outCount = areaReps.filter(r => r.type === 'out').length;
  const bckCount = areaReps.filter(r => r.type === 'bck').length;
  const total = outCount + bckCount;
  // Need at least 5 reports to be meaningful
  if (total < 5) return null;
  // Score = % of reports that are "power back" — simple and honest
  // High bck% = area gets power back often = reliable
  // High out% = area keeps losing power = unreliable
  const score = Math.round((bckCount / total) * 100);
  const grade = score >= 70 ? "A" : score >= 55 ? "B" : score >= 40 ? "C" : score >= 25 ? "D" : "F";
  const color = score >= 70 ? "var(--p)" : score >= 55 ? "#69F0AE" : score >= 40 ? "var(--am)" : "var(--rd)";
  return { score, grade, color, total };
}

// ══════════════════════════════════════════════════════════════════
// FEATURE: OUTAGE DURATION TIMER
// ══════════════════════════════════════════════════════════════════
let _durationTimerInterval = null;

function getOutageSince(area) {
  if (!area) return null;
  // Find latest report for this area (exact + children)
  const relevant = reports.filter(r =>
    r.area === area || (AREA_PARENT[r.area] === area)
  ).sort((a, b) => b.time - a.time);
  if (!relevant.length) return null;
  const latest = relevant[0];
  if (latest.type !== "out") return null;
  return latest.time;
}

function formatDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hrs === 0) return `${min}m`;
  return `${hrs}h ${min}m`;
}

function startDurationTimer() {
  if (_durationTimerInterval) clearInterval(_durationTimerInterval);
  _durationTimerInterval = setInterval(tickDurationTimers, 30000);
  tickDurationTimers();
}

function tickDurationTimers() {
  document.querySelectorAll("[data-outage-since]").forEach(el => {
    const since = parseInt(el.dataset.outageSince);
    if (!since) return;
    el.textContent = "Out for " + formatDuration(Date.now() - since);
  });
}

// ══════════════════════════════════════════════════════════════════
// FEATURE: SCHEDULED OUTAGE ANNOUNCEMENTS (loaded from Supabase)
// ══════════════════════════════════════════════════════════════════
let scheduledAnnouncements = [];

async function loadAnnouncements() {
  try {
    const { data, error } = await sb.from("announcements")
      .select("*").order("scheduled_for", { ascending: true })
      .gte("scheduled_for", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    if (!error && data) scheduledAnnouncements = data;
    renderAnnouncements();
  } catch(e) {}
}

function renderAnnouncements() {
  const el = document.getElementById("announcementsBanner");
  if (!el) return;
  if (!scheduledAnnouncements.length) { el.innerHTML = ""; el.style.display = "none"; return; }
  const now = Date.now();
  const active = scheduledAnnouncements.filter(a => {
    const sf = new Date(a.scheduled_for).getTime();
    const end = a.ends_at ? new Date(a.ends_at).getTime() : sf + 8 * 3600000;
    return sf <= now + 2 * 3600000 && end >= now; // show up to 2h before
  });
  if (!active.length) { el.innerHTML = ""; el.style.display = "none"; return; }
  el.style.display = "block";
  el.innerHTML = active.map(a => {
    const sf = new Date(a.scheduled_for);
    const timeStr = sf.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
    const dateStr = sf.toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" });
    const isNow = new Date(a.scheduled_for).getTime() <= now;
    return `<div class="ann-card ${isNow ? "ann-active" : ""}">
      <div class="ann-icon"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5L1 11.5H12L6.5 1.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6.5 5V8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="6.5" cy="9.5" r=".6" fill="currentColor"/></svg></div>
      <div class="ann-body">
        <div class="ann-title">${isNow ? "Ongoing" : "Scheduled"} Outage — ${a.area || "Multiple Areas"}</div>
        <div class="ann-sub">${a.message} · ${isNow ? "Started" : ""} ${dateStr} ${timeStr}</div>
      </div>
    </div>`;
  }).join("");
}

// ══════════════════════════════════════════════════════════════════
// FEATURE: WHATSAPP SHARE
// ══════════════════════════════════════════════════════════════════
// Alert toggle for specific area from report card
async function toggleAreaAlert(evt, area, repId) {
  evt.stopPropagation();
  if (!CU) { toast('Sign in to get alerts for this area', 'info'); go('account'); return; }
  // Check if already watching
  const existing = savedPlaces.find(p => p.location_area === area && p.type === 'alert');
  if (existing) {
    await togglePlaceNotif(existing.id);
    _refreshAreaAlertBtns(area);
    return;
  }
  // Save area as an alert-only saved place
  // Look up in LOCS first, fall back to the report's own data for custom areas
  const areaLoc = LOCS.find(l => l.name === area && !l.street) || LOCS.find(l => l.area === area && !l.street);
  const rep = reports.find(r => r.id == repId) || reports.find(r => r.area === area);
  const placeObj = {
    type: 'alert',
    custom_label: `Alerts: ${area}`,
    location_id: areaLoc?.id || null,
    location_name: areaLoc?.name || rep?.name || area,
    location_area: area,
    location_label: area,
    notif_on: true,
  };
  const saved = await savePlaceToDB(placeObj);
  if (saved) {
    savedPlaces.push(saved);
    toast(`<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1a3 3 0 0 1 3 3c0 1.7.7 2.6 1.3 3H2.2c.6-.4 1.3-1.3 1.3-3a3 3 0 0 1 3-3z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M4 7c0 .83.67 1.5 1.5 1.5S7 7.83 7 7" stroke="currentColor" stroke-width="1.2"/></svg> Alerts on for ${area}`, 'ok');
    _refreshAreaAlertBtns(area);
  }
}

// Refresh all alert bell buttons for a given area across the feed
function _refreshAreaAlertBtns(area) {
  const isOn = savedPlaces.some(p => p.location_area === area && p.notif_on !== false);
  document.querySelectorAll('.fc[data-rid]').forEach(card => {
    const btn = card.querySelector('.alert-area-btn');
    if (!btn) return;
    // Check if this card belongs to the toggled area by finding the report
    const rid = card.dataset.rid;
    const rep = reports.find(r => String(r.id) === String(rid));
    if (!rep || rep.area !== area) return;
    btn.classList.toggle('active', isOn);
    btn.title = isOn ? 'Turn off alerts for this area' : 'Get alerts for this area';
  });
}

// Tap anywhere on report card to show confirm popup or expand
function _onReportCardTap(evt, repId) {
  // Don't fire if a button inside was tapped
  if (evt.target.closest('button')) return;
  const r = reports.find(x => String(x.id) === String(repId));
  if (!r) return;
  showConfirmPopup(r);
}

function shareToWhatsApp(repId) {
  const r = reports.find(x => x.id === repId);
  if (!r) return;
  const isOut = r.type === "out";
  const timeStr = new Date(r.time).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  const msg = isOut
    ? `Power outage reported at ${r.name}, ${r.area} as of ${timeStr}.\n\nCheck & track live on NEPAWatch Lagos\n${APP_URL}`
    : `Power restored at ${r.name}, ${r.area} as of ${timeStr}.\n\nTrack live power updates on NEPAWatch Lagos\n${APP_URL}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
}

// ══════════════════════════════════════════════════════════════════
// FEATURE: PER-AREA POWER HISTORY MODAL
// ══════════════════════════════════════════════════════════════════
function showAreaHistory(area) {
  const modal = document.getElementById("areaHistoryModal");
  const title = document.getElementById("ahTitle");
  const body  = document.getElementById("ahBody");
  if (!modal) return;
  title.textContent = area;

  // Get last 7 days of reports for this area
  const now = Date.now();
  const dayMs = 86400000;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - i * dayMs;
    const dayEnd   = dayStart + dayMs;
    const d = new Date(dayStart);
    const label = i === 0 ? "Today" : d.toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" });
    const dayReps = reports.filter(r =>
      (r.area === area || AREA_PARENT[r.area] === area) &&
      r.time >= dayStart && r.time < dayEnd
    );
    const outN = dayReps.filter(r => r.type === "out").length;
    const bckN = dayReps.filter(r => r.type === "bck").length;
    // Estimate supply hours: assume 12h base, deduct 3h per net outage
    const estHrs = dayReps.length
      ? Math.max(0, Math.min(24, 12 - outN * 3 + bckN * 1.5))
      : null;
    days.push({ label, outN, bckN, estHrs, total: dayReps.length });
  }

  const rel = getAreaReliability(area);
  const relHtml = rel
    ? `<div class="ah-rel" style="color:${rel.color}">Grade ${rel.grade} — ${rel.score}% reliable (30 days)</div>`
    : `<div class="ah-rel" style="color:var(--ink3)">Not enough data for reliability score</div>`;

  body.innerHTML = relHtml + `<div class="ah-bars">` + days.map(d => {
    const pct = d.estHrs !== null ? (d.estHrs / 24) * 100 : 0;
    const color = d.estHrs === null ? "var(--ink3)" : d.estHrs > 16 ? "var(--p)" : d.estHrs > 8 ? "var(--am)" : "var(--rd)";
    return `<div class="ah-bar-col">
      <div class="ah-bar-wrap"><div class="ah-bar-fill" style="height:${pct}%;background:${color}"></div></div>
      <div class="ah-bar-hrs" style="color:${color}">${d.estHrs !== null ? d.estHrs.toFixed(0) + "h" : "—"}</div>
      <div class="ah-bar-label">${d.label.split(" ")[0]}</div>
      ${d.total ? `<div class="ah-bar-reps">${d.total} rep${d.total !== 1 ? "s" : ""}</div>` : ""}
    </div>`;
  }).join("") + `</div>
  <div class="ah-detail">` + days.map(d =>
    `<div class="ah-row"><span class="ah-day">${d.label}</span><span class="ah-out" style="color:var(--rd)">${d.outN} out</span><span class="ah-bck" style="color:var(--p)">${d.bckN} restored</span></div>`
  ).join("") + `</div>`;

  modal.classList.add("open");
}

function closeAreaHistory() {
  document.getElementById("areaHistoryModal")?.classList.remove("open");
}

function seedFallback(){reports=[{id:"s1",name:"Adeola Odeku Street",area:"Victoria Island",type:"out",time:Date.now()-7*60000,confirms:14},{id:"s2",name:"Allen Avenue",area:"Ikeja (Allen/Opebi)",type:"out",time:Date.now()-22*60000,confirms:9},{id:"s3",name:"Admiralty Way",area:"Lekki Phase 1",type:"bck",time:Date.now()-5*60000,confirms:18},{id:"s4",name:"Adeniran Ogunsanya St",area:"Surulere",type:"out",time:Date.now()-35*60000,confirms:6},{id:"s5",name:"Bourdillon Road",area:"Ikoyi",type:"bck",time:Date.now()-12*60000,confirms:11},{id:"s6",name:"Agege Motor Road",area:"Mushin",type:"out",time:Date.now()-55*60000,confirms:7},{id:"s7",name:"Agric Road Ikorodu",area:"Ikorodu",type:"out",time:Date.now()-80*60000,confirms:4},{id:"s8",name:"Badore Road",area:"Ajah",type:"bck",time:Date.now()-10*60000,confirms:8}];}

function buildEmailHtml({type='info', name='', area='', street='', time='', places='', appUrl='https://nepawatch.app'} = {}) {
  const isOut = type === 'out';
  const isWelcome = type === 'welcome';
  const accentColor = isOut ? '#FF3D57' : '#00E676';
  const statusBg = isOut ? '#FF3D57' : '#00E676';
  const statusText = isOut ? '#fff' : '#07090A';
  const statusLabel = isOut ? 'POWER OUT' : (isWelcome ? 'WELCOME' : 'POWER RESTORED');
  const iconPath = isOut
    ? '<path d="M13 2L5 14H12L10 22L20 10H13L15 2H13Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    : (isWelcome
      ? '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>'
      : '<path d="M13 2L5 14H12L10 22L20 10H13L15 2H13Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>');

  const headline = isWelcome
    ? `Welcome to NEPAWatch${name ? ', ' + name : ''}!`
    : isOut
    ? `Power outage near ${street || area}`
    : `Power restored near ${street || area}`;

  const bodyHtml = isWelcome
    ? `<p style="margin:0 0 14px;color:#8FAE97;font-size:15px;line-height:1.7">You're now set up to receive <strong style="color:#E6EDE8">real-time power alerts</strong> for Lagos. Whenever there's an outage or power comes back in your area, we'll ping you straight away.</p>
       <p style="margin:0 0 20px;color:#8FAE97;font-size:15px;line-height:1.7">Open the app, set your location, and join thousands of Lagosians keeping each other updated.</p>`
    : `<p style="margin:0 0 6px;color:#8FAE97;font-size:14px;text-transform:uppercase;letter-spacing:.1em;font-weight:600">Location</p>
       <p style="margin:0 0 18px;color:#E6EDE8;font-size:16px;font-weight:600">${street ? street + ', ' : ''}${area}, Lagos</p>
       <p style="margin:0 0 6px;color:#8FAE97;font-size:14px;text-transform:uppercase;letter-spacing:.1em;font-weight:600">Time Reported</p>
       <p style="margin:0 0 18px;color:#E6EDE8;font-size:16px;font-weight:600">${time || new Date().toLocaleTimeString('en-NG', {hour:'2-digit',minute:'2-digit'})}</p>
       ${places ? `<p style="margin:0 0 6px;color:#8FAE97;font-size:14px;text-transform:uppercase;letter-spacing:.1em;font-weight:600">Your Saved Place(s)</p><p style="margin:0 0 18px;color:#E6EDE8;font-size:15px">${places}</p>` : ''}
       <p style="margin:0 0 20px;color:#8FAE97;font-size:14px;line-height:1.7">This was reported by the NEPAWatch community. Check the app for the latest updates, or to confirm the report.</p>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>NEPAWatch Alert</title>
  <style>
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #07090A !important;
      -webkit-font-smoothing: antialiased;
    }
    /* Force dark on Gmail (targets [data-ogsc] Gmail app wrapper) */
    [data-ogsc] body, [data-ogsb] body { background-color: #07090A !important; }
    [data-ogsc] .outer-wrap, [data-ogsb] .outer-wrap { background-color: #07090A !important; }
    [data-ogsc] .card, [data-ogsb] .card { background-color: #0F1511 !important; }
    [data-ogsc] .card-header, [data-ogsb] .card-header { background-color: #080C09 !important; }
    [data-ogsc] .card-body-inner, [data-ogsb] .card-body-inner { background-color: #141C16 !important; }
    /* Force dark in BOTH light and dark mode email clients */
    @media screen {
      body { background-color: #07090A !important; }
      .outer-wrap { background-color: #07090A !important; }
      .card { background-color: #0F1511 !important; border-color: #1C271E !important; }
      .card-header { background-color: #080C09 !important; border-color: #1C271E !important; }
      .card-body-inner { background-color: #141C16 !important; border-color: #1C271E !important; }
      .footer-row { border-color: #1C271E !important; }
      h1 { color: #E6EDE8 !important; }
      .logo-text { color: #E6EDE8 !important; }
    }
    @media (prefers-color-scheme: light) {
      body { background-color: #07090A !important; }
      .outer-wrap { background-color: #07090A !important; }
      .card { background-color: #0F1511 !important; border-color: #1C271E !important; }
      .card-header { background-color: #080C09 !important; border-color: #1C271E !important; }
      .card-body-inner { background-color: #141C16 !important; border-color: #1C271E !important; }
      .footer-row { border-color: #1C271E !important; }
      h1 { color: #E6EDE8 !important; }
      .logo-text { color: #E6EDE8 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#07090A;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <!--[if mso]><table width="100%" bgcolor="#07090A"><tr><td><![endif]-->
  <div class="outer-wrap" style="background-color:#07090A;padding:32px 16px;width:100%">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;margin:0 auto">
      <tr><td>
        <table class="card" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0F1511;border:1px solid #1C271E;border-radius:16px;overflow:hidden">

          <!-- Header -->
          <tr><td class="card-header" style="background-color:#080C09;padding:20px 28px;border-bottom:1px solid #1C271E">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="vertical-align:middle">
                <span class="logo-text" style="font-family:'Arial Black',Arial,sans-serif;font-size:22px;font-weight:900;color:#E6EDE8;letter-spacing:.02em">NEPA<span style="color:#00E676">Watch</span></span>
                <span style="font-size:11px;font-weight:600;letter-spacing:.08em;color:rgba(230,237,232,.45);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:4px;padding:2px 7px;margin-left:8px;vertical-align:middle">LAGOS</span>
              </td>
              <td align="right" style="vertical-align:middle">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="background:rgba(0,230,118,.1);border:1px solid rgba(0,230,118,.22);border-radius:99px;padding:4px 10px">
                    <table cellpadding="0" cellspacing="0" border="0"><tr>
                      <td><div style="width:6px;height:6px;background:#00E676;border-radius:50%;display:block;margin-right:5px"></div></td>
                      <td style="font-size:11px;font-weight:700;color:#00E676;letter-spacing:.08em;white-space:nowrap">LIVE</td>
                    </tr></table>
                  </td>
                </tr></table>
              </td>
            </tr></table>
          </td></tr>

          <!-- Status badge + headline -->
          <tr><td style="padding:28px 28px 0">
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px"><tr>
              <td style="background:${statusBg};border-radius:8px;padding:8px 14px">
                <table cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="vertical-align:middle;padding-right:8px">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">${iconPath}</svg>
                  </td>
                  <td style="font-size:12px;font-weight:800;color:${statusText};letter-spacing:.12em;white-space:nowrap">${statusLabel}</td>
                </tr></table>
              </td>
            </tr></table>
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#E6EDE8;line-height:1.25;font-family:'Segoe UI',Helvetica,Arial,sans-serif">${headline}</h1>
          </td></tr>

          <!-- Body -->
          <tr><td style="padding:0 28px 24px">
            <table class="card-body-inner" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#141C16;border:1px solid #1C271E;border-radius:12px">
              <tr><td style="padding:20px">
                ${bodyHtml}
              </td></tr>
            </table>
          </td></tr>

          <!-- CTA -->
          <tr><td style="padding:0 28px 28px;text-align:center">
            <a href="${appUrl}" style="display:inline-block;background:#00E676;color:#07090A;font-size:15px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:10px;letter-spacing:.01em;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
              ${isWelcome ? 'Open NEPAWatch &rarr;' : 'See Live Updates &rarr;'}
            </a>
          </td></tr>

          <!-- Footer -->
          <tr><td class="footer-row" style="padding:18px 28px;border-top:1px solid #1C271E;text-align:center">
            <p style="margin:0 0 4px;font-size:12px;color:rgba(230,237,232,.3);font-family:Arial,sans-serif">You are receiving this because you signed up for alerts on NEPAWatch.</p>
            <p style="margin:0;font-size:12px;color:rgba(230,237,232,.2);font-family:Arial,sans-serif"><a href="${appUrl}" style="color:#00E676;text-decoration:none">nepawatch.app</a> &mdash; Real-time power tracking for Lagos</p>
          </td></tr>

        </table>
      </td></tr>
    </table>
  </div>
  <!--[if mso]></td></tr></table><![endif]-->
</body>
</html>`;
}

async function sendEmail(to, subject, body, htmlBody) {
  if (!to || !subject) return;
  const html = htmlBody || null;
  try {
    await fetch(EMAIL_FN, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'apikey': SUPA_ANON, 'Authorization': `Bearer ${SUPA_ANON}`},
      // Send html in every possible field name the edge function might read
      body: JSON.stringify({to, subject,
        body: html || body,   // if edge fn passes body straight to Resend as html
        text: body,           // plain text fallback
        html: html || body,   // explicit html field
        htmlBody: html || body,
        mode: 'direct'
      })
    });
  } catch(e) {}
}
async function sendAreaAlerts(repName,repArea,repType){if(!repArea)return;
  // Fire local push notification for foreground-invisible users
  const pushTitle=repType==='out'?`Power Outage — ${repArea}`:`Power Restored — ${repArea}`;
  const pushBody=repType==='out'?`Outage near ${repName}. Tap to confirm.`:`Power back near ${repName}. Tap to confirm.`;
  _localNotify(pushTitle, pushBody, repType);
const _aKey=repArea+'|'+repType;const _now=Date.now();if(_alertCooldowns[_aKey]&&(_now-_alertCooldowns[_aKey])<ALERT_COOLDOWN_MS)return;_alertCooldowns[_aKey]=_now;try{const subject=repType==="out"?`Power Outage — ${repArea}, Nigeria`:`Power Restored — ${repArea}, Nigeria`;const time=new Date().toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit"});const body=`${repType==="out"?"Power outage":"Power restored"} near ${repName}, ${repArea}.\n\nTime: ${time}\n\nSee live updates: ${APP_URL}\n\n— NEPAWatch`;const alertHtml=buildEmailHtml({type:repType,area:repArea,street:repName,time,appUrl:APP_URL});let edgeSent=false;try{const res=await fetch(EMAIL_FN,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPA_ANON,"Authorization":`Bearer ${SUPA_ANON}`},body:JSON.stringify({mode:"area_alert",area:repArea,repName,repType,subject,body,html:alertHtml,time,confirmRequest:true})});if(res.ok){const json=await res.json().catch(()=>({}));const count=json.sent||0;edgeSent=true;if(count>0){emailLog.unshift({subject,to:`${count} watcher${count!==1?"s":""} in ${repArea}`,time});if(emailLog.length>8)emailLog.pop();}}}catch(fe){}if(CU&&savedPlaces.length){const matchingPlaces=savedPlaces.filter(p=>(areaMatches(repArea,p.location_area)||areaMatches(p.location_area,repArea))&&p.notif_on!==false);if(matchingPlaces.length&&CU.email&&!edgeSent){const placeNames=matchingPlaces.map(p=>getPlaceDisplayName(p)).join(", ");const placeHtml=buildEmailHtml({type:repType,area:repArea,street:repName,time,places:placeNames,appUrl:APP_URL});await sendEmail(CU.email,subject,body,placeHtml);emailLog.unshift({subject,to:CU.email+"  (saved place)",time});if(emailLog.length>8)emailLog.pop();toast("Alert sent for your saved place","ok");if(document.getElementById("page-account").classList.contains("active"))renderAccount();}}else if(!edgeSent&&CU&&PR&&(areaMatches(repArea,PR.location_area)||areaMatches(PR.location_area,repArea))&&PR.notif_on&&CU.email){const userHtml=buildEmailHtml({type:repType,area:repArea,street:repName,time,appUrl:APP_URL});await sendEmail(CU.email,subject,body,userHtml);emailLog.unshift({subject,to:CU.email,time});if(emailLog.length>8)emailLog.pop();toast("Alert sent to your email","ok");if(document.getElementById("page-account").classList.contains("active"))renderAccount();}}catch(e){}}

function openModal(type){mType=type;mSel=null;document.getElementById("shTitle").textContent=type==="out"?"Report Power Outage":"Report Power Restored";document.getElementById("shDesc").textContent=type==="out"?"Search your street or area in Lagos.":"Great news! Tell your community.";const btn=document.getElementById("mBtn");btn.textContent=type==="out"?"Confirm Outage":"Confirm Restored";btn.className="mconfirm "+(type==="out"?"out":"bck");btn.disabled=true;document.getElementById("mSearch").value="";if(PR?.location_id){mSel=LOCS.find(l=>l.id===PR.location_id)||null;if(mSel){btn.disabled=false;btn.textContent=type==="out"?`Report — ${mSel.name}`:`Restored — ${mSel.name}`;}}renderMList(LOCS.slice(0,60));document.getElementById("repOverlay").classList.add("open");}
function closeModal(){document.getElementById("repOverlay").classList.remove("open");mType=null;mSel=null;}
function filterList(){const q=document.getElementById("mSearch").value.trim().toLowerCase();if(!q){renderMList(LOCS.slice(0,60));return;}renderMList(LOCS.filter(l=>l.label.toLowerCase().includes(q)).slice(0,50));}
function renderMList(locs){const el=document.getElementById("mList");if(!locs.length){el.innerHTML=`<div class="mopt" style="color:var(--ink3);cursor:default;justify-content:center;padding:18px">No results found</div>`;return;}el.innerHTML=locs.map(l=>`<div class="mopt ${mSel?.id===l.id?"sel":""}" onclick="selectLoc('${l.id}')"><span>${l.name}</span><span class="mopt-sub">${l.street?l.area:"Area"}</span></div>`).join("");}
function _normName(n){
  if(!n)return n;
  if(/unilag\s+main\s+gate/i.test(n)||/university of lagos main gate/i.test(n))return"UNILAG";
  return n;
}
function selectLoc(id){mSel=LOCS.find(l=>l.id===id);
  if(mSel)mSel={...mSel,name:_normName(mSel.name),label:_normName(mSel.name)+(mSel.area?" — "+mSel.area:"")};const q=document.getElementById("mSearch").value.trim().toLowerCase();renderMList(q?LOCS.filter(l=>l.label.toLowerCase().includes(q)).slice(0,50):LOCS.slice(0,60));const btn=document.getElementById("mBtn");if(mSel){btn.disabled=false;btn.textContent=mType==="out"?`Report — ${mSel.name}`:`Restored — ${mSel.name}`;}}
async function submitReport(){if(!mSel){toast("Please select a location","info");return;}const loc=mSel,type=mType;closeModal();await pushReport(loc,type);}

function buildFilter(){const sel=document.getElementById("areaFilter");if(!sel)return;setTimeout(()=>{const locsEl=document.getElementById("s-locs");if(locsEl)animateNum("s-locs",LOCS.length);},100);
const areas=new Set();LOCS.forEach(l=>areas.add(l.area));
// Separate parents and children
const parents=new Set(Object.values(AREA_PARENT||{}));
const children=new Set(Object.keys(AREA_PARENT||{}));
// Parent areas = have children OR are in AREA_COORDS and not a child of anything
const topLevel=[...areas].filter(a=>!AREA_PARENT?.[a]).sort();
const childAreas=[...areas].filter(a=>AREA_PARENT?.[a]).sort();
sel.innerHTML=`<option value="">All Nigeria areas</option>`;
topLevel.forEach(a=>{const o=document.createElement("option");o.value=a;o.textContent=a;sel.appendChild(o);});
if(childAreas.length){const grp=document.createElement("optgroup");grp.label="Specific areas";childAreas.forEach(a=>{const o=document.createElement("option");o.value=a;o.textContent=`${a} (${AREA_PARENT[a]})`;grp.appendChild(o);});sel.appendChild(grp);}
}
function applyFilter(){filterArea=document.getElementById("areaFilter").value;feedPage=1;renderFeed("liveFeed");}
function toggleSuggestLoc(){const form=document.getElementById("suggestLocForm");const txt=document.getElementById("suggestLocToggleTxt");if(!form)return;const show=form.style.display==="none";form.style.display=show?"block":"none";txt.textContent=show?"Hide":"+ Cannot find your street? Add it for everyone";if(show){setTimeout(()=>{const si=document.getElementById("suggestStreet");if(si)si.focus();},80);}}
async function handleSuggestLoc(){if(!CU){toast("Sign in to add a location","info");closeModal();go("account");return;}const street=(document.getElementById("suggestStreet")?.value||"").trim();const area=(document.getElementById("suggestArea")?.value||"").trim();if(!street){toast("Enter a street name","info");return;}if(!area){toast("Enter the area name","info");return;}const btn=document.querySelector("#suggestLocForm .mconfirm");if(btn){btn.innerHTML='Checking location... <span class="spin"></span>';btn.disabled=true;}// submitCustomLocation now geocodes + deduplicates automatically
const newLoc=await submitCustomLocation(street,area);if(btn){btn.innerHTML="Save and Use This Location";btn.disabled=false;}if(newLoc){mSel=newLoc;const mBtn=document.getElementById("mBtn");if(mBtn){mBtn.disabled=false;mBtn.textContent=mType==="out"?`Report — ${newLoc.name}`:`Restored — ${newLoc.name}`;}buildFilter();const q=document.getElementById("mSearch")?.value.trim().toLowerCase()||"";renderMList(q?LOCS.filter(l=>l.label.toLowerCase().includes(q)).slice(0,50):LOCS.slice(0,60));const form=document.getElementById("suggestLocForm");if(form)form.style.display="none";const txt=document.getElementById("suggestLocToggleTxt");if(txt)txt.textContent="+ Cannot find your street? Add it for everyone";}}

function updateBanner(){const b=document.getElementById("mainBanner"),t=document.getElementById("bannerTxt");if(!CU){t.textContent="Sign in to receive email alerts when power changes in your area.";b.classList.add("show");}else if(PR&&!PR.location_id){t.textContent=`Hi ${PR.name} — tap Locate Me or report your street to set your location.`;b.classList.add("show");}else{b.classList.remove("show");}}

function ago(ts){
  const d=Math.floor((Date.now()-ts)/1000);
  if(d<60)return`${d}s`;
  if(d<3600)return`${Math.floor(d/60)}m`;
  if(d<86400)return`${Math.floor(d/3600)}h`;
  // Older than today — show actual date + time
  const dt=new Date(ts);
  const today=new Date();today.setHours(0,0,0,0);
  const yesterday=new Date(today);yesterday.setDate(today.getDate()-1);
  if(dt>=yesterday){
    return`Yesterday ${dt.toLocaleTimeString('en-NG',{hour:'2-digit',minute:'2-digit'})}`;
  }
  return dt.toLocaleDateString('en-NG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}
function areaStatus(a){const r=reports.filter(x=>x.area===a);if(!r.length)return"unknown";return r[0].type==="out"?"out":"on";}

function todayReports(){const midnight=new Date();midnight.setHours(0,0,0,0);return reports.filter(r=>r.time>=midnight.getTime());}
function renderStats(){
  const isAll=feedFilter==="all";
  const pool=isAll?reports:todayReports();
  const out=new Set(),bck=new Set();
  pool.forEach(r=>r.type==="out"?out.add(r.area):bck.add(r.area));
  animateNum("s-out",out.size);
  animateNum("s-bck",bck.size);
  animateNum("s-rep",pool.length);
  const lOut=document.getElementById("sl-out"),lBck=document.getElementById("sl-bck"),lRep=document.getElementById("sl-rep");
  if(lOut)lOut.textContent=isAll?"Out Areas":"Today Out";
  if(lBck)lBck.textContent=isAll?"Restored Areas":"Today Restored";
  if(lRep)lRep.textContent=isAll?"All Reports":"Today Reports";
  const locsEl=document.getElementById("s-locs");
  if(locsEl)animateNum("s-locs",LOCS.length);
}
function animateNum(id,target){const el=document.getElementById(id);if(!el)return;const current=parseInt(el.textContent)||0;if(current===target){el.textContent=target;return;}let start=null;const dur=400;const step=ts=>{if(!start)start=ts;const p=Math.min((ts-start)/dur,1);el.textContent=Math.round(current+(target-current)*p);if(p<1)requestAnimationFrame(step);};requestAnimationFrame(step);}

/* ━━━ PATCH 1: renderFeed — AI badge on AI-generated reports + hide own confirm button ━━━ */
function setFeedFilter(f){
  feedFilter=f;
  feedPage=1;
  document.getElementById("ftToday").classList.toggle("active",f==="today");
  document.getElementById("ftAll").classList.toggle("active",f==="all");
  renderStats();
  renderFeed("liveFeed");
}
function _buildReportCard(r, i=0){
  const isAI=r.isAI||r.userId===AI_USER_ID;
  const aiBadge=isAI?`<div class="fc-ai-badge">${IC.ai}&nbsp;NEPAWatch AI</div>`:'';
  const isOwn = CU && r.userId === CU.id;
  const isFlagged = r.flagged || (r.wrongVotes || 0) >= 3;
  const confirmBtn = isOwn ? '' : `<button class="same-btn" onclick="addConfirm('${r.id}')">${IC.chk} Same</button>`;
  const wrongBtn = isOwn ? '' : `<button class="wrong-btn" onclick="markReportWrong('${r.id}')" title="Flag as inaccurate">${(r.wrongVotes||0)>0?`<span class="wrong-count">${r.wrongVotes}</span>`:''}<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>`;
  const waBtn = `<button class="wa-btn" onclick="shareToWhatsApp('${r.id}')" title="Share on WhatsApp"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1A4.5 4.5 0 0 0 1.5 7.2L1 10l2.8-.5A4.5 4.5 0 1 0 5.5 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg></button>`;
  const rel = getAreaReliability(r.area);
  const relBadge = rel ? `<span class="rel-badge" style="color:${rel.color}" title="${rel.score}% of reports are power-restored (${rel.total} reports, 30d)">${rel.grade}</span>` : '';
  const since = r.type === 'out' ? r.time : null;
  const timerHtml = since ? `<div class="fc-timer" data-outage-since="${since}">Out for ${formatDuration(Date.now()-since)}</div>` : '';
  const flaggedCls = isFlagged ? ' fc-flagged' : '';
  const _areaWatched = savedPlaces.some(p => p.location_area === r.area && p.notif_on !== false);
  const alertBtn = `<button class="alert-area-btn${_areaWatched?' active':''}" onclick="toggleAreaAlert(event,'${r.area.replace(/'/g,"\'")}','${r.id}')" title="${_areaWatched?'Turn off alerts for this area':'Get alerts for this area'}"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1a3.5 3.5 0 0 1 3.5 3.5c0 2 .8 3 1.5 3.5H1c.7-.5 1.5-1.5 1.5-3.5A3.5 3.5 0 0 1 6 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M4.5 8c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5" stroke="currentColor" stroke-width="1.2"/></svg></button>`;
  return`<div class="fc ${r.type}${flaggedCls}" data-rid="${r.id}" style="animation-delay:${i*30}ms" onclick="_onReportCardTap(event,'${r.id}')">
    <div class="fc-bar"></div>
    <div class="fc-dot">${r.type==="out"?IC.out:IC.bck}</div>
    <div class="fc-body">
      <div class="fc-loc">${r.name}${relBadge}</div>
      <div class="fc-area" onclick="event.stopPropagation();showAreaHistory('${r.area.replace(/'/g,"\'")}');" style="cursor:pointer;text-decoration:underline dotted">${r.area}</div>
      ${timerHtml}
      <div class="fc-meta" data-confirms="${r.id}">${r.confirms} confirmation${r.confirms!==1?"s":""} &middot; <span style="opacity:.6">tap to confirm</span></div>
      ${isFlagged?'<div class="fc-flagged-note">Flagged as potentially inaccurate</div>':''}
      ${aiBadge}
    </div>
    <div class="fc-r">
      <div class="fc-time">${ago(r.time)} ago</div>
      <div class="fc-actions">
        ${confirmBtn}
        <button class="wa-btn" onclick="event.stopPropagation();shareToWhatsApp('${r.id}')" title="Share on WhatsApp">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.112.554 4.094 1.523 5.812L.057 23.57a.75.75 0 0 0 .93.903l5.87-1.611A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.944 9.944 0 0 1-5.031-1.357l-.36-.214-3.733 1.024 1.01-3.647-.234-.374A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
        </button>
        ${wrongBtn}
        ${alertBtn}
      </div>
    </div>
  </div>`;
}

function prependReportCard(r, feedId="liveFeed"){
  const el=document.getElementById(feedId);if(!el)return;
  const fa=feedId==="liveFeed"?filterArea:null;
  // Only prepend if it passes the current filter
  if(fa&&!areaMatches(r.area,fa))return;
  if(feedFilter==="today"){
    const midnight=new Date();midnight.setHours(0,0,0,0);
    if(r.time<midnight.getTime())return;
  }
  // Remove empty state if present
  const empty=el.querySelector(".empty");if(empty)empty.remove();
  // Don't duplicate
  if(el.querySelector(`[data-rid="${r.id}"]`))return;
  const card=document.createElement("div");
  card.innerHTML=_buildReportCard(r,0);
  const node=card.firstElementChild;
  el.insertBefore(node,el.firstChild);
  // Cap visible cards at 40
  const cards=el.querySelectorAll(".fc");
  if(cards.length>40)cards[cards.length-1].remove();
}

function setStatusFilter(f){
  statusFilter=f;
  feedPage=1;
  document.getElementById("sfAll")?.classList.toggle("active-bck",f==="all");
  document.getElementById("sfAll")?.classList.remove("active-out");
  document.getElementById("sfOut")?.classList.toggle("active-out",f==="out");
  document.getElementById("sfBck")?.classList.toggle("active-bck",f==="bck");
  // reset all to neutral first
  ["sfAll","sfOut","sfBck"].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.classList.remove("active-out","active-bck");
  });
  if(f==="out") document.getElementById("sfOut")?.classList.add("active-out");
  else if(f==="bck") document.getElementById("sfBck")?.classList.add("active-bck");
  else document.getElementById("sfAll")?.classList.add("active-bck");
  renderFeed("liveFeed");
}

function loadMoreFeed(){
  feedPage++;
  renderFeed("liveFeed");
  window.scrollBy({top:300,behavior:"smooth"});
}

function renderFeed(id="liveFeed", aF=null){
  const el=document.getElementById(id);if(!el)return;
  const fa=aF!==null?aF:(id==="liveFeed"?filterArea:null);
  let data=fa?reports.filter(r=>areaMatches(r.area,fa)):reports;
  if(id==="liveFeed"&&feedFilter==="today"){
    const midnight=new Date();midnight.setHours(0,0,0,0);
    data=data.filter(r=>r.time>=midnight.getTime());
  }
  // Status filter (light on / off)
  if(id==="liveFeed"&&statusFilter!=="all"){
    data=data.filter(r=>r.type===statusFilter);
  }
  if(!data.length){
    el.innerHTML=`<div class="empty"><div class="empty-ico">${IC.bck}</div><p>${
      statusFilter!=="all"?`No "${statusFilter==="out"?"light out":"light restored"}" reports${feedFilter==="today"?" today":""} yet.`:
      id==="liveFeed"&&feedFilter==="today"?"No reports today yet — be the first!":
      fa?`No reports for ${fa} yet.`:"No reports yet — be the first to report!"
    }</p></div>`;
    const lmb=document.getElementById("loadMoreBtn");if(lmb)lmb.style.display="none";
    const fc=document.getElementById("feedCount");if(fc)fc.textContent="";
    return;
  }
  // Pagination — only for liveFeed
  if(id==="liveFeed"){
    const total=data.length;
    const pageSize=FEED_PAGE_SIZE;
    const shown=Math.min(feedPage*pageSize,total);
    const pageData=data.slice(0,shown);
    el.innerHTML=pageData.map((r,i)=>_buildReportCard(r,i)).join("");
    const lmb=document.getElementById("loadMoreBtn");
    const fc=document.getElementById("feedCount");
    if(lmb)lmb.style.display=shown<total?"block":"none";
    if(fc)fc.textContent=shown<total?`Showing ${shown} of ${total} reports`:`${total} report${total!==1?"s":""}`;
  } else {
    el.innerHTML=data.slice(0,40).map((r,i)=>_buildReportCard(r,i)).join("");
  }
}

function renderDiscos(){const el=document.getElementById("discoZones");if(!el)return;el.innerHTML=DISCO.map(d=>{const outN=d.lgas.filter(a=>areaStatus(a)==="out").length;const rel=Math.max(10,Math.round(100-(outN/Math.max(d.lgas.length,1))*100));const c=rel>70?"var(--p)":rel>40?"var(--am)":"var(--rd)";const dot=outN>d.lgas.length*.5?"var(--rd)":outN>0?"var(--am)":"var(--p)";return`<div class="zc"><div class="zdot" style="background:${dot}"></div><div class="zb"><div class="zn">${d.name}<span>${d.lgas.slice(0,3).join(" · ")}...</span></div><div class="zt"><div class="zf" style="width:${rel}%;background:${c}"></div></div></div><div class="zp" style="color:${c}">${rel}%</div></div>`;}).join("");}

function renderMyArea(){
  const loc=PR?.location_id?LOCS.find(l=>l.id===PR.location_id):null;
  const days7=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const now=Date.now();const dayMs=86400000;
  let hrs=days7.map((_,i)=>{if(!loc)return null;const dayStart=now-(6-i)*dayMs;const dayEnd=dayStart+dayMs;const dayReps=reports.filter(r=>areaMatches(r.area,loc.area)&&r.time>=dayStart&&r.time<dayEnd);if(!dayReps.length)return null;const outage=dayReps.filter(r=>r.type==="out").length;const restored=dayReps.filter(r=>r.type==="bck").length;return Math.min(23,Math.max(1,12-(outage*3)+(restored*1.5)));});
  const hasData=hrs.some(h=>h!==null);
  if(!hasData){document.getElementById("myScore").innerHTML=`—<span class="score-u">h/day</span>`;document.getElementById("myDesc").textContent=loc?`No reports yet for ${loc.area}. Be the first!`:"Set your location on Home or tap Locate Me.";document.getElementById("weekGrid").innerHTML=days7.map(d=>`<div class="dr"><div class="dl">${d}</div><div class="dtr"><div class="df" style="width:0%;background:var(--ink3)"></div></div><div class="dh" style="color:var(--ink3)">—</div></div>`).join("");renderFeed("myFeed",loc?.area||null);renderMyPlacesList();
  /* Show widget even without data */ if(typeof renderMyAreaPredictWidget==='function')renderMyAreaPredictWidget();
  return;}
  const known=hrs.filter(h=>h!==null);const knownAvg=known.reduce((a,b)=>a+b,0)/known.length;hrs=hrs.map(h=>h===null?parseFloat(knownAvg.toFixed(1)):h);const avg=(hrs.reduce((a,b)=>a+b,0)/7).toFixed(1);document.getElementById("myScore").innerHTML=`${avg}<span class="score-u">h/day</span>`;const pa=parseFloat(avg);document.getElementById("myDesc").textContent=loc?(pa>16?`Excellent supply in ${loc.area} this week`:pa>12?`Good supply in ${loc.area} this week`:pa>8?`Moderate supply in ${loc.area} this week`:pa>4?`Unstable supply near ${loc.name}`:`Very poor supply in ${loc.area}`):"Set your location on Home or tap Locate Me.";document.getElementById("weekGrid").innerHTML=days7.map((d,i)=>{const h=hrs[i],p=(h/24)*100,c=h>16?"var(--p)":h>10?"var(--am)":"var(--rd)";return`<div class="dr"><div class="dl">${d}</div><div class="dtr"><div class="df" style="width:0%;background:${c}" data-w="${p}"></div></div><div class="dh">${h}h</div></div>`;}).join("");setTimeout(()=>{document.querySelectorAll("#weekGrid .df").forEach(bar=>{bar.style.width=bar.dataset.w+"%";});},50);renderFeed("myFeed",loc?.area||null);renderMyPlacesList();
  if(typeof renderMyAreaPredictWidget==='function')renderMyAreaPredictWidget();
}

/* ━━━ PATCH 2: renderCommunity — includes NEPAWatch AI on leaderboard ━━━ */
async function renderCommunity(){
  document.getElementById("lbList").innerHTML=`<div class="loading-row"><div class="spin w"></div>Loading leaderboard...</div>`;
  try{
    const{data:repData,error:repErr}=await sb.from("reports").select("user_id,location_name,location_area,type,created_at").not("user_id","is",null).order("created_at",{ascending:false}).limit(300);
    if(repErr)throw repErr;
    if(repData&&repData.length>0){
      const counts={};
      repData.forEach(r=>{if(!r.user_id)return;if(!counts[r.user_id])counts[r.user_id]={uid:r.user_id,count:0};counts[r.user_id].count++;});
      const uids=Object.keys(counts).filter(u=>u!==AI_USER_ID).slice(0,20);
      const{data:profData}=await sb.from("profiles").select("id,name,email").in("id",uids);
      const profMap={};(profData||[]).forEach(p=>profMap[p.id]=p.name||p.email?.split("@")[0]||"Reporter");
      /* Add AI entry */
      const aiCount=counts[AI_USER_ID]?.count||0;
      let reporters=Object.entries(counts)
        .filter(([uid])=>uid!==AI_USER_ID)
        .map(([uid,c])=>({name:profMap[uid]||"Reporter",count:c.count,isAI:false}))
        .sort((a,b)=>b.count-a.count).slice(0,5);
      /* Insert AI into sorted position */
      if(aiCount>0){
        const aiEntry={name:AI_USER_NAME,count:aiCount,isAI:true};
        const insertAt=reporters.findIndex(r=>r.count<=aiCount);
        if(insertAt===-1)reporters.push(aiEntry);else reporters.splice(insertAt,0,aiEntry);
        reporters=reporters.slice(0,6);
      }
      if(reporters.length>0){
        const rankClass=["gold","silver","bronze","","",""];
        document.getElementById("lbList").innerHTML=reporters.map((r,i)=>{
          const isAI=r.isAI;
          const nameHtml=isAI?`<span style="color:var(--p)">${IC.ai}&nbsp;${r.name}</span>`:r.name;
          const subHtml=isAI?`<span style="color:var(--p);font-size:.6rem">AI auto-reporter</span>`:`${IC.user}&nbsp;Community reporter`;
          return`<div class="lbi"><div class="lbr ${rankClass[i]||""}">${i+1}</div><div style="flex:1"><div class="lbi-n">${nameHtml}</div><div class="lbi-a">${subHtml}</div></div><div class="lbi-c">${r.count}<small>report${r.count!==1?"s":""}</small></div></div>`;
        }).join("");
      }else{renderFallbackLeaderboard();}
    }else{renderFallbackLeaderboard();}
  }catch(e){renderFallbackLeaderboard();}

  const areas=Object.keys(LAGOS).map(a=>{const aReps=reports.filter(r=>areaMatches(r.area,a));const outN=aReps.filter(r=>r.type==="out").length;const bckN=aReps.filter(r=>r.type==="bck").length;const total=aReps.length;if(total===0)return{name:a,score:null,reports:0};const score=Math.max(5,Math.min(98,80-(outN*15)+(bckN*10)));return{name:a,score,reports:total};}).sort((a,b)=>{if(a.score===null&&b.score===null)return 0;if(a.score===null)return 1;if(b.score===null)return-1;return b.score-a.score;});
  document.getElementById("areaRank").innerHTML=areas.slice(0,16).map((a,i)=>{const hasData=a.score!==null;const c=!hasData?"var(--ink3)":a.score>70?"var(--p)":a.score>45?"var(--am)":"var(--rd)";return`<div class="zc" style="animation:pgIn .2s ease ${i*20}ms both"><div style="font-size:.68rem;color:var(--ink3);font-weight:700;width:22px;flex-shrink:0;text-align:center">${i+1}</div><div class="zb"><div class="zn">${a.name}<span>${a.reports?a.reports+" report"+(a.reports!==1?"s":""):"No reports yet"}</span></div><div class="zt"><div class="zf" style="width:${hasData?a.score:0}%;background:${c}"></div></div></div><div class="zp" style="color:${c}">${hasData?`${a.score}%`:"—"}</div></div>`;}).join("");
  document.getElementById("commNote").style.display="block";
}

function renderFallbackLeaderboard(){document.getElementById("lbList").innerHTML=`<div class="empty" style="padding:24px 18px"><div class="empty-ico">${IC.user}</div><p>Be the first to report! Top reporters will appear here.</p></div>`;}

function renderAccount(){const el=document.getElementById("authWrap");if(CU&&PR){renderProfile(el);_maybeShowA2HSOnAccount();}else if(CU&&!PR)el.innerHTML=`<div class="loading-row"><div class="spin w"></div>Loading profile...</div>`;else renderAuthForm(el,"login");}

const LOGO_IMG_TAG=`<img src="logo.jpg" alt="NEPAWatch" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;

function renderAuthForm(el,mode){el.innerHTML=`<div class="auth-wrap"><div class="auth-logo"><div class="auth-logo-icon">${LOGO_IMG_TAG}</div><span class="auth-logo-name">NEPA<em>Watch</em></span></div><h2>${mode==="login"?"Welcome back":mode==="forgot"?"Reset password":"Join NEPAWatch"}</h2><p class="auth-sub">${mode==="login"?"Sign in to report outages and get email alerts.":mode==="forgot"?"Enter your email to receive a password reset link.":"Get free real-time power alerts for your street anywhere in Nigeria."}</p><div class="msg err" id="authErr"></div><div class="msg ok" id="authOk"></div>${mode==="register"?`<div class="fld"><label>Your Name</label><input id="inp-name" type="text" placeholder="e.g. Chidi" autocomplete="name"></div>`:""}<div class="fld"><label>Email</label><input id="inp-email" type="email" placeholder="you@example.com" autocomplete="email"></div>${mode!=="forgot"?`<div class="fld"><label>Password</label><input id="inp-pass" type="password" placeholder="Min 6 characters" autocomplete="${mode==="login"?"current-password":"new-password"}"><button type="button" class="pw-eye-btn" onclick="appTogglePw(this)" tabindex="-1"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8C2.5 5 5 3.5 8 3.5C11 3.5 13.5 5 15 8C13.5 11 11 12.5 8 12.5C5 12.5 2.5 11 1 8Z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.3"/></svg></button></div>`:""}<button class="auth-btn" id="authBtn" onclick="handleAuth('${mode}')">${mode==="login"?"Sign In":mode==="forgot"?"Send Reset Link":"Create Account"}</button><div class="auth-switch">${mode==="login"?`No account? <a onclick="renderAuthForm(document.getElementById('authWrap'),'register')">Register free</a><br><span style="display:block;margin-top:8px"><a onclick="renderAuthForm(document.getElementById('authWrap'),'forgot')">Forgot password?</a></span>`:mode==="register"?`Have an account? <a onclick="renderAuthForm(document.getElementById('authWrap'),'login')">Sign in</a>`:`Remember it? <a onclick="renderAuthForm(document.getElementById('authWrap'),'login')">Back to sign in</a>`}</div></div>`;setTimeout(()=>{el.querySelectorAll("input").forEach(inp=>inp.addEventListener("keydown",e=>{if(e.key==="Enter")handleAuth(mode);}));},80);}

async function handleAuth(mode){const errEl=document.getElementById("authErr"),okEl=document.getElementById("authOk"),btn=document.getElementById("authBtn");const email=(document.getElementById("inp-email")?.value||"").trim();const pass=document.getElementById("inp-pass")?.value||"";const name=(document.getElementById("inp-name")?.value||"").trim();errEl.classList.remove("show");okEl.classList.remove("show");if(!email||!email.includes("@")||!email.includes(".")){errEl.textContent="Please enter a valid email address.";errEl.classList.add("show");return;}if(mode!=="forgot"&&pass.length<6){errEl.textContent="Password must be at least 6 characters.";errEl.classList.add("show");return;}if(mode==="register"&&!name){errEl.textContent="Please enter your name.";errEl.classList.add("show");return;}btn.innerHTML=`${mode==="login"?"Signing in":mode==="forgot"?"Sending link":"Creating account"}&nbsp;<span class="spin"></span>`;btn.disabled=true;try{if(mode==="register"){await doRegister(name,email,pass);okEl.textContent="Account created! Check your email to confirm, then sign in.";okEl.classList.add("show");btn.innerHTML="Create Account";btn.disabled=false;setTimeout(()=>renderAuthForm(document.getElementById("authWrap"),"login"),2800);}else if(mode==="forgot"){await sb.auth.resetPasswordForEmail(email,{redirectTo:APP_URL+"?mode=reset"});okEl.textContent="Reset link sent! Check your inbox (and spam folder).";okEl.classList.add("show");btn.innerHTML="Send Reset Link";btn.disabled=false;}else{await doLogin(email,pass);}}catch(e){let msg=e.message||"Something went wrong.";if(msg.toLowerCase().includes("invalid login")||msg.toLowerCase().includes("invalid credentials"))msg="Incorrect email or password. Please try again.";if(msg.toLowerCase().includes("email not confirmed"))msg="Please confirm your email first — check your inbox.";if(msg.toLowerCase().includes("already registered")||msg.toLowerCase().includes("user already registered"))msg="This email is already registered. Please sign in instead.";if(msg==="RATE_LIMIT"||msg.toLowerCase().includes("rate limit"))msg="Too many sign-up attempts. Please wait about 1 hour before trying again.";errEl.textContent=msg;errEl.classList.add("show");btn.innerHTML=mode==="login"?"Sign In":mode==="forgot"?"Send Reset Link":"Create Account";btn.disabled=false;}}

function renderProfile(el){const locText=PR.location_label||PR.location_name||"Not set";const notifOn=PR.notif_on!==false;const savedCount=savedPlaces.length;
  const pushSt=getPushStatus();
  const _pushMsgs={
    'enabled':          'On — tap to disable',
    'blocked':          'Blocked — enable in browser settings',
    'unsupported':      'Not available in this browser',
    'ios-needs-install':'Add to Home Screen first (Safari > Share > Add to Home Screen)',
    'off':              'Off — tap to enable',
  };
  const pushStatusText=_pushMsgs[pushSt]||'Off — tap to enable';
  const pushBtn=pushSt==='unsupported'?'':
    pushSt==='ios-needs-install'?`<a href="https://support.apple.com/guide/iphone/bookmark-favorite-webpages-iph42ab2f3a7/ios" target="_blank" style="font-size:.65rem;font-weight:600;color:var(--p);background:var(--pp);border:1px solid var(--pb);border-radius:6px;padding:4px 9px;cursor:pointer;text-decoration:none">How?</a>`:
    `<button class="toggle ${pushSt==='enabled'?'on':''}" onclick="togglePushNotif()"></button>`;
el.innerHTML=`<div class="ph"><h2>Account</h2><p>Manage your alerts and locations</p></div><div class="profile-card"><div class="pc-top"><div class="pc-av">${(PR.name||"?")[0].toUpperCase()}</div><div><div class="pc-name">${PR.name||"User"}</div><div class="pc-email">${PR.email||CU.email}</div></div></div><div class="pc-row"><div class="pc-rl-wrap"><div class="pc-ico"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1A3 3 0 0 0 4 4C4 7.5 7 12 7 12S10 7.5 10 4A3 3 0 0 0 7 1z" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="4" r="1.2" fill="currentColor"/></svg></div><div><div class="pc-rl">Watching area</div><div class="pc-rs">${locText}</div></div></div>${PR.location_id?`<button onclick="clearLoc()" style="font-size:.65rem;font-weight:600;color:var(--ink3);background:none;border:1px solid var(--bd);border-radius:6px;padding:4px 9px;cursor:pointer">Clear</button>`:""}</div><div class="pc-row"><div class="pc-rl-wrap"><div class="pc-ico"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 7L7 1.5L12.5 7V12.5H9V9H5V12.5H1.5V7Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></div><div><div class="pc-rl">Saved Places</div><div class="pc-rs">${savedCount} place${savedCount!==1?"s":""} saved</div></div></div><button onclick="go('myarea')" style="font-size:.65rem;font-weight:600;color:var(--p);background:var(--pp);border:1px solid var(--pb);border-radius:6px;padding:4px 9px;cursor:pointer">Manage</button></div><div class="pc-row"><div class="pc-rl-wrap"><div class="pc-ico"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M1 5L7 8.5L13 5" stroke="currentColor" stroke-width="1.3"/></svg></div><div><div class="pc-rl">Email Alerts</div><div class="pc-rs">${notifOn?"On — receiving alerts":"Off — tap to enable"}</div></div></div><button class="toggle ${notifOn?"on":""}" id="notifToggle" onclick="toggleNotif()"></button></div>
<div class="pc-row"><div class="pc-rl-wrap"><div class="pc-ico"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5L5 5H2.5l2 2-1 3.5L7 8.5 9.5 10.5l-1-3.5 2-2H8L7 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg></div><div><div class="pc-rl">Push Notifications</div><div class="pc-rs" id="pushStatusTxt">${pushStatusText}</div></div></div>${pushBtn}</div><div class="pc-row"><div class="pc-rl-wrap"><div class="pc-ico"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M1.5 13c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></div><div><div class="pc-rl">Alert address</div><div class="pc-rs">${CU.email}</div></div></div></div>${emailLog.length?`<div class="email-log"><div class="email-log-hd">Recent Alerts Sent</div>${emailLog.map(e=>`<div class="ei"><div class="ei-s">${e.subject}</div><div class="ei-m">${e.to} &middot; ${e.time}</div></div>`).join("")}</div>`:""}<button class="logout-btn" onclick="doLogout()">Sign Out</button></div>`;}

/* ━━━ PATCH 3: go() — handles predict page + widget refresh ━━━ */
function go(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".ni").forEach(n=>n.classList.remove("active"));
  const pg=document.getElementById(`page-${page}`);
  pg.classList.add("active");pg.classList.remove("page-enter");
  void pg.offsetWidth;pg.classList.add("page-enter");
  document.getElementById(`nav-${page}`).classList.add("active");
  if(page==="myarea"){renderMyArea();}
  if(page==="predict"){
  if(typeof renderPredictPage==='function'){
    renderPredictPage();
  } else {
    let _tries=0;
    const _wait=setInterval(()=>{
      if(typeof renderPredictPage==='function'){clearInterval(_wait);renderPredictPage();}
      else if(++_tries>30){clearInterval(_wait);const pp=document.getElementById('page-predict');if(pp)pp.innerHTML='<div style="padding:32px 20px;text-align:center;color:var(--ink3)">Predictions unavailable — please refresh the page.</div>';}
    },200);
  }
}
  if(page==="community")renderCommunity();
  if(page==="account")renderAccount();
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PUSH NOTIFICATIONS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let _pushSubscription = null;

function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function initPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) { _pushSubscription = existing; await _savePushSub(existing); }
  } catch(e) {}
}

async function requestPushPermission() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    toast('Push notifications not supported in this browser', 'info'); return false;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Notifications blocked — enable in browser settings', 'info'); return false; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    _pushSubscription = sub;
    await _savePushSub(sub);
    toast('Push notifications enabled', 'ok');
    renderAccount();
    return true;
  } catch(e) {
    toast('Could not enable push: ' + (e.message || 'unknown error'), 'err');
    return false;
  }
}

async function disablePush() {
  try {
    if (_pushSubscription) { await _pushSubscription.unsubscribe(); _pushSubscription = null; }
    if (CU) await sb.from('push_subscriptions').delete().eq('user_id', CU.id);
    toast('Push notifications disabled', 'info');
    renderAccount();
  } catch(e) { toast('Could not disable push', 'err'); }
}

async function _savePushSub(sub) {
  if (!CU || !sub) return;
  const subJson = sub.toJSON();
  try {
    const { error } = await sb.from('push_subscriptions').upsert({
      user_id:  CU.id,
      endpoint: subJson.endpoint,
      p256dh:   subJson.keys?.p256dh,
      auth:     subJson.keys?.auth,
      area:     PR?.location_area || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) {
      console.error('[Push] _savePushSub error:', error.message);
      if (error.message?.includes('push_subscriptions') || error.code === '42P01') {
        toast('Push setup failed: run the push_subscriptions SQL in Supabase first', 'err');
      }
    }
  } catch(e) { console.error('[Push] _savePushSub exception:', e); }
}

async function updatePushArea(area) {
  if (!CU || !_pushSubscription) return;
  try { await sb.from('push_subscriptions').update({ area }).eq('user_id', CU.id); } catch(e) {}
}

function _isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function _isInStandaloneMode() {
  return ('standalone' in navigator && navigator.standalone) ||
    window.matchMedia('(display-mode: standalone)').matches;
}
function getPushStatus() {
  // iOS Chrome / Firefox never support Push (Apple forces their own engine)
  // iOS Safari only supports Push if installed as PWA (standalone)
  if (_isIos()) {
    if (!('Notification' in window)) return 'ios-needs-install';
    if (!_isInStandaloneMode()) return 'ios-needs-install';
    if (Notification.permission === 'denied') return 'blocked';
    if (_pushSubscription) return 'enabled';
    return 'off';
  }
  if (!('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (_pushSubscription) return 'enabled';
  return 'off';
}

// Deliver a local push-style notification when app is in foreground
function _localNotify(title, body, type) {
  if (document.visibilityState === 'visible') return; // skip if app is open
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body, icon: '/logo2.jpg', tag: 'nw-local-' + type }); } catch(e) {}
}

// Listen for SW push-click messages (navigate to area feed)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'PUSH_CLICK') {
      go('home');
      const pushArea = event.data?.area;
      if (pushArea) {
        // Filter feed to the notified area immediately so user sees context
        filterArea = pushArea;
        const areaFilterEl = document.getElementById('areaFilter');
        if (areaFilterEl) areaFilterEl.value = pushArea;
        renderFeed('liveFeed');
        // Load fresh reports then show the info/feedback sheet
        loadReports().then(() => {
          const rep = reports.find(r =>
            (r.area === pushArea || areaMatches(r.area, pushArea)) &&
            (Date.now() - r.time) < 2 * 60 * 60 * 1000
          );
          if (!rep) return;
          if (rep.isAI) showAIFeedbackPopup(rep);
          else showPushInfoSheet(rep);
        }).catch(() => {
          // Fallback: still try with whatever is in memory
          const rep = reports.find(r =>
            (r.area === pushArea || areaMatches(r.area, pushArea)) &&
            (Date.now() - r.time) < 2 * 60 * 60 * 1000
          );
          if (rep) {
            if (rep.isAI) showAIFeedbackPopup(rep);
            else showPushInfoSheet(rep);
          }
        });
      }
    }
  });
}

function render(){renderStats();renderFeed("liveFeed");renderDiscos();tickDurationTimers();if(_mpMap&&document.getElementById("mapPickerOverlay")?.classList.contains("open"))_mpDrawPowerDots();}

// ── ALWAYS-ON BACKGROUND LOCATION ─────────────────────────────────────────
let _bgWatchId = null;
function startBackgroundLocation() {
  if (!navigator.geolocation) return;
  if (_bgWatchId !== null) return; // already watching
  _bgWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      // Update internal coords silently — no UI change unless user hasn't set area yet
      if (lat && lng) {
        _userLat = lat; _userLng = lng;
        userExactLat = lat; userExactLng = lng;
        const nearby = findNearestAreas(lat, lng, 5);
        if (nearby.length) {
          _nearbyAreas = nearby;
          // If signed in and no area set yet, auto-set silently
          if (CU && PR && !PR.location_id) {
            const nearest = nearby[0]?.area;
            if (nearest) {
              const loc = LOCS.find(l => l.area === nearest && !l.street);
              if (loc) saveLocation(loc);
            }
          }
        }
      }
    },
    () => { /* silent fail — user may have denied */ },
    { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 }
  );
}

// ── CONFIRM REPORT POPUP ───────────────────────────────────────────────────
let _confirmRepId = null;
const _confirmedReports = new Set(); // track what user already confirmed/dismissed

// Called when user taps a push notification — shows info + optional confirm
function showPushInfoSheet(rep) {
  if (!rep) return;
  const isOut = rep.type === 'out';
  const icon = isOut ? IC.out : IC.bck;
  const color = isOut ? 'var(--rd)' : 'var(--p)';
  const bg = isOut ? 'rgba(255,64,85,.08)' : 'rgba(170,255,0,.07)';
  const border = isOut ? 'rgba(255,64,85,.2)' : 'rgba(170,255,0,.2)';

  _confirmRepId = rep.id;
  document.getElementById('confirmTitle').textContent = isOut ? 'Power Outage' : 'Power Restored';
  document.getElementById('confirmSub').textContent = rep.area;
  document.getElementById('confirmBody').innerHTML =
    `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:${bg};border-radius:10px;border:1px solid ${border};margin-bottom:14px">
      <span style="flex-shrink:0">${icon}</span>
      <div>
        <div style="font-weight:600;font-size:.88rem;color:${color}">${rep.name}</div>
        <div style="font-size:.74rem;color:var(--ink3);margin-top:2px">${rep.area} &middot; ${ago(rep.time)} ago</div>
      </div>
    </div>
    <p style="font-size:.8rem;color:var(--ink2);margin:0 0 14px;line-height:1.6">
      ${isOut ? 'Power outage was reported in this area.' : 'Power has been restored in this area.'}
      ${CU ? '<span style="color:var(--ink3)">Can you confirm this?</span>' : ''}
    </p>
    ${CU ? `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <button onclick="submitPushConfirm('yes')" style="padding:10px 6px;border-radius:9px;border:1px solid ${border};background:${bg};color:${color};font-weight:700;font-size:.75rem;cursor:pointer">
        ${isOut ? 'Still out' : 'Yes, back'}
      </button>
      <button onclick="submitPushConfirm('no')" style="padding:10px 6px;border-radius:9px;border:1px solid var(--bd);background:var(--bg3);color:var(--ink);font-weight:700;font-size:.75rem;cursor:pointer">
        ${isOut ? 'No, back' : 'No, still out'}
      </button>
      <button onclick="dismissConfirm()" style="padding:10px 6px;border-radius:9px;border:1px solid var(--bd);background:var(--bg3);color:var(--ink3);font-size:.75rem;cursor:pointer">
        Not sure
      </button>
    </div>` : ''}`;

  // Hide the old single yes button, we have inline buttons now
  document.getElementById('confirmYesBtn').style.display = 'none';
  document.getElementById('confirmOverlay').classList.add('open');
  setTimeout(() => dismissConfirm(), 60000);
}

async function submitPushConfirm(answer) {
  if (!_confirmRepId) return;
  const rid = _confirmRepId;
  // Dismiss immediately
  _confirmedReports.add(rid);
  _confirmRepId = null;
  document.getElementById('confirmOverlay').classList.remove('open');
  if (answer === 'yes') await addConfirm(rid);
  else if (answer === 'no') markReportWrong(rid);
  // 'unsure' = just dismiss, no vote
}

function showConfirmPopup(rep) {
  // Don't show if: user is the reporter, already confirmed/dismissed, no login
  if (!CU) return;
  if (rep.userId === CU.id) return;
  if (_confirmedReports.has(rep.id)) return;
  // Show if user has this area saved OR is in the same area
  const userArea = PR?.location_area || (_nearbyAreas[0]?.area);
  const hasSaved = savedPlaces.some(p => p.location_area === rep.area);
  if (!userArea && !hasSaved) return;
  if (!hasSaved && userArea && !areaMatches(rep.area, userArea) && !areaMatches(userArea, rep.area)) return;

  _confirmRepId = rep.id;
  const isOut = rep.type === 'out';
  const icon = isOut ? IC.out : IC.bck;
  document.getElementById('confirmTitle').textContent = isOut ? 'Outage reported near you' : 'Power restored near you';
  document.getElementById('confirmSub').textContent = `Can you confirm this?`;
  document.getElementById('confirmBody').innerHTML =
    `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:${isOut?'rgba(255,64,85,.08)':'rgba(170,255,0,.07)'};border-radius:10px;border:1px solid ${isOut?'rgba(255,64,85,.2)':'rgba(170,255,0,.2)'}">
      <span style="flex-shrink:0">${icon}</span>
      <div>
        <div style="font-weight:600;font-size:.88rem;color:${isOut?'var(--rd)':'var(--p)'}">${rep.name}</div>
        <div style="font-size:.74rem;color:var(--ink3);margin-top:2px">${rep.area} &middot; just now</div>
      </div>
    </div>
    <p style="font-size:.78rem;color:var(--ink3);margin:12px 0 0;line-height:1.6">
      ${isOut ? 'Is power actually out near you right now?' : 'Has power actually been restored near you?'} Your confirmation helps the community trust this report.
    </p>`;
  const btn = document.getElementById('confirmYesBtn');
  btn.textContent = isOut ? 'Yes, power is out here' : 'Yes, power is back here';
  btn.className = `mconfirm ${isOut ? 'out' : 'bck'}`;
  btn.style.display = '';
  btn.onclick = submitConfirm;
  // Add/update No button dynamically
  let noBtn = document.getElementById('confirmNoBtn');
  if (!noBtn) {
    noBtn = document.createElement('button');
    noBtn.id = 'confirmNoBtn';
    noBtn.className = 'mcancel';
    btn.insertAdjacentElement('afterend', noBtn);
  }
  noBtn.textContent = isOut ? 'No, power is fine here' : 'No, still no power';
  noBtn.style.cssText = 'background:rgba(255,64,85,.07);color:var(--rd);border:1px solid rgba(255,64,85,.15)';
  noBtn.onclick = submitWrong;
  document.getElementById('confirmOverlay').classList.add('open');
  setTimeout(() => dismissConfirm(), 30000);
}

async function submitConfirm() {
  if (!_confirmRepId) return;
  const rid = _confirmRepId;
  _confirmedReports.add(rid);
  _confirmRepId = null;
  document.getElementById('confirmOverlay').classList.remove('open');
  await addConfirm(rid);
  toast('Confirmed!', 'ok');
}

async function submitWrong() {
  if (!_confirmRepId) return;
  const rid = _confirmRepId;
  _confirmedReports.add(rid);
  _confirmRepId = null;
  document.getElementById('confirmOverlay').classList.remove('open');
  markReportWrong(rid);
}
function dismissConfirm() {
  if (_confirmRepId) _confirmedReports.add(_confirmRepId);
  document.getElementById('confirmOverlay').classList.remove('open');
  _confirmRepId = null;
}

// ══════════════════════════════════════════════════════════════════
// FEATURE: AI REPORT FEEDBACK — trains the model on yes/no answers
// Shown to users in the same area when the AI files a report
// ══════════════════════════════════════════════════════════════════
function showAIFeedbackPopup(rep) {
  if (!rep) return;
  // Only show to logged-in users who are not the AI itself
  if (!CU) return;
  if (_confirmedReports.has(rep.id)) return;

  // Only show for users whose saved area or GPS area matches the report area
  const userArea = PR?.location_area || (_nearbyAreas[0]?.area);
  const hasSaved = savedPlaces.some(p => areaMatches(p.location_area, rep.area));
  if (!userArea && !hasSaved) return;
  if (!hasSaved && userArea && !areaMatches(rep.area, userArea) && !areaMatches(userArea, rep.area)) return;

  const isOut = rep.type === 'out';
  const icon = isOut ? IC.out : IC.bck;
  const color = isOut ? 'var(--rd)' : 'var(--p)';
  const bg = isOut ? 'rgba(255,64,85,.08)' : 'rgba(170,255,0,.07)';
  const border = isOut ? 'rgba(255,64,85,.2)' : 'rgba(170,255,0,.2)';
  const probPct = rep.aiProb ? ` (${Math.round(rep.aiProb * 100)}% confidence)` : '';

  _confirmRepId = rep.id;
  document.getElementById('confirmTitle').textContent = 'AI Report — Can you verify?';
  document.getElementById('confirmSub').textContent = rep.area;
  document.getElementById('confirmBody').innerHTML =
    `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:${bg};border-radius:10px;border:1px solid ${border};margin-bottom:12px">
      <span style="flex-shrink:0">${icon}</span>
      <div>
        <div style="font-weight:600;font-size:.88rem;color:${color}">${rep.name}</div>
        <div style="font-size:.74rem;color:var(--ink3);margin-top:2px">${rep.area} &middot; ${ago(rep.time)} ago</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:7px;padding:8px 12px;background:rgba(100,180,255,.07);border-radius:8px;margin-bottom:10px;font-size:.75rem;color:var(--ink2)">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="#4fc3f7" stroke-width="1.2"/><path d="M6.5 5.5v4M6.5 4h.01" stroke="#4fc3f7" stroke-width="1.3" stroke-linecap="round"/></svg>
      <span>NEPAWatch AI predicted ${isOut ? 'a power outage' : 'power restoration'}${probPct}. Your response trains the AI.</span>
    </div>
    <p style="font-size:.8rem;color:var(--ink2);margin:0;line-height:1.6">${isOut ? 'Is power actually out in your area right now?' : 'Has power actually been restored in your area?'}</p>`;

  const btn = document.getElementById('confirmYesBtn');
  btn.textContent = isOut ? 'Yes, power is out' : 'Yes, power is back';
  btn.className = `mconfirm ${isOut ? 'out' : 'bck'}`;
  btn.style.display = '';
  btn.onclick = () => _submitAIFeedback(rep.id, true);

  let noBtn = document.getElementById('confirmNoBtn');
  if (!noBtn) {
    noBtn = document.createElement('button');
    noBtn.id = 'confirmNoBtn';
    noBtn.className = 'mcancel';
    btn.insertAdjacentElement('afterend', noBtn);
  }
  noBtn.textContent = isOut ? 'No, power is fine' : 'No, still no power';
  noBtn.style.cssText = 'background:rgba(255,64,85,.07);color:var(--rd);border:1px solid rgba(255,64,85,.15)';
  noBtn.style.display = '';
  noBtn.onclick = () => _submitAIFeedback(rep.id, false);

  document.getElementById('confirmOverlay').classList.add('open');
  setTimeout(() => dismissConfirm(), 45000);
}

async function _submitAIFeedback(repId, isCorrect) {
  const r = reports.find(x => String(x.id) === String(repId));
  _confirmedReports.add(repId);
  _confirmRepId = null;
  document.getElementById('confirmOverlay').classList.remove('open');

  if (isCorrect) {
    // Positive: confirm the report + strengthen model signal
    if (r) {
      r.confirms = (r.confirms || 1) + 1;
      const confirmsEl = document.querySelector(`[data-confirms="${repId}"]`);
      if (confirmsEl) confirmsEl.textContent = `${r.confirms} confirmation${r.confirms !== 1 ? 's' : ''}`;
      const isReal = !String(repId).startsWith('local-') && !String(repId).startsWith('ai-');
      if (isReal) {
        try { await sb.from('reports').update({ confirms: r.confirms }).eq('id', repId); } catch(e) {}
      }
      // Strengthen model: add a weighted data point for this area/hour/day
      if (typeof PredictHistory !== 'undefined' && r.area) {
        PredictHistory.addReport({
          location_area: r.area,
          type: r.type,
          created_at: new Date(r.time).toISOString(),
          confirms: 3, // extra weight — user validated the AI prediction
        });
      }
    }
    toast('Thanks! AI prediction confirmed — helps improve accuracy.', 'ok');
  } else {
    // Negative: flag wrong + add counter-signal to model
    if (r) {
      r.wrongVotes = (r.wrongVotes || 0) + 1;
      if (r.wrongVotes >= 3) r.flagged = true;
      const isReal = !String(repId).startsWith('local-') && !String(repId).startsWith('ai-');
      if (isReal) {
        try { await sb.from('reports').update({ wrong_votes: r.wrongVotes }).eq('id', repId); } catch(e) {}
      }
      // Weaken model: counter-signal — AI said 'out' but it's actually 'bck', or vice versa
      if (typeof PredictHistory !== 'undefined' && r.area) {
        const counterType = r.type === 'out' ? 'bck' : 'out';
        PredictHistory.addReport({
          location_area: r.area,
          type: counterType,
          created_at: new Date(r.time).toISOString(),
          confirms: 2,
        });
      }
      renderFeed('liveFeed');
    }
    toast('Thanks! AI will learn from this.', 'info');
  }
}

// Expose globally so predict.js can call it after saving an AI report
window.showAIFeedbackPopup = showAIFeedbackPopup;

let _rtChannel=null,_recentAlerts=new Set(),_rtWatchdog=null;
// ── Silent background auto-refresh (no visible spinner) ─────────────────
// Feed updates automatically every 5s via pollReports() + realtime subscriptions.
// No pull-to-refresh needed — data arrives the moment it changes.

function startRealtime(){try{if(_rtChannel){try{sb.removeChannel(_rtChannel);}catch(e){}} _rtChannel=sb.channel("realtime-reports-"+Date.now()).on("postgres_changes",{event:"INSERT",schema:"public",table:"reports"},payload=>{try{const r=payload.new;if(!r||reports.find(x=>String(x.id)===String(r.id)))return;const newRep={id:String(r.id),name:String(r.location_name||""),area:String(r.location_area||""),type:String(r.type||""),time:new Date(r.created_at).getTime(),confirms:Number(r.confirms)||1,userId:r.user_id,isAI:r.user_id===AI_USER_ID||r.ai_prob!=null,aiProb:r.ai_prob||null,wrongVotes:r.wrong_votes||0,flagged:(r.wrong_votes||0)>=3};// Replace optimistic local/ai entry if it matches area+type within last 60s
const matchIdx=reports.findIndex(x=>(String(x.id).startsWith('local-')||String(x.id).startsWith('ai-'))&&x.area===newRep.area&&x.type===newRep.type&&Math.abs(x.time-newRep.time)<60000);if(matchIdx!==-1){reports[matchIdx]=newRep;}else{reports.unshift(newRep);if(reports.length>500){const di=reports.slice(400).findIndex(x=>!x.isAI&&x.userId!==AI_USER_ID&&!String(x.id).startsWith('local-')&&!String(x.id).startsWith('ai-'));if(di!==-1)reports.splice(400+di,1);else reports.splice(500,1);}}// Live-train AI history with every incoming report
if(typeof PredictHistory!=='undefined')PredictHistory.addReport(r);renderStats();prependReportCard(newRep,"liveFeed");renderDiscos();if(_nearbyAreas.length)renderNearbyDashboard();renderSavedPlacesHome();renderMyPlacesList();if(r.user_id&&r.user_id!==CU?.id){const alertKey=r.id+r.type;if(!_recentAlerts.has(alertKey)){_recentAlerts.add(alertKey);setTimeout(()=>_recentAlerts.delete(alertKey),30000);sendAreaAlerts(r.location_name,r.location_area,r.type);}}// Show in-app confirm/feedback popup for reports in user's area
setTimeout(()=>{ if(!document.getElementById('confirmOverlay').classList.contains('open')){if(newRep.isAI)showAIFeedbackPopup(newRep);else showConfirmPopup(newRep);}},800);}catch(e){}}).on("postgres_changes",{event:"UPDATE",schema:"public",table:"reports"},payload=>{try{const r=payload.new;const existing=reports.find(x=>String(x.id)===String(r.id));if(existing){existing.confirms=Number(r.confirms)||1;const confirmsEl=document.querySelector(`[data-confirms="${existing.id}"]`);if(confirmsEl)confirmsEl.textContent=`${existing.confirms} confirmation${existing.confirms!==1?"s":""}`;else{renderFeed("liveFeed");renderFeed("myFeed",PR?.location_area||null);}}}catch(e){}}).subscribe(status=>{
    // If realtime drops, restart it after 5s
    if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
      clearTimeout(_rtWatchdog);
      _rtWatchdog=setTimeout(startRealtime,5000);
    }
  });}catch(e){clearTimeout(_rtWatchdog);_rtWatchdog=setTimeout(startRealtime,8000);}}

async function shareApp(){const shareData={title:"NEPAWatch Lagos — Live Power Tracker",text:"Know when light don go or come back in your Lagos area. Real-time crowd-sourced reports + email alerts. Free!",url:APP_URL};if(navigator.share){try{await navigator.share(shareData);}catch(e){if(e.name!=="AbortError"){try{await navigator.clipboard.writeText(APP_URL);toast("Link copied!","ok");}catch(ce){toast(APP_URL,"info");}}}}else{try{await navigator.clipboard.writeText(APP_URL);toast("Link copied!","ok");}catch(e){toast(APP_URL+" — share this link","info");}}}

/* ━━━ PATCH 4: window.load — start AI reporter after app boots ━━━ */
window.addEventListener("load",async()=>{
  initTheme();
  buildFilter();
  document.getElementById("repOverlay").addEventListener("click",e=>{if(e.target===document.getElementById("repOverlay"))closeModal();});
  document.getElementById("placeOverlay").addEventListener("click",e=>{if(e.target===document.getElementById("placeOverlay"))closePlaceModal();});
  document.getElementById("confirmOverlay")?.addEventListener("click",e=>{if(e.target===document.getElementById("confirmOverlay"))dismissConfirm();});
  document.getElementById("areaHistoryModal")?.addEventListener("click",e=>{if(e.target===document.getElementById("areaHistoryModal"))closeAreaHistory();});

  // Detect recovery token BEFORE getSessionFromUrl clears the hash
  const urlParams=new URLSearchParams(window.location.search);
  const hashParams=new URLSearchParams(window.location.hash.replace("#",""));
  const isReset=(urlParams.get("mode")==="reset")||(hashParams.get("type")==="recovery");

  if(isReset){
    _inResetFlow=true; // block onAuthStateChange from interfering
    // Exchange the token so we have a session for updateUser()
    try{await sb.auth.getSessionFromUrl({storeSession:true});}catch(e){}
    // Clean URL immediately
    window.history.replaceState({},document.title,window.location.pathname);
    // Light boot — just enough for the app to be usable behind the form
    if(reports.length === 0) { reports = [..._SEED_REPORTS]; render(); }
    const _rf2=setTimeout(()=>{const el=document.getElementById("liveFeed");if(el&&el.querySelector(".loading-row")){render();}},10000);
    await Promise.all([loadReports(),loadCustomLocations()]);
    clearTimeout(_rf2);
    startPolling();
    go("account");
    setTimeout(()=>{
      const el=document.getElementById("authWrap");
      el.innerHTML=`<div class="auth-wrap"><div class="auth-logo"><div class="auth-logo-icon" style="background:var(--p)">${LOGO_IMG_TAG}</div><span class="auth-logo-name">NEPA<em>Watch</em></span></div><h2>Set new password</h2><p class="auth-sub">Choose a strong new password for your account.</p><div class="msg err" id="authErr"></div><div class="msg ok" id="authOk"></div><div class="fld"><label>New Password</label><input id="inp-newpass" type="password" placeholder="Min 6 characters" autocomplete="new-password"><button type="button" class="pw-eye-btn" onclick="appTogglePw(this)" tabindex="-1"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8C2.5 5 5 3.5 8 3.5C11 3.5 13.5 5 15 8C13.5 11 11 12.5 8 12.5C5 12.5 2.5 11 1 8Z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.3"/></svg></button></div><div class="fld"><label>Confirm Password</label><input id="inp-confpass" type="password" placeholder="Repeat password" autocomplete="new-password"><button type="button" class="pw-eye-btn" onclick="appTogglePw(this)" tabindex="-1"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8C2.5 5 5 3.5 8 3.5C11 3.5 13.5 5 15 8C13.5 11 11 12.5 8 12.5C5 12.5 2.5 11 1 8Z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.3"/></svg></button></div><button class="auth-btn" id="authBtn" onclick="doPasswordReset()">Update Password</button></div>`;
    },500);
    return; // skip normal boot
  }

  // ── Normal boot ──
  await initAuth();
  // Pre-populate feed with seed reports immediately — no empty state
  if(reports.length === 0) {
    reports = [..._SEED_REPORTS];
    render(); // render seed data right away
  }
  // Show fallback in feed if loading takes too long (network issues)
  const _feedFailsafe = setTimeout(()=>{
    const el=document.getElementById('liveFeed');
    if(el&&el.querySelector('.loading-row')){
      render();
    }
  }, 10000);
  await Promise.all([loadReports(),loadCustomLocations()]);
  clearTimeout(_feedFailsafe);
  if(CU)loadSavedPlaces();
  loadUserCount();
  updateBanner();
  startRealtime();
  startPolling();
  renderMyArea();
  initPush();
  startBackgroundLocation();
  startDurationTimer();
  loadAnnouncements();
  if(typeof AIReporter!=='undefined'){
    await AIReporter.loadHistory();
    AIReporter.start();
  }
  /* Load Nigeria-wide data after LOCS + AREA_BANDS are ready */
  if(typeof initNigeriaData==='function') initNigeriaData();
  /* Check if outside Nigeria (much more permissive than old Lagos check) */
  checkIfOutsideNigeria();
});

async function doPasswordReset(){
  const errEl=document.getElementById("authErr"),okEl=document.getElementById("authOk"),btn=document.getElementById("authBtn");
  const np=(document.getElementById("inp-newpass")?.value||"").trim();
  const cp=(document.getElementById("inp-confpass")?.value||"").trim();
  errEl.classList.remove("show");okEl.classList.remove("show");
  if(np.length<6){errEl.textContent="Password must be at least 6 characters.";errEl.classList.add("show");return;}
  if(np!==cp){errEl.textContent="Passwords do not match.";errEl.classList.add("show");return;}
  btn.innerHTML='Updating&nbsp;<span class="spin"></span>';btn.disabled=true;
  const _doSuccess=async()=>{
    // Sign out the recovery session cleanly
    await sb.auth.signOut().catch(()=>{});
    CU=null;PR=null;
    // Show success message
    const el=document.getElementById("authWrap");
    if(el)el.innerHTML='<div class="auth-wrap"><div class="msg ok show" style="margin-bottom:24px"><strong>Password updated!</strong><br>Please sign in with your new password.</div></div>';
    // After 2s: clear reset flag, do full proper boot, show login form
    setTimeout(async()=>{
      _inResetFlow=false;
      await initAuth();
      loadUserCount();updateBanner();startRealtime();renderMyArea();
      if(typeof AIReporter!=="undefined"){await AIReporter.loadHistory();AIReporter.start();}
      go("account");
      renderAuthForm(document.getElementById("authWrap"),"login");
    },3500);
  };
  try{
    const{error}=await sb.auth.updateUser({password:np});
    if(error)throw error;
    await _doSuccess();
  }catch(e){
    const msg=(e.message||"").toLowerCase();
    // "Lock was stolen" = a race with the auth state change — but password DID update, treat as success
    if(msg.includes("lock")||msg.includes("stolen")||msg.includes("session")||msg.includes("expired")){
      await _doSuccess();return;
    }
    if(btn){errEl.textContent=e.message||"Could not update password.";errEl.classList.add("show");btn.innerHTML="Update Password";btn.disabled=false;}
  }
}

/* ═══════════════════════════════════════════════════════
   HOME SEARCH BAR — Leaflet + Nominatim autocomplete
   ═══════════════════════════════════════════════════════ */

let _hsDebounce=null,_hsNominatimResults=[],_hsOpen=false;

function onHomeSearch(val){
  const clear=document.getElementById('hsClear');
  if(clear)clear.style.display=val?'flex':'none';
  document.getElementById('homeSearchWrap').classList.add('focused');
  clearTimeout(_hsDebounce);
  if(!val.trim()){showHomeResults();return;}
  _hsDebounce=setTimeout(()=>_runHomeSearch(val.trim()),280);
}

async function _runHomeSearch(q){
  const el=document.getElementById('hsResults');
  if(!el)return;
  el.style.display='block';
  _hsOpen=true;

  // 1. Local matches from LOCS first (instant)
  const ql=q.toLowerCase();
  const local=LOCS.filter(l=>l.label.toLowerCase().includes(ql)).slice(0,5);

  // 2. Nominatim search for all of Nigeria (async)
  let nomResults=[];
  try{
    const url=`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q+', Nigeria')}&format=json&limit=8&addressdetails=1&countrycodes=ng`;
    const res=await fetch(url,{headers:{"Accept-Language":"en","User-Agent":"NEPAWatch/1.0"}});
    nomResults=await res.json();
    _hsNominatimResults=nomResults;
  }catch(e){_hsNominatimResults=[];}

  _renderHomeResults(q,local,nomResults);
}

function _renderHomeResults(q,local,nomResults){
  const el=document.getElementById('hsResults');
  if(!el||!_hsOpen)return;
  let html='';

  if(local.length){
    html+=`<div class="hs-section">In NEPAWatch</div>`;
    html+=local.map(l=>{
      const st=getPlaceStatus(l.area);
      const stHtml=st==='out'?'<span class="hs-item-status s-out">Out</span>':st==='on'?'<span class="hs-item-status s-on">On</span>':'';
      return`<div class="hs-item" onclick="selectHomeLocation('${l.id}')">
        <div class="hs-item-icon"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1A2.3 2.3 0 0 0 3.7 3.3C3.7 5.7 6 10.5 6 10.5S8.3 5.7 8.3 3.3A2.3 2.3 0 0 0 6 1z" stroke="currentColor" stroke-width="1.2"/><circle cx="6" cy="3.3" r=".9" fill="currentColor"/></svg></div>
        <div class="hs-item-body"><div class="hs-item-name">${l.name}</div><div class="hs-item-sub">${l.street?l.area:'Area · Nigeria'}</div></div>
        ${stHtml}
      </div>`;
    }).join('');
  }

  if(nomResults.length){
    html+=`<div class="hs-section">Map Results</div>`;
    html+=nomResults.map((r,i)=>{
      const name=r.name||r.display_name.split(',')[0];
      const sub=r.display_name.split(',').slice(1,3).join(',').trim();
      return`<div class="hs-item" onclick="selectNominatimResult(${i})">
        <div class="hs-item-icon"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2"/><path d="M4 6h4M6 4v4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg></div>
        <div class="hs-item-body"><div class="hs-item-name">${name}</div><div class="hs-item-sub">${sub||'Nigeria'}</div></div>
      </div>`;
    }).join('');
  }

  if(!local.length&&!nomResults.length){
    html=`<div class="hs-empty">No results — try a different street name</div>`;
  }

  // Always offer "add new location"
  html+=`<div class="hs-add-row" onclick="openAddFromSearch('${q.replace(/'/g,"\\'")}')">
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    Add "${q}" as a new location
  </div>`;

  el.innerHTML=html;
  el.style.display='block';
}

function showHomeResults(){
  const q=(document.getElementById('homeSearch')?.value||'').trim();
  if(!q){
    // Show top areas
    const el=document.getElementById('hsResults');
    if(!el)return;
    _hsOpen=true;
    const top=LOCS.filter(l=>!l.street).slice(0,8);
    let html=`<div class="hs-section">Nigerian Areas</div>`;
    html+=top.map(l=>{
      const st=getPlaceStatus(l.area);
      const stHtml=st==='out'?'<span class="hs-item-status s-out">Out</span>':st==='on'?'<span class="hs-item-status s-on">On</span>':'';
      return`<div class="hs-item" onclick="selectHomeLocation('${l.id}')">
        <div class="hs-item-icon"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="2" width="10" height="8" rx="1.2" stroke="currentColor" stroke-width="1.2"/></svg></div>
        <div class="hs-item-body"><div class="hs-item-name">${l.name}</div><div class="hs-item-sub">Area</div></div>
        ${stHtml}
      </div>`;
    }).join('');

    el.innerHTML=html;
    el.style.display='block';
  } else {
    _runHomeSearch(q);
  }
}

function hideHomeResults(){
  _hsOpen=false;
  const el=document.getElementById('hsResults');
  if(el)el.style.display='none';
  document.getElementById('homeSearchWrap')?.classList.remove('focused');
}

function clearHomeSearch(){
  const inp=document.getElementById('homeSearch');
  if(inp)inp.value='';
  const clear=document.getElementById('hsClear');
  if(clear)clear.style.display='none';
  hideHomeResults();
  inp?.focus();
}

function selectHomeLocation(id){
  const loc=LOCS.find(l=>l.id===id);
  if(!loc)return;
  hideHomeResults();
  const inp=document.getElementById('homeSearch');
  if(inp){inp.value='';} // clear search bar — loc tag shows watching area
  // Set filter using parent area so sub-areas all show
  const parent=AREA_PARENT?.[loc.area]||loc.area;
  filterArea=parent;
  const sel=document.getElementById('areaFilter');
  if(sel)sel.value=parent;
  renderFeed('liveFeed');
  // Always update the watching tag
  const locTag=document.getElementById('locTag');
  const locLabel=document.getElementById('locLabel');
  if(locTag)locTag.classList.add('on');
  if(locLabel)locLabel.textContent=loc.street?`${loc.name}, ${loc.area}`:loc.name;
  const clear=document.getElementById('hsClear');
  if(clear)clear.style.display='none';
  toast(`Now watching ${loc.street?loc.name+', '+loc.area:loc.name}`,'ok');
  // Save to DB if logged in
  if(CU)saveLocation(loc);
}

async function selectNominatimResult(idx){
  const r=_hsNominatimResults[idx];
  if(!r)return;
  hideHomeResults();
  const lat=parseFloat(r.lat),lng=parseFloat(r.lon);
  const name=r.name||r.display_name.split(',')[0];

  // Clear search bar — watching tag will show the area
  const inp=document.getElementById('homeSearch');
  if(inp)inp.value='';
  const cl=document.getElementById('hsClear');
  if(cl)cl.style.display='none';

  // Snap to existing LOCS within 200m first
  const snapped=_findDupLoc(lat,lng,200);
  if(snapped){ selectHomeLocation(snapped.id); return; }

  // Find nearest area, prefer parent for broader report coverage
  const nearest=findNearestAreas(lat,lng,1)[0];
  const area=nearest?.area||'Lagos';
  const parent=AREA_PARENT?.[area]||area;
  filterArea=parent;
  const sel=document.getElementById('areaFilter');
  if(sel)sel.value=parent;
  renderFeed('liveFeed');

  // Update watching tag immediately (no need to be logged in)
  const locTag=document.getElementById('locTag');
  const locLabel=document.getElementById('locLabel');
  if(locTag)locTag.classList.add('on');
  if(locLabel)locLabel.textContent=name!==area?`${name}, ${area}`:area;
  toast(`Now watching ${name!==area?name+', '+area:area}`,'ok');

  // Show on Leaflet map
  _showMap();showLeafletLocation(lat,lng);

  // If logged in, save to profile with coords
  if(CU){
    const a=r.address||{};
    const areaName=a.suburb||a.city_district||area;
    const newLoc=await submitCustomLocation(name,areaName,lat,lng);
    if(newLoc)await saveLocation(newLoc);
  }
}

function openAddFromSearch(streetHint){
  hideHomeResults();
  // Pre-fill the "add location" form in the report modal
  openModal('out');
  setTimeout(()=>{
    const ms=document.getElementById('mSearch');
    if(ms){ms.value=streetHint;filterList();}
    // Open suggest form
    const form=document.getElementById('suggestLocForm');
    const txt=document.getElementById('suggestLocToggleTxt');
    if(form){
      form.style.display='block';
      if(txt)txt.textContent='Hide';
      const si=document.getElementById('suggestStreet');
      if(si){si.value=streetHint;si.focus();}
    }
  },200);
}

// Close search results when clicking outside
document.addEventListener('click',e=>{
  const wrap=document.getElementById('homeSearchWrap');
  if(wrap&&!wrap.contains(e.target))hideHomeResults();
},{passive:true});


/* ═══════════════════════════════════════════════════════
   MAP PICKER — Leaflet interactive location picker
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   MAP PICKER — auto-locates + shows green/red power dots
   ═══════════════════════════════════════════════════════ */
let _mpMap=null,_mpMarker=null,_mpLat=null,_mpLng=null,_mpArea=null,_mpCurrentName='',_mpCurrentArea='';
let _mpPowerMarkers=[];

function mpOnNameEdit(val){
  _mpCurrentName=val.trim();
  const btn=document.getElementById('mpConfirmBtn');
  if(btn)btn.disabled=!_mpCurrentName;
}

function openMapPicker(){
  document.getElementById('mapPickerOverlay').classList.add('open');
  hideHomeResults();
  setTimeout(()=>{
    if(!_mpMap){
      _mpMap=L.map('mapPickerMap',{zoomControl:true,attributionControl:false}).setView([6.5244,3.3792],12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(_mpMap);
      _mpMap.on('click',_onMapPickerClick);
    }
    _mpMap.invalidateSize();
    _mpAutoLocate();
  },220);
}

function closeMapPicker(){
  document.getElementById('mapPickerOverlay').classList.remove('open');
}

async function _mpAutoLocate(){
  if(userExactLat&&userExactLng){
    _mpMap.setView([userExactLat,userExactLng],15);
    _mpPlaceUserPin(userExactLat,userExactLng);
    _mpDrawPowerDots();
    return;
  }
  if(!navigator.geolocation)return;
  const loadEl=document.getElementById('mpLocatingMsg');
  if(loadEl)loadEl.style.display='flex';
  try{
    const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:12000,maximumAge:30000}));
    const {latitude:lat,longitude:lng}=pos.coords;
    userExactLat=lat;userExactLng=lng;
    _mpMap.setView([lat,lng],15);
    _mpPlaceUserPin(lat,lng);
    _mpDrawPowerDots();
  }catch(e){
    _mpMap.setView([6.5244,3.3792],12);
    _mpDrawPowerDots();
  }finally{
    if(loadEl)loadEl.style.display='none';
  }
}

function _mpPlaceUserPin(lat,lng){
  if(_mpMarker)_mpMarker.remove();
  const icon=L.divIcon({className:'',html:`
    <div style="position:relative;width:24px;height:24px">
      <div style="position:absolute;inset:0;background:rgba(75,142,245,.25);border-radius:50%;animation:mp-pulse 1.8s ease infinite"></div>
      <div style="position:absolute;top:4px;left:4px;width:16px;height:16px;background:#4B8EF5;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>
    </div>`,iconSize:[24,24],iconAnchor:[12,12]});
  _mpMarker=L.marker([lat,lng],{icon,zIndexOffset:1000}).addTo(_mpMap);
  _mpMarker.bindPopup('<strong>You are here</strong>').openPopup();
  _mpLat=lat;_mpLng=lng;
  _mpReverseAndFill(lat,lng);
}

async function _mpReverseAndFill(lat,lng){
  const nearestArr=findNearestAreas(lat,lng,1);
  _mpArea=nearestArr[0]?.area||null;
  let locName=_mpArea||'Your location';
  let locArea=_mpArea||'Lagos';
  try{
    const res=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`,{headers:{"Accept-Language":"en","User-Agent":"NEPAWatch/1.0"}});
    const data=await res.json();
    const a=data.address||{};
    locName=a.road||a.neighbourhood||a.suburb||a.city_district||_mpArea||'Your location';
    locArea=a.suburb||a.city_district||a.town||a.neighbourhood||_mpArea||'Lagos';
  }catch(e){}
  const selEl=document.getElementById('mpSelected');
  const nameEl=document.getElementById('mpSelectedName');
  const areaEl=document.getElementById('mpSelectedArea');
  if(selEl)selEl.style.display='block';
  if(nameEl){nameEl.value=locName;nameEl.select();}
  if(areaEl)areaEl.value=locArea;
  _mpCurrentName=locName;
  _mpCurrentArea=locArea;
  const btn=document.getElementById('mpConfirmBtn');
  if(btn){btn.disabled=false;btn.textContent='Save This Location';}
}

function _mpDrawPowerDots(){
  _mpPowerMarkers.forEach(m=>m.remove());
  _mpPowerMarkers=[];
  Object.entries(AREA_COORDS).forEach(([area,coords])=>{
    const status=getPlaceStatus(area);
    if(status==='unk')return;
    const col=status==='on'?'#AAFF00':'#FF4055';
    const glow=status==='on'?'rgba(170,255,0,.5)':'rgba(255,64,85,.5)';
    const label=status==='on'?'Power On':'Power Out';
    const icon=L.divIcon({className:'',html:`<div style="width:14px;height:14px;background:${col};border:2px solid rgba(255,255,255,.85);border-radius:50%;box-shadow:0 0 8px ${glow},0 1px 4px rgba(0,0,0,.4)"></div>`,iconSize:[14,14],iconAnchor:[7,7]});
    const marker=L.marker([coords.lat,coords.lng],{icon}).addTo(_mpMap);
    marker.bindPopup(`<strong>${area}</strong><br>${label}`);
    _mpPowerMarkers.push(marker);
  });
}

async function _onMapPickerClick(e){
  const {lat,lng}=e.latlng;
  _mpPlaceUserPin(lat,lng);
}

async function confirmMapPick(){
  if(_mpLat===null||_mpLng===null)return;

  // Read the (possibly user-edited) values straight from the inputs
  const nameEl=document.getElementById('mpSelectedName');
  const areaEl=document.getElementById('mpSelectedArea');
  const streetName=(nameEl?.value||_mpCurrentName||'').trim();
  const areaName=(areaEl?.value||_mpCurrentArea||_mpArea||'Lagos').trim();

  if(!streetName){toast('Please enter a location name','info');nameEl?.focus();return;}

  const btn=document.getElementById('mpConfirmBtn');
  if(btn){btn.textContent='Saving…';btn.disabled=true;}

  closeMapPicker();

  // Check if an identical name+area already exists — no duplicates
  const existing=LOCS.find(l=>
    l.name.toLowerCase()===streetName.toLowerCase()&&
    (l.area||'').toLowerCase()===areaName.toLowerCase()
  );
  if(existing){
    toast(`Using existing location: ${streetName}`,'ok');
    selectHomeLocation(existing.id);
    return;
  }

  // Check for a nearby duplicate within 150m (same physical spot, different name)
  const snapped=_findDupLoc(_mpLat,_mpLng,150);
  if(snapped){
    // Snapped to existing but user gave a new name — update the name in Supabase
    if(CU&&snapped.custom&&streetName!==snapped.name){
      try{
        await sb.from('custom_locations').update({street_name:streetName,area_name:areaName}).eq('id',snapped.id);
        snapped.name=streetName;snapped.street=streetName;snapped.area=areaName;
        snapped.label=`${streetName} — ${areaName}`;
        toast(`Location renamed to "${streetName}"`,'ok');
      }catch(e){}
    }
    selectHomeLocation(snapped.id);
    return;
  }

  // Brand new location — save to Supabase custom_locations and add to LOCS
  if(CU){
    const newLoc=await submitCustomLocation(streetName,areaName,_mpLat,_mpLng);
    if(newLoc){
      toast(`"${streetName}" added to locations`,'ok');
      await saveLocation(newLoc);
    }
  } else {
    // Not logged in — add to LOCS in memory only so the session works
    const tempId='local-mp-'+Date.now();
    const tempLoc={id:tempId,name:streetName,area:areaName,street:streetName,
      label:`${streetName} — ${areaName}`,custom:true,lat:_mpLat,lng:_mpLng};
    LOCS.unshift(tempLoc);
    selectHomeLocation(tempId);
    toast(`Watching ${streetName} — sign in to save permanently`,'info');
  }
}

document.getElementById('mapPickerOverlay')?.addEventListener('click',e=>{
  if(e.target===document.getElementById('mapPickerOverlay'))closeMapPicker();
});

/* map show/hide helpers */
function _showMap(){const w=document.getElementById('mapWrap');if(w)w.style.display='block';}
function _hideMap(){const w=document.getElementById('mapWrap');if(w)w.style.display='none';}
function dismissMap(){_hideMap();if(_leafletMap){_leafletMap.remove();_leafletMap=null;_leafletUserMarker=null;_leafletPowerMarkers=[];}}


/* ═══════════════════════════════════════════════════════
   WELCOME MODAL — shows once on first login
   ═══════════════════════════════════════════════════════ */
const TOUR_KEY = 'nw_welcome_v2';

function startTour() { _showWelcome(); }

function _showWelcome() {
  if (localStorage.getItem(TOUR_KEY)) return;

  const overlay = document.createElement('div');
  overlay.id = 'onbOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:20px;pointer-events:all';

  overlay.innerHTML = `
    <div style="background:var(--sf,#111815);border:1.5px solid var(--p,#AAFF00);border-radius:18px;padding:28px 24px;max-width:340px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,.6);animation:onb-pop .25s cubic-bezier(.4,0,.2,1)">
      <div style="font-size:1.35rem;font-weight:900;color:var(--ink1);margin-bottom:6px;letter-spacing:-.01em">Welcome to NEPAWatch</div>
      <div style="font-size:.78rem;color:var(--p);font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:20px">Lagos Power Tracker</div>

      <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:24px">

        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="flex-shrink:0;width:32px;height:32px;background:var(--sf2,#17201A);border-radius:8px;display:flex;align-items:center;justify-content:center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L4.5 8.5H7.5L6.5 14.5L11.5 7.5H8.5L8 1.5Z" stroke="var(--p)" stroke-width="1.4" stroke-linejoin="round"/></svg>
          </div>
          <div>
            <div style="font-size:.8rem;font-weight:700;color:var(--ink1);margin-bottom:2px">Report power changes</div>
            <div style="font-size:.73rem;color:var(--ink3);line-height:1.5">Tap <strong style="color:var(--ink2)">Light Don Go</strong> or <strong style="color:var(--ink2)">Light Don Come</strong> on the home screen to update your community.</div>
          </div>
        </div>

        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="flex-shrink:0;width:32px;height:32px;background:var(--sf2,#17201A);border-radius:8px;display:flex;align-items:center;justify-content:center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="6.5" r="4" stroke="var(--p)" stroke-width="1.4"/><path d="M11 10.5L14.5 14" stroke="var(--p)" stroke-width="1.4" stroke-linecap="round"/></svg>
          </div>
          <div>
            <div style="font-size:.8rem;font-weight:700;color:var(--ink1);margin-bottom:2px">Search or tap Locate Me</div>
            <div style="font-size:.73rem;color:var(--ink3);line-height:1.5">Type your street in the search bar, or tap <strong style="color:var(--ink2)">Locate Me</strong> in the top bar to auto-detect your area.</div>
          </div>
        </div>

        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="flex-shrink:0;width:32px;height:32px;background:var(--sf2,#17201A);border-radius:8px;display:flex;align-items:center;justify-content:center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M8 2v12" stroke="var(--p)" stroke-width="1.4" stroke-linecap="round"/></svg>
          </div>
          <div>
            <div style="font-size:.8rem;font-weight:700;color:var(--ink1);margin-bottom:2px">Save places for alerts</div>
            <div style="font-size:.73rem;color:var(--ink3);line-height:1.5">Go to <strong style="color:var(--ink2)">My Area</strong> to save Home, Work or School and get email alerts the moment power changes.</div>
          </div>
        </div>

      </div>

      <button onclick="_endTour()" style="width:100%;background:var(--p);color:#07090A;border:none;border-radius:10px;padding:13px;font-size:.9rem;font-weight:800;cursor:pointer;letter-spacing:.01em">Got it — open the app</button>
    </div>`;

  document.body.appendChild(overlay);
}

function _endTour() {
  document.getElementById('onbOverlay')?.remove();
  localStorage.setItem(TOUR_KEY, '1');
  // Show add-to-home-screen banner after welcome is dismissed
  setTimeout(_maybeShowA2HS, 600);
}

function _clearTourEl() {
  document.getElementById('onbOverlay')?.remove();
}

function _maybeStartTour() {
  if (!localStorage.getItem(TOUR_KEY)) {
    setTimeout(_showWelcome, 800);
  }
}

/* ═══════════════════════════════════════════════════════
   ADD TO HOME SCREEN — full-screen modal
   "Remind me later" snoozes 3 days; no permanent dismiss.
   ═══════════════════════════════════════════════════════ */
const A2HS_SNOOZE_KEY = 'nw_a2hs_snooze_until';
const A2HS_SNOOZE_DAYS = 3;
let _deferredA2HSPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredA2HSPrompt = e;
  if (!_isInStandaloneMode()) _maybeShowA2HS();
});

function _a2hsSnoozed() {
  const until = parseInt(localStorage.getItem(A2HS_SNOOZE_KEY) || '0', 10);
  return Date.now() < until;
}

function _maybeShowA2HS() {
  if (_isInStandaloneMode()) return;
  if (document.getElementById('a2hsModal')) return;
  if (_a2hsSnoozed()) return;

  const isIos = _isIos();
  if (!isIos && !_deferredA2HSPrompt) return;

  const modal = document.createElement('div');
  modal.id = 'a2hsModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(7,9,10,.92);display:flex;align-items:flex-end;justify-content:center;animation:onb-fade .2s ease';

  const iosSteps = `
    <div style="margin-top:20px;background:rgba(255,255,255,.04);border-radius:12px;padding:16px;text-align:left">
      <div style="font-size:.78rem;color:var(--ink3);line-height:1.8">
        <div style="margin-bottom:6px;color:var(--ink2);font-weight:600">How to install on iPhone:</div>
        <div>1. Open this page in <strong style="color:var(--p)">Safari</strong> (not Chrome)</div>
        <div>2. Tap the <strong style="color:var(--p)">Share</strong> button
          <svg style="vertical-align:middle;margin:0 3px" width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 4l3-3 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 8v4h10V8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          at the bottom
        </div>
        <div>3. Scroll down and tap <strong style="color:var(--p)">Add to Home Screen</strong></div>
      </div>
    </div>`;

  const androidContent = `
    <button onclick="_triggerA2HS()" style="width:100%;background:var(--p);color:#07090A;border:none;border-radius:12px;padding:15px;font-size:1rem;font-weight:800;cursor:pointer;margin-top:20px;letter-spacing:.01em">
      Install NEPAWatch
    </button>`;

  modal.innerHTML = `
    <div style="width:100%;max-width:480px;background:var(--sf,#111815);border-radius:24px 24px 0 0;padding:28px 24px 36px;text-align:center">
      <div style="width:64px;height:64px;background:var(--pp);border-radius:16px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M18 4L8 18h10l-4 10 14-16H18L22 4z" fill="var(--p)"/></svg>
      </div>
      <div style="font-size:1.25rem;font-weight:800;color:var(--ink1);margin-bottom:8px">Install NEPAWatch</div>
      <div style="font-size:.88rem;color:var(--ink3);line-height:1.5">
        Get <strong style="color:var(--ink2)">free push notifications</strong> the moment light goes or comes back in your area — even when your browser is closed.
      </div>
      ${isIos ? iosSteps : androidContent}
      <button onclick="_snoozeA2HS()" style="width:100%;background:none;border:1.5px solid rgba(255,255,255,.1);border-radius:12px;padding:13px;font-size:.88rem;font-weight:600;color:var(--ink3);cursor:pointer;margin-top:10px">
        Remind me later
      </button>
    </div>`;

  document.body.appendChild(modal);
}

async function _triggerA2HS() {
  if (!_deferredA2HSPrompt) return;
  _deferredA2HSPrompt.prompt();
  const { outcome } = await _deferredA2HSPrompt.userChoice;
  _deferredA2HSPrompt = null;
  document.getElementById('a2hsModal')?.remove();
  if (outcome === 'accepted') {
    _onPWAInstalled(); // auto-enable push, disable email
  } else {
    _snoozeA2HS(); // snooze if they declined the native prompt
  }
}

function _snoozeA2HS() {
  document.getElementById('a2hsModal')?.remove();
  const until = Date.now() + A2HS_SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(A2HS_SNOOZE_KEY, String(until));
}

// Also show on Account page if not installed
function _maybeShowA2HSOnAccount() {
  if (_isInStandaloneMode()) return;
  if (document.getElementById('a2hsModal')) return;
  setTimeout(_maybeShowA2HS, 300);
}

/* When PWA is installed (via our button or browser menu):
   auto-enable push notifications and turn off email to save costs */
async function _onPWAInstalled() {
  // Enable push notifications silently
  if (typeof requestPushPermission === 'function') {
    try { await requestPushPermission(); } catch(e) {}
  }
  // Turn off email alerts for this user — they have push now
  if (CU && PR) {
    try {
      await sb.from('profiles').update({ notif_on: false }).eq('id', CU.id);
      PR.notif_on = false;
      if (typeof renderAccount === 'function') renderAccount();
    } catch(e) {}
  }
  toast('Push notifications enabled — email alerts turned off', 'ok');
}

// Fires when user installs via browser menu (outside our custom modal)
window.addEventListener('appinstalled', () => { _onPWAInstalled(); });
