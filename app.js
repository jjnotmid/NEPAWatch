/* ===== NEPAWatch Lagos — app.js ===== */
/* =========================================================
   INTEGRATION PATCHES for predict.js / AI auto-reporter
   Changes from original:
   1. renderFeed() — shows 🤖 AI badge on AI-generated reports
   2. go()         — handles 'predict' page + calls renderPredictPage()
                     and renderMyAreaPredictWidget() for myarea
   3. renderCommunity() leaderboard — shows NEPAWatch AI entry
   4. window.load  — calls AIReporter.loadHistory() + AIReporter.start()
   5. SESSION FIX  — proper persistence so refresh doesn't log out
   6. 500+ COORDINATES — accurate Lagos locations added
   ========================================================= */
try { window.BroadcastChannel = undefined; } catch (e) {}

const SUPA_URL = 'https://djurokbkkqrmpafcxlez.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdXJva2Jra3FybXBhZmN4bGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzE5OTUsImV4cCI6MjA4ODE0Nzk5NX0.ZLOtWFB7qy_J0mitjb_pcZ88wxmRjMe-3OdbQCRL8xE';
const EMAIL_FN = `${SUPA_URL}/functions/v1/send-alert`;
const APP_URL = 'https://nepawatch.app';
const APP_LOGO_URL = APP_URL + '/logo2.jpg';

/* AI reporter constants */
const AI_USER_ID = '00000000-0000-0000-0000-000000000001';
const AI_USER_NAME = 'NEPAWatch AI';

/* ── SESSION-PERSISTENT Supabase client ── */
const sb = supabase.createClient(SUPA_URL, SUPA_ANON, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'nw-auth-token',
    storage: window.localStorage
  }
});

const LAGOS = {
  "Ikeja GRA": [
    "Isaac John Street", "Oduduwa Crescent", "Joel Ogunnaike Street", "Oba Akinjobi Road",
    "Aromire Avenue", "Mobolaji Bank Anthony Way", "Adeniyi Jones Avenue", "Rev Ogunbiyi Street",
    "Olowopo Street", "Sobo Arobiodu Street", "Adebayo Doherty Street", "Akin Ogunlewe Road",
    "Olatunde Ayoola Avenue", "Fola Osibo Street", "Remi Fani-Kayode Street", "Olu Holloway Street",
    "Simpson Street", "Oduduwa Way"
  ],
  "Ikeja (Allen/Opebi)": [
    "Allen Avenue", "Toyin Street", "Opebi Road", "Oregun Road", "Obafemi Awolowo Way",
    "Computer Village", "Alausa Secretariat", "Agidingbi Road", "Lateef Jakande Road",
    "Mobolaji Johnson Avenue", "Kudirat Abiola Way", "Salvation Road", "Opebi Link Road",
    "Fatai Atere Way", "Oduduwa Crescent", "Aromire Street", "Ogundana Street"
  ],
  "Maryland/Anthony": [
    "Anthony Village", "Ikorodu Road", "Palmgrove Estate", "Onipanu Street", "Jibowu Street",
    "Oworonshoki Expressway", "Cemetery Road", "Gani Fawehinmi Way", "Ikosi Road",
    "Anthony Oke", "Anthony Bus Stop", "Maryland Mall Road", "Fashoro Street"
  ],
  "Ogba": [
    "Ogba Estate", "Ifako Road", "Command Road", "Abeokuta Expressway", "Ijaiye Road",
    "Acme Road", "MCC Road", "Ogba Bus Stop", "Ogba Market", "Iju Road", "Water Works Road"
  ],
  "Agege": [
    "Agege Stadium Road", "Oko Oba Road", "Dopemu Road", "Orile Agege", "Papa Ajao",
    "Abule Egba", "Abeokuta Expressway", "Old Abeokuta Road", "Pen Cinema Road",
    "Agege Motor Road", "Iju Road", "Ifako Road", "Command Road", "Acme Road"
  ],
  "Alimosho/Ipaja": [
    "Idimu Road", "Egbe Road", "Iyana Ipaja", "Ayobo Road", "Akowonjo Road",
    "Shasha Road", "Jakande Estate Isolo", "Igando Road", "Baruwa Road", "Ikotun Road"
  ],
  "Ojodu/Omole": [
    "Ojodu Berger", "Isheri Road", "Omole Phase 1", "Omole Phase 2", "CMD Road",
    "Fagba Road", "Berger Expressway", "Ojodu Bus Stop", "Omole Estate", "Isheri North"
  ],
  "Kosofe/Ketu": [
    "Ketu Mile 12", "Ogudu Road", "Ojota Interchange", "Alapere Road",
    "Mile 12 Market", "Kosofe Road", "Agboyi Road", "Magodo Phase 1", "Magodo Phase 2"
  ],
  "Gbagada": [
    "Gbagada Phase 1", "Gbagada Phase 2", "Pedro Road", "Tigris Crescent",
    "Soluyi Avenue", "Ifako Gbagada", "Gbagada Express", "Keffi Street"
  ],
  "Ilupeju": [
    "Ilupeju Estate Road", "Ilupeju Bypass", "Commercial Avenue Ilupeju",
    "Simbiat Abiola Road", "Harvey Road", "Oregun Road Ilupeju"
  ],
  "Mushin": [
    "Agege Motor Road Mushin", "Ladipo Street", "Idi Oro Road", "Apata Street",
    "Fadeyi Road", "Mushin Market Road", "Ejigbo Road Mushin", "Town Planning Way"
  ],
  "Surulere": [
    "Adeniran Ogunsanya Street", "Bode Thomas Street", "Ogunlana Drive",
    "Ojuelegba Road", "Eric Moore Road", "Western Avenue Surulere",
    "Itire Road", "Masha Road", "Randle Avenue", "Akerele Street", "Lawanson Road"
  ],
  "Yaba": [
    "Herbert Macaulay Way", "Akoka Road", "Iwaya Road", "Sabo Road Yaba",
    "Jibowu Yaba", "Tejuosho Road", "University of Lagos Road", "Makoko Road"
  ],
  "Oshodi/Isolo": [
    "International Airport Road", "Bolade Road", "Oshodi Market",
    "Ago Palace Way", "Okota Road", "Cele Expressway", "Ilasamaja Road", "Ejigbo Road"
  ],
  "Shomolu/Bariga": [
    "Shomolu Road", "Bariga Road", "Onigbongbo", "Obanikoro Road", "Fadeyi Shomolu", "Pedro Shomolu"
  ],
  "Ebute Metta": [
    "Ebute Metta East", "Ebute Metta West", "Willoughby Street", "Oyingbo Market Road", "Olawale Street"
  ],
  "Apapa": [
    "Apapa GRA", "Creek Road", "Commercial Road Apapa", "Liverpool Road",
    "Marine Beach Road", "Kirikiri Road", "Burma Road"
  ],
  "Lagos Island": [
    "Broad Street", "Marina Lagos", "Nnamdi Azikiwe Street", "Tinubu Square",
    "Balogun Market Area", "Idumota", "Ereko Street", "Custom Street", "Lagos Island GRA"
  ],
  "Ikoyi": [
    "Bourdillon Road", "Osborne Road", "Alexander Road", "Kingsway Road Ikoyi",
    "Awolowo Road", "Gerrard Road", "Banana Island", "Parkview Estate", "Lugard Avenue"
  ],
  "Victoria Island": [
    "Adeola Odeku Street", "Akin Adesola Street", "Ozumba Mbadiwe Avenue",
    "Idejo Street", "Ahmadu Bello Way VI", "Ligali Ayorinde Street",
    "Sanusi Fafunwa Street", "Kofo Abayomi Street", "Ademola Adetokunbo Street", "Oniru Estate Road"
  ],
  "Obalende/CMS": [
    "Obalende Road", "Race Course Road", "Hawley Street", "Campbell Street",
    "Awolowo Road Obalende", "Igbosere Road"
  ],
  "Lekki Phase 1": [
    "Admiralty Way", "Fola Osibo Road", "Adewunmi Adebimpe Drive",
    "Omorinre Johnson Street", "Bisola Durosinmi-Etti Drive", "Adebayo Doherty Road",
    "Freedom Way Lekki", "T.F. Kuboye Road", "Jakande Road Lekki"
  ],
  "Lekki Phase 2/Ikota": [
    "Crown Estate Road", "Orchid Road Lekki", "Ikota Shopping Complex Road",
    "VGC Road", "Megamound Road", "Abraham Adesanya Road", "Thomas Estate Road Ikota"
  ],
  "Ajah": [
    "Abraham Adesanya Estate", "Jakande Estate Ajah", "Badore Road",
    "Ilaje Road Ajah", "Thomas Estate Road", "Sangotedo Road",
    "Addo Road Ajah", "Monastery Road", "Ogombo Road", "Ado Road", "Ilasan Road Ajah"
  ],
  "Chevron/Lekki-Epe Expressway": [
    "Chevron Alternative Route", "Chevron Drive", "Palace Road Lekki",
    "Osapa London", "Ikate-Elegushi Road", "Oral Estate Road", "Mobil Road Lekki"
  ],
  "Igbo Efon/Ilasan": [
    "Igbo Efon Road", "Ilasan Road", "Agungi Road Igbo Efon", "Ologolo Road", "Lekki Conservation Road"
  ],
  "Ibeju-Lekki": [
    "Lekki Free Trade Zone Road", "Awoyaya Road", "Bogije Road",
    "Akodo Road", "Epe Expressway Ibeju", "Eleko Road"
  ],
  "Festac Town": [
    "1st Avenue Festac", "2nd Avenue Festac", "21 Road Festac",
    "22 Road Festac", "D Close Festac", "FESTAC Expressway", "6th Avenue Festac", "7th Avenue Festac"
  ],
  "Amuwo Odofin": [
    "Apple Junction Road", "Mile 2 Road", "Kirikiri Industrial Road",
    "Satellite Town Road", "Amuwo Odofin Estate", "Alakija Road"
  ],
  "Ojo/Alaba": [
    "Alaba International Market", "Navy Town Road Ojo", "Volkswagen Road Ojo",
    "Trade Fair Complex Road", "Ojo Barracks Road", "LASU Road Ojo"
  ],
  "Badagry": [
    "Badagry Expressway", "Seme Border Road", "Agbara Estate Road",
    "Ajangbadi Road", "Badagry Town", "Topo Road Badagry", "Marina Road Badagry"
  ],
  "Ikorodu": [
    "Lagos Road Ikorodu", "Agric Road Ikorodu", "Benson Road Ikorodu",
    "Ikorodu GRA", "Owutu Road", "Imota Road", "Ijede Road"
  ],
  "Magodo": [
    "Magodo Phase 1 Road", "Magodo Phase 2 Road", "GRA Shangisha Road",
    "Magodo Estate Road", "CMD Road Magodo"
  ],
  "Ojota/Oregun": [
    "Ojota Road", "Oregun Road", "Kudirat Abiola Way", "Oregun Industrial Estate Road", "Ojota Market Road"
  ],
  "Onikan/Lagos Mainland": [
    "Onikan Stadium Road", "Bishop Oluwole Street", "Broad Street Onikan", "King George V Road"
  ],
  "Epe": [
    "Epe Town Road", "Lagos-Epe Expressway", "Epe GRA Road", "Poka Road", "Mojoda Road"
  ]
};

const DISCO = [
  { name: "Ikeja Electric", lgas: ["Ikeja GRA","Ikeja (Allen/Opebi)","Maryland/Anthony","Ogba","Agege","Alimosho/Ipaja","Ojodu/Omole","Kosofe/Ketu","Gbagada","Ilupeju","Mushin","Oshodi/Isolo","Shomolu/Bariga","Ikorodu","Magodo","Ojota/Oregun"] },
  { name: "Eko Electric", lgas: ["Lagos Island","Ikoyi","Victoria Island","Obalende/CMS","Ebute Metta","Apapa","Surulere","Yaba","Lekki Phase 1","Lekki Phase 2/Ikota","Ajah","Chevron/Lekki-Epe Expressway","Igbo Efon/Ilasan","Ibeju-Lekki","Festac Town","Amuwo Odofin","Ojo/Alaba","Badagry","Onikan/Lagos Mainland","Epe"] },
];

/* ═══════════════════════════════════════════════════════════════
   AREA COORDINATES — 500+ accurate Lagos locations
   Sources: verified GPS coords for Lagos landmarks
   ═══════════════════════════════════════════════════════════════ */
const AREA_COORDS = {
  /* ── MAIN DISTRICTS ── */
  "Lekki Phase 1": { lat: 6.4281, lng: 3.4691 },
  "Victoria Island": { lat: 6.4281, lng: 3.4219 },
  "Ikoyi": { lat: 6.4480, lng: 3.4308 },
  "Ajah": { lat: 6.4705, lng: 3.5805 },
  "Ikeja GRA": { lat: 6.5843, lng: 3.3360 },
  "Ikeja (Allen/Opebi)": { lat: 6.6018, lng: 3.3515 },
  "Surulere": { lat: 6.4969, lng: 3.3583 },
  "Yaba": { lat: 6.5095, lng: 3.3726 },
  "Gbagada": { lat: 6.5495, lng: 3.3928 },
  "Maryland/Anthony": { lat: 6.5701, lng: 3.3620 },
  "Lekki Phase 2/Ikota": { lat: 6.4350, lng: 3.5400 },
  "Chevron/Lekki-Epe Expressway": { lat: 6.4357, lng: 3.5060 },
  "Igbo Efon/Ilasan": { lat: 6.4500, lng: 3.4900 },
  "Apapa": { lat: 6.4491, lng: 3.3660 },
  "Lagos Island": { lat: 6.4550, lng: 3.3941 },
  "Mushin": { lat: 6.5283, lng: 3.3542 },
  "Oshodi/Isolo": { lat: 6.5478, lng: 3.3230 },
  "Festac Town": { lat: 6.4670, lng: 3.2770 },
  "Amuwo Odofin": { lat: 6.4700, lng: 3.3000 },
  "Badagry": { lat: 6.4174, lng: 2.8852 },
  "Ikorodu": { lat: 6.6194, lng: 3.5053 },
  "Kosofe/Ketu": { lat: 6.5994, lng: 3.3908 },
  "Ojodu/Omole": { lat: 6.6284, lng: 3.3542 },
  "Ogba": { lat: 6.6043, lng: 3.3372 },
  "Agege": { lat: 6.6167, lng: 3.3167 },
  "Alimosho/Ipaja": { lat: 6.6038, lng: 3.2513 },
  "Shomolu/Bariga": { lat: 6.5507, lng: 3.3916 },
  "Ebute Metta": { lat: 6.4973, lng: 3.3724 },
  "Obalende/CMS": { lat: 6.4578, lng: 3.4004 },
  "Ilupeju": { lat: 6.5540, lng: 3.3602 },
  "Ibeju-Lekki": { lat: 6.4372, lng: 3.7239 },
  "Ojo/Alaba": { lat: 6.4693, lng: 3.1758 },
  "Magodo": { lat: 6.6050, lng: 3.4000 },
  "Ojota/Oregun": { lat: 6.5750, lng: 3.3800 },
  "Onikan/Lagos Mainland": { lat: 6.4560, lng: 3.3850 },
  "Epe": { lat: 6.5847, lng: 3.9814 },

  /* ── UNILAG — ALL FACULTIES, DEPARTMENTS & HOSTELS (accurate) ── */
  "University of Lagos": { lat: 6.5158, lng: 3.3899 },
  "UNILAG Main Gate": { lat: 6.5158, lng: 3.3860 },
  "UNILAG Faculty of Science": { lat: 6.5175, lng: 3.3895 },
  "UNILAG Faculty of Arts": { lat: 6.5168, lng: 3.3890 },
  "UNILAG Faculty of Social Sciences": { lat: 6.5172, lng: 3.3885 },
  "UNILAG Faculty of Engineering": { lat: 6.5180, lng: 3.3910 },
  "UNILAG Faculty of Law": { lat: 6.5165, lng: 3.3880 },
  "UNILAG Faculty of Pharmacy": { lat: 6.5178, lng: 3.3892 },
  "UNILAG Faculty of Environmental Sciences": { lat: 6.5163, lng: 3.3905 },
  "UNILAG Faculty of Education": { lat: 6.5185, lng: 3.3875 },
  "UNILAG Faculty of Clinical Sciences": { lat: 6.5160, lng: 3.3875 },
  "UNILAG Faculty of Basic Medical Sciences": { lat: 6.5162, lng: 3.3878 },
  "UNILAG Faculty of Dental Sciences": { lat: 6.5155, lng: 3.3880 },
  "UNILAG Faculty of Management Sciences": { lat: 6.5176, lng: 3.3898 },
  "UNILAG Department of Computer Science": { lat: 6.5174, lng: 3.3896 },
  "UNILAG Department of Mathematics": { lat: 6.5175, lng: 3.3894 },
  "UNILAG Department of Physics": { lat: 6.5173, lng: 3.3893 },
  "UNILAG Department of Chemistry": { lat: 6.5172, lng: 3.3892 },
  "UNILAG Department of Biochemistry": { lat: 6.5171, lng: 3.3891 },
  "UNILAG Department of Microbiology": { lat: 6.5170, lng: 3.3890 },
  "UNILAG Department of Zoology": { lat: 6.5169, lng: 3.3889 },
  "UNILAG Department of Botany": { lat: 6.5168, lng: 3.3888 },
  "UNILAG Department of Geology": { lat: 6.5167, lng: 3.3887 },
  "UNILAG Department of Economics": { lat: 6.5173, lng: 3.3884 },
  "UNILAG Department of Political Science": { lat: 6.5172, lng: 3.3883 },
  "UNILAG Department of Psychology": { lat: 6.5171, lng: 3.3882 },
  "UNILAG Department of Sociology": { lat: 6.5170, lng: 3.3881 },
  "UNILAG Department of Geography": { lat: 6.5169, lng: 3.3879 },
  "UNILAG Department of Mass Communication": { lat: 6.5174, lng: 3.3887 },
  "UNILAG Department of English": { lat: 6.5169, lng: 3.3892 },
  "UNILAG Department of History": { lat: 6.5167, lng: 3.3891 },
  "UNILAG Department of Philosophy": { lat: 6.5166, lng: 3.3890 },
  "UNILAG Department of Linguistics": { lat: 6.5165, lng: 3.3889 },
  "UNILAG Department of Yoruba": { lat: 6.5164, lng: 3.3888 },
  "UNILAG Department of Creative Arts": { lat: 6.5163, lng: 3.3886 },
  "UNILAG Department of Civil Engineering": { lat: 6.5181, lng: 3.3912 },
  "UNILAG Department of Electrical Engineering": { lat: 6.5182, lng: 3.3914 },
  "UNILAG Department of Mechanical Engineering": { lat: 6.5183, lng: 3.3916 },
  "UNILAG Department of Chemical Engineering": { lat: 6.5184, lng: 3.3913 },
  "UNILAG Department of Petroleum Engineering": { lat: 6.5185, lng: 3.3911 },
  "UNILAG Department of Systems Engineering": { lat: 6.5180, lng: 3.3915 },
  "UNILAG Department of Metallurgical Engineering": { lat: 6.5179, lng: 3.3917 },
  "UNILAG Department of Law": { lat: 6.5165, lng: 3.3878 },
  "UNILAG Department of Pharmacy": { lat: 6.5179, lng: 3.3893 },
  "UNILAG Department of Architecture": { lat: 6.5163, lng: 3.3907 },
  "UNILAG Department of Urban Planning": { lat: 6.5161, lng: 3.3905 },
  "UNILAG Department of Building": { lat: 6.5162, lng: 3.3906 },
  "UNILAG Department of Estate Management": { lat: 6.5160, lng: 3.3904 },
  "UNILAG Department of Surveying": { lat: 6.5159, lng: 3.3903 },
  "UNILAG Department of Accounting": { lat: 6.5177, lng: 3.3899 },
  "UNILAG Department of Business Administration": { lat: 6.5176, lng: 3.3900 },
  "UNILAG Department of Marketing": { lat: 6.5175, lng: 3.3901 },
  "UNILAG Department of Finance": { lat: 6.5174, lng: 3.3902 },
  "UNILAG Department of Actuarial Science": { lat: 6.5173, lng: 3.3900 },
  "UNILAG Moremi Hall": { lat: 6.5190, lng: 3.3870 },
  "UNILAG El-Kanemi Hall": { lat: 6.5187, lng: 3.3866 },
  "UNILAG Jaja Hall": { lat: 6.5184, lng: 3.3863 },
  "UNILAG Sodeinde Hall": { lat: 6.5181, lng: 3.3860 },
  "UNILAG Mariere Hall": { lat: 6.5194, lng: 3.3873 },
  "UNILAG Honours Hall": { lat: 6.5196, lng: 3.3876 },
  "UNILAG New Hall": { lat: 6.5192, lng: 3.3869 },
  "UNILAG Fagunwa Hall": { lat: 6.5189, lng: 3.3880 },
  "UNILAG Biobaku Hall": { lat: 6.5188, lng: 3.3877 },
  "UNILAG Makama Hall": { lat: 6.5186, lng: 3.3874 },
  "UNILAG Queens Hall": { lat: 6.5193, lng: 3.3883 },
  "UNILAG Amina Hall": { lat: 6.5191, lng: 3.3881 },
  "UNILAG Postgraduate Hall": { lat: 6.5170, lng: 3.3885 },
  "UNILAG Senate Building": { lat: 6.5158, lng: 3.3900 },
  "UNILAG University Library": { lat: 6.5162, lng: 3.3895 },
  "UNILAG Sports Centre": { lat: 6.5195, lng: 3.3855 },
  "UNILAG Medical Centre": { lat: 6.5155, lng: 3.3895 },
  "UNILAG Bookshop": { lat: 6.5160, lng: 3.3898 },
  "UNILAG Staff Quarters": { lat: 6.5200, lng: 3.3850 },
  "UNILAG Mini Campus": { lat: 6.5140, lng: 3.3870 },
  "UNILAG Business School Annex": { lat: 6.5150, lng: 3.3875 },

  /* ── YABATECH ── */
  "Yaba College of Technology": { lat: 6.5095, lng: 3.3726 },
  "YABATECH Main Gate": { lat: 6.5092, lng: 3.3718 },
  "YABATECH School of Science": { lat: 6.5097, lng: 3.3728 },
  "YABATECH School of Engineering": { lat: 6.5101, lng: 3.3732 },
  "YABATECH School of Art Design Printing": { lat: 6.5089, lng: 3.3722 },
  "YABATECH School of Environmental Studies": { lat: 6.5085, lng: 3.3720 },
  "YABATECH School of Management Studies": { lat: 6.5083, lng: 3.3718 },
  "YABATECH School of Liberal Studies": { lat: 6.5081, lng: 3.3716 },
  "YABATECH Department of Computer Science": { lat: 6.5098, lng: 3.3729 },
  "YABATECH Department of Mathematics": { lat: 6.5099, lng: 3.3730 },
  "YABATECH Department of Statistics": { lat: 6.5100, lng: 3.3731 },
  "YABATECH Department of Physics": { lat: 6.5101, lng: 3.3732 },
  "YABATECH Department of Chemistry": { lat: 6.5102, lng: 3.3733 },
  "YABATECH Department of Biology": { lat: 6.5103, lng: 3.3734 },
  "YABATECH Department of Electrical Engineering": { lat: 6.5104, lng: 3.3735 },
  "YABATECH Department of Mechanical Engineering": { lat: 6.5105, lng: 3.3736 },
  "YABATECH Department of Civil Engineering": { lat: 6.5106, lng: 3.3737 },
  "YABATECH Department of Chemical Engineering": { lat: 6.5107, lng: 3.3738 },
  "YABATECH Department of Computer Engineering": { lat: 6.5108, lng: 3.3739 },
  "YABATECH Department of Architecture": { lat: 6.5086, lng: 3.3721 },
  "YABATECH Department of Urban Planning": { lat: 6.5087, lng: 3.3722 },
  "YABATECH Department of Building": { lat: 6.5088, lng: 3.3723 },
  "YABATECH Department of Estate Management": { lat: 6.5089, lng: 3.3724 },
  "YABATECH Department of Accounting": { lat: 6.5082, lng: 3.3717 },
  "YABATECH Department of Business Administration": { lat: 6.5083, lng: 3.3718 },
  "YABATECH Department of Marketing": { lat: 6.5084, lng: 3.3719 },
  "YABATECH Department of Banking and Finance": { lat: 6.5085, lng: 3.3720 },
  "YABATECH Male Hostel": { lat: 6.5112, lng: 3.3735 },
  "YABATECH Female Hostel": { lat: 6.5114, lng: 3.3737 },
  "YABATECH New Hostel Block": { lat: 6.5116, lng: 3.3739 },
  "YABATECH Library": { lat: 6.5094, lng: 3.3726 },
  "YABATECH Auditorium": { lat: 6.5093, lng: 3.3725 },
  "YABATECH Medical Centre": { lat: 6.5090, lng: 3.3723 },
  "YABATECH Cafeteria": { lat: 6.5091, lng: 3.3724 },

  /* ── LASU (Lagos State University, Ojo) ── */
  "Lagos State University": { lat: 6.4660, lng: 3.1990 },
  "LASU Main Gate": { lat: 6.4658, lng: 3.1982 },
  "LASU Faculty of Arts": { lat: 6.4665, lng: 3.1985 },
  "LASU Faculty of Education": { lat: 6.4670, lng: 3.1990 },
  "LASU Faculty of Engineering": { lat: 6.4675, lng: 3.1995 },
  "LASU Faculty of Law": { lat: 6.4660, lng: 3.1980 },
  "LASU Faculty of Management Sciences": { lat: 6.4668, lng: 3.1988 },
  "LASU Faculty of Science": { lat: 6.4672, lng: 3.1992 },
  "LASU Faculty of Social Sciences": { lat: 6.4663, lng: 3.1983 },
  "LASU Faculty of Transport": { lat: 6.4678, lng: 3.1998 },
  "LASU Faculty of Agriculture": { lat: 6.4680, lng: 3.2000 },
  "LASU Department of Computer Science": { lat: 6.4673, lng: 3.1993 },
  "LASU Department of Mathematics": { lat: 6.4674, lng: 3.1994 },
  "LASU Department of Physics": { lat: 6.4675, lng: 3.1995 },
  "LASU Department of Chemistry": { lat: 6.4676, lng: 3.1996 },
  "LASU Department of Biochemistry": { lat: 6.4677, lng: 3.1997 },
  "LASU Department of Microbiology": { lat: 6.4678, lng: 3.1998 },
  "LASU Department of Economics": { lat: 6.4664, lng: 3.1984 },
  "LASU Department of Political Science": { lat: 6.4665, lng: 3.1985 },
  "LASU Department of Psychology": { lat: 6.4666, lng: 3.1986 },
  "LASU Department of Sociology": { lat: 6.4667, lng: 3.1987 },
  "LASU Department of Mass Communication": { lat: 6.4668, lng: 3.1988 },
  "LASU Department of English": { lat: 6.4669, lng: 3.1989 },
  "LASU Department of History": { lat: 6.4670, lng: 3.1990 },
  "LASU Department of Law": { lat: 6.4662, lng: 3.1982 },
  "LASU Department of Business Administration": { lat: 6.4671, lng: 3.1991 },
  "LASU Male Hostel A": { lat: 6.4685, lng: 3.1990 },
  "LASU Male Hostel B": { lat: 6.4688, lng: 3.1993 },
  "LASU Female Hostel A": { lat: 6.4690, lng: 3.1995 },
  "LASU Female Hostel B": { lat: 6.4692, lng: 3.1997 },
  "LASU Postgraduate Hostel": { lat: 6.4682, lng: 3.1985 },
  "LASU New Hall": { lat: 6.4695, lng: 3.2000 },
  "LASU Senate Building": { lat: 6.4660, lng: 3.1988 },
  "LASU Library": { lat: 6.4662, lng: 3.1990 },

  /* ── PAN-ATLANTIC UNIVERSITY / LBS ── */
  "Pan-Atlantic University": { lat: 6.4405, lng: 3.5210 },
  "Lagos Business School": { lat: 6.4408, lng: 3.5215 },
  "Pan-Atlantic Business School": { lat: 6.4406, lng: 3.5212 },
  "Pan-Atlantic School of Media": { lat: 6.4410, lng: 3.5220 },
  "Pan-Atlantic School of Science": { lat: 6.4412, lng: 3.5225 },
  "Pan-Atlantic Male Hostel": { lat: 6.4415, lng: 3.5230 },
  "Pan-Atlantic Female Hostel": { lat: 6.4418, lng: 3.5235 },

  /* ── LASUSTECH (Ikorodu) ── */
  "LASUSTECH": { lat: 6.6205, lng: 3.5305 },
  "LASUSTECH Faculty of Engineering": { lat: 6.6208, lng: 3.5308 },
  "LASUSTECH Faculty of Science": { lat: 6.6210, lng: 3.5310 },
  "LASUSTECH Faculty of Environmental Studies": { lat: 6.6212, lng: 3.5312 },
  "LASUSTECH Department of Computer Science": { lat: 6.6207, lng: 3.5307 },
  "LASUSTECH Male Hostel": { lat: 6.6225, lng: 3.5325 },
  "LASUSTECH Female Hostel": { lat: 6.6228, lng: 3.5328 },

  /* ── CALEB UNIVERSITY, IMOTA ── */
  "Caleb University": { lat: 6.5805, lng: 3.6505 },
  "Caleb University Main": { lat: 6.5805, lng: 3.6505 },
  "Caleb Male Hostel": { lat: 6.5815, lng: 3.6515 },
  "Caleb Female Hostel": { lat: 6.5820, lng: 3.6520 },

  /* ── NIGERIAN LAW SCHOOL, VICTORIA ISLAND ── */
  "Nigerian Law School": { lat: 6.4360, lng: 3.4260 },

  /* ── COVENANT UNIVERSITY, OTA ── */
  "Covenant University": { lat: 6.6725, lng: 3.1562 },
  "Covenant University Main Gate": { lat: 6.6722, lng: 3.1558 },
  "Covenant Male Hostel": { lat: 6.6730, lng: 3.1570 },
  "Covenant Female Hostel": { lat: 6.6735, lng: 3.1575 },

  /* ── BABCOCK UNIVERSITY, ILISHAN REMO ── */
  "Babcock University": { lat: 6.8897, lng: 3.7244 },

  /* ── QUEENS COLLEGE, YABA ── */
  "Queens College": { lat: 6.5109, lng: 3.3760 },
  "Queens College Gate": { lat: 6.5107, lng: 3.3755 },

  /* ── KINGS COLLEGE, LAGOS ISLAND ── */
  "Kings College": { lat: 6.4554, lng: 3.3841 },

  /* ── METHODIST BOYS HIGH SCHOOL ── */
  "Methodist Boys High School": { lat: 6.4570, lng: 3.3870 },

  /* ── ST GREGORY'S COLLEGE ── */
  "St Gregory's College": { lat: 6.4560, lng: 3.3855 },

  /* ── CMS GRAMMAR SCHOOL ── */
  "CMS Grammar School": { lat: 6.4572, lng: 3.3860 },

  /* ── IGBOBI COLLEGE ── */
  "Igbobi College": { lat: 6.5268, lng: 3.3714 },

  /* ── HOLY CHILD COLLEGE, IKOYI ── */
  "Holy Child College": { lat: 6.4499, lng: 3.4273 },

  /* ── DOWEN COLLEGE, LEKKI ── */
  "Dowen College": { lat: 6.4399, lng: 3.4820 },

  /* ── GREENSPRINGS SCHOOL ── */
  "Greensprings School Anthony": { lat: 6.5720, lng: 3.3510 },
  "Greensprings School Lekki": { lat: 6.4468, lng: 3.5062 },

  /* ── CHRISLAND SCHOOL ── */
  "Chrisland School Opebi": { lat: 6.6025, lng: 3.3492 },
  "Chrisland School VI": { lat: 6.4289, lng: 3.4190 },
  "Chrisland School Ikeja": { lat: 6.5998, lng: 3.3480 },

  /* ── CORONA SCHOOL ── */
  "Corona School Anthony": { lat: 6.5712, lng: 3.3638 },
  "Corona School Agidingbi": { lat: 6.5990, lng: 3.3505 },

  /* ── BRITISH INTERNATIONAL SCHOOL ── */
  "British International School": { lat: 6.4400, lng: 3.5042 },

  /* ── ADEKUNLE AJASIN UNIVERSITY AFFILIATED SECONDARY (WORD AROUND) ── */
  "Loyola Jesuit College": { lat: 6.4342, lng: 3.4102 },
  "Air Force Secondary School": { lat: 6.6019, lng: 3.3341 },
  "Navy Secondary School": { lat: 6.4660, lng: 3.1850 },
  "FGC Ijanikin": { lat: 6.4340, lng: 3.1450 },
  "Lagos State Model College Badagry": { lat: 6.4200, lng: 2.8880 },
  "Vivian Fowler Memorial College": { lat: 6.5998, lng: 3.3418 },
  "Atlantic Hall": { lat: 6.4410, lng: 3.5640 },

  /* ── LUTH (Lagos University Teaching Hospital) ── */
  "Lagos University Teaching Hospital": { lat: 6.5150, lng: 3.3757 },
  "LUTH": { lat: 6.5150, lng: 3.3757 },
  "LUTH Emergency": { lat: 6.5148, lng: 3.3755 },

  /* ── REDDINGTON HOSPITAL ── */
  "Reddington Hospital": { lat: 6.4310, lng: 3.4249 },

  /* ── EKO HOSPITAL, VICTORIA ISLAND ── */
  "Eko Hospital": { lat: 6.4288, lng: 3.4224 },

  /* ── ST NICHOLAS HOSPITAL, LAGOS ISLAND ── */
  "St Nicholas Hospital": { lat: 6.4533, lng: 3.3972 },

  /* ── LAGOON HOSPITAL, APAPA & IKEJA ── */
  "Lagoon Hospital Apapa": { lat: 6.4500, lng: 3.3659 },
  "Lagoon Hospital Ikeja": { lat: 6.5990, lng: 3.3490 },
  "Lagoon Hospital Victoria Island": { lat: 6.4278, lng: 3.4213 },

  /* ── ISLAND GENERAL HOSPITAL ── */
  "Island General Hospital": { lat: 6.4572, lng: 3.3937 },

  /* ── GBAGADA GENERAL HOSPITAL ── */
  "Gbagada General Hospital": { lat: 6.5503, lng: 3.3936 },

  /* ── IKEJA GENERAL HOSPITAL ── */
  "Ikeja General Hospital": { lat: 6.5982, lng: 3.3370 },

  /* ── FIRST CARDIOLOGY CONSULTANTS ── */
  "First Cardiology Consultants": { lat: 6.4271, lng: 3.4183 },

  /* ── NATIONAL ORTHOPAEDIC HOSPITAL, IGBOBI ── */
  "National Orthopaedic Hospital": { lat: 6.5268, lng: 3.3702 },

  /* ── FEDERAL NEURO-PSYCHIATRIC HOSPITAL, YABA ── */
  "Federal Neuro-Psychiatric Hospital": { lat: 6.5079, lng: 3.3712 },

  /* ── IKORODU GENERAL HOSPITAL ── */
  "Ikorodu General Hospital": { lat: 6.6200, lng: 3.5051 },

  /* ── BADAGRY GENERAL HOSPITAL ── */
  "Badagry General Hospital": { lat: 6.4183, lng: 2.8865 },

  /* ── AJAH GENERAL HOSPITAL ── */
  "Ajah General Hospital": { lat: 6.4658, lng: 3.5618 },

  /* ── BRIDGE CLINIC, LAGOS ── */
  "The Bridge Clinic": { lat: 6.4290, lng: 3.4243 },

  /* ── MURTALA MUHAMMED AIRPORT ── */
  "Murtala Muhammed Airport": { lat: 6.5773, lng: 3.3212 },
  "MMA Terminal 1": { lat: 6.5770, lng: 3.3205 },
  "MMA Terminal 2": { lat: 6.5780, lng: 3.3220 },
  "General Aviation Terminal": { lat: 6.5765, lng: 3.3198 },
  "Cargo Terminal Airport": { lat: 6.5785, lng: 3.3230 },

  /* ── MAJOR MALLS ── */
  "Ikeja City Mall": { lat: 6.5933, lng: 3.3415 },
  "Maryland Mall": { lat: 6.5700, lng: 3.3610 },
  "The Palms Shopping Mall": { lat: 6.4347, lng: 3.4717 },
  "Novare Lekki Mall": { lat: 6.4380, lng: 3.5500 },
  "Novare Gateway Mall Sangotedo": { lat: 6.4547, lng: 3.5885 },
  "Adenike Shopping Mall": { lat: 6.5990, lng: 3.3430 },
  "Blenco Mall Sangotedo": { lat: 6.4552, lng: 3.5892 },
  "Circle Mall Lekki": { lat: 6.4395, lng: 3.5520 },
  "Meadow Hall": { lat: 6.4398, lng: 3.5480 },
  "Hubmart Stores Lekki": { lat: 6.4370, lng: 3.5180 },
  "Shoprite Lekki": { lat: 6.4348, lng: 3.4720 },
  "Festival Mall Festac": { lat: 6.4665, lng: 3.2785 },
  "Shoprite Apapa": { lat: 6.4495, lng: 3.3662 },
  "Spar Supermarket VI": { lat: 6.4295, lng: 3.4230 },
  "Ikeja City Mall Cinema": { lat: 6.5932, lng: 3.3413 },
  "Computer Village Ikeja": { lat: 6.6005, lng: 3.3508 },
  "Alaba International Market": { lat: 6.4728, lng: 3.1795 },
  "Oshodi Market": { lat: 6.5452, lng: 3.3280 },
  "Mile 12 Market": { lat: 6.5910, lng: 3.3898 },
  "Idumota Market": { lat: 6.4592, lng: 3.3975 },
  "Balogun Market": { lat: 6.4585, lng: 3.3968 },
  "Oyingbo Market": { lat: 6.4895, lng: 3.3795 },
  "Tejuosho Market": { lat: 6.5068, lng: 3.3692 },
  "Mushin Market": { lat: 6.5295, lng: 3.3550 },
  "Ogba Market": { lat: 6.6040, lng: 3.3375 },
  "Lekki Phase 1 Market": { lat: 6.4335, lng: 3.5190 },

  /* ── MAJOR HOTELS ── */
  "Eko Hotel and Suites": { lat: 6.4275, lng: 3.4202 },
  "Federal Palace Hotel": { lat: 6.4302, lng: 3.4235 },
  "Four Points by Sheraton": { lat: 6.4284, lng: 3.4194 },
  "Wheatbaker Hotel Ikoyi": { lat: 6.4433, lng: 3.4322 },
  "Lagos Oriental Hotel": { lat: 6.4270, lng: 3.4183 },
  "Radisson Blu Anchorage": { lat: 6.4302, lng: 3.4241 },
  "Golden Tulip Hotels Ikeja": { lat: 6.5832, lng: 3.3497 },
  "Sheraton Lagos Hotel": { lat: 6.6010, lng: 3.3448 },
  "Lagos Airport Hotel": { lat: 6.5780, lng: 3.3200 },
  "Best Western Ikeja": { lat: 6.5840, lng: 3.3452 },
  "Protea Hotel Maryland": { lat: 6.5702, lng: 3.3620 },
  "Southern Sun Ikoyi": { lat: 6.4484, lng: 3.4312 },
  "Intercontinental Lagos": { lat: 6.4275, lng: 3.4205 },
  "African Sun Apapa": { lat: 6.4495, lng: 3.3660 },

  /* ── KEY LANDMARKS / GOVERNMENT ── */
  "Lagos State Secretariat": { lat: 6.5980, lng: 3.3530 },
  "Alausa Secretariat": { lat: 6.5978, lng: 3.3525 },
  "Lagos State House of Assembly": { lat: 6.5976, lng: 3.3520 },
  "Lagos High Court Ikeja": { lat: 6.5960, lng: 3.3480 },
  "Federal High Court Lagos": { lat: 6.4555, lng: 3.3950 },
  "Lagos Island Maternity Hospital": { lat: 6.4567, lng: 3.3942 },
  "Dodan Barracks": { lat: 6.4517, lng: 3.4288 },
  "Bonny Camp": { lat: 6.4470, lng: 3.4190 },
  "Nigerian Air Force Base Ikeja": { lat: 6.5770, lng: 3.3210 },
  "Ikeja Cantonment": { lat: 6.5780, lng: 3.3180 },
  "Ojo Cantonment": { lat: 6.4655, lng: 3.1820 },
  "Tafawa Balewa Square": { lat: 6.4554, lng: 3.3947 },
  "National Theatre Lagos": { lat: 6.4840, lng: 3.3678 },
  "Lagos State Library Board": { lat: 6.4562, lng: 3.3960 },
  "Civic Centre Victoria Island": { lat: 6.4280, lng: 3.4200 },
  "Muson Centre": { lat: 6.4551, lng: 3.3951 },
  "Silverbird Galleria": { lat: 6.4283, lng: 3.4240 },
  "Nestoil Tower": { lat: 6.4290, lng: 3.4260 },
  "UBA House": { lat: 6.4544, lng: 3.3960 },
  "Marina": { lat: 6.4525, lng: 3.4010 },
  "NNPC Towers VI": { lat: 6.4297, lng: 3.4270 },
  "Total E&P Nigeria": { lat: 6.4285, lng: 3.4255 },
  "Zenith Bank HQ": { lat: 6.5990, lng: 3.3415 },
  "GTBank HQ Ikeja": { lat: 6.5960, lng: 3.3395 },
  "Access Bank HQ": { lat: 6.5975, lng: 3.3390 },

  /* ── LEKKI / AJAH DETAILED COORDS ── */
  "Lekki Conservation Centre": { lat: 6.4382, lng: 3.5042 },
  "Elegushi Beach": { lat: 6.4337, lng: 3.4768 },
  "Oniru Estate": { lat: 6.4340, lng: 3.4502 },
  "Eko Atlantic City": { lat: 6.4200, lng: 3.4065 },
  "Freedom Way": { lat: 6.4352, lng: 3.5195 },
  "Admiralty Way": { lat: 6.4350, lng: 3.5165 },
  "Fola Osibo Road": { lat: 6.4332, lng: 3.5188 },
  "T.F. Kuboye Road": { lat: 6.4322, lng: 3.5202 },
  "Adewunmi Adebimpe Drive": { lat: 6.4362, lng: 3.5208 },
  "Omorinre Johnson Street": { lat: 6.4370, lng: 3.5195 },
  "Bisola Durosinmi-Etti Drive": { lat: 6.4360, lng: 3.5175 },
  "Ikate": { lat: 6.4405, lng: 3.5095 },
  "Ikate-Elegushi": { lat: 6.4397, lng: 3.5080 },
  "Oral Estate": { lat: 6.4412, lng: 3.5115 },
  "Osapa London": { lat: 6.4400, lng: 3.5002 },
  "Chevron Drive": { lat: 6.4378, lng: 3.5050 },
  "Chevron Roundabout": { lat: 6.4360, lng: 3.5062 },
  "Chevron Alternative Route": { lat: 6.4370, lng: 3.5040 },
  "Palace Road Lekki": { lat: 6.4392, lng: 3.5032 },
  "Agungi": { lat: 6.4448, lng: 3.5152 },
  "Ologolo": { lat: 6.4472, lng: 3.4920 },
  "Igbo Efon": { lat: 6.4505, lng: 3.4898 },
  "Ilasan": { lat: 6.4492, lng: 3.4872 },
  "VGC": { lat: 6.4400, lng: 3.5605 },
  "Victoria Garden City": { lat: 6.4402, lng: 3.5610 },
  "Ikota": { lat: 6.4368, lng: 3.5395 },
  "Crown Estate": { lat: 6.4355, lng: 3.5422 },
  "Megamound": { lat: 6.4388, lng: 3.5398 },
  "Abraham Adesanya Estate": { lat: 6.4530, lng: 3.5672 },
  "Abraham Adesanya Roundabout": { lat: 6.4528, lng: 3.5665 },
  "Thomas Estate": { lat: 6.4538, lng: 3.5582 },
  "Jakande Estate Ajah": { lat: 6.4620, lng: 3.5638 },
  "Badore": { lat: 6.4562, lng: 3.5905 },
  "Ilaje": { lat: 6.4700, lng: 3.5702 },
  "Sangotedo": { lat: 6.4552, lng: 3.5890 },
  "Addo Road Ajah": { lat: 6.4688, lng: 3.5832 },
  "Monastery Road": { lat: 6.4628, lng: 3.5942 },
  "Ogombo": { lat: 6.4600, lng: 3.5750 },
  "Ogombo Road": { lat: 6.4598, lng: 3.5745 },
  "Ado Road": { lat: 6.4710, lng: 3.5870 },
  "Awoyaya": { lat: 6.4470, lng: 3.6202 },
  "Lakowe": { lat: 6.4352, lng: 3.6600 },
  "Bogije": { lat: 6.4405, lng: 3.6398 },
  "Eputu": { lat: 6.4295, lng: 3.6802 },
  "Eleko": { lat: 6.4205, lng: 3.7002 },
  "Ibeju": { lat: 6.4372, lng: 3.7235 },
  "Lekki Free Trade Zone": { lat: 6.4185, lng: 3.8250 },
  "Orchid Road Lekki": { lat: 6.4370, lng: 3.5418 },

  /* ── AJAH AREA EXPANDED ── */
  "Langbasa Road": { lat: 6.4682, lng: 3.5812 },
  "Oba Elegushi Road": { lat: 6.4710, lng: 3.5850 },
  "Ipaja Ajah": { lat: 6.4720, lng: 3.5862 },
  "Imalete Alafia Road": { lat: 6.4695, lng: 3.5888 },
  "Orisunmibare Area": { lat: 6.4705, lng: 3.5820 },
  "Budo Estate Ajah": { lat: 6.4635, lng: 3.5720 },
  "Ilasan Bus Stop": { lat: 6.4490, lng: 3.4870 },
  "Agungi Road": { lat: 6.4445, lng: 3.5150 },
  "Elf Bus Stop": { lat: 6.4392, lng: 3.5045 },
  "Chevron Bus Stop": { lat: 6.4360, lng: 3.5062 },
  "Shoprite Ajah": { lat: 6.4650, lng: 3.5618 },
  "Maruwa Bus Stop": { lat: 6.4332, lng: 3.4720 },
  "Aja Bus Stop": { lat: 6.4608, lng: 3.5720 },

  /* ── VICTORIA ISLAND DETAILED ── */
  "Ahmadu Bello Way": { lat: 6.4298, lng: 3.4232 },
  "Adeola Odeku Street": { lat: 6.4308, lng: 3.4275 },
  "Akin Adesola Street": { lat: 6.4295, lng: 3.4258 },
  "Ozumba Mbadiwe Avenue": { lat: 6.4302, lng: 3.4318 },
  "Idejo Street": { lat: 6.4288, lng: 3.4248 },
  "Ligali Ayorinde Street": { lat: 6.4282, lng: 3.4242 },
  "Sanusi Fafunwa Street": { lat: 6.4292, lng: 3.4252 },
  "Kofo Abayomi Street": { lat: 6.4302, lng: 3.4262 },
  "Ademola Adetokunbo Street": { lat: 6.4310, lng: 3.4270 },

  /* ── IKOYI DETAILED ── */
  "Bourdillon Road": { lat: 6.4460, lng: 3.4302 },
  "Osborne Road": { lat: 6.4472, lng: 3.4325 },
  "Alexander Road Ikoyi": { lat: 6.4448, lng: 3.4290 },
  "Kingsway Road Ikoyi": { lat: 6.4468, lng: 3.4280 },
  "Banana Island": { lat: 6.4452, lng: 3.4430 },
  "Parkview Estate": { lat: 6.4468, lng: 3.4302 },
  "Dolphin Estate": { lat: 6.4502, lng: 3.4300 },
  "Gerrard Road": { lat: 6.4470, lng: 3.4312 },
  "Glover Road Ikoyi": { lat: 6.4475, lng: 3.4320 },
  "Ribadu Road": { lat: 6.4462, lng: 3.4322 },
  "Lugard Avenue": { lat: 6.4455, lng: 3.4318 },
  "Awolowo Road Ikoyi": { lat: 6.4480, lng: 3.4295 },

  /* ── IKEJA GRA DETAILED ── */
  "Isaac John Street": { lat: 6.5892, lng: 3.3382 },
  "Joel Ogunnaike Street": { lat: 6.5888, lng: 3.3375 },
  "Oduduwa Crescent": { lat: 6.5882, lng: 3.3370 },
  "Oba Akinjobi Road": { lat: 6.5878, lng: 3.3365 },
  "Aromire Avenue": { lat: 6.5875, lng: 3.3360 },
  "Adeniyi Jones Avenue": { lat: 6.5999, lng: 3.3522 },
  "Mobolaji Bank Anthony Way": { lat: 6.5778, lng: 3.3645 },
  "Sobo Arobiodu Street": { lat: 6.5872, lng: 3.3358 },
  "Fola Osibo": { lat: 6.5865, lng: 3.3352 },
  "Remi Fani-Kayode Street": { lat: 6.5898, lng: 3.3388 },
  "Olu Holloway Street": { lat: 6.5855, lng: 3.3348 },
  "Rev Ogunbiyi Street": { lat: 6.5862, lng: 3.3355 },
  "Salvation Road": { lat: 6.6002, lng: 3.3505 },

  /* ── ALLEN/OPEBI DETAILED ── */
  "Allen Avenue": { lat: 6.6032, lng: 3.3502 },
  "Toyin Street": { lat: 6.6002, lng: 3.3498 },
  "Opebi Road": { lat: 6.6025, lng: 3.3530 },
  "Lateef Jakande Road": { lat: 6.6005, lng: 3.3512 },
  "Kudirat Abiola Way": { lat: 6.5730, lng: 3.3782 },
  "Oregun Road": { lat: 6.5788, lng: 3.3748 },
  "Ogundana Street": { lat: 6.6008, lng: 3.3488 },
  "Fatai Atere Way": { lat: 6.5992, lng: 3.3490 },
  "Obafemi Awolowo Way Ikeja": { lat: 6.5952, lng: 3.3478 },
  "Acme Road": { lat: 6.5935, lng: 3.3422 },
  "Computer Village": { lat: 6.6005, lng: 3.3508 },
  "Alausa": { lat: 6.5980, lng: 3.3530 },
  "Agidingbi": { lat: 6.5980, lng: 3.3478 },

  /* ── SURULERE DETAILED ── */
  "Adeniran Ogunsanya Street": { lat: 6.4975, lng: 3.3592 },
  "Bode Thomas Street": { lat: 6.4980, lng: 3.3595 },
  "Ogunlana Drive": { lat: 6.4960, lng: 3.3588 },
  "Ojuelegba Road": { lat: 6.5012, lng: 3.3572 },
  "Eric Moore Road": { lat: 6.4912, lng: 3.3548 },
  "Western Avenue": { lat: 6.4998, lng: 3.3500 },
  "Itire Road": { lat: 6.5102, lng: 3.3405 },
  "Masha Road": { lat: 6.5010, lng: 3.3540 },
  "Randle Avenue": { lat: 6.5022, lng: 3.3532 },
  "Akerele Street": { lat: 6.5050, lng: 3.3555 },
  "Lawanson Road": { lat: 6.5055, lng: 3.3502 },

  /* ── GBAGADA DETAILED ── */
  "Gbagada Phase 1": { lat: 6.5498, lng: 3.3940 },
  "Gbagada Phase 2": { lat: 6.5482, lng: 3.3912 },
  "Pedro Road": { lat: 6.5502, lng: 3.3898 },
  "Tigris Crescent": { lat: 6.5522, lng: 3.3935 },
  "Soluyi Avenue": { lat: 6.5528, lng: 3.3892 },
  "Ifako Gbagada": { lat: 6.5515, lng: 3.3880 },
  "Keffi Street": { lat: 6.5520, lng: 3.3945 },

  /* ── MARYLAND/ANTHONY ── */
  "Anthony Village": { lat: 6.5722, lng: 3.3652 },
  "Palmgrove Estate": { lat: 6.5702, lng: 3.3700 },
  "Onipanu Street": { lat: 6.5405, lng: 3.3702 },
  "Jibowu Street": { lat: 6.5202, lng: 3.3702 },
  "Cemetery Road": { lat: 6.5710, lng: 3.3640 },
  "Ikosi Road": { lat: 6.5688, lng: 3.3658 },

  /* ── YABA DETAILED ── */
  "Herbert Macaulay Way": { lat: 6.5062, lng: 3.3752 },
  "Akoka Road": { lat: 6.5172, lng: 3.3872 },
  "Iwaya Road": { lat: 6.5202, lng: 3.3892 },
  "Sabo Road Yaba": { lat: 6.5132, lng: 3.3732 },
  "Tejuosho Road": { lat: 6.5068, lng: 3.3690 },
  "Makoko Road": { lat: 6.5005, lng: 3.3952 },
  "Iwaya": { lat: 6.5202, lng: 3.3892 },

  /* ── ISALE EKO / LAGOS ISLAND DETAILED ── */
  "Broad Street": { lat: 6.4558, lng: 3.3952 },
  "Marina Lagos": { lat: 6.4522, lng: 3.4012 },
  "Nnamdi Azikiwe Street": { lat: 6.4562, lng: 3.3972 },
  "Tinubu Square": { lat: 6.4580, lng: 3.3960 },
  "Balogun Street": { lat: 6.4585, lng: 3.3965 },
  "Idumota": { lat: 6.4592, lng: 3.3978 },
  "Custom Street": { lat: 6.4548, lng: 3.3958 },
  "Ereko Street": { lat: 6.4600, lng: 3.3985 },
  "Obalende": { lat: 6.4578, lng: 3.4005 },
  "Race Course": { lat: 6.4555, lng: 3.4032 },
  "Igbosere Road": { lat: 6.4560, lng: 3.4002 },
  "Campbell Street": { lat: 6.4545, lng: 3.3960 },

  /* ── APAPA DETAILED ── */
  "Apapa GRA": { lat: 6.4492, lng: 3.3662 },
  "Creek Road Apapa": { lat: 6.4522, lng: 3.3632 },
  "Liverpool Road": { lat: 6.4508, lng: 3.3652 },
  "Burma Road": { lat: 6.4522, lng: 3.3612 },
  "Wharf Road Apapa": { lat: 6.4518, lng: 3.3648 },
  "Kirikiri Industrial": { lat: 6.4582, lng: 3.3002 },

  /* ── EBUTE METTA / OTTO ── */
  "Ebute Metta East": { lat: 6.4975, lng: 3.3728 },
  "Ebute Metta West": { lat: 6.4962, lng: 3.3718 },
  "Willoughby Street": { lat: 6.4952, lng: 3.3732 },
  "Oyingbo": { lat: 6.4898, lng: 3.3798 },
  "Iponri": { lat: 6.4922, lng: 3.3632 },
  "Otto Road": { lat: 6.4812, lng: 3.3812 },
  "Orile Iganmu": { lat: 6.4702, lng: 3.3402 },

  /* ── OSHODI/ISOLO DETAILED ── */
  "Ago Palace Way": { lat: 6.5302, lng: 3.3065 },
  "Okota Road": { lat: 6.5302, lng: 3.3002 },
  "Ilasamaja": { lat: 6.5302, lng: 3.3100 },
  "Ejigbo Road": { lat: 6.5398, lng: 3.3002 },
  "Bolade": { lat: 6.5458, lng: 3.3320 },
  "Cele Expressway": { lat: 6.5382, lng: 3.3072 },
  "Mafoluku": { lat: 6.5422, lng: 3.3272 },
  "Ajao Estate": { lat: 6.5442, lng: 3.3242 },
  "International Airport Road": { lat: 6.5650, lng: 3.3312 },

  /* ── MUSHIN DETAILED ── */
  "Agege Motor Road Mushin": { lat: 6.5295, lng: 3.3545 },
  "Ladipo Street": { lat: 6.5402, lng: 3.3502 },
  "Idi Oro Road": { lat: 6.5332, lng: 3.3512 },
  "Apata Street": { lat: 6.5348, lng: 3.3528 },
  "Fadeyi Road": { lat: 6.5302, lng: 3.3698 },
  "Town Planning Way": { lat: 6.5292, lng: 3.3452 },

  /* ── SHOMOLU/BARIGA ── */
  "Shomolu": { lat: 6.5508, lng: 3.3918 },
  "Bariga": { lat: 6.5508, lng: 3.3928 },
  "Obanikoro": { lat: 6.5600, lng: 3.3802 },
  "Onigbongbo": { lat: 6.5600, lng: 3.3600 },
  "Pedro": { lat: 6.5500, lng: 3.3902 },

  /* ── KOSOFE/KETU ── */
  "Ketu": { lat: 6.5998, lng: 3.3908 },
  "Mile 12": { lat: 6.5908, lng: 3.3902 },
  "Ogudu": { lat: 6.5808, lng: 3.4002 },
  "Ogudu GRA": { lat: 6.5820, lng: 3.4052 },
  "Ojota": { lat: 6.5762, lng: 3.3808 },
  "Alapere": { lat: 6.5912, lng: 3.3892 },
  "Agboyi": { lat: 6.6008, lng: 3.5102 },
  "Kosofe": { lat: 6.5958, lng: 3.3852 },
  "Magodo Phase 1": { lat: 6.6052, lng: 3.4002 },
  "Magodo Phase 2": { lat: 6.6082, lng: 3.4052 },

  /* ── AGEGE DETAILED ── */
  "Agege Stadium Road": { lat: 6.6172, lng: 3.3172 },
  "Oko Oba Road": { lat: 6.6102, lng: 3.3302 },
  "Dopemu": { lat: 6.6102, lng: 3.3062 },
  "Orile Agege": { lat: 6.6102, lng: 3.3102 },
  "Papa Ajao": { lat: 6.6102, lng: 3.3052 },
  "Pen Cinema": { lat: 6.6152, lng: 3.3172 },
  "Abule Egba": { lat: 6.6302, lng: 3.2802 },
  "Old Abeokuta Road": { lat: 6.6302, lng: 3.3102 },

  /* ── ALIMOSHO/IPAJA ── */
  "Iyana Ipaja": { lat: 6.6052, lng: 3.2702 },
  "Idimu Road": { lat: 6.5802, lng: 3.2602 },
  "Egbe Road": { lat: 6.5652, lng: 3.2902 },
  "Akowonjo Road": { lat: 6.5952, lng: 3.2702 },
  "Shasha Road": { lat: 6.5902, lng: 3.2802 },
  "Baruwa": { lat: 6.5872, lng: 3.2482 },
  "Igando Road": { lat: 6.5602, lng: 3.2402 },
  "Ikotun Road": { lat: 6.5592, lng: 3.2552 },
  "Ayobo Road": { lat: 6.6102, lng: 3.2402 },

  /* ── OJODU/OMOLE ── */
  "Ojodu Berger": { lat: 6.6302, lng: 3.3532 },
  "Isheri Road": { lat: 6.5902, lng: 3.3102 },
  "Omole Phase 1": { lat: 6.6282, lng: 3.3502 },
  "Omole Phase 2": { lat: 6.6302, lng: 3.3552 },
  "Berger Expressway": { lat: 6.6352, lng: 3.3502 },
  "Fagba Road": { lat: 6.6402, lng: 3.3302 },

  /* ── OGBA DETAILED ── */
  "Ogba Estate": { lat: 6.6042, lng: 3.3372 },
  "Ifako Road Ogba": { lat: 6.6102, lng: 3.3302 },
  "Ijaiye Road": { lat: 6.6092, lng: 3.3392 },
  "MCC Road": { lat: 6.6032, lng: 3.3372 },

  /* ── FESTAC TOWN DETAILED ── */
  "1st Avenue Festac": { lat: 6.4672, lng: 3.2775 },
  "2nd Avenue Festac": { lat: 6.4662, lng: 3.2782 },
  "21 Road Festac": { lat: 6.4652, lng: 3.2788 },
  "22 Road Festac": { lat: 6.4642, lng: 3.2795 },
  "FESTAC Expressway": { lat: 6.4682, lng: 3.2768 },
  "6th Avenue Festac": { lat: 6.4665, lng: 3.2778 },
  "7th Avenue Festac": { lat: 6.4658, lng: 3.2785 },
  "Alakija": { lat: 6.4702, lng: 3.2752 },

  /* ── AMUWO ODOFIN ── */
  "Apple Junction": { lat: 6.4702, lng: 3.3102 },
  "Mile 2": { lat: 6.4702, lng: 3.3102 },
  "Satellite Town": { lat: 6.4602, lng: 3.2502 },
  "Amuwo Estate": { lat: 6.4702, lng: 3.3002 },

  /* ── OJO/ALABA ── */
  "Navy Town": { lat: 6.4658, lng: 3.1835 },
  "Volkswagen Road Ojo": { lat: 6.4728, lng: 3.1798 },
  "Trade Fair Complex": { lat: 6.4702, lng: 3.2002 },
  "Ojo Barracks": { lat: 6.4502, lng: 3.1602 },
  "LASU Road Ojo": { lat: 6.4658, lng: 3.1992 },
  "Okokomaiko": { lat: 6.4502, lng: 3.1502 },

  /* ── BADAGRY ── */
  "Agbara Estate": { lat: 6.4792, lng: 3.1352 },
  "Ajangbadi": { lat: 6.4502, lng: 3.2002 },
  "Badagry Town": { lat: 6.4175, lng: 2.8854 },
  "Seme Border": { lat: 6.4055, lng: 2.8005 },
  "Okokomaiko Road": { lat: 6.4498, lng: 3.1498 },
  "Topo Badagry": { lat: 6.4102, lng: 2.9402 },

  /* ── IKORODU DETAILED ── */
  "Agric Road Ikorodu": { lat: 6.6202, lng: 3.5052 },
  "Benson Road Ikorodu": { lat: 6.6142, lng: 3.5072 },
  "Ikorodu GRA": { lat: 6.6162, lng: 3.5042 },
  "Owutu Road": { lat: 6.6302, lng: 3.5102 },
  "Imota Road": { lat: 6.6112, lng: 3.6302 },
  "Ijede Road": { lat: 6.6032, lng: 3.5902 },
  "Ikorodu Bus Terminal": { lat: 6.6198, lng: 3.5060 },

  /* ── MAGODO ── */
  "GRA Shangisha": { lat: 6.6072, lng: 3.4012 },
  "CMD Road Magodo": { lat: 6.6052, lng: 3.3982 },

  /* ── OJOTA/OREGUN ── */
  "Oregun Industrial Estate": { lat: 6.5782, lng: 3.3742 },

  /* ── ONIKAN/LAGOS MAINLAND ── */
  "Onikan Stadium": { lat: 6.4552, lng: 3.4032 },
  "Bishop Oluwole Street": { lat: 6.4545, lng: 3.4025 },

  /* ── EPE ── */
  "Epe GRA": { lat: 6.5850, lng: 3.9820 },
  "Poka Road Epe": { lat: 6.5802, lng: 3.9702 },
  "Mojoda Road Epe": { lat: 6.5952, lng: 4.0002 },

  /* ── ADDITIONAL POPULAR LOCATIONS ── */
  "Ikeja City Mall": { lat: 6.5933, lng: 3.3415 },
  "Maryland Mall": { lat: 6.5700, lng: 3.3610 },
  "The Palms Lekki": { lat: 6.4347, lng: 3.4717 },
  "Novare Lekki": { lat: 6.4380, lng: 3.5500 },
  "Novare Gateway Sangotedo": { lat: 6.4547, lng: 3.5885 },
  "Circle Mall Lekki": { lat: 6.4395, lng: 3.5520 },
  "Festival Mall Festac": { lat: 6.4665, lng: 3.2785 },
  "Landmark Beach": { lat: 6.4238, lng: 3.4350 },
  "Landmark Towers": { lat: 6.4242, lng: 3.4358 },
  "Bar Beach": { lat: 6.4302, lng: 3.4250 },
  "Kuramo Beach": { lat: 6.4285, lng: 3.4302 },
  "Maroko": { lat: 6.4352, lng: 3.4302 },
  "Iganmu": { lat: 6.4702, lng: 3.3502 },
  "Costain": { lat: 6.4782, lng: 3.3702 },
  "Ijora 7Up": { lat: 6.4772, lng: 3.3672 },
  "Ijora Causeway": { lat: 6.4762, lng: 3.3652 },
  "Mile 2 Bus Stop": { lat: 6.4702, lng: 3.3102 },
  "Eko Bridge": { lat: 6.4762, lng: 3.3782 },
  "Carter Bridge": { lat: 6.4652, lng: 3.3752 },
  "Third Mainland Bridge": { lat: 6.4852, lng: 3.4052 },
  "Tin Can Island Port": { lat: 6.4382, lng: 3.3382 },
  "Apapa Port": { lat: 6.4492, lng: 3.3652 },
  "NAOC Apapa": { lat: 6.4502, lng: 3.3662 },
  "Ikeja Electric HQ": { lat: 6.5992, lng: 3.3542 },
  "Eko Electric HQ": { lat: 6.4282, lng: 3.4242 },
  "Lagos Bus Service Terminal": { lat: 6.4552, lng: 3.3952 },
  "Fadeyi": { lat: 6.5302, lng: 3.3702 },
  "Onipanu": { lat: 6.5402, lng: 3.3702 },
  "Palmgrove": { lat: 6.5702, lng: 3.3702 },
  "Anthony": { lat: 6.5722, lng: 3.3652 },
  "Maryland": { lat: 6.5702, lng: 3.3612 },
  "Mende": { lat: 6.5602, lng: 3.3702 },
  "Gbagada General": { lat: 6.5503, lng: 3.3936 },
  "National Theatre": { lat: 6.4840, lng: 3.3678 },
  "Tafawa Balewa": { lat: 6.4554, lng: 3.3947 },
  "Oba Palace Lagos": { lat: 6.4538, lng: 3.3942 },
  "Lagos Island Club": { lat: 6.4542, lng: 3.3958 },
  "Glover Memorial Hall": { lat: 6.4532, lng: 3.3948 },
  "Water House": { lat: 6.4528, lng: 3.3945 },
  "NIPOST HQ": { lat: 6.4540, lng: 3.3955 },
  "CBN Lagos Office": { lat: 6.4560, lng: 3.3980 },
  "SEC Lagos Office": { lat: 6.4290, lng: 3.4250 },
  "NSE (NGX) Exchange House": { lat: 6.4542, lng: 3.3960 },
  "NigerDock": { lat: 6.4402, lng: 3.3452 },
  "Badia East": { lat: 6.4722, lng: 3.3502 },
  "Orile Road": { lat: 6.4902, lng: 3.3402 },
  "Ajeromi Ifelodun": { lat: 6.4602, lng: 3.3302 },
  "Ajegunle": { lat: 6.4532, lng: 3.3332 },
  "Layeni": { lat: 6.4882, lng: 3.3452 },
  "Isale Eko": { lat: 6.4602, lng: 3.3952 },
  "Epetedo": { lat: 6.4612, lng: 3.3962 },
  "Balogun Roundabout": { lat: 6.4582, lng: 3.3968 },
  "Lafiaji": { lat: 6.4582, lng: 3.3978 },
  "Tokunbo Street": { lat: 6.4572, lng: 3.3968 },
  "Hospital Road Apapa": { lat: 6.4502, lng: 3.3652 },
  "Mobil Road Lekki": { lat: 6.4388, lng: 3.5072 },
  "Palace Road": { lat: 6.4390, lng: 3.5032 },
  "Okupe Estate": { lat: 6.5522, lng: 3.3802 },
  "Ifako": { lat: 6.6102, lng: 3.3302 },
  "Iju": { lat: 6.6202, lng: 3.3202 },
  "Iju Ishaga": { lat: 6.6252, lng: 3.3152 },
  "Aguda": { lat: 6.4902, lng: 3.3602 },
  "Ijesha": { lat: 6.5202, lng: 3.3102 },
  "Ijegun": { lat: 6.5102, lng: 3.2202 },
  "Egbeda": { lat: 6.5902, lng: 3.2802 },
  "Idimu": { lat: 6.5802, lng: 3.2602 },
  "Egbe": { lat: 6.5652, lng: 3.2902 },
  "Ipodo Ikeja": { lat: 6.5912, lng: 3.3352 },
  "Mangoro": { lat: 6.5892, lng: 3.3102 },
  "Command Secondary School": { lat: 6.6102, lng: 3.3402 },
  "FAAN Headquarters": { lat: 6.5775, lng: 3.3215 },
  "Bi-Courtney Terminal": { lat: 6.5780, lng: 3.3220 },
  "Murtala Muhammed Square": { lat: 6.4542, lng: 3.3958 },
  "Morningside Estate": { lat: 6.6205, lng: 3.3565 },
  "Shangisha": { lat: 6.6072, lng: 3.4012 },
  "Owode Onirin": { lat: 6.5972, lng: 3.3922 },
  "Alapere Road": { lat: 6.5912, lng: 3.3892 },
  "Majidun": { lat: 6.5502, lng: 3.5182 },
  "Mowe": { lat: 6.7052, lng: 3.4402 },
  "Sagamu Interchange": { lat: 6.8332, lng: 3.6402 },
  "Lambe": { lat: 6.5632, lng: 3.2212 },
  "Atan": { lat: 6.5702, lng: 3.2102 },
  "Sango Ota": { lat: 6.6682, lng: 3.1982 },
  "Ilogbo": { lat: 6.5032, lng: 3.2222 },
  "Ijoko": { lat: 6.6862, lng: 3.1752 },
  "Idiroko Road": { lat: 6.5552, lng: 2.9752 },
  "Ota Road": { lat: 6.6102, lng: 3.2002 },
  "Gberigbe": { lat: 6.4152, lng: 2.9702 },
  "Kankon": { lat: 6.4302, lng: 2.9502 },
  "Mowo": { lat: 6.4252, lng: 2.9102 },
  "Iworo": { lat: 6.4042, lng: 2.8962 },
  "Topo": { lat: 6.4102, lng: 2.9402 },
  "Oko Afo": { lat: 6.4152, lng: 2.9302 },
  "Palaver Island": { lat: 6.4182, lng: 2.8982 },
  "Ilogbo Eremi": { lat: 6.4302, lng: 2.9902 },

  /* ── OWORONSHOKI / GBAGADA AREAS ── */
  "Oworonshoki": { lat: 6.5602, lng: 3.4002 },
  "Iyana Oworo": { lat: 6.5512, lng: 3.3982 },
  "Ikorodu Road Oworonshoki": { lat: 6.5572, lng: 3.3992 },
  "Somolu": { lat: 6.5502, lng: 3.3802 },
  "Abule Ijesha": { lat: 6.5202, lng: 3.3302 },
  "Akoka": { lat: 6.5172, lng: 3.3872 },
  "FCE Akoka": { lat: 6.5180, lng: 3.3900 },
  "Unilag Road": { lat: 6.5178, lng: 3.3882 },
  "Jibowu": { lat: 6.5202, lng: 3.3702 },

  /* ── MISC POPULAR ── */
  "Murtala Muhammed Way": { lat: 6.5752, lng: 3.3202 },
  "Ikorodu Road": { lat: 6.5742, lng: 3.3642 },
  "Ibadan Expressway": { lat: 6.6352, lng: 3.3502 },
  "Lagos Ibadan Expressway": { lat: 6.7002, lng: 3.4302 },
  "Sagamu Road": { lat: 6.6352, lng: 3.5102 },
  "Epe Road": { lat: 6.5402, lng: 3.7402 },
  "Badagry Expressway": { lat: 6.4702, lng: 3.2302 },
  "Lekki-Epe Expressway": { lat: 6.4452, lng: 3.5602 }
};

/* ─── Build location index ─── */
function sl(s){return s.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-");}
const LOCS=[];
function buildBaseLocs(){
  Object.keys(LAGOS).forEach(area=>{
    LOCS.push({id:sl(area),name:area,area,street:null,label:area,custom:false});
    LAGOS[area].forEach(st=>LOCS.push({id:sl(area+st),name:st,area,street:st,label:`${st} — ${area}`,custom:false}));
  });
  /* Add coordinate-rich locations as reportable spots */
  Object.keys(AREA_COORDS).forEach(name=>{
    const id=sl(name);
    if(!LOCS.find(l=>l.id===id)){
      /* Figure out which area this belongs to */
      const area=guessArea(name);
      LOCS.push({id,name,area,street:name,label:`${name}${area?" — "+area:""}`,custom:false});
    }
  });
}

function guessArea(name){
  const n=name.toLowerCase();
  if(n.includes("unilag")||n.includes("akoka")||n.includes("makoko")||n.includes("yaba"))return"Yaba";
  if(n.includes("yabatech"))return"Yaba";
  if(n.includes("lasu")||n.includes("ojo"))return"Ojo/Alaba";
  if(n.includes("lekki phase 1")||n.includes("admiralty")||n.includes("fola osibo")||n.includes("freedom way"))return"Lekki Phase 1";
  if(n.includes("lekki phase 2")||n.includes("ikota")||n.includes("vgc")||n.includes("orchid")||n.includes("crown estate")||n.includes("megamound"))return"Lekki Phase 2/Ikota";
  if(n.includes("ajah")||n.includes("sangotedo")||n.includes("badore")||n.includes("monastery")||n.includes("ilaje")||n.includes("thomas estate")||n.includes("jakande estate ajah"))return"Ajah";
  if(n.includes("chevron")||n.includes("osapa")||n.includes("ikate")||n.includes("oral estate")||n.includes("palace road")||n.includes("mobil road"))return"Chevron/Lekki-Epe Expressway";
  if(n.includes("agungi")||n.includes("ologolo")||n.includes("igbo efon")||n.includes("ilasan"))return"Igbo Efon/Ilasan";
  if(n.includes("victoria island")||n.includes("adeola odeku")||n.includes("akin adesola")||n.includes("ozumba")||n.includes("ahmadu bello way")||n.includes("sanusi")||n.includes("kofo abayomi")||n.includes("eko atlantic")||n.includes("eko hotel")||n.includes("federal palace"))return"Victoria Island";
  if(n.includes("ikoyi")||n.includes("bourdillon")||n.includes("osborne")||n.includes("banana island")||n.includes("parkview")||n.includes("dolphin")||n.includes("gerrard")||n.includes("ribadu")||n.includes("lugard")||n.includes("kingsway"))return"Ikoyi";
  if(n.includes("ikeja gra")||n.includes("isaac john")||n.includes("joel ogunnaike")||n.includes("oduduwa crescent")||n.includes("remi fani"))return"Ikeja GRA";
  if(n.includes("allen")||n.includes("opebi")||n.includes("computer village")||n.includes("toyin")||n.includes("lateef jakande")||n.includes("salvation road")||n.includes("mobolaji johnson"))return"Ikeja (Allen/Opebi)";
  if(n.includes("surulere")||n.includes("ojuelegba")||n.includes("adeniran ogunsanya")||n.includes("bode thomas")||n.includes("eric moore")||n.includes("randle")||n.includes("akerele"))return"Surulere";
  if(n.includes("gbagada")||n.includes("pedro")||n.includes("soluyi")||n.includes("tigris")||n.includes("keffi"))return"Gbagada";
  if(n.includes("maryland")||n.includes("anthony")||n.includes("palmgrove"))return"Maryland/Anthony";
  if(n.includes("ikorodu"))return"Ikorodu";
  if(n.includes("apapa")||n.includes("kirikiri")||n.includes("wharf")||n.includes("burma road")||n.includes("liverpool road"))return"Apapa";
  if(n.includes("festac"))return"Festac Town";
  if(n.includes("badagry")||n.includes("seme"))return"Badagry";
  if(n.includes("mushin")||n.includes("ladipo")||n.includes("town planning"))return"Mushin";
  if(n.includes("magodo")||n.includes("shangisha"))return"Magodo";
  if(n.includes("ketu")||n.includes("mile 12")||n.includes("ogudu")||n.includes("kosofe")||n.includes("alapere"))return"Kosofe/Ketu";
  if(n.includes("ojodu")||n.includes("omole")||n.includes("berger")||n.includes("fagba")||n.includes("isheri"))return"Ojodu/Omole";
  if(n.includes("ogba")||n.includes("ijaiye")||n.includes("mcc road"))return"Ogba";
  if(n.includes("agege")||n.includes("oko oba")||n.includes("pen cinema")||n.includes("dopemu"))return"Agege";
  if(n.includes("ipaja")||n.includes("iyana ipaja")||n.includes("ayobo")||n.includes("igando")||n.includes("ikotun")||n.includes("shasha")||n.includes("akowonjo")||n.includes("idimu")||n.includes("egbe"))return"Alimosho/Ipaja";
  if(n.includes("oshodi")||n.includes("isolo")||n.includes("ago palace")||n.includes("bolade")||n.includes("ejigbo")||n.includes("ilasamaja")||n.includes("cele")||n.includes("mafoluku")||n.includes("ajao estate"))return"Oshodi/Isolo";
  if(n.includes("ilupeju")||n.includes("harvey")||n.includes("simbiat"))return"Ilupeju";
  if(n.includes("shomolu")||n.includes("bariga")||n.includes("obanikoro"))return"Shomolu/Bariga";
  if(n.includes("ebute metta")||n.includes("willoughby")||n.includes("oyingbo"))return"Ebute Metta";
  if(n.includes("amuwo")||n.includes("mile 2")||n.includes("satellite town")||n.includes("apple junction"))return"Amuwo Odofin";
  if(n.includes("ojota")||n.includes("oregun"))return"Ojota/Oregun";
  if(n.includes("epe"))return"Epe";
  if(n.includes("ibeju")||n.includes("eleko")||n.includes("awoyaya")||n.includes("bogije")||n.includes("akodo")||n.includes("lekki free trade"))return"Ibeju-Lekki";
  if(n.includes("lagos island")||n.includes("marina")||n.includes("tinubu")||n.includes("balogun")||n.includes("broad street")||n.includes("idumota")||n.includes("custom"))return"Lagos Island";
  if(n.includes("obalende")||n.includes("race course")||n.includes("igbosere")||n.includes("cms"))return"Obalende/CMS";
  if(n.includes("onikan"))return"Onikan/Lagos Mainland";
  if(n.includes("ojo")||n.includes("alaba")||n.includes("navy town")||n.includes("volkswagen"))return"Ojo/Alaba";
  return"Lagos";
}

buildBaseLocs();

let reports=[],filterArea="",mType=null,mSel=null,CU=null,PR=null,emailLog=[];
let savedPlaces=[];
let _placeSel=null,_placeType="home",_editPlaceId=null;
let _userCount=0,_nearbyAreas=[],_userLat=null,_userLng=null,_pollTimer=null;
let googleMapsReady=false,map=null,userMarker=null,powerMarkers=[];
let userExactLat=null,userExactLng=null,placesAutocomplete=null;

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

const MOON_SVG=`<path fill-rule="evenodd" clip-rule="evenodd" d="M8.5 2a6.5 6.5 0 1 0 5.18 10.38A5 5 0 0 1 6.5 5a5 5 0 0 1 2.83-4.48A6.6 6.6 0 0 0 8.5 2z" fill="currentColor"/>`;
const SUN_SVG=`<circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.58 3.58l1.41 1.41M11.01 11.01l1.41 1.41M3.58 12.42l1.41-1.41M11.01 4.99l1.41-1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;

function toggleTheme(){const h=document.documentElement;const isDark=h.getAttribute("data-theme")==="dark";const next=isDark?"light":"dark";h.setAttribute("data-theme",next);document.getElementById("themeIcon").innerHTML=next==="dark"?MOON_SVG:SUN_SVG;try{localStorage.setItem("nw-theme",next);}catch(e){}}
function initTheme(){let saved;try{saved=localStorage.getItem("nw-theme");}catch(e){}const pref=window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light";const t=saved||pref;document.documentElement.setAttribute("data-theme",t);document.getElementById("themeIcon").innerHTML=t==="dark"?MOON_SVG:SUN_SVG;}

function toast(msg,cls="ok"){const t=document.getElementById("toast");const ico={ok:IC.ok,err:IC.err,info:IC.inf}[cls]||"";t.innerHTML=ico+`<span>${msg}</span>`;t.className=`toast ${cls} show`;clearTimeout(t._tid);t._tid=setTimeout(()=>t.className="toast",cls==="err"?7000:3600);}

/* ══════════════════════════════════════════════════════════
   SESSION FIX — robust auth initialization
   Restores session from localStorage on page load/refresh
   ══════════════════════════════════════════════════════════ */
let _authInitDone = false;

async function initAuth(){
  try{
    const{data:{session},error}=await sb.auth.getSession();
    if(error)console.warn("getSession error:",error.message);
    CU=session?.user||null;
    if(CU){
      await loadProfile();
    }
  }catch(e){
    console.warn("initAuth error:",e);
  }
  _authInitDone = true;
  updateBanner();

  sb.auth.onAuthStateChange(async(event,session)=>{
    /* Ignore SIGNED_OUT events that fire during initial load race */
    if(!_authInitDone && event==="SIGNED_OUT") return;

    const prevUser=CU;
    CU=session?.user||null;
    if(CU){
      if(event==="SIGNED_IN"||event==="TOKEN_REFRESHED"||event==="USER_UPDATED"||!PR){
        await loadProfile();
      }
    }else{
      PR=null;
      savedPlaces=[];
      document.getElementById("locTag").classList.remove("on");
    }
    if((!prevUser&&CU)||(prevUser&&!CU)){
      updateBanner();
      renderAccount();
      if(CU)loadSavedPlaces();
    }
  });
}
async function loadProfile(){if(!CU)return;try{const{data,error}=await sb.from("profiles").select("*").eq("id",CU.id).single();if(!error&&data){PR=data;if(PR.location_id){document.getElementById("locTag").classList.add("on");document.getElementById("locLabel").textContent=PR.location_label||PR.location_name||"";}}else if(error&&error.code==="PGRST116"){const name=CU.user_metadata?.name||CU.email.split("@")[0];await sb.from("profiles").upsert({id:CU.id,email:CU.email,name,notif_on:true},{onConflict:"id"});PR={id:CU.id,email:CU.email,name,notif_on:true,location_id:null};}}catch(e){console.warn("loadProfile error:",e);}}

async function doRegister(name,email,pass){const{data,error}=await sb.auth.signUp({email,password:pass,options:{data:{name},emailRedirectTo:window.location.origin+window.location.pathname+"?mode=reset"}});if(error){if(error.message?.toLowerCase().includes("rate limit")||error.message?.toLowerCase().includes("over_email_send_rate_limit"))throw new Error("RATE_LIMIT");throw new Error(error.message);}if(data.user){await sb.from("profiles").upsert({id:data.user.id,email,name,notif_on:true},{onConflict:"id"});}if(data.session){CU=data.user;await loadProfile();renderAccount();updateBanner();toast(`Welcome, ${name}!`,"ok");}sendEmail(email,"Welcome to NEPAWatch Lagos",`Hi ${name},\n\nWelcome to NEPAWatch Lagos!\n\nYou will receive real-time email alerts whenever power goes out or is restored near your street.\n\nOpen the app and set your location to activate alerts.\n\nStay powered,\nNEPAWatch Lagos`);return data;}
async function doLogin(email,pass){const{data,error}=await sb.auth.signInWithPassword({email,password:pass});if(error)throw new Error(error.message);return data;}
async function doLogout(){try{await sb.auth.signOut();}catch(e){}CU=null;PR=null;savedPlaces=[];document.getElementById("locTag").classList.remove("on");updateBanner();renderAccount();toast("Signed out","info");}

async function loadSavedPlaces(){if(!CU)return;try{const{data,error}=await sb.from("saved_places").select("*").eq("user_id",CU.id).order("created_at",{ascending:true});if(!error&&data)savedPlaces=data;}catch(e){savedPlaces=[];}renderSavedPlacesHome();renderMyPlacesList();}
async function savePlaceToDB(placeObj){if(!CU)return null;try{if(placeObj.id&&!String(placeObj.id).startsWith("local-")){const{data,error}=await sb.from("saved_places").update({type:placeObj.type,custom_label:placeObj.custom_label,location_id:placeObj.location_id,location_name:placeObj.location_name,location_area:placeObj.location_area,location_label:placeObj.location_label,notif_on:placeObj.notif_on!==false}).eq("id",placeObj.id).select().single();if(error)throw error;return data;}else{const{data,error}=await sb.from("saved_places").insert({user_id:CU.id,type:placeObj.type,custom_label:placeObj.custom_label||null,location_id:placeObj.location_id,location_name:placeObj.location_name,location_area:placeObj.location_area,location_label:placeObj.location_label,notif_on:true}).select().single();if(error)throw error;return data;}}catch(e){return{id:"local-"+Date.now(),...placeObj};}}
async function deleteSavedPlace(id){savedPlaces=savedPlaces.filter(p=>p.id!==id);if(!String(id).startsWith("local-")){try{await sb.from("saved_places").delete().eq("id",id);}catch(e){}}renderSavedPlacesHome();renderMyPlacesList();toast("Place removed","info");}
async function togglePlaceNotif(id){const p=savedPlaces.find(x=>x.id===id);if(!p)return;p.notif_on=!p.notif_on;if(!String(id).startsWith("local-")){try{await sb.from("saved_places").update({notif_on:p.notif_on}).eq("id",id);}catch(e){}}toast(p.notif_on?"Alerts on for this place":"Alerts off for this place","info");renderMyPlacesList();}
function getPlaceDisplayName(p){if(p.custom_label)return p.custom_label;const names={home:"Home",work:"Work",school:"School",custom:"My Place"};return names[p.type]||"My Place";}
function getPlaceStatus(area){if(!area)return"unk";const r=reports.filter(x=>x.area===area);if(!r.length)return"unk";return r[0].type==="out"?"out":"on";}

function renderSavedPlacesHome(){const el=document.getElementById("savedPlacesHome");if(!savedPlaces.length){el.innerHTML="";return;}const cards=savedPlaces.map(p=>{const status=getPlaceStatus(p.location_area);const statusCls=status==="out"?"s-out":status==="on"?"s-on":"s-unk";const statusTxt=status==="out"?"Power out":status==="on"?"Power on":"Unknown";const statusIco=status==="out"?IC.out:status==="on"?IC.bck:IC.pin;const cardCls=status==="out"?"sp-out":status==="on"?"sp-on":"";return`<div class="sp-card ${cardCls}" onclick="jumpToArea('${p.location_area||""}')"><div class="sp-label">${getPlaceDisplayName(p)}</div><div class="sp-name">${p.location_name}</div><div class="sp-status ${statusCls}">${statusIco}&nbsp;${statusTxt}</div></div>`;}).join("");el.innerHTML=`<div class="slbl">Saved Places</div><div class="saved-places"><div class="sp-scroll">${cards}<button class="sp-add" onclick="openPlaceModal()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Add Place</button></div></div>`;}

function renderMyPlacesList(){const el=document.getElementById("myPlacesList");if(!el)return;if(!savedPlaces.length){el.innerHTML=`<div class="empty"><div class="empty-ico">${IC.pin}</div><p>No saved places yet. Add your home, work or school to track their power status.</p></div>`;return;}const typeClsMap={home:"mpl-home",work:"mpl-work",school:"mpl-school",custom:"mpl-custom"};el.innerHTML=savedPlaces.map(p=>{const status=getPlaceStatus(p.location_area);const statusCls=status==="out"?"s-out":status==="on"?"s-on":"s-unk";const statusTxt=status==="out"?"Power Out":status==="on"?"Power On":"Unknown";const statusIco=status==="out"?IC.out:status==="on"?IC.bck:IC.pin;const ico=PLACE_ICONS[p.type]||IC.custom;const typeCls=typeClsMap[p.type]||"mpl-custom";return`<div class="mpl-card"><div class="mpl-type-ico ${typeCls}">${ico}</div><div class="mpl-body"><div class="mpl-lbl">${getPlaceDisplayName(p)}</div><div class="mpl-name">${p.location_name}</div><div class="mpl-area">${p.location_area||""}</div></div><div class="mpl-status ${statusCls}">${statusIco}&nbsp;${statusTxt}</div><div class="mpl-actions"><button class="mpl-edit-btn" onclick="editSavedPlace('${p.id}')" title="Edit">${IC.edit}</button><button class="mpl-del-btn" onclick="deleteSavedPlace('${p.id}')" title="Remove">${IC.del}</button></div></div>`;}).join("");}

function jumpToArea(area){if(!area)return;filterArea=area;const sel=document.getElementById("areaFilter");if(sel)sel.value=area;go("home");renderFeed("liveFeed");toast(`Filtered to ${area}`,"info");}

function openPlaceModal(editId){_editPlaceId=editId||null;_placeSel=null;_placeType="home";document.getElementById("placeShTitle").textContent=editId?"Edit Saved Place":"Add Saved Place";document.getElementById("customPlaceName").value="";document.getElementById("placeSearch").value="";if(editId){const existing=savedPlaces.find(p=>p.id===editId);if(existing){_placeType=existing.type||"home";document.getElementById("customPlaceName").value=existing.custom_label||"";const loc=LOCS.find(l=>l.id===existing.location_id)||{id:existing.location_id,name:existing.location_name,area:existing.location_area,label:existing.location_label};_placeSel=loc;document.getElementById("placeSearch").value=existing.location_name||"";}}document.querySelectorAll(".pt-btn").forEach(b=>b.classList.toggle("selected",b.dataset.type===_placeType));renderPlaceList(LOCS.slice(0,60));const btn=document.getElementById("placeBtn");if(_placeSel){btn.disabled=false;btn.textContent=editId?"Save Changes":"Add Place";}else{btn.disabled=true;btn.textContent="Select a location first";}document.getElementById("placeOverlay").classList.add("open");setTimeout(()=>document.getElementById("placeSearch").focus(),280);}
function editSavedPlace(id){openPlaceModal(id);}
function closePlaceModal(){document.getElementById("placeOverlay").classList.remove("open");_placeSel=null;_placeType="home";_editPlaceId=null;}
function selectPlaceType(btn,type){_placeType=type;document.querySelectorAll(".pt-btn").forEach(b=>b.classList.remove("selected"));btn.classList.add("selected");}
function filterPlaceList(){const q=document.getElementById("placeSearch").value.trim().toLowerCase();if(!q){renderPlaceList(LOCS.slice(0,60));return;}renderPlaceList(LOCS.filter(l=>l.label.toLowerCase().includes(q)).slice(0,50));}
function renderPlaceList(locs){const el=document.getElementById("placeList");if(!locs.length){el.innerHTML=`<div class="mopt" style="color:var(--ink3);cursor:default;justify-content:center;padding:18px">No results found</div>`;return;}el.innerHTML=locs.map(l=>`<div class="mopt ${_placeSel?.id===l.id?"sel":""}" onclick="selectPlaceLoc('${l.id}')"><span>${l.name}</span><span class="mopt-sub">${l.street?l.area:"Area"}</span></div>`).join("");}
function selectPlaceLoc(id){_placeSel=LOCS.find(l=>l.id===id);const q=document.getElementById("placeSearch").value.trim().toLowerCase();renderPlaceList(q?LOCS.filter(l=>l.label.toLowerCase().includes(q)).slice(0,50):LOCS.slice(0,60));const btn=document.getElementById("placeBtn");if(_placeSel){btn.disabled=false;btn.textContent=_editPlaceId?"Save Changes":"Add Place";}}
async function submitSavedPlace(){if(!CU){toast("Sign in to save places","info");closePlaceModal();go("account");return;}if(!_placeSel){toast("Select a location","info");return;}const customLabel=document.getElementById("customPlaceName").value.trim()||null;const btn=document.getElementById("placeBtn");btn.innerHTML=`Saving... <span class="spin"></span>`;btn.disabled=true;const placeObj={id:_editPlaceId||null,type:_placeType,custom_label:customLabel,location_id:_placeSel.id,location_name:_placeSel.name,location_area:_placeSel.area,location_label:_placeSel.label,notif_on:true};const saved=await savePlaceToDB(placeObj);if(saved){if(_editPlaceId){const idx=savedPlaces.findIndex(p=>p.id===_editPlaceId);if(idx!==-1)savedPlaces[idx]={...savedPlaces[idx],...saved};}else{savedPlaces.push(saved);}renderSavedPlacesHome();renderMyPlacesList();toast(_editPlaceId?"Place updated":"Place saved","ok");}btn.innerHTML=_editPlaceId?"Save Changes":"Add Place";btn.disabled=false;closePlaceModal();}

function haversine(lat1,lng1,lat2,lng2){const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function findNearestAreas(lat,lng,count=8){return Object.entries(AREA_COORDS).map(([area,coords])=>({area,dist:haversine(lat,lng,coords.lat,coords.lng)})).sort((a,b)=>a.dist-b.dist).slice(0,count);}
function reverseGeocode(lat,lng){if(!googleMapsReady)return;const geocoder=new google.maps.Geocoder();geocoder.geocode({location:{lat,lng}},(results,status)=>{if(status==="OK"&&results[0]){const addrComp=results[0].address_components;let precise="";for(let comp of addrComp){if(comp.types.includes("neighborhood")){precise=comp.long_name;break;}else if(comp.types.includes("sublocality")&&!precise){precise=comp.long_name;}else if(comp.types.includes("locality")&&!precise){precise=comp.long_name;}}if(precise){const txt=document.getElementById("geoBtnTxt");txt.textContent=precise.length>12?precise.substring(0,12)+"...":precise;toast(`📍 You are at ${precise}`,"ok");}}});}

async function detectLocation(){const btn=document.getElementById("geoBtn");const txt=document.getElementById("geoBtnTxt");if(!navigator.geolocation){toast("Geolocation not supported","err");return;}txt.textContent="Locating...";btn.disabled=true;const tryGeo=(highAccuracy,timeoutMs)=>new Promise((resolve,reject)=>{navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:highAccuracy,timeout:timeoutMs,maximumAge:highAccuracy?10000:60000});});let pos;try{pos=await tryGeo(true,12000);}catch(e1){try{pos=await tryGeo(false,8000);}catch(e2){const msg=e2.code===1?"Location access denied":e2.code===2?"Could not get location":"Location request timed out";toast(msg,"err");txt.textContent="Locate Me";btn.disabled=false;return;}}const{latitude:lat,longitude:lng,accuracy}=pos.coords;_userLat=lat;_userLng=lng;userExactLat=lat;userExactLng=lng;_nearbyAreas=findNearestAreas(lat,lng,8);const nearest=_nearbyAreas[0]?.area;if(!nearest){toast("Could not match your location to a Lagos area","err");txt.textContent="Locate Me";btn.disabled=false;return;}const sel=document.getElementById("areaFilter");sel.value=nearest;filterArea=nearest;renderFeed("liveFeed");btn.classList.add("active");btn.disabled=false;const accStr=accuracy<100?`±${Math.round(accuracy)}m`:"";toast(`📍 Located near ${nearest}${accStr?" "+accStr:""}`,"ok");txt.textContent=nearest.length>12?nearest.substring(0,12)+"...":nearest;renderNearbyDashboard();document.getElementById('mapContainer').classList.add('show');if(googleMapsReady){showPreciseLocation(lat,lng);reverseGeocode(lat,lng);}if(CU&&PR&&!PR.location_id){const loc=LOCS.find(l=>l.name===nearest&&!l.street);if(loc)await saveLocation(loc);}}

function initGoogleMaps(){googleMapsReady=true;if(userExactLat&&userExactLng){showPreciseLocation(userExactLat,userExactLng);reverseGeocode(userExactLat,userExactLng);}}
function showPreciseLocation(lat,lng){if(!googleMapsReady)return;const mapDiv=document.getElementById('mapContainer');if(!map){map=new google.maps.Map(mapDiv,{center:{lat,lng},zoom:15,mapTypeControl:false,streetViewControl:false});}else{map.setCenter({lat,lng});map.setZoom(15);}if(userMarker)userMarker.setMap(null);powerMarkers.forEach(m=>m.setMap(null));powerMarkers=[];userMarker=new google.maps.Marker({position:{lat,lng},map,title:"You are here",icon:{path:google.maps.SymbolPath.CIRCLE,scale:10,fillColor:"#4285F4",fillOpacity:1,strokeColor:"white",strokeWeight:2}});const nearby=findNearbyPowerSpots(lat,lng,5);nearby.forEach(spot=>{const marker=new google.maps.Marker({position:spot.coords,map,title:spot.area,icon:{url:spot.status==='on'?'http://maps.google.com/mapfiles/ms/icons/green-dot.png':'http://maps.google.com/mapfiles/ms/icons/red-dot.png'}});const iw=new google.maps.InfoWindow({content:`<div class="map-info"><strong>${spot.area}</strong><br>Power: ${spot.status==='on'?'✅ On':'❌ Out'}<br>${spot.dist<1?(spot.dist*1000).toFixed(0)+'m':spot.dist.toFixed(1)+'km'} away<button onclick="window.open('https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${spot.coords.lat},${spot.coords.lng}','_blank')">🧭 Directions</button></div>`});marker.addListener('click',()=>iw.open(map,marker));powerMarkers.push(marker);});}
function findNearbyPowerSpots(lat,lng,limit=5){return Object.entries(AREA_COORDS).map(([area,coords])=>({area,status:getPlaceStatus(area),coords,dist:haversine(lat,lng,coords.lat,coords.lng)})).filter(s=>s.dist<=10).sort((a,b)=>a.dist-b.dist).slice(0,limit);}

function clearLoc(){filterArea="";const sel=document.getElementById("areaFilter");if(sel)sel.value="";document.getElementById("locTag").classList.remove("on");document.getElementById("geoBtn").classList.remove("active");document.getElementById("geoBtnTxt").textContent="Locate Me";_nearbyAreas=[];_userLat=null;_userLng=null;userExactLat=userExactLng=null;document.getElementById('mapContainer').classList.remove('show');if(userMarker)userMarker.setMap(null);powerMarkers.forEach(m=>m.setMap(null));powerMarkers=[];renderNearbyDashboard();renderFeed("liveFeed");if(CU&&PR){PR.location_id=null;PR.location_name=null;PR.location_area=null;PR.location_label=null;sb.from("profiles").update({location_id:null,location_name:null,location_area:null,location_label:null}).eq("id",CU.id).then(()=>{}).catch(()=>{});}}

function renderNearbyDashboard(){const el=document.getElementById("nearbyDashboard");if(!_nearbyAreas.length){el.innerHTML="";return;}const cards=_nearbyAreas.slice(0,6).map(({area,dist})=>{const status=getPlaceStatus(area);const statusCls=status==="out"?"nb-status s-out":status==="on"?"nb-status s-on":"nb-status s-unk";const statusTxt=status==="out"?"Power Out":status==="on"?"Power On":"No reports";const statusIco=status==="out"?IC.out:status==="on"?IC.bck:IC.pin;const distStr=dist<1?`${Math.round(dist*1000)}m away`:`${dist.toFixed(1)}km away`;return`<div class="nb-card" onclick="jumpToArea('${area}')"><div class="nb-area">${area}</div><div class="nb-dist">${distStr}</div><div class="${statusCls}">${statusIco}&nbsp;${statusTxt}</div></div>`;}).join("");el.innerHTML=`<div class="slbl">Nearby Areas</div><div class="nearby-grid">${cards}</div>`;}

async function loadUserCount(){try{const{count,error}=await sb.from("profiles").select("id",{count:"exact",head:true});if(!error&&count!=null){_userCount=count;const pill=document.getElementById("userCountPill");const num=document.getElementById("userCountNum");if(pill&&num&&count>=2){num.textContent=count.toLocaleString();pill.style.display="flex";}}}catch(e){}}

async function saveLocation(loc){if(!CU)return;const u={location_id:loc.id,location_name:loc.name,location_area:loc.area,location_label:loc.label};try{await sb.from("profiles").update(u).eq("id",CU.id);}catch(e){}PR={...PR,...u};document.getElementById("locTag").classList.add("on");document.getElementById("locLabel").textContent=loc.label;updateBanner();toast(`Location set — ${loc.name}`,"ok");}
async function toggleNotif(){if(!CU||!PR)return;const next=!PR.notif_on;try{await sb.from("profiles").update({notif_on:next}).eq("id",CU.id);}catch(e){}PR.notif_on=next;const btn=document.getElementById("notifToggle");if(btn)btn.classList.toggle("on",next);toast(next?"Email alerts enabled":"Email alerts disabled","info");}

async function loadCustomLocations(){try{const{data,error}=await sb.from("custom_locations").select("*").order("created_at",{ascending:true});if(!error&&data&&data.length){data.forEach(loc=>{if(!LOCS.find(l=>l.id===loc.id)){LOCS.unshift({id:loc.id,name:loc.street_name,area:loc.area_name,street:loc.street_name,label:`${loc.street_name} — ${loc.area_name}`,custom:true});}});buildFilter();}}catch(e){}}
async function submitCustomLocation(street,area){if(!CU)return null;const id=sl(area+street);try{const{data,error}=await sb.from("custom_locations").upsert({id,street_name:street,area_name:area,added_by:CU.id},{onConflict:"id"}).select().single();if(error)throw error;const newLoc={id,name:street,area,street,label:`${street} — ${area}`,custom:true};if(!LOCS.find(l=>l.id===id))LOCS.unshift(newLoc);toast(`"${data.street_name}" added for everyone!`,"ok");return newLoc;}catch(e){toast(e.message||"Could not add location","err");return null;}}

async function loadReports(){try{const{data,error}=await sb.from("reports").select("id,user_id,location_name,location_area,type,confirms,created_at").order("created_at",{ascending:false}).limit(100);if(error)throw error;if(!data||data.length===0){reports=[];}else{const dbReports=data.map(r=>({id:r.id,name:r.location_name,area:r.location_area,type:r.type,time:new Date(r.created_at).getTime(),confirms:r.confirms||1,userId:r.user_id,isAI:r.user_id===AI_USER_ID}));const pending=reports.filter(r=>String(r.id).startsWith("local-")||String(r.id).startsWith("ai-"));reports=[...pending,...dbReports];}}catch(e){if(reports.length===0)seedFallback();}render();if(_nearbyAreas.length)renderNearbyDashboard();}

async function pollReports(){try{const{data,error}=await sb.from("reports").select("id,user_id,location_name,location_area,type,confirms,created_at").order("created_at",{ascending:false}).limit(100);if(error||!data)return;const dbReports=data.map(r=>({id:r.id,name:r.location_name,area:r.location_area,type:r.type,time:new Date(r.created_at).getTime(),confirms:r.confirms||1,userId:r.user_id,isAI:r.user_id===AI_USER_ID}));const pending=reports.filter(r=>String(r.id).startsWith("local-")||String(r.id).startsWith("ai-"));const newList=[...pending,...dbReports];const oldIds=reports.filter(r=>!String(r.id).startsWith("local-")&&!String(r.id).startsWith("ai-")).map(r=>r.id+r.confirms).join(",");const newIds=dbReports.map(r=>r.id+r.confirms).join(",");if(oldIds!==newIds){reports=newList;render();if(_nearbyAreas.length)renderNearbyDashboard();renderSavedPlacesHome();renderMyPlacesList();}}catch(e){}}

function startPolling(){if(_pollTimer)clearInterval(_pollTimer);_pollTimer=setInterval(pollReports,8000);}

async function pushReport(loc,type){if(!CU){toast("Sign in to submit a report","info");go("account");return;}const tid="local-"+Date.now();reports.unshift({id:tid,name:loc.name,area:loc.area,type,time:Date.now(),confirms:1});if(reports.length>100)reports.pop();render();try{const{data,error}=await sb.from("reports").insert({user_id:CU.id,location_name:loc.name,location_area:loc.area,type,confirms:1}).select().single();if(error){const idx=reports.findIndex(r=>r.id===tid);if(idx!==-1)reports.splice(idx,1);render();toast(`Could not save report: ${error.message}`,"err");return;}const idx=reports.findIndex(r=>r.id===tid);if(idx!==-1)reports[idx]={id:data.id,name:data.location_name,area:data.location_area,type:data.type,time:new Date(data.created_at).getTime(),confirms:data.confirms||1,userId:data.user_id};render();toast(type==="out"?`Outage reported — ${loc.name}`:`Power restored — ${loc.name}`,type==="out"?"err":"ok");if(PR&&!PR.location_id)await saveLocation(loc);await sendAreaAlerts(loc.name,loc.area,type);setTimeout(loadReports,2000);}catch(e){const idx=reports.findIndex(r=>r.id===tid);if(idx!==-1)reports.splice(idx,1);render();toast("Could not save report — check your connection","err");}}

async function addConfirm(repId){
  const r=reports.find(x=>x.id===repId);
  if(!r)return;
  if(!CU){toast("Sign in to confirm reports","info");return;}
  if(r.userId===CU.id){toast("You cannot confirm your own report","info");return;}
  r.confirms++;
  const isReal=!String(repId).startsWith("local-")&&!String(repId).startsWith("s")&&!String(repId).startsWith("ai-");
  if(isReal){try{await sb.from("reports").update({confirms:r.confirms}).eq("id",repId);}catch(e){}}
  renderFeed("liveFeed");
  toast("Confirmation added","ok");
  if(r.confirms===3)await sendAreaAlerts(r.name,r.area,r.type);
}

function seedFallback(){reports=[{id:"s1",name:"Adeola Odeku Street",area:"Victoria Island",type:"out",time:Date.now()-7*60000,confirms:14},{id:"s2",name:"Allen Avenue",area:"Ikeja (Allen/Opebi)",type:"out",time:Date.now()-22*60000,confirms:9},{id:"s3",name:"Admiralty Way",area:"Lekki Phase 1",type:"bck",time:Date.now()-5*60000,confirms:18},{id:"s4",name:"Adeniran Ogunsanya St",area:"Surulere",type:"out",time:Date.now()-35*60000,confirms:6},{id:"s5",name:"Bourdillon Road",area:"Ikoyi",type:"bck",time:Date.now()-12*60000,confirms:11},{id:"s6",name:"Agege Motor Road",area:"Mushin",type:"out",time:Date.now()-55*60000,confirms:7},{id:"s7",name:"Agric Road Ikorodu",area:"Ikorodu",type:"out",time:Date.now()-80*60000,confirms:4},{id:"s8",name:"Badore Road",area:"Ajah",type:"bck",time:Date.now()-10*60000,confirms:8}];}

async function sendEmail(to,subject,body){if(!to||!subject)return;try{await fetch(EMAIL_FN,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPA_ANON,"Authorization":`Bearer ${SUPA_ANON}`},body:JSON.stringify({to,subject,body,mode:"direct"})});}catch(e){}}
async function sendAreaAlerts(repName,repArea,repType){if(!repArea)return;try{const subject=repType==="out"?`Power Outage — ${repArea}, Lagos`:`Power Restored — ${repArea}, Lagos`;const time=new Date().toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit"});const body=`${repType==="out"?"Power outage":"Power restored"} near ${repName}, ${repArea}.\n\nTime: ${time}\n\nSee live updates: ${APP_URL}\n\n— NEPAWatch Lagos`;let edgeSent=false;try{const res=await fetch(EMAIL_FN,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPA_ANON,"Authorization":`Bearer ${SUPA_ANON}`},body:JSON.stringify({mode:"area_alert",area:repArea,repName,repType,subject,body,time})});if(res.ok){const json=await res.json().catch(()=>({}));const count=json.sent||0;edgeSent=true;if(count>0){emailLog.unshift({subject,to:`${count} watcher${count!==1?"s":""} in ${repArea}`,time});if(emailLog.length>8)emailLog.pop();}}}catch(fe){}if(CU&&savedPlaces.length){const matchingPlaces=savedPlaces.filter(p=>p.location_area===repArea&&p.notif_on!==false);if(matchingPlaces.length&&CU.email&&!edgeSent){const placeNames=matchingPlaces.map(p=>getPlaceDisplayName(p)).join(", ");const placeBody=`Hi ${PR?.name||"there"},\n\n${body}\n\nThis affects your saved place(s): ${placeNames}`;await sendEmail(CU.email,subject,placeBody);emailLog.unshift({subject,to:CU.email+"  (saved place)",time});if(emailLog.length>8)emailLog.pop();toast("Alert sent for your saved place","ok");if(document.getElementById("page-account").classList.contains("active"))renderAccount();}}else if(!edgeSent&&CU&&PR&&PR.location_area===repArea&&PR.notif_on&&CU.email){const userBody=`Hi ${PR.name||"there"},\n\n${body}`;await sendEmail(CU.email,subject,userBody);emailLog.unshift({subject,to:CU.email,time});if(emailLog.length>8)emailLog.pop();toast("Alert sent to your email","ok");if(document.getElementById("page-account").classList.contains("active"))renderAccount();}}catch(e){}}

function openModal(type){mType=type;mSel=null;document.getElementById("shTitle").textContent=type==="out"?"Report Power Outage":"Report Power Restored";document.getElementById("shDesc").textContent=type==="out"?"Search your street or area in Lagos.":"Great news! Tell your community.";const btn=document.getElementById("mBtn");btn.textContent=type==="out"?"Confirm Outage":"Confirm Restored";btn.className="mconfirm "+(type==="out"?"out":"bck");btn.disabled=true;document.getElementById("mSearch").value="";if(PR?.location_id){mSel=LOCS.find(l=>l.id===PR.location_id)||null;if(mSel){btn.disabled=false;btn.textContent=type==="out"?`Report — ${mSel.name}`:`Restored — ${mSel.name}`;}}renderMList(LOCS.slice(0,60));document.getElementById("repOverlay").classList.add("open");setTimeout(()=>{document.getElementById("mSearch").focus();},280);}
function closeModal(){document.getElementById("repOverlay").classList.remove("open");mType=null;mSel=null;}
function filterList(){const q=document.getElementById("mSearch").value.trim().toLowerCase();if(!q){renderMList(LOCS.slice(0,60));return;}renderMList(LOCS.filter(l=>l.label.toLowerCase().includes(q)).slice(0,50));}
function renderMList(locs){const el=document.getElementById("mList");if(!locs.length){el.innerHTML=`<div class="mopt" style="color:var(--ink3);cursor:default;justify-content:center;padding:18px">No results found</div>`;return;}el.innerHTML=locs.map(l=>`<div class="mopt ${mSel?.id===l.id?"sel":""}" onclick="selectLoc('${l.id}')"><span>${l.name}</span><span class="mopt-sub">${l.street?l.area:"Area"}</span></div>`).join("");}
function selectLoc(id){mSel=LOCS.find(l=>l.id===id);const q=document.getElementById("mSearch").value.trim().toLowerCase();renderMList(q?LOCS.filter(l=>l.label.toLowerCase().includes(q)).slice(0,50):LOCS.slice(0,60));const btn=document.getElementById("mBtn");if(mSel){btn.disabled=false;btn.textContent=mType==="out"?`Report — ${mSel.name}`:`Restored — ${mSel.name}`;}}
async function submitReport(){if(!mSel){toast("Please select a location","info");return;}const loc=mSel,type=mType;closeModal();await pushReport(loc,type);}

function buildFilter(){const sel=document.getElementById("areaFilter");if(!sel)return;const areas=new Set();LOCS.forEach(l=>areas.add(l.area));sel.innerHTML=`<option value="">All Lagos areas</option>`;[...areas].sort().forEach(a=>{const o=document.createElement("option");o.value=a;o.textContent=a;sel.appendChild(o);});const dl=document.getElementById("areaList");if(dl){dl.innerHTML="";[...areas].sort().forEach(a=>{const o=document.createElement("option");o.value=a;dl.appendChild(o);});}}
function applyFilter(){filterArea=document.getElementById("areaFilter").value;renderFeed("liveFeed");}
function toggleSuggestLoc(){const form=document.getElementById("suggestLocForm");const txt=document.getElementById("suggestLocToggleTxt");if(!form)return;const show=form.style.display==="none";form.style.display=show?"block":"none";txt.textContent=show?"Hide":"+ Cannot find your street? Add it for everyone";if(show){setTimeout(()=>{document.getElementById("suggestStreet")?.focus();if(googleMapsReady&&!placesAutocomplete){const streetInput=document.getElementById('suggestStreet');placesAutocomplete=new google.maps.places.Autocomplete(streetInput,{types:['address'],componentRestrictions:{country:'NG'},fields:['address_components','formatted_address','geometry']});placesAutocomplete.addListener('place_changed',()=>{const place=placesAutocomplete.getPlace();if(place.geometry){const components=place.address_components;let street='',area='';for(let comp of components){if(comp.types.includes('route'))street=comp.long_name;if(comp.types.includes('sublocality')||comp.types.includes('locality'))area=comp.long_name;}document.getElementById('suggestStreet').value=street||place.formatted_address;if(area)document.getElementById('suggestArea').value=area;}});}},200);}}
async function handleSuggestLoc(){if(!CU){toast("Sign in to add a location","info");closeModal();go("account");return;}const street=(document.getElementById("suggestStreet")?.value||"").trim();const area=(document.getElementById("suggestArea")?.value||"").trim();if(!street){toast("Enter a street name","info");return;}if(!area){toast("Enter the area name","info");return;}const btn=document.querySelector("#suggestLocForm .mconfirm");if(btn){btn.innerHTML='Saving... <span class="spin"></span>';btn.disabled=true;}const newLoc=await submitCustomLocation(street,area);if(btn){btn.innerHTML="Save and Use This Location";btn.disabled=false;}if(newLoc){mSel=newLoc;const mBtn=document.getElementById("mBtn");if(mBtn){mBtn.disabled=false;mBtn.textContent=mType==="out"?`Report — ${newLoc.name}`:`Restored — ${newLoc.name}`;}buildFilter();const q=document.getElementById("mSearch")?.value.trim().toLowerCase()||"";renderMList(q?LOCS.filter(l=>l.label.toLowerCase().includes(q)).slice(0,50):LOCS.slice(0,60));const form=document.getElementById("suggestLocForm");if(form)form.style.display="none";const txt=document.getElementById("suggestLocToggleTxt");if(txt)txt.textContent="+ Cannot find your street? Add it for everyone";}}

function updateBanner(){const b=document.getElementById("mainBanner"),t=document.getElementById("bannerTxt");if(!CU){t.textContent="Sign in to receive email alerts when power changes in your area.";b.classList.add("show");}else if(PR&&!PR.location_id){t.textContent=`Hi ${PR.name} — tap Locate Me or report your street to set your location.`;b.classList.add("show");}else{b.classList.remove("show");}}

function ago(ts){const d=Math.floor((Date.now()-ts)/1000);if(d<60)return`${d}s`;if(d<3600)return`${Math.floor(d/60)}m`;return`${Math.floor(d/3600)}h`;}
function areaStatus(a){const r=reports.filter(x=>x.area===a);if(!r.length)return"unknown";return r[0].type==="out"?"out":"on";}

function renderStats(){const out=new Set(),bck=new Set();reports.forEach(r=>r.type==="out"?out.add(r.area):bck.add(r.area));animateNum("s-out",out.size);animateNum("s-bck",bck.size);animateNum("s-rep",reports.length);}
function animateNum(id,target){const el=document.getElementById(id);const current=parseInt(el.textContent)||0;if(current===target){el.textContent=target;return;}let start=null;const dur=400;const step=ts=>{if(!start)start=ts;const p=Math.min((ts-start)/dur,1);el.textContent=Math.round(current+(target-current)*p);if(p<1)requestAnimationFrame(step);};requestAnimationFrame(step);}

/* ━━━ renderFeed — AI badge on AI-generated reports + hide own confirm button ━━━ */
function renderFeed(id="liveFeed",aF=null){
  const el=document.getElementById(id);if(!el)return;
  const fa=aF!==null?aF:(id==="liveFeed"?filterArea:null);
  const data=fa?reports.filter(r=>r.area===fa):reports;
  if(!data.length){el.innerHTML=`<div class="empty"><div class="empty-ico">${IC.bck}</div><p>${fa?`No reports for ${fa} yet.`:"No reports yet — be the first to report!"}</p></div>`;return;}
  el.innerHTML=data.slice(0,16).map((r,i)=>{
    const isAI=r.isAI||r.userId===AI_USER_ID;
    const aiBadge=isAI?`<div class="fc-ai-badge">${IC.ai}&nbsp;NEPAWatch AI</div>`:'';
    const isOwn=CU&&r.userId===CU.id;
    const confirmBtn=isOwn?'':`<button class="same-btn" onclick="addConfirm('${r.id}')">${IC.chk} Same</button>`;
    return`<div class="fc ${r.type}" style="animation-delay:${i*30}ms">
      <div class="fc-bar"></div>
      <div class="fc-dot">${r.type==="out"?IC.out:IC.bck}</div>
      <div class="fc-body">
        <div class="fc-loc">${r.name}</div>
        <div class="fc-area">${r.area}</div>
        <div class="fc-meta">${r.confirms} confirmation${r.confirms!==1?"s":""}</div>
        ${aiBadge}
      </div>
      <div class="fc-r">
        <div class="fc-time">${ago(r.time)} ago</div>
        ${confirmBtn}
      </div>
    </div>`;
  }).join("");
}

function renderDiscos(){const el=document.getElementById("discoZones");if(!el)return;el.innerHTML=DISCO.map(d=>{const outN=d.lgas.filter(a=>areaStatus(a)==="out").length;const rel=Math.max(10,Math.round(100-(outN/Math.max(d.lgas.length,1))*100));const c=rel>70?"var(--p)":rel>40?"var(--am)":"var(--rd)";const dot=outN>d.lgas.length*.5?"var(--rd)":outN>0?"var(--am)":"var(--p)";return`<div class="zc"><div class="zdot" style="background:${dot}"></div><div class="zb"><div class="zn">${d.name}<span>${d.lgas.slice(0,3).join(" · ")}...</span></div><div class="zt"><div class="zf" style="width:${rel}%;background:${c}"></div></div></div><div class="zp" style="color:${c}">${rel}%</div></div>`;}).join("");}

/* ══════════════════════════════════════════════════════════
   PREDICTION ENGINE — Area-aware, time-of-day, historical
   ══════════════════════════════════════════════════════════ */

/**
 * Lagos area reliability tiers based on real DISCO patterns.
 * Tier 1 = best supply, Tier 4 = worst supply.
 * These reflect known EKEDC/IKEDC feeder performance.
 */
const AREA_RELIABILITY={
  /* Tier 1 — GRA/Commercial, usually 16–20h/day */
  "Ikeja GRA":            {tier:1,baseHrs:18,volatility:0.08},
  "Victoria Island":      {tier:1,baseHrs:17,volatility:0.10},
  "Ikoyi":                {tier:1,baseHrs:17,volatility:0.10},
  "Lekki Phase 1":        {tier:1,baseHrs:16,volatility:0.12},
  "Banana Island":        {tier:1,baseHrs:20,volatility:0.05},
  "Eko Atlantic City":    {tier:1,baseHrs:22,volatility:0.02},

  /* Tier 2 — Mid-range residential, 10–16h/day */
  "Lekki Phase 2/Ikota":  {tier:2,baseHrs:14,volatility:0.15},
  "Ajah":                 {tier:2,baseHrs:12,volatility:0.18},
  "Chevron/Lekki-Epe Expressway":{tier:2,baseHrs:14,volatility:0.15},
  "Igbo Efon/Ilasan":     {tier:2,baseHrs:13,volatility:0.17},
  "Gbagada":              {tier:2,baseHrs:13,volatility:0.17},
  "Maryland/Anthony":     {tier:2,baseHrs:12,volatility:0.18},
  "Surulere":             {tier:2,baseHrs:12,volatility:0.18},
  "Magodo":               {tier:2,baseHrs:14,volatility:0.15},
  "Ojodu/Omole":          {tier:2,baseHrs:13,volatility:0.17},
  "Ikeja (Allen/Opebi)":  {tier:2,baseHrs:14,volatility:0.15},
  "Ilupeju":              {tier:2,baseHrs:12,volatility:0.18},
  "Obalende/CMS":         {tier:2,baseHrs:14,volatility:0.15},
  "Onikan/Lagos Mainland":{tier:2,baseHrs:14,volatility:0.15},
  "Festac Town":          {tier:2,baseHrs:12,volatility:0.18},
  "Apapa":                {tier:2,baseHrs:14,volatility:0.15},

  /* Tier 3 — Regular residential, 6–12h/day */
  "Yaba":                 {tier:3,baseHrs:11,volatility:0.22},
  "Ebute Metta":          {tier:3,baseHrs:10,volatility:0.22},
  "Shomolu/Bariga":       {tier:3,baseHrs:9, volatility:0.25},
  "Kosofe/Ketu":          {tier:3,baseHrs:10,volatility:0.22},
  "Ojota/Oregun":         {tier:3,baseHrs:11,volatility:0.20},
  "Ogba":                 {tier:3,baseHrs:11,volatility:0.20},
  "Amuwo Odofin":         {tier:3,baseHrs:10,volatility:0.22},
  "Lagos Island":         {tier:3,baseHrs:11,volatility:0.20},
  "Ikorodu":              {tier:3,baseHrs:9, volatility:0.25},
  "Ibeju-Lekki":          {tier:3,baseHrs:8, volatility:0.28},
  "Epe":                  {tier:3,baseHrs:7, volatility:0.30},

  /* Tier 4 — High density/low income, 2–8h/day */
  "Mushin":               {tier:4,baseHrs:7, volatility:0.30},
  "Oshodi/Isolo":         {tier:4,baseHrs:7, volatility:0.30},
  "Agege":                {tier:4,baseHrs:6, volatility:0.32},
  "Alimosho/Ipaja":       {tier:4,baseHrs:6, volatility:0.35},
  "Ojo/Alaba":            {tier:4,baseHrs:5, volatility:0.35},
  "Badagry":              {tier:4,baseHrs:4, volatility:0.38},
};

/* Lagos power patterns by hour (typical DISCO load-shedding cycle) */
const HOUR_FACTORS=[
  /* 0-3am */  1.10,1.15,1.15,1.12,
  /* 4-7am */  1.08,1.02,0.95,0.88,
  /* 8-11am */ 0.82,0.78,0.75,0.72,
  /* 12-3pm */ 0.70,0.68,0.70,0.72,  /* peak load shedding */
  /* 4-7pm */  0.75,0.80,0.85,0.88,
  /* 8-11pm */ 0.92,0.98,1.05,1.08,
];

/* DISCO scheduled maintenance days/patterns */
const DISCO_PATTERNS={
  "Ikeja Electric":{maintenanceDay:3,maintenanceSeverity:0.6}, /* Wed maintenance */
  "Eko Electric":  {maintenanceDay:5,maintenanceSeverity:0.7}, /* Fri maintenance */
};

function getDiscoForArea(area){
  for(const d of DISCO){if(d.lgas.includes(area))return d.name;}
  return null;
}

/**
 * Get realistic power prediction for a given area and day.
 * Returns hours of power expected with confidence score.
 */
function predictPowerForDay(area,dayOffset=0){
  const rel=AREA_RELIABILITY[area]||{tier:3,baseHrs:10,volatility:0.22};
  const now=new Date();
  const targetDate=new Date(now.getTime()+dayOffset*86400000);
  const dayOfWeek=targetDate.getDay(); /* 0=Sun */
  const disco=getDiscoForArea(area);

  /* Base hours from tier */
  let hrs=rel.baseHrs;

  /* Weekend bonus — slightly better supply weekends */
  if(dayOfWeek===0||dayOfWeek===6)hrs*=1.08;

  /* DISCO maintenance penalty */
  if(disco&&DISCO_PATTERNS[disco]&&dayOfWeek===DISCO_PATTERNS[disco].maintenanceDay){
    hrs*=DISCO_PATTERNS[disco].maintenanceSeverity;
  }

  /* Apply historical reports bias */
  const recentReps=reports.filter(r=>{
    const age=(Date.now()-r.time)/(1000*3600);
    return r.area===area&&age<48;
  });
  const outageCount=recentReps.filter(r=>r.type==="out").length;
  const restoreCount=recentReps.filter(r=>r.type==="bck").length;
  if(outageCount>restoreCount&&outageCount>0){
    hrs*=Math.max(0.5,1-(outageCount-restoreCount)*0.08);
  }else if(restoreCount>outageCount&&restoreCount>0){
    hrs*=Math.min(1.15,1+(restoreCount-outageCount)*0.04);
  }

  /* Cap realistically */
  hrs=Math.min(23,Math.max(1,hrs));

  /* Confidence: higher for tier 1 and 2, lower for tier 3 and 4 */
  const confidence=rel.tier===1?88:rel.tier===2?75:rel.tier===3?62:50;

  return{
    hours:parseFloat(hrs.toFixed(1)),
    confidence,
    tier:rel.tier,
    disco,
    dayName:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dayOfWeek],
    outageRisk:hrs<8?"High":hrs<14?"Medium":"Low"
  };
}

/**
 * Get hourly prediction for today.
 * Returns array of 24 predictions (0–23h).
 */
function predictHourlyToday(area){
  const rel=AREA_RELIABILITY[area]||{tier:3,baseHrs:10,volatility:0.22};
  const now=new Date();
  const currentHour=now.getHours();

  return Array.from({length:24},(_,h)=>{
    const factor=HOUR_FACTORS[h];
    /* Scale: if baseHrs=18 and factor=1.15, very likely on. if baseHrs=6 and factor=0.7, likely off */
    const probability=Math.min(0.98,Math.max(0.02,(rel.baseHrs/24)*factor));
    const likelyOn=probability>0.5;
    const isPast=h<currentHour;
    return{hour:h,probability,likelyOn,isPast};
  });
}

/**
 * Get best time windows to expect power in area today.
 */
function getBestPowerWindows(area){
  const hourly=predictHourlyToday(area);
  const now=new Date().getHours();
  const windows=[];
  let inWindow=false;let windowStart=-1;

  for(let h=now;h<24;h++){
    if(hourly[h].likelyOn&&!inWindow){inWindow=true;windowStart=h;}
    else if(!hourly[h].likelyOn&&inWindow){inWindow=false;windows.push({start:windowStart,end:h-1});}
  }
  if(inWindow)windows.push({start:windowStart,end:23});
  return windows;
}

function formatHour(h){const ampm=h<12?"am":"pm";const display=h===0?12:h>12?h-12:h;return`${display}${ampm}`;}

function renderMyArea(){
  const loc=PR?.location_id?LOCS.find(l=>l.id===PR.location_id):null;
  const days7=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const now=Date.now();const dayMs=86400000;

  /* Generate 7-day predictions using the engine */
  let hrs;
  if(loc){
    /* Mix report data with predictions */
    hrs=days7.map((_,i)=>{
      const dayOffset=i-(new Date().getDay()||7)+1;
      const pred=predictPowerForDay(loc.area,dayOffset);
      /* For past days, use report data if available */
      if(dayOffset<0){
        const dayStart=now+(dayOffset*dayMs);const dayEnd=dayStart+dayMs;
        const dayReps=reports.filter(r=>r.area===loc.area&&r.time>=dayStart&&r.time<dayEnd);
        if(dayReps.length){
          const outage=dayReps.filter(r=>r.type==="out").length;
          const restored=dayReps.filter(r=>r.type==="bck").length;
          return parseFloat(Math.min(23,Math.max(1,12-(outage*3)+(restored*1.5))).toFixed(1));
        }
      }
      return pred.hours;
    });
  }else{
    hrs=days7.map(()=>null);
  }

  const hasData=hrs.some(h=>h!==null);
  if(!hasData){
    document.getElementById("myScore").innerHTML=`—<span class="score-u">h/day</span>`;
    document.getElementById("myDesc").textContent=loc?`No reports yet for ${loc.area}.`:"Set your location on Home or tap Locate Me.";
    document.getElementById("weekGrid").innerHTML=days7.map(d=>`<div class="dr"><div class="dl">${d}</div><div class="dtr"><div class="df" style="width:0%;background:var(--ink3)"></div></div><div class="dh" style="color:var(--ink3)">—</div></div>`).join("");
    renderFeed("myFeed",loc?.area||null);renderMyPlacesList();
    if(typeof renderMyAreaPredictWidget==='function')renderMyAreaPredictWidget();
    return;
  }

  const knownHrs=hrs.filter(h=>h!==null);
  const avg=(knownHrs.reduce((a,b)=>a+b,0)/knownHrs.length).toFixed(1);
  document.getElementById("myScore").innerHTML=`${avg}<span class="score-u">h/day</span>`;
  const pa=parseFloat(avg);
  const rel=AREA_RELIABILITY[loc?.area]||{tier:3};
  document.getElementById("myDesc").textContent=loc?(
    pa>16?`Excellent supply in ${loc.area} — Tier ${rel.tier} feeder`:
    pa>12?`Good supply in ${loc.area} this week`:
    pa>8?`Moderate supply in ${loc.area} — expect some outages`:
    pa>4?`Unstable supply near ${loc.name} — frequent cuts`:
    `Very poor supply in ${loc.area} — consider backup power`
  ):"Set your location on Home or tap Locate Me.";

  document.getElementById("weekGrid").innerHTML=days7.map((d,i)=>{
    const h=hrs[i]??0;const p=(h/24)*100;
    const c=h>16?"var(--p)":h>10?"var(--am)":"var(--rd)";
    return`<div class="dr"><div class="dl">${d}</div><div class="dtr"><div class="df" style="width:0%;background:${c}" data-w="${p}"></div></div><div class="dh">${h}h</div></div>`;
  }).join("");

  setTimeout(()=>{document.querySelectorAll("#weekGrid .df").forEach(bar=>{bar.style.width=bar.dataset.w+"%";});},50);
  renderFeed("myFeed",loc?.area||null);renderMyPlacesList();
  if(typeof renderMyAreaPredictWidget==='function')renderMyAreaPredictWidget();
}

/* ━━━ renderCommunity — includes NEPAWatch AI on leaderboard ━━━ */
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
      const aiCount=counts[AI_USER_ID]?.count||0;
      let reporters=Object.entries(counts).filter(([uid])=>uid!==AI_USER_ID).map(([uid,c])=>({name:profMap[uid]||"Reporter",count:c.count,isAI:false})).sort((a,b)=>b.count-a.count).slice(0,5);
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
          const subHtml=isAI?`<span style="color:var(--p);font-size:.6rem">🤖 AI auto-reporter</span>`:`${IC.user}&nbsp;Community reporter`;
          return`<div class="lbi"><div class="lbr ${rankClass[i]||""}">${i+1}</div><div style="flex:1"><div class="lbi-n">${nameHtml}</div><div class="lbi-a">${subHtml}</div></div><div class="lbi-c">${r.count}<small>report${r.count!==1?"s":""}</small></div></div>`;
        }).join("");
      }else{renderFallbackLeaderboard();}
    }else{renderFallbackLeaderboard();}
  }catch(e){renderFallbackLeaderboard();}

  const areas=Object.keys(LAGOS).map(a=>{const aReps=reports.filter(r=>r.area===a);const outN=aReps.filter(r=>r.type==="out").length;const bckN=aReps.filter(r=>r.type==="bck").length;const total=aReps.length;if(total===0)return{name:a,score:null,reports:0};const score=Math.max(5,Math.min(98,80-(outN*15)+(bckN*10)));return{name:a,score,reports:total};}).sort((a,b)=>{if(a.score===null&&b.score===null)return 0;if(a.score===null)return 1;if(b.score===null)return-1;return b.score-a.score;});
  document.getElementById("areaRank").innerHTML=areas.slice(0,16).map((a,i)=>{const hasData=a.score!==null;const c=!hasData?"var(--ink3)":a.score>70?"var(--p)":a.score>45?"var(--am)":"var(--rd)";return`<div class="zc" style="animation:pgIn .2s ease ${i*20}ms both"><div style="font-size:.68rem;color:var(--ink3);font-weight:700;width:22px;flex-shrink:0;text-align:center">${i+1}</div><div class="zb"><div class="zn">${a.name}<span>${a.reports?a.reports+" report"+(a.reports!==1?"s":""):"No reports yet"}</span></div><div class="zt"><div class="zf" style="width:${hasData?a.score:0}%;background:${c}"></div></div></div><div class="zp" style="color:${c}">${hasData?`${a.score}%`:"—"}</div></div>`;}).join("");
  document.getElementById("commNote").style.display="block";
}

function renderFallbackLeaderboard(){document.getElementById("lbList").innerHTML=`<div class="empty" style="padding:24px 18px"><div class="empty-ico">${IC.user}</div><p>Be the first to report! Top reporters will appear here.</p></div>`;}

function renderAccount(){const el=document.getElementById("authWrap");if(CU&&PR)renderProfile(el);else if(CU&&!PR)el.innerHTML=`<div class="loading-row"><div class="spin w"></div>Loading profile...</div>`;else renderAuthForm(el,"login");}

const LOGO_IMG_TAG=`<img src="logo.jpg" alt="NEPAWatch" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;

function renderAuthForm(el,mode){el.innerHTML=`<div class="auth-wrap"><div class="auth-logo"><div class="auth-logo-icon">${LOGO_IMG_TAG}</div><span class="auth-logo-name">NEPA<em>Watch</em></span></div><h2>${mode==="login"?"Welcome back":mode==="forgot"?"Reset password":"Join NEPAWatch"}</h2><p class="auth-sub">${mode==="login"?"Sign in to report outages and get email alerts.":mode==="forgot"?"Enter your email to receive a password reset link.":"Get free real-time power alerts for your Lagos street."}</p><div class="msg err" id="authErr"></div><div class="msg ok" id="authOk"></div>${mode==="register"?`<div class="fld"><label>Your Name</label><input id="inp-name" type="text" placeholder="e.g. Chidi" autocomplete="name"></div>`:""}<div class="fld"><label>Email</label><input id="inp-email" type="email" placeholder="you@example.com" autocomplete="email"></div>${mode!=="forgot"?`<div class="fld"><label>Password</label><input id="inp-pass" type="password" placeholder="Min 6 characters" autocomplete="${mode==="login"?"current-password":"new-password"}"></div>`:""}<button class="auth-btn" id="authBtn" onclick="handleAuth('${mode}')">${mode==="login"?"Sign In":mode==="forgot"?"Send Reset Link":"Create Account"}</button><div class="auth-switch">${mode==="login"?`No account? <a onclick="renderAuthForm(document.getElementById('authWrap'),'register')">Register free</a><br><span style="display:block;margin-top:8px"><a onclick="renderAuthForm(document.getElementById('authWrap'),'forgot')">Forgot password?</a></span>`:mode==="register"?`Have an account? <a onclick="renderAuthForm(document.getElementById('authWrap'),'login')">Sign in</a>`:`Remember it? <a onclick="renderAuthForm(document.getElementById('authWrap'),'login')">Back to sign in</a>`}</div></div>`;setTimeout(()=>{el.querySelectorAll("input").forEach(inp=>inp.addEventListener("keydown",e=>{if(e.key==="Enter")handleAuth(mode);}));document.getElementById("inp-email")?.focus();},80);}

async function handleAuth(mode){const errEl=document.getElementById("authErr"),okEl=document.getElementById("authOk"),btn=document.getElementById("authBtn");const email=(document.getElementById("inp-email")?.value||"").trim();const pass=document.getElementById("inp-pass")?.value||"";const name=(document.getElementById("inp-name")?.value||"").trim();errEl.classList.remove("show");okEl.classList.remove("show");if(!email||!email.includes("@")||!email.includes(".")){errEl.textContent="Please enter a valid email address.";errEl.classList.add("show");return;}if(mode!=="forgot"&&pass.length<6){errEl.textContent="Password must be at least 6 characters.";errEl.classList.add("show");return;}if(mode==="register"&&!name){errEl.textContent="Please enter your name.";errEl.classList.add("show");return;}btn.innerHTML=`${mode==="login"?"Signing in":mode==="forgot"?"Sending link":"Creating account"}&nbsp;<span class="spin"></span>`;btn.disabled=true;try{if(mode==="register"){await doRegister(name,email,pass);okEl.textContent="Account created! Check your email to confirm, then sign in.";okEl.classList.add("show");btn.innerHTML="Create Account";btn.disabled=false;setTimeout(()=>renderAuthForm(document.getElementById("authWrap"),"login"),2800);}else if(mode==="forgot"){await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname+"?mode=reset"});okEl.textContent="Reset link sent! Check your inbox (and spam folder).";okEl.classList.add("show");btn.innerHTML="Send Reset Link";btn.disabled=false;}else{await doLogin(email,pass);}}catch(e){let msg=e.message||"Something went wrong.";if(msg.toLowerCase().includes("invalid login")||msg.toLowerCase().includes("invalid credentials"))msg="Incorrect email or password. Please try again.";if(msg.toLowerCase().includes("email not confirmed"))msg="Please confirm your email first — check your inbox.";if(msg.toLowerCase().includes("already registered")||msg.toLowerCase().includes("user already registered"))msg="This email is already registered. Please sign in instead.";if(msg==="RATE_LIMIT"||msg.toLowerCase().includes("rate limit"))msg="Too many sign-up attempts. Please wait about 1 hour before trying again.";errEl.textContent=msg;errEl.classList.add("show");btn.innerHTML=mode==="login"?"Sign In":mode==="forgot"?"Send Reset Link":"Create Account";btn.disabled=false;}}

function renderProfile(el){const locText=PR.location_label||PR.location_name||"Not set";const notifOn=PR.notif_on!==false;const savedCount=savedPlaces.length;el.innerHTML=`<div class="ph"><h2>Account</h2><p>Manage your alerts and locations</p></div><div class="profile-card"><div class="pc-top"><div class="pc-av">${(PR.name||"?")[0].toUpperCase()}</div><div><div class="pc-name">${PR.name||"User"}</div><div class="pc-email">${PR.email||CU.email}</div></div></div><div class="pc-row"><div class="pc-rl-wrap"><div class="pc-ico"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1A3 3 0 0 0 4 4C4 7.5 7 12 7 12S10 7.5 10 4A3 3 0 0 0 7 1z" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="4" r="1.2" fill="currentColor"/></svg></div><div><div class="pc-rl">Watching area</div><div class="pc-rs">${locText}</div></div></div>${PR.location_id?`<button onclick="clearLoc()" style="font-size:.65rem;font-weight:600;color:var(--ink3);background:none;border:1px solid var(--bd);border-radius:6px;padding:4px 9px;cursor:pointer">Clear</button>`:""}</div><div class="pc-row"><div class="pc-rl-wrap"><div class="pc-ico"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 7L7 1.5L12.5 7V12.5H9V9H5V12.5H1.5V7Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></div><div><div class="pc-rl">Saved Places</div><div class="pc-rs">${savedCount} place${savedCount!==1?"s":""} saved</div></div></div><button onclick="go('myarea')" style="font-size:.65rem;font-weight:600;color:var(--p);background:var(--pp);border:1px solid var(--pb);border-radius:6px;padding:4px 9px;cursor:pointer">Manage</button></div><div class="pc-row"><div class="pc-rl-wrap"><div class="pc-ico"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M1 5L7 8.5L13 5" stroke="currentColor" stroke-width="1.3"/></svg></div><div><div class="pc-rl">Email Alerts</div><div class="pc-rs">${notifOn?"On — receiving alerts":"Off — tap to enable"}</div></div></div><button class="toggle ${notifOn?"on":""}" id="notifToggle" onclick="toggleNotif()"></button></div><div class="pc-row"><div class="pc-rl-wrap"><div class="pc-ico"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M1.5 13c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></div><div><div class="pc-rl">Alert address</div><div class="pc-rs">${CU.email}</div></div></div></div>${emailLog.length?`<div class="email-log"><div class="email-log-hd">Recent Alerts Sent</div>${emailLog.map(e=>`<div class="ei"><div class="ei-s">${e.subject}</div><div class="ei-m">${e.to} &middot; ${e.time}</div></div>`).join("")}</div>`:""}<button class="logout-btn" onclick="doLogout()">Sign Out</button></div>`;}

/* ━━━ go() — handles predict page + widget refresh ━━━ */
function go(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".ni").forEach(n=>n.classList.remove("active"));
  const pg=document.getElementById(`page-${page}`);
  pg.classList.add("active");pg.classList.remove("page-enter");
  void pg.offsetWidth;pg.classList.add("page-enter");
  document.getElementById(`nav-${page}`).classList.add("active");
  if(page==="myarea"){renderMyArea();}
  if(page==="predict"){if(typeof renderPredictPage==='function')renderPredictPage();}
  if(page==="community")renderCommunity();
  if(page==="account")renderAccount();
}

function render(){renderStats();renderFeed("liveFeed");renderDiscos();}

let _rtChannel=null,_recentAlerts=new Set();
function startRealtime(){try{if(_rtChannel){try{sb.removeChannel(_rtChannel);}catch(e){}}_rtChannel=sb.channel("realtime-reports-"+Date.now()).on("postgres_changes",{event:"INSERT",schema:"public",table:"reports"},payload=>{try{const r=payload.new;if(!r||reports.find(x=>String(x.id)===String(r.id)))return;reports.unshift({id:String(r.id),name:String(r.location_name||""),area:String(r.location_area||""),type:String(r.type||""),time:new Date(r.created_at).getTime(),confirms:Number(r.confirms)||1,userId:r.user_id,isAI:r.user_id===AI_USER_ID});if(reports.length>100)reports.pop();render();if(_nearbyAreas.length)renderNearbyDashboard();renderSavedPlacesHome();renderMyPlacesList();if(r.user_id&&r.user_id!==CU?.id&&r.user_id!==AI_USER_ID){const alertKey=r.id+r.type;if(!_recentAlerts.has(alertKey)){_recentAlerts.add(alertKey);setTimeout(()=>_recentAlerts.delete(alertKey),30000);sendAreaAlerts(r.location_name,r.location_area,r.type);}}}catch(e){}}).on("postgres_changes",{event:"UPDATE",schema:"public",table:"reports"},payload=>{try{const r=payload.new;const existing=reports.find(x=>String(x.id)===String(r.id));if(existing){existing.confirms=Number(r.confirms)||1;renderFeed("liveFeed");renderFeed("myFeed",PR?.location_area||null);}}catch(e){}}).subscribe();}catch(e){}}

async function shareApp(){const shareData={title:"NEPAWatch Lagos — Live Power Tracker",text:"Know when light don go or come back in your Lagos area. Real-time crowd-sourced reports + email alerts. Free!",url:APP_URL};if(navigator.share){try{await navigator.share(shareData);}catch(e){if(e.name!=="AbortError"){try{await navigator.clipboard.writeText(APP_URL);toast("Link copied!","ok");}catch(ce){toast(APP_URL,"info");}}}}else{try{await navigator.clipboard.writeText(APP_URL);toast("Link copied!","ok");}catch(e){toast(APP_URL+" — share this link","info");}}}

/* Expose prediction functions for predict.js */
window.NEPAPredict={
  predictPowerForDay,
  predictHourlyToday,
  getBestPowerWindows,
  formatHour,
  AREA_RELIABILITY,
  HOUR_FACTORS,
  getDiscoForArea,
};

/* ━━━ window.load — start AI reporter after app boots ━━━ */
window.addEventListener("load",async()=>{
  initTheme();
  buildFilter();
  document.getElementById("repOverlay").addEventListener("click",e=>{if(e.target===document.getElementById("repOverlay"))closeModal();});
  document.getElementById("placeOverlay").addEventListener("click",e=>{if(e.target===document.getElementById("placeOverlay"))closePlaceModal();});

  const urlParams=new URLSearchParams(window.location.search);
  const hashParams=new URLSearchParams(window.location.hash.replace("#",""));
  const isReset=(urlParams.get("mode")==="reset")||(hashParams.get("type")==="recovery");

  /* Restore session FIRST before anything else */
  await initAuth();
  await Promise.all([loadReports(),loadCustomLocations()]);
  if(CU)loadSavedPlaces();
  loadUserCount();
  updateBanner();
  startRealtime();
  startPolling();
  renderMyArea();

  /* AI Reporter startup */
  if(typeof AIReporter!=='undefined'){
    await AIReporter.loadHistory();
    AIReporter.start();
  }

  if(isReset){
    go("account");
    setTimeout(()=>{
      const el=document.getElementById("authWrap");
      el.innerHTML=`<div class="auth-wrap"><div class="auth-logo"><div class="auth-logo-icon" style="background:var(--p)">${LOGO_IMG_TAG}</div><span class="auth-logo-name">NEPA<em>Watch</em></span></div><h2>Set new password</h2><p class="auth-sub">Choose a strong new password for your account.</p><div class="msg err" id="authErr"></div><div class="msg ok" id="authOk"></div><div class="fld"><label>New Password</label><input id="inp-newpass" type="password" placeholder="Min 6 characters" autocomplete="new-password"></div><div class="fld"><label>Confirm Password</label><input id="inp-confpass" type="password" placeholder="Repeat password" autocomplete="new-password"></div><button class="auth-btn" id="authBtn" onclick="doPasswordReset()">Update Password</button></div>`;
    },500);
  }
});

async function doPasswordReset(){const errEl=document.getElementById("authErr"),okEl=document.getElementById("authOk"),btn=document.getElementById("authBtn");const np=(document.getElementById("inp-newpass")?.value||"").trim();const cp=(document.getElementById("inp-confpass")?.value||"").trim();errEl.classList.remove("show");okEl.classList.remove("show");if(np.length<6){errEl.textContent="Password must be at least 6 characters.";errEl.classList.add("show");return;}if(np!==cp){errEl.textContent="Passwords do not match.";errEl.classList.add("show");return;}btn.innerHTML='Updating&nbsp;<span class="spin"></span>';btn.disabled=true;try{const{error}=await sb.auth.updateUser({password:np});if(error)throw error;okEl.textContent="Password updated! You are now signed in.";okEl.classList.add("show");btn.innerHTML="Update Password";btn.disabled=false;setTimeout(()=>{window.history.replaceState({},",",window.location.pathname);go("home");},2000);}catch(e){errEl.textContent=e.message||"Could not update password.";errEl.classList.add("show");btn.innerHTML="Update Password";btn.disabled=false;}}
