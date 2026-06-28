/* ─── NEPAWatch Nigeria — Shared data for Edge Functions ─────────────────── */

/* AI identity and tuning constants */
export const AI_USER_ID              = '00000000-0000-0000-0000-000000000001';
export const AI_CONFIDENCE_THRESH    = 0.58;
export const AI_RESTORE_THRESH       = 0.32;
export const AI_MAX_PER_SCAN         = 6;
export const AI_MIN_REFIRE_MS        = 45 * 60 * 1000;
export const AI_BOOTSTRAP_THRESH     = 0.72;
export const AI_BOOTSTRAP_COOLDOWN_MS = 6 * 3600 * 1000;
export const AI_MAX_BOOTSTRAP_PER_SCAN = 2;

/* ─── AREA → NERC BAND ──────────────────────────────────────────────────── */
export const NIGERIA_AREA_BANDS: Record<string, string> = {
  /* FCT / ABUJA */
  "Maitama": "A", "Asokoro": "A", "Wuse 2": "A", "Jabi": "A",
  "Wuse": "B", "Garki": "B", "Central Business District Abuja": "B",
  "Utako": "B", "Gudu": "B", "Apo": "B", "Durumi": "B",
  "Gwarinpa": "C", "Kubwa": "C", "Lokogoma": "C", "Bwari": "C",
  "Karu": "D", "Nyanya": "D", "Kuje": "D", "Abaji": "D",
  "Gwagwalada": "D", "Kwali": "E",
  /* NIGER STATE */
  "Minna GRA": "B", "Minna": "C", "Suleja": "C", "Bida": "D",
  "Kontagora": "D", "Bosso Minna": "C", "Maikunkele": "D",
  /* NASARAWA STATE */
  "Lafia GRA": "C", "Lafia": "D", "Keffi": "C", "Akwanga": "D",
  "Nasarawa Egon": "E",
  /* KOGI STATE */
  "Lokoja GRA": "C", "Lokoja": "D", "Okene": "D", "Kabba": "D", "Idah": "E",
  /* OYO STATE */
  "Ibadan GRA": "A", "Bodija": "B", "Ring Road Ibadan": "B", "Iyaganku": "B",
  "Agodi": "B", "Mokola": "C", "Challenge Ibadan": "C", "Dugbe": "C",
  "Sango Ibadan": "C", "Ojoo": "C", "Oke Ado": "C", "Ekotedo": "C",
  "Oluyole": "D", "Iwo Road": "D", "Agege Ibadan": "D",
  "Ogbomoso": "D", "Oyo Town": "D", "Iseyin": "E", "Saki": "E",
  /* OGUN STATE */
  "Abeokuta GRA": "B", "Oke Mosan": "B", "Panseke": "C", "Kuto": "C",
  "Sapon": "C", "Kemta": "C", "Ifo": "D", "Sagamu": "C", "Ilaro": "D",
  "Shagamu": "C", "Ijebu Ode": "C", "Ijebu Igbo": "D",
  /* OSUN STATE */
  "Osogbo GRA": "B", "Station Road Osogbo": "C", "Oke Baale": "C",
  "Ile Ife": "C", "Ilesa": "C", "Ede": "D",
  /* KWARA STATE */
  "Ilorin GRA": "B", "Taiwo Road Ilorin": "C", "Tanke Ilorin": "C",
  "Oloje Ilorin": "D", "Offa": "D", "Omu Aran": "E",
  /* ENUGU STATE */
  "GRA Enugu": "A", "Independence Layout Enugu": "A", "Trans Ekulu": "B",
  "New Haven Enugu": "B", "Abakpa": "C", "Coal Camp": "C",
  "Obiagu": "C", "Maryland Enugu": "C", "Uwani": "C", "Ogui": "D",
  "Garden Avenue Enugu": "B", "Achara Layout": "C",
  /* ANAMBRA STATE */
  "Awka GRA": "B", "Unizik Road Awka": "C", "Okpuno": "D",
  "Nnewi": "C", "Onitsha GRA": "B", "Fegge Onitsha": "C",
  "Bridge Head Onitsha": "C", "Ekwueme Square Awka": "C",
  /* IMO STATE */
  "Owerri GRA": "B", "New Owerri": "B", "Trans Amadi Owerri": "C",
  "Aladinma": "C", "Naze Owerri": "C", "World Bank Owerri": "C",
  "Orlu": "D", "Okigwe": "D",
  /* ABIA STATE */
  "Umuahia GRA": "C", "Umuola Road": "C", "Ubakala": "D",
  "Aba GRA": "B", "Aba Road Aba": "C", "Ngwa Road": "C",
  /* EBONYI STATE */
  "Abakaliki GRA": "C", "Mile 50 Abakaliki": "C", "Ishieke": "D",
  /* RIVERS STATE */
  "Port Harcourt GRA Phase 1": "A", "Port Harcourt GRA Phase 2": "A",
  "GRA Phase 3": "B", "D-Line PH": "B", "Old GRA PH": "B",
  "Trans Amadi PH": "C", "Artillery PH": "C", "Rumuola": "C",
  "Rumuibekwe": "C", "Woji": "C", "Eliozu": "C",
  "Diobu": "D", "Mile 1 PH": "D", "Mile 2 PH": "D",
  "Mile 3 PH": "D", "Rumuomasi": "D", "Rumuokoro": "D",
  "Peter Odili Road": "C", "Aba Road PH": "C", "Choba": "C",
  "Rumuokwuta": "D",
  /* BAYELSA STATE */
  "Yenagoa GRA": "C", "Tombia": "D", "Swali": "D",
  "Opolo": "D", "Kpansia": "D", "Amarata": "D",
  /* CROSS RIVER STATE */
  "Calabar GRA": "B", "Calabar South": "C", "UNICAL Road": "C",
  "Etta Agbo": "D", "Marian": "C", "State Housing": "C",
  /* AKWA IBOM STATE */
  "Uyo GRA": "B", "Ewet Housing": "C", "Wellington Bassey Way Uyo": "C",
  "Ikot Ekpene": "C", "Eket": "D",
  /* EDO STATE */
  "Benin City GRA": "A", "Airport Road Benin": "B", "Ugbowo": "C",
  "Ekehuan Road": "C", "Ring Road Benin": "C", "Sapele Road Benin": "C",
  "Upper Siluko": "D", "Ikpoba Hill": "C", "Uselu": "C",
  "New Benin": "C", "Sakponba": "D",
  /* DELTA STATE */
  "Asaba GRA": "B", "Cable Point Asaba": "C", "Summit Asaba": "C",
  "Okpanam": "C", "Warri GRA": "B", "PTI Road Warri": "C",
  "Okumagba Avenue": "C", "Effurun": "C", "Ovwian": "D", "Agbarho": "D",
  /* ONDO STATE */
  "Akure GRA": "B", "Ado Road Akure": "C", "FUTA Road": "C",
  "Ondo Town": "D", "Owo": "D", "Ikare": "E",
  /* EKITI STATE */
  "Ado Ekiti GRA": "C", "Basiri": "C", "Ido Ekiti": "D", "Ikole Ekiti": "E",
  /* LAGOS NORTH (IE) */
  "Ikeja GRA": "A", "Ikeja (Allen/Opebi)": "A", "Maryland/Anthony": "B",
  "Ogba": "B", "Agege": "C", "Alimosho/Ipaja": "D",
  "Ojodu/Omole": "B", "Kosofe/Ketu": "C", "Gbagada": "B",
  "Ilupeju": "B", "Mushin": "D", "Oshodi/Isolo": "C",
  "Shomolu/Bariga": "C", "Ikorodu": "D", "Magodo": "B",
  "Ojota/Oregun": "C", "Computer Village Ikeja": "B",
  "Murtala Muhammed Airport": "B",
  /* LAGOS SOUTH (EKEDC) */
  "Lagos Island": "A", "Ikoyi": "A", "Victoria Island": "A",
  "Obalende/CMS": "B", "Ebute Metta": "C", "Apapa": "B",
  "Surulere": "B", "Yaba": "B", "Lekki Phase 1": "A",
  "Lekki Phase 2/Ikota": "B", "Ajah": "C",
  "Chevron/Lekki-Epe Expressway": "B", "Igbo Efon/Ilasan": "C",
  "Ibeju-Lekki": "D", "Festac Town": "C", "Amuwo Odofin": "C",
  "Ojo/Alaba": "D", "Badagry": "E", "Epe": "D",
  /* KADUNA STATE */
  "Kaduna GRA": "A", "Ungwan Rimi": "B", "Barnawa": "C",
  "Tudun Wada Kaduna": "C", "Kawo": "C", "Rigasa": "D",
  "Malali": "D", "Sabon Gari Kaduna": "C", "Hayin Banki": "D",
  "Gonin Gora": "D",
  /* KEBBI STATE */
  "Birnin Kebbi GRA": "C", "Kalgo Road": "D", "Koko": "D", "Argungu": "E",
  /* SOKOTO STATE */
  "Sokoto GRA": "B", "Mabera": "C", "Gawon Nama Sokoto": "D",
  "Runjin Sambo": "D",
  /* ZAMFARA STATE */
  "Gusau GRA": "C", "Tudun Wada Gusau": "D",
  /* KANO STATE */
  "Nassarawa GRA Kano": "A", "Bompai Industrial": "B",
  "Sabon Gari Kano": "C", "Gwale": "C", "Kofar Mata": "D",
  "Tarauni": "D", "Hotoro": "D", "Dorayi": "D",
  "Zaria Road Kano": "C", "Fagge": "C", "Panshekara": "D",
  "Wudil": "E", "Kiru": "E",
  /* JIGAWA STATE */
  "Dutse GRA Jigawa": "C", "Kazaure": "D",
  /* KATSINA STATE */
  "Katsina GRA": "C", "Daura Road": "D",
  /* PLATEAU STATE */
  "Jos GRA": "B", "Rayfield": "B", "Bukuru": "C",
  "Bauchi Road Jos": "C", "Zaria Road Jos": "C",
  "Anglo-Jos": "C", "Rantya": "D", "Tudun Wada Jos": "D", "Kabong": "D",
  /* BENUE STATE */
  "Makurdi GRA": "C", "High Level Makurdi": "C", "North Bank Makurdi": "C",
  "Wurukum": "C", "Wadata": "D",
  /* ADAMAWA STATE */
  "Yola GRA": "C", "Jimeta": "C", "Doubeli": "D", "Karewa Yola": "D",
  /* TARABA STATE */
  "Jalingo GRA": "C", "Hammaruwa": "D", "Mayo-Belwa": "E",
  /* GOMBE STATE */
  "Gombe GRA": "C", "Pantami": "C", "Tudun Wada Gombe": "D",
  /* BAUCHI STATE */
  "Bauchi GRA": "C", "Yelwa": "D", "Wunti": "D",
  /* BORNO STATE */
  "Maiduguri GRA": "C", "Bolori": "D", "Gwange": "D",
  /* YOBE STATE */
  "Damaturu GRA": "D",
};

/* ─── AREA COORDINATES ───────────────────────────────────────────────────── */
export const NIGERIA_AREA_COORDS: Record<string, { lat: number; lng: number }> = {
  "Maitama": {lat:9.0820,lng:7.4710}, "Asokoro": {lat:9.0400,lng:7.5200},
  "Wuse 2": {lat:9.0720,lng:7.4870}, "Wuse": {lat:9.0680,lng:7.4760},
  "Jabi": {lat:9.0830,lng:7.4560}, "Garki": {lat:9.0600,lng:7.4880},
  "Central Business District Abuja": {lat:9.0600,lng:7.4900},
  "Utako": {lat:9.0780,lng:7.4650}, "Gudu": {lat:9.0250,lng:7.4780},
  "Apo": {lat:9.0200,lng:7.5030}, "Durumi": {lat:9.0350,lng:7.4700},
  "Gwarinpa": {lat:9.1140,lng:7.4360}, "Kubwa": {lat:9.1440,lng:7.4060},
  "Lokogoma": {lat:8.9800,lng:7.5100}, "Bwari": {lat:9.1800,lng:7.3800},
  "Karu": {lat:8.9500,lng:7.5600}, "Nyanya": {lat:8.9600,lng:7.5500},
  "Kuje": {lat:8.8800,lng:7.2200}, "Gwagwalada": {lat:8.9400,lng:7.0900},
  "Abaji": {lat:8.4700,lng:6.9400}, "Kwali": {lat:8.7900,lng:7.0400},
  "Minna GRA": {lat:9.6220,lng:6.5580}, "Minna": {lat:9.6140,lng:6.5570},
  "Suleja": {lat:9.1810,lng:7.1820}, "Bida": {lat:9.0780,lng:6.0110},
  "Kontagora": {lat:10.4000,lng:5.4700}, "Bosso Minna": {lat:9.6450,lng:6.5700},
  "Lafia GRA": {lat:8.4930,lng:8.5150}, "Lafia": {lat:8.4820,lng:8.5100},
  "Keffi": {lat:8.8500,lng:7.8700}, "Akwanga": {lat:8.9100,lng:8.4000},
  "Lokoja GRA": {lat:7.8030,lng:6.7420}, "Lokoja": {lat:7.8030,lng:6.7420},
  "Okene": {lat:7.5500,lng:6.2400}, "Kabba": {lat:7.8200,lng:6.0700},
  "Idah": {lat:7.1200,lng:6.7300},
  "Ibadan GRA": {lat:7.3920,lng:3.9010}, "Bodija": {lat:7.4300,lng:3.9200},
  "Ring Road Ibadan": {lat:7.3780,lng:3.9050}, "Iyaganku": {lat:7.3850,lng:3.9170},
  "Agodi": {lat:7.3960,lng:3.9200}, "Mokola": {lat:7.4090,lng:3.9000},
  "Challenge Ibadan": {lat:7.3740,lng:3.8920}, "Dugbe": {lat:7.3780,lng:3.8980},
  "Sango Ibadan": {lat:7.4250,lng:3.8810}, "Ojoo": {lat:7.4600,lng:3.9050},
  "Oke Ado": {lat:7.3900,lng:3.8940}, "Oluyole": {lat:7.3450,lng:3.8700},
  "Iwo Road": {lat:7.3980,lng:3.9370}, "Ogbomoso": {lat:8.1300,lng:4.2400},
  "Oyo Town": {lat:7.8500,lng:3.9300}, "Iseyin": {lat:7.9700,lng:3.6000},
  "Saki": {lat:8.6700,lng:3.3900},
  "Abeokuta GRA": {lat:7.1620,lng:3.3580}, "Oke Mosan": {lat:7.1780,lng:3.3420},
  "Panseke": {lat:7.1480,lng:3.3600}, "Kuto": {lat:7.1500,lng:3.3490},
  "Sapon": {lat:7.1420,lng:3.3370}, "Kemta": {lat:7.1300,lng:3.3300},
  "Sagamu": {lat:6.8400,lng:3.6500}, "Ifo": {lat:6.8100,lng:3.1900},
  "Ilaro": {lat:6.8900,lng:2.9800}, "Shagamu": {lat:6.8400,lng:3.6500},
  "Ijebu Ode": {lat:6.8200,lng:3.9200}, "Ijebu Igbo": {lat:6.9900,lng:3.9900},
  "Osogbo GRA": {lat:7.7750,lng:4.5640}, "Station Road Osogbo": {lat:7.7700,lng:4.5600},
  "Oke Baale": {lat:7.7690,lng:4.5570}, "Ile Ife": {lat:7.4800,lng:4.5600},
  "Ilesa": {lat:7.6300,lng:4.7400}, "Ede": {lat:7.7300,lng:4.4300},
  "Ilorin GRA": {lat:8.5040,lng:4.5500}, "Taiwo Road Ilorin": {lat:8.4960,lng:4.5520},
  "Tanke Ilorin": {lat:8.4800,lng:4.5800}, "Oloje Ilorin": {lat:8.5200,lng:4.5200},
  "Offa": {lat:8.1500,lng:4.7200}, "Omu Aran": {lat:8.2100,lng:5.1000},
  "GRA Enugu": {lat:6.4490,lng:7.5001}, "Independence Layout Enugu": {lat:6.4400,lng:7.5050},
  "Trans Ekulu": {lat:6.4680,lng:7.5350}, "New Haven Enugu": {lat:6.4380,lng:7.4840},
  "Abakpa": {lat:6.4750,lng:7.5500}, "Coal Camp": {lat:6.4560,lng:7.4970},
  "Obiagu": {lat:6.4520,lng:7.4900}, "Maryland Enugu": {lat:6.4610,lng:7.5100},
  "Uwani": {lat:6.4420,lng:7.4900}, "Ogui": {lat:6.4470,lng:7.5080},
  "Garden Avenue Enugu": {lat:6.4350,lng:7.5000}, "Achara Layout": {lat:6.4220,lng:7.5100},
  "Awka GRA": {lat:6.2130,lng:7.0750}, "Unizik Road Awka": {lat:6.2200,lng:7.0820},
  "Okpuno": {lat:6.2400,lng:7.0400}, "Nnewi": {lat:6.0200,lng:6.9100},
  "Onitsha GRA": {lat:6.1660,lng:6.7860}, "Fegge Onitsha": {lat:6.1590,lng:6.7920},
  "Bridge Head Onitsha": {lat:6.1450,lng:6.7800},
  "Owerri GRA": {lat:5.4906,lng:7.0280}, "New Owerri": {lat:5.5100,lng:7.0500},
  "Trans Amadi Owerri": {lat:5.4980,lng:7.0150}, "Aladinma": {lat:5.5050,lng:7.0380},
  "Naze Owerri": {lat:5.4850,lng:7.0200}, "World Bank Owerri": {lat:5.5200,lng:7.0400},
  "Orlu": {lat:5.7800,lng:7.0500}, "Okigwe": {lat:5.8600,lng:7.3500},
  "Umuahia GRA": {lat:5.5320,lng:7.4920}, "Umuola Road": {lat:5.5280,lng:7.4890},
  "Ubakala": {lat:5.4900,lng:7.5300}, "Aba GRA": {lat:5.1070,lng:7.3630},
  "Aba Road Aba": {lat:5.1150,lng:7.3540}, "Ngwa Road": {lat:5.1200,lng:7.3800},
  "Abakaliki GRA": {lat:6.3220,lng:8.1000}, "Mile 50 Abakaliki": {lat:6.3380,lng:8.1140},
  "Ishieke": {lat:6.3500,lng:8.0800},
  "Port Harcourt GRA Phase 1": {lat:4.8280,lng:7.0150},
  "Port Harcourt GRA Phase 2": {lat:4.8150,lng:6.9900},
  "GRA Phase 3": {lat:4.8050,lng:6.9700}, "D-Line PH": {lat:4.8100,lng:7.0050},
  "Artillery PH": {lat:4.7900,lng:7.0100}, "Trans Amadi PH": {lat:4.8300,lng:7.0400},
  "Rumuola": {lat:4.8500,lng:7.0200}, "Rumuibekwe": {lat:4.8450,lng:7.0300},
  "Woji": {lat:4.8200,lng:7.0500}, "Eliozu": {lat:4.8800,lng:7.0700},
  "Diobu": {lat:4.8200,lng:7.0000}, "Mile 1 PH": {lat:4.8250,lng:7.0070},
  "Mile 2 PH": {lat:4.8180,lng:6.9980}, "Mile 3 PH": {lat:4.8100,lng:6.9900},
  "Rumuomasi": {lat:4.8350,lng:7.0180}, "Rumuokoro": {lat:4.8600,lng:7.0600},
  "Peter Odili Road": {lat:4.8400,lng:7.0350}, "Aba Road PH": {lat:4.8250,lng:7.0300},
  "Choba": {lat:4.8950,lng:7.0180}, "Rumuokwuta": {lat:4.8500,lng:7.0280},
  "Old GRA PH": {lat:4.8200,lng:7.0100},
  "Yenagoa GRA": {lat:4.9260,lng:6.2720}, "Tombia": {lat:4.8800,lng:6.2600},
  "Swali": {lat:4.9200,lng:6.2500}, "Opolo": {lat:4.9100,lng:6.2600},
  "Kpansia": {lat:4.9000,lng:6.2650}, "Amarata": {lat:4.9300,lng:6.2700},
  "Calabar GRA": {lat:4.9620,lng:8.3420}, "Calabar South": {lat:4.9500,lng:8.3380},
  "UNICAL Road": {lat:4.9750,lng:8.3350}, "Etta Agbo": {lat:4.9400,lng:8.3450},
  "Marian": {lat:4.9600,lng:8.3490},
  "Uyo GRA": {lat:5.0500,lng:7.9250}, "Ewet Housing": {lat:5.0600,lng:7.9350},
  "Wellington Bassey Way Uyo": {lat:5.0520,lng:7.9200},
  "Ikot Ekpene": {lat:5.1800,lng:7.7200}, "Eket": {lat:4.6600,lng:7.9200},
  "Benin City GRA": {lat:6.3420,lng:5.6350}, "Airport Road Benin": {lat:6.3480,lng:5.6230},
  "Ugbowo": {lat:6.3600,lng:5.6400}, "Ekehuan Road": {lat:6.3200,lng:5.6100},
  "Ring Road Benin": {lat:6.3320,lng:5.6270}, "Sapele Road Benin": {lat:6.3500,lng:5.6450},
  "Upper Siluko": {lat:6.3100,lng:5.6000}, "Ikpoba Hill": {lat:6.3350,lng:5.6480},
  "Uselu": {lat:6.3700,lng:5.6500}, "New Benin": {lat:6.3280,lng:5.6350},
  "Asaba GRA": {lat:6.2000,lng:6.7450}, "Cable Point Asaba": {lat:6.2050,lng:6.7500},
  "Summit Asaba": {lat:6.2100,lng:6.7380}, "Okpanam": {lat:6.2200,lng:6.7200},
  "Warri GRA": {lat:5.5200,lng:5.7490}, "PTI Road Warri": {lat:5.5330,lng:5.7550},
  "Okumagba Avenue": {lat:5.5250,lng:5.7480}, "Effurun": {lat:5.5400,lng:5.7800},
  "Ovwian": {lat:5.5100,lng:5.7900}, "Agbarho": {lat:5.6500,lng:5.8000},
  "Akure GRA": {lat:7.2600,lng:5.2040}, "Ado Road Akure": {lat:7.2700,lng:5.2100},
  "FUTA Road": {lat:7.2800,lng:5.1900}, "Ondo Town": {lat:7.1000,lng:4.8400},
  "Owo": {lat:7.1900,lng:5.5900}, "Ikare": {lat:7.5200,lng:5.7600},
  "Ado Ekiti GRA": {lat:7.6350,lng:5.2190}, "Basiri": {lat:7.6200,lng:5.2300},
  "Ido Ekiti": {lat:7.6500,lng:5.2100}, "Ikole Ekiti": {lat:7.7900,lng:5.4900},
  /* LAGOS */
  "Ikeja GRA": {lat:6.5968,lng:3.3419}, "Ikeja (Allen/Opebi)": {lat:6.6010,lng:3.3497},
  "Maryland/Anthony": {lat:6.5630,lng:3.3590}, "Ogba": {lat:6.6250,lng:3.3190},
  "Agege": {lat:6.6340,lng:3.3190}, "Alimosho/Ipaja": {lat:6.5940,lng:3.2580},
  "Ojodu/Omole": {lat:6.6490,lng:3.3620}, "Kosofe/Ketu": {lat:6.5970,lng:3.3900},
  "Gbagada": {lat:6.5620,lng:3.3850}, "Ilupeju": {lat:6.5650,lng:3.3600},
  "Mushin": {lat:6.5260,lng:3.3580}, "Oshodi/Isolo": {lat:6.5340,lng:3.3440},
  "Shomolu/Bariga": {lat:6.5500,lng:3.3790}, "Ikorodu": {lat:6.6190,lng:3.5070},
  "Magodo": {lat:6.6050,lng:3.3800}, "Ojota/Oregun": {lat:6.5880,lng:3.3680},
  "Computer Village Ikeja": {lat:6.5986,lng:3.3378},
  "Murtala Muhammed Airport": {lat:6.5774,lng:3.3215},
  "Lagos Island": {lat:6.4541,lng:3.3947}, "Ikoyi": {lat:6.4590,lng:3.4310},
  "Victoria Island": {lat:6.4280,lng:3.4225}, "Obalende/CMS": {lat:6.4580,lng:3.3960},
  "Ebute Metta": {lat:6.4740,lng:3.3760}, "Apapa": {lat:6.4490,lng:3.3590},
  "Surulere": {lat:6.4958,lng:3.3561}, "Yaba": {lat:6.5080,lng:3.3740},
  "Lekki Phase 1": {lat:6.4430,lng:3.4820}, "Lekki Phase 2/Ikota": {lat:6.4350,lng:3.5350},
  "Ajah": {lat:6.4680,lng:3.5770}, "Chevron/Lekki-Epe Expressway": {lat:6.4360,lng:3.5180},
  "Igbo Efon/Ilasan": {lat:6.4450,lng:3.5090}, "Ibeju-Lekki": {lat:6.4800,lng:3.7200},
  "Festac Town": {lat:6.4610,lng:3.2840}, "Amuwo Odofin": {lat:6.4690,lng:3.3040},
  "Ojo/Alaba": {lat:6.5050,lng:3.1800}, "Badagry": {lat:6.4200,lng:2.8910},
  "Epe": {lat:6.5850,lng:3.9800},
  /* KADUNA */
  "Kaduna GRA": {lat:10.5220,lng:7.4400}, "Ungwan Rimi": {lat:10.5100,lng:7.4350},
  "Barnawa": {lat:10.4900,lng:7.4380}, "Tudun Wada Kaduna": {lat:10.5300,lng:7.4580},
  "Kawo": {lat:10.5400,lng:7.4200}, "Rigasa": {lat:10.5050,lng:7.3850},
  "Malali": {lat:10.5600,lng:7.4700}, "Sabon Gari Kaduna": {lat:10.5200,lng:7.4450},
  "Hayin Banki": {lat:10.4800,lng:7.4100}, "Gonin Gora": {lat:10.4700,lng:7.3900},
  "Birnin Kebbi GRA": {lat:12.4520,lng:4.2020}, "Kalgo Road": {lat:12.4400,lng:4.2100},
  "Koko": {lat:11.4200,lng:4.5100}, "Argungu": {lat:12.7400,lng:4.5200},
  "Sokoto GRA": {lat:13.0600,lng:5.2400}, "Mabera": {lat:13.0700,lng:5.2600},
  "Gawon Nama Sokoto": {lat:13.0500,lng:5.2300}, "Runjin Sambo": {lat:13.0400,lng:5.2500},
  "Gusau GRA": {lat:12.1680,lng:6.6530}, "Tudun Wada Gusau": {lat:12.1750,lng:6.6600},
  "Nassarawa GRA Kano": {lat:11.9980,lng:8.5230}, "Bompai Industrial": {lat:12.0100,lng:8.5400},
  "Sabon Gari Kano": {lat:12.0000,lng:8.5320}, "Gwale": {lat:11.9850,lng:8.5150},
  "Kofar Mata": {lat:12.0200,lng:8.5600}, "Tarauni": {lat:12.0050,lng:8.5100},
  "Hotoro": {lat:11.9900,lng:8.5650}, "Dorayi": {lat:11.9700,lng:8.5000},
  "Zaria Road Kano": {lat:12.0400,lng:8.5500}, "Fagge": {lat:12.0150,lng:8.5280},
  "Panshekara": {lat:11.9750,lng:8.5450}, "Wudil": {lat:11.8000,lng:8.8500},
  "Kiru": {lat:11.7600,lng:8.4500},
  "Dutse GRA Jigawa": {lat:11.7600,lng:9.3430}, "Kazaure": {lat:12.6800,lng:8.1900},
  "Katsina GRA": {lat:12.9950,lng:7.5990}, "Daura Road": {lat:12.9900,lng:7.6050},
  "Jos GRA": {lat:9.9180,lng:8.8920}, "Rayfield": {lat:9.9000,lng:8.8980},
  "Bukuru": {lat:9.7900,lng:8.8600}, "Bauchi Road Jos": {lat:9.9300,lng:8.9200},
  "Zaria Road Jos": {lat:9.9400,lng:8.9100}, "Anglo-Jos": {lat:9.9250,lng:8.8800},
  "Rantya": {lat:9.9100,lng:8.8700}, "Tudun Wada Jos": {lat:9.9050,lng:8.8850},
  "Kabong": {lat:9.9350,lng:8.8650},
  "Makurdi GRA": {lat:7.7310,lng:8.5320}, "High Level Makurdi": {lat:7.7400,lng:8.5400},
  "North Bank Makurdi": {lat:7.7250,lng:8.5150}, "Wurukum": {lat:7.7200,lng:8.5380},
  "Wadata": {lat:7.7150,lng:8.5450},
  "Yola GRA": {lat:9.2050,lng:12.4820}, "Jimeta": {lat:9.2800,lng:12.4700},
  "Doubeli": {lat:9.2100,lng:12.4700}, "Karewa Yola": {lat:9.2200,lng:12.4900},
  "Jalingo GRA": {lat:8.8900,lng:11.3620}, "Hammaruwa": {lat:8.8800,lng:11.3700},
  "Mayo-Belwa": {lat:9.0700,lng:12.0000},
  "Gombe GRA": {lat:10.2950,lng:11.1670}, "Pantami": {lat:10.3000,lng:11.1700},
  "Tudun Wada Gombe": {lat:10.2900,lng:11.1600},
  "Bauchi GRA": {lat:10.3170,lng:9.8500}, "Yelwa": {lat:10.3100,lng:9.8600},
  "Wunti": {lat:10.3250,lng:9.8400},
  "Maiduguri GRA": {lat:11.8470,lng:13.1600}, "Bolori": {lat:11.8600,lng:13.1500},
  "Gwange": {lat:11.8400,lng:13.1700},
  "Damaturu GRA": {lat:11.7470,lng:11.9600},
};

/* ─── DISCO → AREA MAPPING ──────────────────────────────────────────────── */
export const NIGERIA_DISCO_AREAS: Record<string, string[]> = {
  'IE': ["Ikeja GRA","Ikeja (Allen/Opebi)","Maryland/Anthony","Ogba","Agege",
         "Alimosho/Ipaja","Ojodu/Omole","Kosofe/Ketu","Gbagada","Ilupeju",
         "Mushin","Oshodi/Isolo","Shomolu/Bariga","Ikorodu","Magodo",
         "Ojota/Oregun","Computer Village Ikeja","Murtala Muhammed Airport"],
  'EKEDC': ["Lagos Island","Ikoyi","Victoria Island","Obalende/CMS","Ebute Metta",
            "Apapa","Surulere","Yaba","Lekki Phase 1","Lekki Phase 2/Ikota","Ajah",
            "Chevron/Lekki-Epe Expressway","Igbo Efon/Ilasan","Ibeju-Lekki",
            "Festac Town","Amuwo Odofin","Ojo/Alaba","Badagry","Epe"],
  'AEDC': ["Maitama","Asokoro","Wuse 2","Wuse","Garki","Central Business District Abuja",
           "Gwarinpa","Kubwa","Lugbe","Karu","Nyanya","Gwagwalada","Jabi","Utako",
           "Gudu","Apo","Durumi","Lokogoma","Bwari","Kuje","Abaji","Kwali",
           "Minna","Suleja","Bida","Kontagora","Lafia","Keffi","Akwanga",
           "Lokoja","Okene","Kabba","Idah"],
  'IBEDC': ["Ibadan GRA","Bodija","Ring Road Ibadan","Challenge Ibadan","Sango Ibadan",
            "Dugbe","Mokola","Agodi","Iyaganku","Oluyole","Ojoo","Agege Ibadan",
            "Iwo Road","Oke Ado","Ekotedo","Abeokuta GRA","Oke Mosan","Panseke",
            "Kuto","Sapon","Kemta","Ifo","Sagamu","Ilaro","Shagamu","Ijebu Ode",
            "Ijebu Igbo","Osogbo GRA","Station Road Osogbo","Oke Baale",
            "Ilorin GRA","Taiwo Road Ilorin","Ogbomoso","Oyo Town","Iseyin","Saki"],
  'EEDC': ["GRA Enugu","Independence Layout Enugu","Trans Ekulu","Abakpa","Coal Camp",
           "Obiagu","Maryland Enugu","New Haven Enugu","Uwani","Ogui",
           "Garden Avenue Enugu","Achara Layout","Awka GRA","Unizik Road Awka",
           "Okpuno","Nnewi","Onitsha GRA","Fegge Onitsha","Owerri GRA",
           "Trans Amadi Owerri","New Owerri","Aladinma","Naze Owerri",
           "Umuahia GRA","Umuola Road","Ubakala","Abakaliki GRA","Mile 50 Abakaliki"],
  'PHED': ["Port Harcourt GRA Phase 1","Port Harcourt GRA Phase 2","GRA Phase 3",
           "D-Line PH","Artillery PH","Trans Amadi PH","Rumuola","Rumuomasi",
           "Rumuibekwe","Diobu","Mile 1 PH","Mile 2 PH","Mile 3 PH","Old GRA PH",
           "Eliozu","Woji","Rumuokoro","Rumuokwuta","Choba","Peter Odili Road",
           "Aba Road PH","Yenagoa GRA","Tombia","Swali","Calabar GRA","Calabar South",
           "UNICAL Road","Etta Agbo","Uyo GRA","Ewet Housing",
           "Wellington Bassey Way Uyo","Ikot Ekpene","Eket"],
  'KAEDCO': ["Kaduna GRA","Ungwan Rimi","Barnawa","Tudun Wada Kaduna","Kawo","Rigasa",
             "Malali","Sabon Gari Kaduna","Hayin Banki","Gonin Gora",
             "Birnin Kebbi GRA","Kalgo Road","Koko","Argungu","Sokoto GRA","Mabera",
             "Gusau GRA","Tudun Wada Gusau"],
  'KEDCO': ["Nassarawa GRA Kano","Bompai Industrial","Sabon Gari Kano","Gwale",
            "Kofar Mata","Tarauni","Hotoro","Dorayi","Zaria Road Kano","Fagge",
            "Panshekara","Wudil","Kiru","Dutse GRA Jigawa","Kazaure",
            "Katsina GRA","Daura Road"],
  'BEDC': ["Benin City GRA","Airport Road Benin","Ugbowo","Ekehuan Road","Ring Road Benin",
           "Sapele Road Benin","Sakponba","Upper Siluko","Asaba GRA","Cable Point Asaba",
           "Summit Asaba","Okpanam","Warri GRA","PTI Road Warri","Okumagba Avenue",
           "Effurun","Ovwian","Agbarho","Akure GRA","Ado Road Akure","FUTA Road",
           "Ado Ekiti GRA","Basiri","Ido Ekiti"],
  'JED': ["Jos GRA","Rayfield","Bukuru","Bauchi Road Jos","Zaria Road Jos","Anglo-Jos",
          "Rantya","Tudun Wada Jos","Kabong","Makurdi GRA","High Level Makurdi",
          "North Bank Makurdi","Wurukum","Wadata","Lafia GRA","Lafia Road"],
  'YEDC': ["Yola GRA","Jimeta","Doubeli","Karewa Yola","Jalingo GRA","Hammaruwa",
           "Mayo-Belwa","Gombe GRA","Pantami","Tudun Wada Gombe","Bauchi GRA",
           "Yelwa","Wunti","Maiduguri GRA","Bolori","Gwange","Damaturu GRA"],
};

/* ─── BAND BASELINES ─────────────────────────────────────────────────────── */
export const BAND_BASELINE: Record<string, number> = { A:0.18, B:0.28, C:0.42, D:0.58, E:0.74 };
export const BAND_SUPPLY_HOURS: Record<string, number> = { A:22, B:18, C:14, D:10, E:6 };

export const DISCO_BAND_BASELINE: Record<string, Record<string, number>> = {
  'IE':     { A:0.18, B:0.28, C:0.42, D:0.58, E:0.74 },
  'EKEDC':  { A:0.18, B:0.28, C:0.42, D:0.58, E:0.74 },
  'AEDC':   { A:0.22, B:0.34, C:0.50, D:0.64, E:0.78 },
  'IBEDC':  { A:0.32, B:0.44, C:0.57, D:0.70, E:0.82 },
  'PHED':   { A:0.38, B:0.50, C:0.62, D:0.74, E:0.86 },
  'EEDC':   { A:0.42, B:0.53, C:0.64, D:0.75, E:0.86 },
  'BEDC':   { A:0.32, B:0.45, C:0.58, D:0.71, E:0.84 },
  'JED':    { A:0.45, B:0.56, C:0.67, D:0.77, E:0.88 },
  'KEDCO':  { A:0.40, B:0.52, C:0.64, D:0.76, E:0.88 },
  'KAEDCO': { A:0.48, B:0.59, C:0.70, D:0.81, E:0.92 },
  'YEDC':   { A:0.55, B:0.65, C:0.74, D:0.84, E:0.94 },
};

export const DISCO_BAND_SUPPLY_HOURS: Record<string, Record<string, number>> = {
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

export const DISCO_ROTATION_MS: Record<string, number> = {
  'IE':     12 * 3600000, 'EKEDC':  12 * 3600000, 'AEDC':   12 * 3600000,
  'IBEDC':   8 * 3600000, 'PHED':    8 * 3600000, 'EEDC':    8 * 3600000,
  'BEDC':   12 * 3600000, 'JED':    12 * 3600000, 'KEDCO':   8 * 3600000,
  'KAEDCO': 12 * 3600000, 'YEDC':   12 * 3600000,
};

export const DISCO_BAND_MAX_OUT_MS: Record<string, Record<string, number>> = {
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

/* ─── HOURLY DEMAND-RISK CURVES ─────────────────────────────────────────── */
export const HOURLY_SOUTH = [
  0.90,0.80,0.72,0.68,0.72,1.38,1.22,1.10,
  0.98,0.88,0.82,0.80,0.82,0.86,0.90,0.95,
  1.05,1.12,1.38,1.55,1.45,1.30,1.18,1.05,
];
export const HOURLY_NORTH = [
  0.70,0.62,0.58,0.72,1.20,1.48,1.30,1.12,
  0.98,0.90,0.88,0.90,0.95,1.02,1.05,1.00,
  0.96,1.05,1.52,1.35,1.15,0.95,0.82,0.74,
];
export const HOURLY_CENTRAL = [
  0.82,0.74,0.68,0.70,0.85,1.28,1.18,1.08,
  1.05,1.02,0.98,0.95,0.95,0.96,0.98,1.02,
  1.08,1.15,1.35,1.45,1.35,1.20,1.05,0.90,
];

export const DAY_FACTOR = [0.88, 1.06, 1.06, 1.03, 1.00, 0.97, 0.90]; /* 0=Sun */

/* ─── BUILD AREA → DISCO MAP ─────────────────────────────────────────────── */
const _areaDiscoMap: Record<string, string> = {};
let _areaDiscoBuilt = false;
export function getAreaDisco(area: string): string {
  if (!_areaDiscoBuilt) {
    for (const [disco, areas] of Object.entries(NIGERIA_DISCO_AREAS)) {
      for (const a of areas) _areaDiscoMap[a] = disco;
    }
    _areaDiscoBuilt = true;
  }
  return _areaDiscoMap[area] || 'IE';
}

export function getHourlyCurve(area: string): number[] {
  const c = NIGERIA_AREA_COORDS[area];
  if (!c) return HOURLY_CENTRAL;
  if (c.lat > 10.0) return HOURLY_NORTH;
  if (c.lat <= 7.5)  return HOURLY_SOUTH;
  return HOURLY_CENTRAL;
}

export function getWeatherCellKey(area: string): string {
  const c = NIGERIA_AREA_COORDS[area] || { lat: 9.08, lng: 7.40 };
  return `${Math.round(c.lat)}|${Math.round(c.lng)}`;
}

export function getWeatherRiskMultiplier(wx: { code: number | null; rain: number; wind: number } | null): number {
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
}
