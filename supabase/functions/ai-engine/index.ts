/* ═══════════════════════════════════════════════════════════════════════════
   NEPAWatch — ai-engine Edge Function (self-contained, no shared imports)
   Runs every 10 minutes via pg_cron. Replaces all browser-side AI logic.
   Deploy: supabase functions deploy ai-engine  (or paste into Dashboard)
   ═══════════════════════════════════════════════════════════════════════════ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS         = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };

/* ─── AI CONSTANTS ───────────────────────────────────────────────────────── */
const AI_USER_ID               = '00000000-0000-0000-0000-000000000001';
const AI_CONFIDENCE_THRESH     = 0.58;
const AI_RESTORE_THRESH        = 0.32;
const AI_MAX_PER_SCAN          = 6;
const AI_MIN_REFIRE_MS         = 45 * 60 * 1000;
const AI_BOOTSTRAP_THRESH      = 0.72;
const AI_BOOTSTRAP_COOLDOWN_MS = 6 * 3600 * 1000;
const AI_MAX_BOOTSTRAP_PER_SCAN = 2;

/* ─── AREA → NERC BAND ──────────────────────────────────────────────────── */
const AREA_BANDS: Record<string, string> = {
  /* FCT / ABUJA */
  "Maitama":"A","Asokoro":"A","Wuse 2":"A","Jabi":"A",
  "Wuse":"B","Garki":"B","Central Business District Abuja":"B","Utako":"B","Gudu":"B","Apo":"B","Durumi":"B",
  "Gwarinpa":"C","Kubwa":"C","Lokogoma":"C","Bwari":"C",
  "Karu":"D","Nyanya":"D","Kuje":"D","Abaji":"D","Gwagwalada":"D","Kwali":"E",
  /* NIGER STATE */
  "Minna GRA":"B","Minna":"C","Suleja":"C","Bida":"D","Kontagora":"D","Bosso Minna":"C","Maikunkele":"D",
  /* NASARAWA */
  "Lafia GRA":"C","Lafia":"D","Keffi":"C","Akwanga":"D","Nasarawa Egon":"E",
  /* KOGI */
  "Lokoja GRA":"C","Lokoja":"D","Okene":"D","Kabba":"D","Idah":"E",
  /* OYO */
  "Ibadan GRA":"A","Bodija":"B","Ring Road Ibadan":"B","Iyaganku":"B","Agodi":"B",
  "Mokola":"C","Challenge Ibadan":"C","Dugbe":"C","Sango Ibadan":"C","Ojoo":"C","Oke Ado":"C","Ekotedo":"C",
  "Oluyole":"D","Iwo Road":"D","Agege Ibadan":"D","Ogbomoso":"D","Oyo Town":"D","Iseyin":"E","Saki":"E",
  /* OGUN */
  "Abeokuta GRA":"B","Oke Mosan":"B","Panseke":"C","Kuto":"C","Sapon":"C","Kemta":"C",
  "Ifo":"D","Sagamu":"C","Ilaro":"D","Shagamu":"C","Ijebu Ode":"C","Ijebu Igbo":"D",
  /* OSUN */
  "Osogbo GRA":"B","Station Road Osogbo":"C","Oke Baale":"C","Ile Ife":"C","Ilesa":"C","Ede":"D",
  /* KWARA */
  "Ilorin GRA":"B","Taiwo Road Ilorin":"C","Tanke Ilorin":"C","Oloje Ilorin":"D","Offa":"D","Omu Aran":"E",
  /* ENUGU */
  "GRA Enugu":"A","Independence Layout Enugu":"A","Trans Ekulu":"B","New Haven Enugu":"B",
  "Abakpa":"C","Coal Camp":"C","Obiagu":"C","Maryland Enugu":"C","Uwani":"C","Ogui":"D",
  "Garden Avenue Enugu":"B","Achara Layout":"C",
  /* ANAMBRA */
  "Awka GRA":"B","Unizik Road Awka":"C","Okpuno":"D","Nnewi":"C",
  "Onitsha GRA":"B","Fegge Onitsha":"C","Bridge Head Onitsha":"C","Ekwueme Square Awka":"C",
  /* IMO */
  "Owerri GRA":"B","New Owerri":"B","Trans Amadi Owerri":"C","Aladinma":"C",
  "Naze Owerri":"C","World Bank Owerri":"C","Orlu":"D","Okigwe":"D",
  /* ABIA */
  "Umuahia GRA":"C","Umuola Road":"C","Ubakala":"D","Aba GRA":"B","Aba Road Aba":"C","Ngwa Road":"C",
  /* EBONYI */
  "Abakaliki GRA":"C","Mile 50 Abakaliki":"C","Ishieke":"D",
  /* RIVERS */
  "Port Harcourt GRA Phase 1":"A","Port Harcourt GRA Phase 2":"A","GRA Phase 3":"B",
  "D-Line PH":"B","Old GRA PH":"B","Trans Amadi PH":"C","Artillery PH":"C","Rumuola":"C",
  "Rumuibekwe":"C","Woji":"C","Eliozu":"C","Diobu":"D","Mile 1 PH":"D","Mile 2 PH":"D",
  "Mile 3 PH":"D","Rumuomasi":"D","Rumuokoro":"D","Peter Odili Road":"C","Aba Road PH":"C",
  "Choba":"C","Rumuokwuta":"D",
  /* BAYELSA */
  "Yenagoa GRA":"C","Tombia":"D","Swali":"D","Opolo":"D","Kpansia":"D","Amarata":"D",
  /* CROSS RIVER */
  "Calabar GRA":"B","Calabar South":"C","UNICAL Road":"C","Etta Agbo":"D","Marian":"C",
  /* AKWA IBOM */
  "Uyo GRA":"B","Ewet Housing":"C","Wellington Bassey Way Uyo":"C","Ikot Ekpene":"C","Eket":"D",
  /* EDO */
  "Benin City GRA":"A","Airport Road Benin":"B","Ugbowo":"C","Ekehuan Road":"C",
  "Ring Road Benin":"C","Sapele Road Benin":"C","Upper Siluko":"D","Ikpoba Hill":"C",
  "Uselu":"C","New Benin":"C","Sakponba":"D",
  /* DELTA */
  "Asaba GRA":"B","Cable Point Asaba":"C","Summit Asaba":"C","Okpanam":"C",
  "Warri GRA":"B","PTI Road Warri":"C","Okumagba Avenue":"C","Effurun":"C","Ovwian":"D","Agbarho":"D",
  /* ONDO */
  "Akure GRA":"B","Ado Road Akure":"C","FUTA Road":"C","Ondo Town":"D","Owo":"D","Ikare":"E",
  /* EKITI */
  "Ado Ekiti GRA":"C","Basiri":"C","Ido Ekiti":"D","Ikole Ekiti":"E",
  /* LAGOS NORTH (IE) */
  "Ikeja GRA":"A","Ikeja (Allen/Opebi)":"A","Maryland/Anthony":"B","Ogba":"B","Agege":"C",
  "Alimosho/Ipaja":"D","Ojodu/Omole":"B","Kosofe/Ketu":"C","Gbagada":"B","Ilupeju":"B",
  "Mushin":"D","Oshodi/Isolo":"C","Shomolu/Bariga":"C","Ikorodu":"D","Magodo":"B",
  "Ojota/Oregun":"C","Computer Village Ikeja":"B","Murtala Muhammed Airport":"B",
  /* LAGOS SOUTH (EKEDC) */
  "Lagos Island":"A","Ikoyi":"A","Victoria Island":"A","Obalende/CMS":"B","Ebute Metta":"C",
  "Apapa":"B","Surulere":"B","Yaba":"B","Lekki Phase 1":"A","Lekki Phase 2/Ikota":"B","Ajah":"C",
  "Chevron/Lekki-Epe Expressway":"B","Igbo Efon/Ilasan":"C","Ibeju-Lekki":"D",
  "Festac Town":"C","Amuwo Odofin":"C","Ojo/Alaba":"D","Badagry":"E","Epe":"D",
  /* KADUNA */
  "Kaduna GRA":"A","Ungwan Rimi":"B","Barnawa":"C","Tudun Wada Kaduna":"C","Kawo":"C",
  "Rigasa":"D","Malali":"D","Sabon Gari Kaduna":"C","Hayin Banki":"D","Gonin Gora":"D",
  /* KEBBI */
  "Birnin Kebbi GRA":"C","Kalgo Road":"D","Koko":"D","Argungu":"E",
  /* SOKOTO */
  "Sokoto GRA":"B","Mabera":"C","Gawon Nama Sokoto":"D","Runjin Sambo":"D",
  /* ZAMFARA */
  "Gusau GRA":"C","Tudun Wada Gusau":"D",
  /* KANO */
  "Nassarawa GRA Kano":"A","Bompai Industrial":"B","Sabon Gari Kano":"C","Gwale":"C",
  "Kofar Mata":"D","Tarauni":"D","Hotoro":"D","Dorayi":"D","Zaria Road Kano":"C",
  "Fagge":"C","Panshekara":"D","Wudil":"E","Kiru":"E",
  /* JIGAWA */
  "Dutse GRA Jigawa":"C","Kazaure":"D",
  /* KATSINA */
  "Katsina GRA":"C","Daura Road":"D",
  /* PLATEAU */
  "Jos GRA":"B","Rayfield":"B","Bukuru":"C","Bauchi Road Jos":"C","Zaria Road Jos":"C",
  "Anglo-Jos":"C","Rantya":"D","Tudun Wada Jos":"D","Kabong":"D",
  /* BENUE */
  "Makurdi GRA":"C","High Level Makurdi":"C","North Bank Makurdi":"C","Wurukum":"C","Wadata":"D",
  /* ADAMAWA */
  "Yola GRA":"C","Jimeta":"C","Doubeli":"D","Karewa Yola":"D",
  /* TARABA */
  "Jalingo GRA":"C","Hammaruwa":"D","Mayo-Belwa":"E",
  /* GOMBE */
  "Gombe GRA":"C","Pantami":"C","Tudun Wada Gombe":"D",
  /* BAUCHI */
  "Bauchi GRA":"C","Yelwa":"D","Wunti":"D",
  /* BORNO */
  "Maiduguri GRA":"C","Bolori":"D","Gwange":"D",
  /* YOBE */
  "Damaturu GRA":"D",
};

/* ─── AREA COORDINATES (1-degree grid for weather) ──────────────────────── */
const AREA_COORDS: Record<string, { lat: number; lng: number }> = {
  "Maitama":{lat:9.082,lng:7.471},"Asokoro":{lat:9.04,lng:7.52},"Wuse 2":{lat:9.072,lng:7.487},
  "Wuse":{lat:9.068,lng:7.476},"Jabi":{lat:9.083,lng:7.456},"Garki":{lat:9.06,lng:7.488},
  "Central Business District Abuja":{lat:9.06,lng:7.49},"Utako":{lat:9.078,lng:7.465},
  "Gudu":{lat:9.025,lng:7.478},"Apo":{lat:9.02,lng:7.503},"Durumi":{lat:9.035,lng:7.47},
  "Gwarinpa":{lat:9.114,lng:7.436},"Kubwa":{lat:9.144,lng:7.406},"Lokogoma":{lat:8.98,lng:7.51},
  "Bwari":{lat:9.18,lng:7.38},"Karu":{lat:8.95,lng:7.56},"Nyanya":{lat:8.96,lng:7.55},
  "Kuje":{lat:8.88,lng:7.22},"Gwagwalada":{lat:8.94,lng:7.09},"Abaji":{lat:8.47,lng:6.94},
  "Kwali":{lat:8.79,lng:7.04},"Minna GRA":{lat:9.622,lng:6.558},"Minna":{lat:9.614,lng:6.557},
  "Suleja":{lat:9.181,lng:7.182},"Bida":{lat:9.078,lng:6.011},"Kontagora":{lat:10.4,lng:5.47},
  "Bosso Minna":{lat:9.645,lng:6.57},"Lafia GRA":{lat:8.493,lng:8.515},"Lafia":{lat:8.482,lng:8.51},
  "Keffi":{lat:8.85,lng:7.87},"Akwanga":{lat:8.91,lng:8.4},"Lokoja GRA":{lat:7.803,lng:6.742},
  "Lokoja":{lat:7.803,lng:6.742},"Okene":{lat:7.55,lng:6.24},"Kabba":{lat:7.82,lng:6.07},
  "Idah":{lat:7.12,lng:6.73},"Ibadan GRA":{lat:7.392,lng:3.901},"Bodija":{lat:7.43,lng:3.92},
  "Ring Road Ibadan":{lat:7.378,lng:3.905},"Iyaganku":{lat:7.385,lng:3.917},"Agodi":{lat:7.396,lng:3.92},
  "Mokola":{lat:7.409,lng:3.9},"Challenge Ibadan":{lat:7.374,lng:3.892},"Dugbe":{lat:7.378,lng:3.898},
  "Sango Ibadan":{lat:7.425,lng:3.881},"Ojoo":{lat:7.46,lng:3.905},"Oke Ado":{lat:7.39,lng:3.894},
  "Oluyole":{lat:7.345,lng:3.87},"Iwo Road":{lat:7.398,lng:3.937},"Ogbomoso":{lat:8.13,lng:4.24},
  "Oyo Town":{lat:7.85,lng:3.93},"Iseyin":{lat:7.97,lng:3.6},"Saki":{lat:8.67,lng:3.39},
  "Abeokuta GRA":{lat:7.162,lng:3.358},"Oke Mosan":{lat:7.178,lng:3.342},"Panseke":{lat:7.148,lng:3.36},
  "Kuto":{lat:7.15,lng:3.349},"Sapon":{lat:7.142,lng:3.337},"Kemta":{lat:7.13,lng:3.33},
  "Sagamu":{lat:6.84,lng:3.65},"Ifo":{lat:6.81,lng:3.19},"Ilaro":{lat:6.89,lng:2.98},
  "Shagamu":{lat:6.84,lng:3.65},"Ijebu Ode":{lat:6.82,lng:3.92},"Ijebu Igbo":{lat:6.99,lng:3.99},
  "Osogbo GRA":{lat:7.775,lng:4.564},"Station Road Osogbo":{lat:7.77,lng:4.56},
  "Oke Baale":{lat:7.769,lng:4.557},"Ile Ife":{lat:7.48,lng:4.56},"Ilesa":{lat:7.63,lng:4.74},
  "Ede":{lat:7.73,lng:4.43},"Ilorin GRA":{lat:8.504,lng:4.55},"Taiwo Road Ilorin":{lat:8.496,lng:4.552},
  "Tanke Ilorin":{lat:8.48,lng:4.58},"Oloje Ilorin":{lat:8.52,lng:4.52},"Offa":{lat:8.15,lng:4.72},
  "Omu Aran":{lat:8.21,lng:5.1},"GRA Enugu":{lat:6.449,lng:7.5},"Independence Layout Enugu":{lat:6.44,lng:7.505},
  "Trans Ekulu":{lat:6.468,lng:7.535},"New Haven Enugu":{lat:6.438,lng:7.484},"Abakpa":{lat:6.475,lng:7.55},
  "Coal Camp":{lat:6.456,lng:7.497},"Obiagu":{lat:6.452,lng:7.49},"Maryland Enugu":{lat:6.461,lng:7.51},
  "Uwani":{lat:6.442,lng:7.49},"Ogui":{lat:6.447,lng:7.508},"Garden Avenue Enugu":{lat:6.435,lng:7.5},
  "Achara Layout":{lat:6.422,lng:7.51},"Awka GRA":{lat:6.213,lng:7.075},"Unizik Road Awka":{lat:6.22,lng:7.082},
  "Okpuno":{lat:6.24,lng:7.04},"Nnewi":{lat:6.02,lng:6.91},"Onitsha GRA":{lat:6.166,lng:6.786},
  "Fegge Onitsha":{lat:6.159,lng:6.792},"Bridge Head Onitsha":{lat:6.145,lng:6.78},
  "Owerri GRA":{lat:5.4906,lng:7.028},"New Owerri":{lat:5.51,lng:7.05},"Trans Amadi Owerri":{lat:5.498,lng:7.015},
  "Aladinma":{lat:5.505,lng:7.038},"Naze Owerri":{lat:5.485,lng:7.02},"World Bank Owerri":{lat:5.52,lng:7.04},
  "Orlu":{lat:5.78,lng:7.05},"Okigwe":{lat:5.86,lng:7.35},"Umuahia GRA":{lat:5.532,lng:7.492},
  "Umuola Road":{lat:5.528,lng:7.489},"Ubakala":{lat:5.49,lng:7.53},"Aba GRA":{lat:5.107,lng:7.363},
  "Aba Road Aba":{lat:5.115,lng:7.354},"Ngwa Road":{lat:5.12,lng:7.38},"Abakaliki GRA":{lat:6.322,lng:8.1},
  "Mile 50 Abakaliki":{lat:6.338,lng:8.114},"Ishieke":{lat:6.35,lng:8.08},
  "Port Harcourt GRA Phase 1":{lat:4.828,lng:7.015},"Port Harcourt GRA Phase 2":{lat:4.815,lng:6.99},
  "GRA Phase 3":{lat:4.805,lng:6.97},"D-Line PH":{lat:4.81,lng:7.005},"Artillery PH":{lat:4.79,lng:7.01},
  "Trans Amadi PH":{lat:4.83,lng:7.04},"Rumuola":{lat:4.85,lng:7.02},"Rumuibekwe":{lat:4.845,lng:7.03},
  "Woji":{lat:4.82,lng:7.05},"Eliozu":{lat:4.88,lng:7.07},"Diobu":{lat:4.82,lng:7.0},
  "Mile 1 PH":{lat:4.825,lng:7.007},"Mile 2 PH":{lat:4.818,lng:6.998},"Mile 3 PH":{lat:4.81,lng:6.99},
  "Rumuomasi":{lat:4.835,lng:7.018},"Rumuokoro":{lat:4.86,lng:7.06},"Peter Odili Road":{lat:4.84,lng:7.035},
  "Aba Road PH":{lat:4.825,lng:7.03},"Choba":{lat:4.895,lng:7.018},"Rumuokwuta":{lat:4.85,lng:7.028},
  "Old GRA PH":{lat:4.82,lng:7.01},"Yenagoa GRA":{lat:4.926,lng:6.272},"Tombia":{lat:4.88,lng:6.26},
  "Swali":{lat:4.92,lng:6.25},"Opolo":{lat:4.91,lng:6.26},"Kpansia":{lat:4.9,lng:6.265},
  "Amarata":{lat:4.93,lng:6.27},"Calabar GRA":{lat:4.962,lng:8.342},"Calabar South":{lat:4.95,lng:8.338},
  "UNICAL Road":{lat:4.975,lng:8.335},"Etta Agbo":{lat:4.94,lng:8.345},"Marian":{lat:4.96,lng:8.349},
  "Uyo GRA":{lat:5.05,lng:7.925},"Ewet Housing":{lat:5.06,lng:7.935},"Wellington Bassey Way Uyo":{lat:5.052,lng:7.92},
  "Ikot Ekpene":{lat:5.18,lng:7.72},"Eket":{lat:4.66,lng:7.92},"Benin City GRA":{lat:6.342,lng:5.635},
  "Airport Road Benin":{lat:6.348,lng:5.623},"Ugbowo":{lat:6.36,lng:5.64},"Ekehuan Road":{lat:6.32,lng:5.61},
  "Ring Road Benin":{lat:6.332,lng:5.627},"Sapele Road Benin":{lat:6.35,lng:5.645},"Upper Siluko":{lat:6.31,lng:5.6},
  "Ikpoba Hill":{lat:6.335,lng:5.648},"Uselu":{lat:6.37,lng:5.65},"New Benin":{lat:6.328,lng:5.635},
  "Asaba GRA":{lat:6.2,lng:6.745},"Cable Point Asaba":{lat:6.205,lng:6.75},"Summit Asaba":{lat:6.21,lng:6.738},
  "Okpanam":{lat:6.22,lng:6.72},"Warri GRA":{lat:5.52,lng:5.749},"PTI Road Warri":{lat:5.533,lng:5.755},
  "Okumagba Avenue":{lat:5.525,lng:5.748},"Effurun":{lat:5.54,lng:5.78},"Ovwian":{lat:5.51,lng:5.79},
  "Agbarho":{lat:5.65,lng:5.8},"Akure GRA":{lat:7.26,lng:5.204},"Ado Road Akure":{lat:7.27,lng:5.21},
  "FUTA Road":{lat:7.28,lng:5.19},"Ondo Town":{lat:7.1,lng:4.84},"Owo":{lat:7.19,lng:5.59},
  "Ikare":{lat:7.52,lng:5.76},"Ado Ekiti GRA":{lat:7.635,lng:5.219},"Basiri":{lat:7.62,lng:5.23},
  "Ido Ekiti":{lat:7.65,lng:5.21},"Ikole Ekiti":{lat:7.79,lng:5.49},
  "Ikeja GRA":{lat:6.5968,lng:3.3419},"Ikeja (Allen/Opebi)":{lat:6.601,lng:3.3497},
  "Maryland/Anthony":{lat:6.563,lng:3.359},"Ogba":{lat:6.625,lng:3.319},"Agege":{lat:6.634,lng:3.319},
  "Alimosho/Ipaja":{lat:6.594,lng:3.258},"Ojodu/Omole":{lat:6.649,lng:3.362},"Kosofe/Ketu":{lat:6.597,lng:3.39},
  "Gbagada":{lat:6.562,lng:3.385},"Ilupeju":{lat:6.565,lng:3.36},"Mushin":{lat:6.526,lng:3.358},
  "Oshodi/Isolo":{lat:6.534,lng:3.344},"Shomolu/Bariga":{lat:6.55,lng:3.379},"Ikorodu":{lat:6.619,lng:3.507},
  "Magodo":{lat:6.605,lng:3.38},"Ojota/Oregun":{lat:6.588,lng:3.368},"Computer Village Ikeja":{lat:6.5986,lng:3.3378},
  "Murtala Muhammed Airport":{lat:6.5774,lng:3.3215},"Lagos Island":{lat:6.4541,lng:3.3947},
  "Ikoyi":{lat:6.459,lng:3.431},"Victoria Island":{lat:6.428,lng:3.4225},"Obalende/CMS":{lat:6.458,lng:3.396},
  "Ebute Metta":{lat:6.474,lng:3.376},"Apapa":{lat:6.449,lng:3.359},"Surulere":{lat:6.4958,lng:3.3561},
  "Yaba":{lat:6.508,lng:3.374},"Lekki Phase 1":{lat:6.443,lng:3.482},"Lekki Phase 2/Ikota":{lat:6.435,lng:3.535},
  "Ajah":{lat:6.468,lng:3.577},"Chevron/Lekki-Epe Expressway":{lat:6.436,lng:3.518},
  "Igbo Efon/Ilasan":{lat:6.445,lng:3.509},"Ibeju-Lekki":{lat:6.48,lng:3.72},"Festac Town":{lat:6.461,lng:3.284},
  "Amuwo Odofin":{lat:6.469,lng:3.304},"Ojo/Alaba":{lat:6.505,lng:3.18},"Badagry":{lat:6.42,lng:2.891},
  "Epe":{lat:6.585,lng:3.98},"Kaduna GRA":{lat:10.522,lng:7.44},"Ungwan Rimi":{lat:10.51,lng:7.435},
  "Barnawa":{lat:10.49,lng:7.438},"Tudun Wada Kaduna":{lat:10.53,lng:7.458},"Kawo":{lat:10.54,lng:7.42},
  "Rigasa":{lat:10.505,lng:7.385},"Malali":{lat:10.56,lng:7.47},"Sabon Gari Kaduna":{lat:10.52,lng:7.445},
  "Hayin Banki":{lat:10.48,lng:7.41},"Gonin Gora":{lat:10.47,lng:7.39},"Birnin Kebbi GRA":{lat:12.452,lng:4.202},
  "Kalgo Road":{lat:12.44,lng:4.21},"Koko":{lat:11.42,lng:4.51},"Argungu":{lat:12.74,lng:4.52},
  "Sokoto GRA":{lat:13.06,lng:5.24},"Mabera":{lat:13.07,lng:5.26},"Gawon Nama Sokoto":{lat:13.05,lng:5.23},
  "Runjin Sambo":{lat:13.04,lng:5.25},"Gusau GRA":{lat:12.168,lng:6.653},"Tudun Wada Gusau":{lat:12.175,lng:6.66},
  "Nassarawa GRA Kano":{lat:11.998,lng:8.523},"Bompai Industrial":{lat:12.01,lng:8.54},
  "Sabon Gari Kano":{lat:12.0,lng:8.532},"Gwale":{lat:11.985,lng:8.515},"Kofar Mata":{lat:12.02,lng:8.56},
  "Tarauni":{lat:12.005,lng:8.51},"Hotoro":{lat:11.99,lng:8.565},"Dorayi":{lat:11.97,lng:8.5},
  "Zaria Road Kano":{lat:12.04,lng:8.55},"Fagge":{lat:12.015,lng:8.528},"Panshekara":{lat:11.975,lng:8.545},
  "Wudil":{lat:11.8,lng:8.85},"Kiru":{lat:11.76,lng:8.45},"Dutse GRA Jigawa":{lat:11.76,lng:9.343},
  "Kazaure":{lat:12.68,lng:8.19},"Katsina GRA":{lat:12.995,lng:7.599},"Daura Road":{lat:12.99,lng:7.605},
  "Jos GRA":{lat:9.918,lng:8.892},"Rayfield":{lat:9.9,lng:8.898},"Bukuru":{lat:9.79,lng:8.86},
  "Bauchi Road Jos":{lat:9.93,lng:8.92},"Zaria Road Jos":{lat:9.94,lng:8.91},"Anglo-Jos":{lat:9.925,lng:8.88},
  "Rantya":{lat:9.91,lng:8.87},"Tudun Wada Jos":{lat:9.905,lng:8.885},"Kabong":{lat:9.935,lng:8.865},
  "Makurdi GRA":{lat:7.731,lng:8.532},"High Level Makurdi":{lat:7.74,lng:8.54},"North Bank Makurdi":{lat:7.725,lng:8.515},
  "Wurukum":{lat:7.72,lng:8.538},"Wadata":{lat:7.715,lng:8.545},"Yola GRA":{lat:9.205,lng:12.482},
  "Jimeta":{lat:9.28,lng:12.47},"Doubeli":{lat:9.21,lng:12.47},"Karewa Yola":{lat:9.22,lng:12.49},
  "Jalingo GRA":{lat:8.89,lng:11.362},"Hammaruwa":{lat:8.88,lng:11.37},"Mayo-Belwa":{lat:9.07,lng:12.0},
  "Gombe GRA":{lat:10.295,lng:11.167},"Pantami":{lat:10.3,lng:11.17},"Tudun Wada Gombe":{lat:10.29,lng:11.16},
  "Bauchi GRA":{lat:10.317,lng:9.85},"Yelwa":{lat:10.31,lng:9.86},"Wunti":{lat:10.325,lng:9.84},
  "Maiduguri GRA":{lat:11.847,lng:13.16},"Bolori":{lat:11.86,lng:13.15},"Gwange":{lat:11.84,lng:13.17},
  "Damaturu GRA":{lat:11.747,lng:11.96},
};

/* ─── DISCO AREA LISTS (for building area→DISCO map) ────────────────────── */
const DISCO_AREAS: Record<string, string[]> = {
  'IE':     ["Ikeja GRA","Ikeja (Allen/Opebi)","Maryland/Anthony","Ogba","Agege","Alimosho/Ipaja","Ojodu/Omole","Kosofe/Ketu","Gbagada","Ilupeju","Mushin","Oshodi/Isolo","Shomolu/Bariga","Ikorodu","Magodo","Ojota/Oregun","Computer Village Ikeja","Murtala Muhammed Airport"],
  'EKEDC':  ["Lagos Island","Ikoyi","Victoria Island","Obalende/CMS","Ebute Metta","Apapa","Surulere","Yaba","Lekki Phase 1","Lekki Phase 2/Ikota","Ajah","Chevron/Lekki-Epe Expressway","Igbo Efon/Ilasan","Ibeju-Lekki","Festac Town","Amuwo Odofin","Ojo/Alaba","Badagry","Epe"],
  'AEDC':   ["Maitama","Asokoro","Wuse 2","Wuse","Garki","Central Business District Abuja","Gwarinpa","Kubwa","Karu","Nyanya","Gwagwalada","Jabi","Utako","Gudu","Apo","Durumi","Lokogoma","Bwari","Kuje","Abaji","Kwali","Minna","Suleja","Bida","Kontagora","Lafia","Keffi","Akwanga","Lokoja","Okene","Kabba","Idah"],
  'IBEDC':  ["Ibadan GRA","Bodija","Ring Road Ibadan","Challenge Ibadan","Sango Ibadan","Dugbe","Mokola","Agodi","Iyaganku","Oluyole","Ojoo","Agege Ibadan","Iwo Road","Oke Ado","Ekotedo","Abeokuta GRA","Oke Mosan","Panseke","Kuto","Sapon","Kemta","Ifo","Sagamu","Ilaro","Shagamu","Ijebu Ode","Ijebu Igbo","Osogbo GRA","Station Road Osogbo","Oke Baale","Ilorin GRA","Taiwo Road Ilorin","Ogbomoso","Oyo Town","Iseyin","Saki"],
  'EEDC':   ["GRA Enugu","Independence Layout Enugu","Trans Ekulu","Abakpa","Coal Camp","Obiagu","Maryland Enugu","New Haven Enugu","Uwani","Ogui","Garden Avenue Enugu","Achara Layout","Awka GRA","Unizik Road Awka","Okpuno","Nnewi","Onitsha GRA","Fegge Onitsha","Owerri GRA","Trans Amadi Owerri","New Owerri","Aladinma","Naze Owerri","Umuahia GRA","Umuola Road","Ubakala","Abakaliki GRA","Mile 50 Abakaliki"],
  'PHED':   ["Port Harcourt GRA Phase 1","Port Harcourt GRA Phase 2","GRA Phase 3","D-Line PH","Artillery PH","Trans Amadi PH","Rumuola","Rumuomasi","Rumuibekwe","Diobu","Mile 1 PH","Mile 2 PH","Mile 3 PH","Old GRA PH","Eliozu","Woji","Rumuokoro","Rumuokwuta","Choba","Peter Odili Road","Aba Road PH","Yenagoa GRA","Tombia","Swali","Calabar GRA","Calabar South","UNICAL Road","Etta Agbo","Uyo GRA","Ewet Housing","Wellington Bassey Way Uyo","Ikot Ekpene","Eket"],
  'KAEDCO': ["Kaduna GRA","Ungwan Rimi","Barnawa","Tudun Wada Kaduna","Kawo","Rigasa","Malali","Sabon Gari Kaduna","Hayin Banki","Gonin Gora","Birnin Kebbi GRA","Kalgo Road","Koko","Argungu","Sokoto GRA","Mabera","Gusau GRA","Tudun Wada Gusau"],
  'KEDCO':  ["Nassarawa GRA Kano","Bompai Industrial","Sabon Gari Kano","Gwale","Kofar Mata","Tarauni","Hotoro","Dorayi","Zaria Road Kano","Fagge","Panshekara","Wudil","Kiru","Dutse GRA Jigawa","Kazaure","Katsina GRA","Daura Road"],
  'BEDC':   ["Benin City GRA","Airport Road Benin","Ugbowo","Ekehuan Road","Ring Road Benin","Sapele Road Benin","Sakponba","Upper Siluko","Asaba GRA","Cable Point Asaba","Summit Asaba","Okpanam","Warri GRA","PTI Road Warri","Okumagba Avenue","Effurun","Ovwian","Agbarho","Akure GRA","Ado Road Akure","FUTA Road","Ado Ekiti GRA","Basiri","Ido Ekiti"],
  'JED':    ["Jos GRA","Rayfield","Bukuru","Bauchi Road Jos","Zaria Road Jos","Anglo-Jos","Rantya","Tudun Wada Jos","Kabong","Makurdi GRA","High Level Makurdi","North Bank Makurdi","Wurukum","Wadata"],
  'YEDC':   ["Yola GRA","Jimeta","Doubeli","Karewa Yola","Jalingo GRA","Hammaruwa","Mayo-Belwa","Gombe GRA","Pantami","Tudun Wada Gombe","Bauchi GRA","Yelwa","Wunti","Maiduguri GRA","Bolori","Gwange","Damaturu GRA"],
};

/* ─── BASELINES ──────────────────────────────────────────────────────────── */
const BAND_BASELINE: Record<string, number> = { A:0.18,B:0.28,C:0.42,D:0.58,E:0.74 };

const DISCO_BAND_BASELINE: Record<string, Record<string, number>> = {
  'IE':    {A:0.18,B:0.28,C:0.42,D:0.58,E:0.74},'EKEDC':{A:0.18,B:0.28,C:0.42,D:0.58,E:0.74},
  'AEDC':  {A:0.22,B:0.34,C:0.50,D:0.64,E:0.78},'IBEDC':{A:0.32,B:0.44,C:0.57,D:0.70,E:0.82},
  'PHED':  {A:0.38,B:0.50,C:0.62,D:0.74,E:0.86},'EEDC': {A:0.42,B:0.53,C:0.64,D:0.75,E:0.86},
  'BEDC':  {A:0.32,B:0.45,C:0.58,D:0.71,E:0.84},'JED':  {A:0.45,B:0.56,C:0.67,D:0.77,E:0.88},
  'KEDCO': {A:0.40,B:0.52,C:0.64,D:0.76,E:0.88},'KAEDCO':{A:0.48,B:0.59,C:0.70,D:0.81,E:0.92},
  'YEDC':  {A:0.55,B:0.65,C:0.74,D:0.84,E:0.94},
};

const DISCO_BAND_SUPPLY_HOURS: Record<string, Record<string, number>> = {
  'IE':    {A:22,B:18,C:13,D:9,E:7},'EKEDC':{A:22,B:18,C:13,D:9,E:7},
  'AEDC':  {A:20,B:16,C:12,D:8,E:6},'IBEDC':{A:17,B:13,C:10,D:7,E:5},
  'PHED':  {A:14,B:11,C:9,D:6,E:3}, 'EEDC': {A:14,B:11,C:9,D:6,E:3},
  'BEDC':  {A:17,B:13,C:10,D:7,E:4},'JED':  {A:13,B:10,C:8,D:6,E:3},
  'KEDCO': {A:14,B:11,C:9,D:6,E:3},'KAEDCO':{A:12,B:9,C:7,D:5,E:2},
  'YEDC':  {A:10,B:8,C:6,D:4,E:2},
};

const DISCO_ROTATION_MS: Record<string, number> = {
  'IE':12*3600000,'EKEDC':12*3600000,'AEDC':12*3600000,'IBEDC':8*3600000,
  'PHED':8*3600000,'EEDC':8*3600000,'BEDC':12*3600000,'JED':12*3600000,
  'KEDCO':8*3600000,'KAEDCO':12*3600000,'YEDC':12*3600000,
};

const DISCO_BAND_MAX_OUT_MS: Record<string, Record<string, number>> = {
  'IE':   {A:2*3600000,B:4*3600000,C:6*3600000,D:9*3600000,E:12*3600000},
  'EKEDC':{A:2*3600000,B:4*3600000,C:6*3600000,D:9*3600000,E:12*3600000},
  'AEDC': {A:3*3600000,B:5*3600000,C:7*3600000,D:10*3600000,E:14*3600000},
  'IBEDC':{A:4*3600000,B:6*3600000,C:8*3600000,D:11*3600000,E:16*3600000},
  'PHED': {A:5*3600000,B:7*3600000,C:9*3600000,D:12*3600000,E:18*3600000},
  'EEDC': {A:5*3600000,B:7*3600000,C:9*3600000,D:12*3600000,E:18*3600000},
  'BEDC': {A:4*3600000,B:6*3600000,C:8*3600000,D:11*3600000,E:16*3600000},
  'JED':  {A:6*3600000,B:8*3600000,C:10*3600000,D:13*3600000,E:20*3600000},
  'KEDCO':{A:5*3600000,B:7*3600000,C:9*3600000,D:12*3600000,E:18*3600000},
  'KAEDCO':{A:8*3600000,B:10*3600000,C:13*3600000,D:18*3600000,E:24*3600000},
  'YEDC': {A:10*3600000,B:14*3600000,C:18*3600000,D:22*3600000,E:30*3600000},
};

const HOURLY_SOUTH  = [0.90,0.80,0.72,0.68,0.72,1.38,1.22,1.10,0.98,0.88,0.82,0.80,0.82,0.86,0.90,0.95,1.05,1.12,1.38,1.55,1.45,1.30,1.18,1.05];
const HOURLY_NORTH  = [0.70,0.62,0.58,0.72,1.20,1.48,1.30,1.12,0.98,0.90,0.88,0.90,0.95,1.02,1.05,1.00,0.96,1.05,1.52,1.35,1.15,0.95,0.82,0.74];
const HOURLY_CENTRAL= [0.82,0.74,0.68,0.70,0.85,1.28,1.18,1.08,1.05,1.02,0.98,0.95,0.95,0.96,0.98,1.02,1.08,1.15,1.35,1.45,1.35,1.20,1.05,0.90];
const DAY_FACTOR    = [0.88,1.06,1.06,1.03,1.00,0.97,0.90];

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
const _areaDiscoMap: Record<string, string> = {};
function getAreaDisco(area: string): string {
  if (Object.keys(_areaDiscoMap).length === 0) {
    for (const [disco, areas] of Object.entries(DISCO_AREAS))
      for (const a of areas) _areaDiscoMap[a] = disco;
  }
  return _areaDiscoMap[area] || 'IE';
}

function getHourlyCurve(area: string): number[] {
  const c = AREA_COORDS[area];
  if (!c) return HOURLY_CENTRAL;
  if (c.lat > 10.0) return HOURLY_NORTH;
  if (c.lat <= 7.5)  return HOURLY_SOUTH;
  return HOURLY_CENTRAL;
}

function weatherKey(area: string): string {
  const c = AREA_COORDS[area] || { lat: 9.08, lng: 7.40 };
  return `${Math.round(c.lat)}|${Math.round(c.lng)}`;
}

function wxMultiplier(wx: { code: number | null; rain: number; wind: number } | null): number {
  if (!wx || wx.code === null) return 1.0;
  const c = wx.code;
  if (c >= 95) return 1.85;
  if (c >= 80 || (c >= 51 && c <= 67)) { if (wx.rain > 10) return 1.65; if (wx.rain > 3) return 1.40; return 1.20; }
  if (wx.wind > 40) return 1.30;
  return 1.0;
}

/* ─── HISTORY ENGINE ─────────────────────────────────────────────────────── */
interface HistoryCell { out: number; total: number; }

function buildHistory(rows: Array<{ location_area: string; type: string; created_at: string; confirms: number; wrong_votes: number }>): Map<string, HistoryCell> {
  const data = new Map<string, HistoryCell>();
  const nowMs = Date.now(), HALF_LIFE = 21 * 24 * 3600000, DISCO_CAP = 500;
  const processed = rows.filter(r => r.location_area).map(r => {
    const t = new Date(r.created_at), ageMs = Math.max(0, nowMs - t.getTime());
    const w = Math.max(0.1, Math.pow(0.5, ageMs / HALF_LIFE))
              * Math.min(3.0, 1 + (r.confirms || 1) * 0.25)
              * Math.max(0.2, 1 - (r.wrong_votes || 0) * 0.35);
    return { k: `${r.location_area}|${t.getHours()}|${t.getDay()}`, type: r.type, disco: getAreaDisco(r.location_area), w };
  });
  const dt: Record<string, number> = {};
  for (const { disco, w } of processed) dt[disco] = (dt[disco] || 0) + w;
  for (const { k, type, disco, w } of processed) {
    const sw = dt[disco] > DISCO_CAP ? w * DISCO_CAP / dt[disco] : w;
    const cell = data.get(k) || { out: 0, total: 0 };
    cell.total += sw; if (type === 'out') cell.out += sw; data.set(k, cell);
  }
  return data;
}

function getRate(h: Map<string, HistoryCell>, area: string, hr: number, d: number): number | null {
  const b = h.get(`${area}|${hr}|${d}`); if (!b || b.total < 4) return null;
  return Math.min(0.97, b.out / b.total);
}

function getAreaRate(h: Map<string, HistoryCell>, area: string): number | null {
  let out = 0, total = 0;
  for (const [k, v] of h) { if (k.startsWith(area + '|')) { out += v.out; total += v.total; } }
  return total >= 6 ? out / total : null;
}

/* ─── FEEDER ROTATION ────────────────────────────────────────────────────── */
function rotationFactor(disco: string, band: string, lastBckAt: Date | null, nowMs: number): number {
  if (!lastBckAt) return 1.0;
  const rotMs = DISCO_ROTATION_MS[disco] || 12 * 3600000;
  const supplyMs = ((DISCO_BAND_SUPPLY_HOURS[disco] || {})[band] || 10) * 3600000;
  const ts = nowMs - lastBckAt.getTime();
  if (ts > rotMs * 2) return 1.0;
  if (ts <= supplyMs) return Math.max(0.5, 1.0 - 0.4 * (1.0 - ts / supplyMs));
  return 1.0 + Math.min(1.0, (ts - supplyMs) / Math.max(1, rotMs - supplyMs)) * 0.35;
}

/* ─── CORE PREDICTION ────────────────────────────────────────────────────── */
function computeProb(
  area: string, hr: number, d: number,
  history: Map<string, HistoryCell>,
  weights: Record<string, number>,
  wxCache: Map<string, { code: number | null; rain: number; wind: number }>,
  lastBck: Date | null, nowMs: number,
  nercOverrides: Record<string, Record<string, number>> | null,
): number {
  const band  = AREA_BANDS[area] || 'C';
  const disco = getAreaDisco(area);
  const baselines = nercOverrides?.[disco] ?? DISCO_BAND_BASELINE[disco] ?? BAND_BASELINE;
  const base  = (baselines as Record<string, number>)[band] ?? 0.42;
  const hProb = Math.min(0.95, base * getHourlyCurve(area)[hr]);
  const dAdj  = DAY_FACTOR[d];
  const hist  = getRate(history, area, hr, d);
  const aHist = getAreaRate(history, area);
  let p: number;
  if (hist !== null)       p = hist*0.50 + hProb*0.25 + base*dAdj*0.25;
  else if (aHist !== null) p = aHist*0.35 + hProb*0.35 + base*dAdj*0.30;
  else                     p = base*0.45 + hProb*0.35 + (base*dAdj - base)*0.20;
  p = Math.min(0.97, p * rotationFactor(disco, band, lastBck, nowMs));
  const acc = weights[area] || 1.0;
  if (acc !== 1.0) p = Math.min(0.97, Math.max(0.03, p * acc));
  p = Math.min(0.97, p * wxMultiplier(wxCache.get(weatherKey(area)) || null));
  return Math.min(0.97, Math.max(0.03, p));
}

/* ─── WEATHER FETCHER ────────────────────────────────────────────────────── */
async function fetchWeather(areas: string[]): Promise<Map<string, { code: number | null; rain: number; wind: number }>> {
  const cache = new Map<string, { code: number | null; rain: number; wind: number }>();
  const seen = new Set<string>();
  const cells: Array<{ key: string; lat: number; lng: number }> = [];
  for (const a of areas) {
    const key = weatherKey(a); if (seen.has(key)) continue; seen.add(key);
    const c = AREA_COORDS[a] || { lat: 9.08, lng: 7.40 };
    cells.push({ key, lat: Math.round(c.lat), lng: Math.round(c.lng) });
  }
  await Promise.allSettled(cells.map(async ({ key, lat, lng }) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weathercode,precipitation,windspeed_10m&timezone=Africa%2FLagos`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;
      const d = await res.json(), cu = d.current || {};
      cache.set(key, { code: cu.weathercode ?? null, rain: cu.precipitation ?? 0, wind: cu.windspeed_10m ?? 0 });
    } catch { /* degrade gracefully */ }
  }));
  return cache;
}

/* ─── MAIN HANDLER ───────────────────────────────────────────────────────── */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.includes(SERVICE_KEY)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const sb     = createClient(SUPABASE_URL, SERVICE_KEY);
  const nowMs  = Date.now();
  const now    = new Date(nowMs);
  const h_utc  = now.getUTCHours();
  const h_wat  = (h_utc + 1) % 24;          // WAT = UTC+1
  const d_wat  = (now.getUTCDay() + (h_utc >= 23 ? 1 : 0)) % 7;
  const runLog: string[] = [];
  const log = (m: string) => { runLog.push(m); console.log('[ai-engine] ' + m); };

  log(`Start — WAT ${h_wat}:00 day ${d_wat}`);

  /* 1. Load training reports — HUMAN reports only.
        Training on our own AI reports creates a feedback loop where the model
        reinforces its own predictions instead of learning from ground truth. */
  const { data: rRows } = await sb.from('reports')
    .select('location_area, type, created_at, confirms, wrong_votes')
    .neq('user_id', AI_USER_ID)
    .order('created_at', { ascending: false }).limit(2000);
  const history = buildHistory((rRows || []) as any[]);
  log(`Training: ${rRows?.length || 0} human reports (AI reports excluded)`);

  /* 2. Accuracy weights */
  const { data: wRows } = await sb.from('ai_accuracy_weights').select('area, weight');
  const weights: Record<string, number> = {};
  for (const r of (wRows || [])) weights[r.area] = r.weight;

  /* 3. NERC overrides */
  const { data: nRows } = await sb.from('nerc_baselines').select('disco, band, outage_prob');
  const nerc: Record<string, Record<string, number>> = {};
  for (const r of (nRows || [])) { if (!nerc[r.disco]) nerc[r.disco] = {}; nerc[r.disco][r.band] = r.outage_prob; }

  /* 4. Current area state */
  const { data: sRows } = await sb.from('area_predictions').select('area, ai_status, last_ai_out_at, last_ai_report_id');
  const state: Record<string, { ai_status: string | null; last_ai_out_at: string | null; last_ai_report_id: string | null }> = {};
  for (const r of (sRows || [])) state[r.area] = { ai_status: r.ai_status, last_ai_out_at: r.last_ai_out_at, last_ai_report_id: r.last_ai_report_id };

  /* 5. Weather */
  const allAreas = Object.keys(AREA_BANDS);
  const wxCache = await fetchWeather(allAreas);
  log(`Weather: ${wxCache.size} grid cells`);

  /* 6. Last 'bck' per area (feeder rotation) */
  const cut48h = new Date(nowMs - 48 * 3600000).toISOString();
  const { data: bRows } = await sb.from('reports').select('location_area, created_at').eq('type', 'bck').neq('user_id', AI_USER_ID).gte('created_at', cut48h).order('created_at', { ascending: false });
  const lastBck: Record<string, Date> = {};
  for (const r of (bRows || [])) { if (!lastBck[r.location_area]) lastBck[r.location_area] = new Date(r.created_at); }

  /* 7. Compute probabilities */
  interface AreaResult { area: string; disco: string; band: string; prob: number; forecast: Array<{ hour: number; prob: number }>; hasHistory: boolean; }
  const results: AreaResult[] = [];
  for (const area of allAreas) {
    const band = AREA_BANDS[area] || 'C', disco = getAreaDisco(area);
    const prob = computeProb(area, h_wat, d_wat, history, weights, wxCache, lastBck[area] || null, nowMs, nerc);
    const forecast: Array<{ hour: number; prob: number }> = [];
    for (let i = 0; i < 24; i++) {
      const fh = (h_wat + i) % 24, fd = (d_wat + Math.floor((h_wat + i) / 24)) % 7;
      forecast.push({ hour: fh, prob: parseFloat(computeProb(area, fh, fd, history, weights, wxCache, lastBck[area] || null, nowMs, nerc).toFixed(4)) });
    }
    results.push({ area, disco, band, prob, forecast, hasHistory: getAreaRate(history, area) !== null });
  }

  /* 8. Scan — outages */
  const outCandidates = results.filter(({ area, hasHistory, prob }) => {
    const s = state[area];
    if (s?.ai_status === 'out') return false;
    if (s?.last_ai_out_at && nowMs - new Date(s.last_ai_out_at).getTime() < AI_MIN_REFIRE_MS) return false;
    if (prob < AI_CONFIDENCE_THRESH) return false;
    if (!hasHistory && prob < AI_BOOTSTRAP_THRESH) return false;
    if (!hasHistory && s?.last_ai_out_at && nowMs - new Date(s.last_ai_out_at).getTime() < AI_BOOTSTRAP_COOLDOWN_MS) return false;
    return true;
  }).sort((a, b) => b.prob - a.prob);

  let outFired = 0, bootFired = 0;
  for (const { area, prob, hasHistory } of outCandidates) {
    if (outFired >= AI_MAX_PER_SCAN) break;
    const isBoot = !hasHistory;
    if (isBoot && bootFired >= AI_MAX_BOOTSTRAP_PER_SCAN) continue;
    const { data: ins, error: insErr } = await sb.from('reports').insert({
      user_id: AI_USER_ID, location_name: area, location_area: area,
      type: 'out', confirms: 1, ai_prob: parseFloat(prob.toFixed(3)),
    }).select('id').single();
    if (!insErr && ins) {
      const rid = String(ins.id);
      state[area] = { ai_status: 'out', last_ai_out_at: now.toISOString(), last_ai_report_id: rid };
      await sb.from('ai_predictions').insert({ report_id: rid, area, disco: getAreaDisco(area), type: 'out', probability: parseFloat(prob.toFixed(4)) }).then(() => {}).catch(() => {});
      outFired++; if (isBoot) bootFired++;
      log(`OUT ${area} @ ${Math.round(prob * 100)}%${isBoot ? ' [boot]' : ''}`);
    }
  }

  /* 9. Scan — restorations */
  let bckFired = 0;
  for (const { area, prob, band } of results) {
    if (bckFired >= AI_MAX_PER_SCAN) break;
    const s = state[area]; if (s?.ai_status !== 'out') continue;
    const disco = getAreaDisco(area);
    const outageAgeMs = s.last_ai_out_at ? nowMs - new Date(s.last_ai_out_at).getTime() : 0;
    const maxOutMs = (DISCO_BAND_MAX_OUT_MS[disco] || {})[band] || 12 * 3600000;
    let humanConfirms = 0;
    if (s.last_ai_out_at) {
      const { count } = await sb.from('reports').select('id', { count: 'exact', head: true })
        .eq('location_area', area).eq('type', 'out').neq('user_id', AI_USER_ID).gte('created_at', s.last_ai_out_at);
      humanConfirms = count || 0;
    }
    const isStale = outageAgeMs > maxOutMs && humanConfirms === 0;
    const dropped = prob < AI_RESTORE_THRESH && outageAgeMs > 90 * 60000;
    if (!isStale && !dropped) continue;
    const { data: ins, error: insErr } = await sb.from('reports').insert({
      user_id: AI_USER_ID, location_name: area, location_area: area,
      type: 'bck', confirms: 1, ai_prob: parseFloat((1 - prob).toFixed(3)),
    }).select('id').single();
    if (!insErr && ins) {
      state[area] = { ...s, ai_status: 'bck', last_ai_report_id: String(ins.id) };
      bckFired++;
      log(`BCK ${area} [${isStale ? 'stale' : 'prob'}]`);
    }
  }

  /* 10. Upsert area_predictions */
  const upserts = results.map(({ area, disco, band, prob, forecast }) => ({
    area, disco, band,
    current_prob:      parseFloat(prob.toFixed(4)),
    forecast_24h:      forecast,
    ai_status:         state[area]?.ai_status ?? null,
    last_ai_out_at:    state[area]?.last_ai_out_at ?? null,
    last_ai_report_id: state[area]?.last_ai_report_id ?? null,
    computed_at:       now.toISOString(),
  }));
  const { error: upErr } = await sb.from('area_predictions').upsert(upserts, { onConflict: 'area' });
  if (upErr) log(`Upsert error: ${upErr.message}`); else log(`Upserted ${upserts.length} areas`);

  /* 11. Log weather */
  if (wxCache.size > 0) {
    const wxRows = [...wxCache.entries()].map(([key, wx]) => {
      const [lat, lon] = key.split('|');
      return { lat_key: parseFloat(lat), lon_key: parseFloat(lon), weather_code: wx.code, rain_mm: wx.rain, wind_kmh: wx.wind };
    });
    await sb.from('weather_log').insert(wxRows).then(() => {}).catch(() => {});
  }

  return new Response(JSON.stringify({ run_at: now.toISOString(), training_rows: rRows?.length || 0, areas: results.length, out: outFired, bck: bckFired, weather_cells: wxCache.size, log: runLog }, null, 2), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
