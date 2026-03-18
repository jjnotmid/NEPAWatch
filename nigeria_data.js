/* ===== NEPAWatch Nigeria — nigeria_data.js =====
   Comprehensive location data for all 36 states + FCT
   All 11 electricity Distribution Companies (DISCOs)
   Major areas, LGAs, cities, and streets across Nigeria
   ================================================== */

/* ─── NIGERIA DISCOS (all 11) ─────────────────────────────────────────── */
const NIGERIA_DISCOS = [
  {
    name: "Ikeja Electric (IE)",
    shortName: "IE",
    states: ["Lagos (North)"],
    lgas: ["Ikeja GRA","Ikeja (Allen/Opebi)","Maryland/Anthony","Ogba","Agege","Alimosho/Ipaja",
           "Ojodu/Omole","Kosofe/Ketu","Gbagada","Ilupeju","Mushin","Oshodi/Isolo","Shomolu/Bariga",
           "Ikorodu","Magodo","Ojota/Oregun","Computer Village Ikeja","Murtala Muhammed Airport"],
    color: "#00E5FF"
  },
  {
    name: "Eko Electric (EKEDC)",
    shortName: "EKEDC",
    states: ["Lagos (South)"],
    lgas: ["Lagos Island","Ikoyi","Victoria Island","Obalende/CMS","Ebute Metta","Apapa","Surulere",
           "Yaba","Lekki Phase 1","Lekki Phase 2/Ikota","Ajah","Chevron/Lekki-Epe Expressway",
           "Igbo Efon/Ilasan","Ibeju-Lekki","Festac Town","Amuwo Odofin","Ojo/Alaba","Badagry","Epe"],
    color: "#69F0AE"
  },
  {
    name: "Abuja Electric (AEDC)",
    shortName: "AEDC",
    states: ["FCT","Niger","Nasarawa","Kogi (partial)"],
    lgas: ["Maitama","Asokoro","Wuse 2","Wuse","Garki","Central Business District Abuja",
           "Gwarinpa","Kubwa","Lugbe","Karu","Nyanya","Gwagwalada","Jabi","Utako",
           "Gudu","Apo","Durumi","Lokogoma","Bwari","Kuje","Abaji","Kwali",
           "Minna","Suleja","Bida","Kontagora","Lafia","Keffi","Akwanga","Nasarawa Egon",
           "Lokoja","Okene","Kabba","Idah"],
    color: "#FFD600"
  },
  {
    name: "Ibadan Electric (IBEDC)",
    shortName: "IBEDC",
    states: ["Oyo","Osun","Ogun","Kwara"],
    lgas: ["Ibadan GRA","Bodija","Ring Road Ibadan","Challenge Ibadan","Sango Ibadan","Dugbe",
           "Mokola","Agodi","Iyaganku","Oluyole","Ojoo","Agege Ibadan","Olunde","Iwo Road",
           "Oke Ado","Ekotedo","Abeokuta GRA","Oke Mosan","Panseke","Kuto","Sapon","Kemta",
           "Ifo","Sagamu","Ilaro","Shagamu","Ijebu Ode","Ijebu Igbo","Osogbo GRA",
           "Station Road Osogbo","Oke Baale","Ilorin GRA","Taiwo Road Ilorin","Ogbomoso",
           "Oyo Town","Iseyin","Saki"],
    color: "#FF6D00"
  },
  {
    name: "Enugu Electric (EEDC)",
    shortName: "EEDC",
    states: ["Enugu","Anambra","Imo","Abia","Ebonyi"],
    lgas: ["GRA Enugu","Independence Layout Enugu","Trans Ekulu","Abakpa","Coal Camp","Obiagu",
           "Maryland Enugu","New Haven Enugu","Uwani","Ogui","Garden Avenue Enugu","Achara Layout",
           "Awka GRA","Unizik Road Awka","Okpuno","Nnewi","Onitsha GRA","Fegge Onitsha",
           "Owerri GRA","Trans Amadi Owerri","New Owerri","Aladinma","Naze Owerri",
           "Umuahia GRA","Umuola Road","Ubakala","Abakaliki GRA","Mile 50 Abakaliki"],
    color: "#E040FB"
  },
  {
    name: "Port Harcourt Electric (PHED)",
    shortName: "PHED",
    states: ["Rivers","Bayelsa","Cross River","Akwa Ibom"],
    lgas: ["Port Harcourt GRA Phase 1","Port Harcourt GRA Phase 2","GRA Phase 3","D-Line PH",
           "Artillery PH","Trans Amadi PH","Rumuola","Rumuomasi","Rumuibekwe","Diobu",
           "Mile 1 PH","Mile 2 PH","Mile 3 PH","Old GRA PH","Eliozu","Woji","Rumuokoro",
           "Rumuokwuta","Choba","Peter Odili Road","Aba Road PH","Yenagoa GRA","Tombia","Swali",
           "Calabar GRA","Calabar South","UNICAL Road","Etta Agbo","Uyo GRA","Ewet Housing",
           "Wellington Bassey Way Uyo","Ikot Ekpene","Eket"],
    color: "#00BCD4"
  },
  {
    name: "Kaduna Electric (KAEDCO)",
    shortName: "KAEDCO",
    states: ["Kaduna","Kebbi","Sokoto","Zamfara"],
    lgas: ["Kaduna GRA","Ungwan Rimi","Barnawa","Tudun Wada Kaduna","Kawo","Rigasa","Malali",
           "Sabon Gari Kaduna","Hayin Banki","Gonin Gora","Birnin Kebbi GRA","Kalgo Road",
           "Koko","Argungu","Sokoto GRA","Mabera","Gusau GRA","Tudun Wada Gusau"],
    color: "#FF5722"
  },
  {
    name: "Kano Electric (KEDCO)",
    shortName: "KEDCO",
    states: ["Kano","Jigawa","Katsina"],
    lgas: ["Nassarawa GRA Kano","Bompai Industrial","Sabon Gari Kano","Gwale","Kofar Mata",
           "Tarauni","Hotoro","Dorayi","Zaria Road Kano","Hadejia Road","Fagge","Panshekara",
           "Wudil","Kiru","Dutse GRA Jigawa","Kazaure","Katsina GRA","Daura Road"],
    color: "#4CAF50"
  },
  {
    name: "Benin Electric (BEDC)",
    shortName: "BEDC",
    states: ["Edo","Delta","Ondo","Ekiti"],
    lgas: ["Benin City GRA","Airport Road Benin","Ugbowo","Ekehuan Road","Ring Road Benin",
           "Sapele Road Benin","Sakponba","Upper Siluko","Asaba GRA","Cable Point Asaba",
           "Summit Asaba","Okpanam","Warri GRA","PTI Road Warri","Okumagba Avenue",
           "Effurun","Ovwian","Agbarho","Akure GRA","Ado Road Akure","FUTA Road",
           "Ado Ekiti GRA","Basiri","Ido Ekiti"],
    color: "#9C27B0"
  },
  {
    name: "Jos Electric (JED)",
    shortName: "JED",
    states: ["Plateau","Benue","Nasarawa (partial)"],
    lgas: ["Jos GRA","Rayfield","Bukuru","Bauchi Road Jos","Zaria Road Jos","Anglo-Jos",
           "Rantya","Tudun Wada Jos","Kabong","Makurdi GRA","High Level Makurdi",
           "North Bank Makurdi","Wurukum","Wadata","Lafia GRA","Lafia Road"],
    color: "#795548"
  },
  {
    name: "Yola Electric (YEDC)",
    shortName: "YEDC",
    states: ["Adamawa","Taraba","Gombe","Bauchi"],
    lgas: ["Yola GRA","Jimeta","Doubeli","Karewa Yola","Jalingo GRA","Hammaruwa","Mayo-Belwa",
           "Gombe GRA","Pantami","Tudun Wada Gombe","Bauchi GRA","Yelwa","Wunti","Maiduguri GRA",
           "Bolori","Gwange","Damaturu GRA"],
    color: "#607D8B"
  }
];

/* ─── AREA BANDS FOR ALL NIGERIA ─────────────────────────────────────── */
/* NERC Band classification: A=best supply, E=worst                        */
/* Based on NERC SBT guidelines and DISCO-reported supply hours           */
const NIGERIA_AREA_BANDS = {
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

  /* OYO STATE / IBADAN */
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

  /* RIVERS STATE / PORT HARCOURT */
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

  /* EDO STATE / BENIN CITY */
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
  "Ado Ekiti GRA": "C", "Basiri": "C", "Ido Ekiti": "D",
  "Ikole Ekiti": "E",

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

  /* PLATEAU STATE / JOS */
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

/* ─── COORDINATES FOR ALL NIGERIA AREAS ──────────────────────────────── */
const NIGERIA_AREA_COORDS = {
  /* ABUJA / FCT */
  "Maitama": {lat:9.0820, lng:7.4710}, "Asokoro": {lat:9.0400, lng:7.5200},
  "Wuse 2": {lat:9.0720, lng:7.4870}, "Wuse": {lat:9.0680, lng:7.4760},
  "Jabi": {lat:9.0830, lng:7.4560}, "Garki": {lat:9.0600, lng:7.4880},
  "Central Business District Abuja": {lat:9.0600, lng:7.4900},
  "Utako": {lat:9.0780, lng:7.4650}, "Gudu": {lat:9.0250, lng:7.4780},
  "Apo": {lat:9.0200, lng:7.5030}, "Durumi": {lat:9.0350, lng:7.4700},
  "Gwarinpa": {lat:9.1140, lng:7.4360}, "Kubwa": {lat:9.1440, lng:7.4060},
  "Lokogoma": {lat:8.9800, lng:7.5100}, "Bwari": {lat:9.1800, lng:7.3800},
  "Karu": {lat:8.9500, lng:7.5600}, "Nyanya": {lat:8.9600, lng:7.5500},
  "Kuje": {lat:8.8800, lng:7.2200}, "Gwagwalada": {lat:8.9400, lng:7.0900},
  "Abaji": {lat:8.4700, lng:6.9400}, "Kwali": {lat:8.7900, lng:7.0400},

  /* NIGER STATE */
  "Minna GRA": {lat:9.6220, lng:6.5580}, "Minna": {lat:9.6140, lng:6.5570},
  "Suleja": {lat:9.1810, lng:7.1820}, "Bida": {lat:9.0780, lng:6.0110},
  "Kontagora": {lat:10.4000, lng:5.4700}, "Bosso Minna": {lat:9.6450, lng:6.5700},

  /* NASARAWA STATE */
  "Lafia GRA": {lat:8.4930, lng:8.5150}, "Lafia": {lat:8.4820, lng:8.5100},
  "Keffi": {lat:8.8500, lng:7.8700}, "Akwanga": {lat:8.9100, lng:8.4000},

  /* KOGI STATE */
  "Lokoja GRA": {lat:7.8030, lng:6.7420}, "Lokoja": {lat:7.8030, lng:6.7420},
  "Okene": {lat:7.5500, lng:6.2400}, "Kabba": {lat:7.8200, lng:6.0700},
  "Idah": {lat:7.1200, lng:6.7300},

  /* OYO / IBADAN */
  "Ibadan GRA": {lat:7.3920, lng:3.9010}, "Bodija": {lat:7.4300, lng:3.9200},
  "Ring Road Ibadan": {lat:7.3780, lng:3.9050}, "Iyaganku": {lat:7.3850, lng:3.9170},
  "Agodi": {lat:7.3960, lng:3.9200}, "Mokola": {lat:7.4090, lng:3.9000},
  "Challenge Ibadan": {lat:7.3740, lng:3.8920}, "Dugbe": {lat:7.3780, lng:3.8980},
  "Sango Ibadan": {lat:7.4250, lng:3.8810}, "Ojoo": {lat:7.4600, lng:3.9050},
  "Oke Ado": {lat:7.3900, lng:3.8940}, "Oluyole": {lat:7.3450, lng:3.8700},
  "Iwo Road": {lat:7.3980, lng:3.9370}, "Ogbomoso": {lat:8.1300, lng:4.2400},
  "Oyo Town": {lat:7.8500, lng:3.9300}, "Iseyin": {lat:7.9700, lng:3.6000},
  "Saki": {lat:8.6700, lng:3.3900},

  /* OGUN STATE */
  "Abeokuta GRA": {lat:7.1620, lng:3.3580}, "Oke Mosan": {lat:7.1780, lng:3.3420},
  "Panseke": {lat:7.1480, lng:3.3600}, "Kuto": {lat:7.1500, lng:3.3490},
  "Sapon": {lat:7.1420, lng:3.3370}, "Kemta": {lat:7.1300, lng:3.3300},
  "Sagamu": {lat:6.8400, lng:3.6500}, "Ifo": {lat:6.8100, lng:3.1900},
  "Ilaro": {lat:6.8900, lng:2.9800}, "Shagamu": {lat:6.8400, lng:3.6500},
  "Ijebu Ode": {lat:6.8200, lng:3.9200}, "Ijebu Igbo": {lat:6.9900, lng:3.9900},

  /* OSUN STATE */
  "Osogbo GRA": {lat:7.7750, lng:4.5640}, "Station Road Osogbo": {lat:7.7700, lng:4.5600},
  "Oke Baale": {lat:7.7690, lng:4.5570}, "Ile Ife": {lat:7.4800, lng:4.5600},
  "Ilesa": {lat:7.6300, lng:4.7400}, "Ede": {lat:7.7300, lng:4.4300},

  /* KWARA STATE */
  "Ilorin GRA": {lat:8.5040, lng:4.5500}, "Taiwo Road Ilorin": {lat:8.4960, lng:4.5520},
  "Tanke Ilorin": {lat:8.4800, lng:4.5800}, "Oloje Ilorin": {lat:8.5200, lng:4.5200},
  "Offa": {lat:8.1500, lng:4.7200}, "Omu Aran": {lat:8.2100, lng:5.1000},

  /* ENUGU STATE */
  "GRA Enugu": {lat:6.4490, lng:7.5001}, "Independence Layout Enugu": {lat:6.4400, lng:7.5050},
  "Trans Ekulu": {lat:6.4680, lng:7.5350}, "New Haven Enugu": {lat:6.4380, lng:7.4840},
  "Abakpa": {lat:6.4750, lng:7.5500}, "Coal Camp": {lat:6.4560, lng:7.4970},
  "Obiagu": {lat:6.4520, lng:7.4900}, "Maryland Enugu": {lat:6.4610, lng:7.5100},
  "Uwani": {lat:6.4420, lng:7.4900}, "Ogui": {lat:6.4470, lng:7.5080},
  "Garden Avenue Enugu": {lat:6.4350, lng:7.5000}, "Achara Layout": {lat:6.4220, lng:7.5100},

  /* ANAMBRA STATE */
  "Awka GRA": {lat:6.2130, lng:7.0750}, "Unizik Road Awka": {lat:6.2200, lng:7.0820},
  "Okpuno": {lat:6.2400, lng:7.0400}, "Nnewi": {lat:6.0200, lng:6.9100},
  "Onitsha GRA": {lat:6.1660, lng:6.7860}, "Fegge Onitsha": {lat:6.1590, lng:6.7920},
  "Bridge Head Onitsha": {lat:6.1450, lng:6.7800},

  /* IMO STATE */
  "Owerri GRA": {lat:5.4906, lng:7.0280}, "New Owerri": {lat:5.5100, lng:7.0500},
  "Trans Amadi Owerri": {lat:5.4980, lng:7.0150}, "Aladinma": {lat:5.5050, lng:7.0380},
  "Naze Owerri": {lat:5.4850, lng:7.0200}, "World Bank Owerri": {lat:5.5200, lng:7.0400},
  "Orlu": {lat:5.7800, lng:7.0500}, "Okigwe": {lat:5.8600, lng:7.3500},

  /* ABIA STATE */
  "Umuahia GRA": {lat:5.5320, lng:7.4920}, "Umuola Road": {lat:5.5280, lng:7.4890},
  "Ubakala": {lat:5.4900, lng:7.5300}, "Aba GRA": {lat:5.1070, lng:7.3630},
  "Aba Road Aba": {lat:5.1150, lng:7.3540}, "Ngwa Road": {lat:5.1200, lng:7.3800},

  /* EBONYI STATE */
  "Abakaliki GRA": {lat:6.3220, lng:8.1000}, "Mile 50 Abakaliki": {lat:6.3380, lng:8.1140},
  "Ishieke": {lat:6.3500, lng:8.0800},

  /* RIVERS STATE / PORT HARCOURT */
  "Port Harcourt GRA Phase 1": {lat:4.8280, lng:7.0150},
  "Port Harcourt GRA Phase 2": {lat:4.8150, lng:6.9900},
  "GRA Phase 3": {lat:4.8050, lng:6.9700}, "D-Line PH": {lat:4.8100, lng:7.0050},
  "Artillery PH": {lat:4.7900, lng:7.0100}, "Trans Amadi PH": {lat:4.8300, lng:7.0400},
  "Rumuola": {lat:4.8500, lng:7.0200}, "Rumuibekwe": {lat:4.8450, lng:7.0300},
  "Woji": {lat:4.8200, lng:7.0500}, "Eliozu": {lat:4.8800, lng:7.0700},
  "Diobu": {lat:4.8200, lng:7.0000}, "Mile 1 PH": {lat:4.8250, lng:7.0070},
  "Mile 2 PH": {lat:4.8180, lng:6.9980}, "Mile 3 PH": {lat:4.8100, lng:6.9900},
  "Rumuomasi": {lat:4.8350, lng:7.0180}, "Rumuokoro": {lat:4.8600, lng:7.0600},
  "Peter Odili Road": {lat:4.8400, lng:7.0350}, "Aba Road PH": {lat:4.8250, lng:7.0300},
  "Choba": {lat:4.8950, lng:7.0180}, "Rumuokwuta": {lat:4.8500, lng:7.0280},
  "Old GRA PH": {lat:4.8200, lng:7.0100},

  /* BAYELSA STATE */
  "Yenagoa GRA": {lat:4.9260, lng:6.2720}, "Tombia": {lat:4.8800, lng:6.2600},
  "Swali": {lat:4.9200, lng:6.2500}, "Opolo": {lat:4.9100, lng:6.2600},
  "Kpansia": {lat:4.9000, lng:6.2650}, "Amarata": {lat:4.9300, lng:6.2700},

  /* CROSS RIVER STATE */
  "Calabar GRA": {lat:4.9620, lng:8.3420}, "Calabar South": {lat:4.9500, lng:8.3380},
  "UNICAL Road": {lat:4.9750, lng:8.3350}, "Etta Agbo": {lat:4.9400, lng:8.3450},
  "Marian": {lat:4.9600, lng:8.3490}, "State Housing Calabar": {lat:4.9650, lng:8.3600},

  /* AKWA IBOM STATE */
  "Uyo GRA": {lat:5.0500, lng:7.9250}, "Ewet Housing": {lat:5.0600, lng:7.9350},
  "Wellington Bassey Way Uyo": {lat:5.0520, lng:7.9200}, "Ikot Ekpene": {lat:5.1800, lng:7.7200},
  "Eket": {lat:4.6600, lng:7.9200},

  /* EDO STATE / BENIN CITY */
  "Benin City GRA": {lat:6.3420, lng:5.6350}, "Airport Road Benin": {lat:6.3480, lng:5.6230},
  "Ugbowo": {lat:6.3600, lng:5.6400}, "Ekehuan Road": {lat:6.3200, lng:5.6100},
  "Ring Road Benin": {lat:6.3320, lng:5.6270}, "Sapele Road Benin": {lat:6.3500, lng:5.6450},
  "Upper Siluko": {lat:6.3100, lng:5.6000}, "Ikpoba Hill": {lat:6.3350, lng:5.6480},
  "Uselu": {lat:6.3700, lng:5.6500}, "New Benin": {lat:6.3280, lng:5.6350},

  /* DELTA STATE */
  "Asaba GRA": {lat:6.2000, lng:6.7450}, "Cable Point Asaba": {lat:6.2050, lng:6.7500},
  "Summit Asaba": {lat:6.2100, lng:6.7380}, "Okpanam": {lat:6.2200, lng:6.7200},
  "Warri GRA": {lat:5.5200, lng:5.7490}, "PTI Road Warri": {lat:5.5330, lng:5.7550},
  "Okumagba Avenue": {lat:5.5250, lng:5.7480}, "Effurun": {lat:5.5400, lng:5.7800},
  "Ovwian": {lat:5.5100, lng:5.7900}, "Agbarho": {lat:5.6500, lng:5.8000},

  /* ONDO STATE */
  "Akure GRA": {lat:7.2600, lng:5.2040}, "Ado Road Akure": {lat:7.2700, lng:5.2100},
  "FUTA Road": {lat:7.2800, lng:5.1900}, "Ondo Town": {lat:7.1000, lng:4.8400},
  "Owo": {lat:7.1900, lng:5.5900}, "Ikare": {lat:7.5200, lng:5.7600},

  /* EKITI STATE */
  "Ado Ekiti GRA": {lat:7.6350, lng:5.2190}, "Basiri": {lat:7.6200, lng:5.2300},
  "Ido Ekiti": {lat:7.6500, lng:5.2100}, "Ikole Ekiti": {lat:7.7900, lng:5.4900},

  /* KADUNA STATE */
  "Kaduna GRA": {lat:10.5220, lng:7.4400}, "Ungwan Rimi": {lat:10.5100, lng:7.4350},
  "Barnawa": {lat:10.4900, lng:7.4380}, "Tudun Wada Kaduna": {lat:10.5300, lng:7.4580},
  "Kawo": {lat:10.5400, lng:7.4200}, "Rigasa": {lat:10.5050, lng:7.3850},
  "Malali": {lat:10.5600, lng:7.4700}, "Sabon Gari Kaduna": {lat:10.5200, lng:7.4450},
  "Hayin Banki": {lat:10.4800, lng:7.4100}, "Gonin Gora": {lat:10.4700, lng:7.3900},

  /* KEBBI STATE */
  "Birnin Kebbi GRA": {lat:12.4520, lng:4.2020}, "Kalgo Road": {lat:12.4400, lng:4.2100},
  "Koko": {lat:11.4200, lng:4.5100}, "Argungu": {lat:12.7400, lng:4.5200},

  /* SOKOTO STATE */
  "Sokoto GRA": {lat:13.0600, lng:5.2400}, "Mabera": {lat:13.0700, lng:5.2600},
  "Gawon Nama Sokoto": {lat:13.0500, lng:5.2300}, "Runjin Sambo": {lat:13.0400, lng:5.2500},

  /* ZAMFARA STATE */
  "Gusau GRA": {lat:12.1680, lng:6.6530}, "Tudun Wada Gusau": {lat:12.1750, lng:6.6600},

  /* KANO STATE */
  "Nassarawa GRA Kano": {lat:11.9980, lng:8.5230}, "Bompai Industrial": {lat:12.0100, lng:8.5400},
  "Sabon Gari Kano": {lat:12.0000, lng:8.5320}, "Gwale": {lat:11.9850, lng:8.5150},
  "Kofar Mata": {lat:12.0200, lng:8.5600}, "Tarauni": {lat:12.0050, lng:8.5100},
  "Hotoro": {lat:11.9900, lng:8.5650}, "Dorayi": {lat:11.9700, lng:8.5000},
  "Zaria Road Kano": {lat:12.0400, lng:8.5500}, "Fagge": {lat:12.0150, lng:8.5280},
  "Panshekara": {lat:11.9750, lng:8.5450}, "Wudil": {lat:11.8000, lng:8.8500},
  "Kiru": {lat:11.7600, lng:8.4500},

  /* JIGAWA STATE */
  "Dutse GRA Jigawa": {lat:11.7600, lng:9.3430}, "Kazaure": {lat:12.6800, lng:8.1900},

  /* KATSINA STATE */
  "Katsina GRA": {lat:12.9950, lng:7.5990}, "Daura Road": {lat:12.9900, lng:7.6050},

  /* PLATEAU STATE / JOS */
  "Jos GRA": {lat:9.9180, lng:8.8920}, "Rayfield": {lat:9.9000, lng:8.8980},
  "Bukuru": {lat:9.7900, lng:8.8600}, "Bauchi Road Jos": {lat:9.9300, lng:8.9200},
  "Zaria Road Jos": {lat:9.9400, lng:8.9100}, "Anglo-Jos": {lat:9.9250, lng:8.8800},
  "Rantya": {lat:9.9100, lng:8.8700}, "Tudun Wada Jos": {lat:9.9050, lng:8.8850},
  "Kabong": {lat:9.9350, lng:8.8650},

  /* BENUE STATE */
  "Makurdi GRA": {lat:7.7310, lng:8.5320}, "High Level Makurdi": {lat:7.7400, lng:8.5400},
  "North Bank Makurdi": {lat:7.7250, lng:8.5150}, "Wurukum": {lat:7.7200, lng:8.5380},
  "Wadata": {lat:7.7150, lng:8.5450},

  /* ADAMAWA STATE */
  "Yola GRA": {lat:9.2050, lng:12.4820}, "Jimeta": {lat:9.2800, lng:12.4700},
  "Doubeli": {lat:9.2100, lng:12.4700}, "Karewa Yola": {lat:9.2200, lng:12.4900},

  /* TARABA STATE */
  "Jalingo GRA": {lat:8.8900, lng:11.3620}, "Hammaruwa": {lat:8.8800, lng:11.3700},
  "Mayo-Belwa": {lat:9.0700, lng:12.0000},

  /* GOMBE STATE */
  "Gombe GRA": {lat:10.2950, lng:11.1670}, "Pantami": {lat:10.3000, lng:11.1700},
  "Tudun Wada Gombe": {lat:10.2900, lng:11.1600},

  /* BAUCHI STATE */
  "Bauchi GRA": {lat:10.3170, lng:9.8500}, "Yelwa": {lat:10.3100, lng:9.8600},
  "Wunti": {lat:10.3250, lng:9.8400},

  /* BORNO STATE */
  "Maiduguri GRA": {lat:11.8470, lng:13.1600}, "Bolori": {lat:11.8600, lng:13.1500},
  "Gwange": {lat:11.8400, lng:13.1700},

  /* YOBE STATE */
  "Damaturu GRA": {lat:11.7470, lng:11.9600},
};

/* ─── STREET DATA FOR MAJOR CITIES ────────────────────────────────────── */
const NIGERIA_CITIES = {
  /* ABUJA / FCT — very comprehensive */
  "Maitama": [
    "Aguiyi Ironsi Street", "Gana Street", "Aminu Kano Crescent", "Tigris Crescent",
    "Rhine Street", "Danube Street", "Mississippi Street", "Aminu Zubair Street",
    "Ousman Danfodio Crescent", "UN Drive", "Tafawa Balewa Way", "Constitution Avenue",
    "Yakubu Gowon Crescent", "Alvan Ikoku Way", "Olusegun Obasanjo Way",
    "Shehu Shagari Way", "Mohammadu Buhari Way", "Nnamdi Azikiwe Expressway",
    "Alex Ekwueme Way", "Wole Soyinka Crescent", "Chinua Achebe Street",
    "Chike Obi Close", "Nobel House", "Transcorp Hilton", "Sheraton Abuja",
    "British High Commission", "US Embassy", "French Embassy", "German Embassy",
    "Ministry of Finance", "Presidential Villa Annex", "State House", "Aso Rock"
  ],
  "Wuse 2": [
    "Aminu Kano Crescent", "Gana Street", "Parakou Street", "Libreville Street",
    "Dakar Street", "Accra Street", "Bangui Street", "Brazzaville Street",
    "Conakry Street", "Freetown Street", "Kampala Street", "Kigali Street",
    "Kinshasa Street", "Luanda Street", "Lusaka Street", "Mogadishu Crescent",
    "Nairobi Street", "Niamey Street", "Nouakchott Street", "Ndjamena Street",
    "Ouagadougou Street", "Porto-Novo Street", "Praia Street", "Rabat Street",
    "Banex Plaza", "Sahad Stores", "Double Four Plaza", "Ceddi Plaza", "Game Village",
    "Hassan Katsina", "Olu Obasanjo Road", "Constitution Avenue"
  ],
  "Garki": [
    "Mohammed Mahmud Street", "Tafawa Balewa Way", "Murtala Muhammed Way",
    "Ahmadu Bello Way", "Adetokunbo Ademola Crescent", "Zaria Street",
    "Independence Avenue", "Herbert Macaulay Way", "Mobolaji Johnson Way",
    "NICON Insurance Plaza", "Federal Secretariat", "Ministry Complex",
    "Area 1 Shopping Centre", "Area 2 Market", "Garki Hospital"
  ],
  "Gwarinpa": [
    "1st Avenue Gwarinpa", "2nd Avenue Gwarinpa", "3rd Avenue Gwarinpa",
    "4th Avenue Gwarinpa", "5th Avenue Gwarinpa", "6th Avenue Gwarinpa",
    "7th Avenue Gwarinpa", "8th Avenue Gwarinpa", "9th Avenue Gwarinpa",
    "10th Avenue Gwarinpa", "11th Avenue Gwarinpa", "12th Avenue Gwarinpa",
    "Citec Estate", "Gwarinpa Estate", "Gwarinpa Market", "Games Village Abuja",
    "Jabi Lake Mall", "Sheraton Road", "Blue Kabab Mall"
  ],
  "Kubwa": [
    "Phase 1 Kubwa", "Phase 2 Kubwa", "Phase 3 Kubwa", "Phase 4 Kubwa",
    "Phase 5 Kubwa", "Kubwa Express Road", "Pyakasa", "Ushafa",
    "Kubwa Central Market", "Kubwa Hospital", "FCDA School", "Police Station Kubwa",
    "FHA Estate Kubwa", "NHC Estate Kubwa", "Bwari Road"
  ],
  "Asokoro": [
    "Independence Avenue", "Panama Street", "Cairo Street", "Cairo Crescent",
    "Accra Street", "Dubai Street", "Kuwait Crescent", "Saudi Arabia Avenue",
    "Aso Rock Presidential Villa", "State House Clinic", "NNPC Towers",
    "Presidential Boulevard", "Eagles Square", "National Mosque Road",
    "National Christian Centre Road", "Millennium Park Drive"
  ],

  /* PORT HARCOURT */
  "Port Harcourt GRA Phase 1": [
    "1st Avenue PH GRA", "2nd Avenue PH GRA", "3rd Avenue PH GRA", "4th Avenue PH GRA",
    "Tennis Court Road", "Yakubu Gowon Stadium Road", "Government House Road",
    "Stadium Road", "Azikiwe Road", "Hospital Road", "Bishop Johnson Road",
    "Christ the King Cathedral Road", "St. Andrews Road", "King Perekule Street"
  ],
  "D-Line PH": [
    "D-Line Road", "Artillery Road", "Moscow Road", "Slaughter Road",
    "Tombia Extension", "Rumuola Road", "NTA Road", "Azikiwe Road",
    "Aggrey Road", "Aba Road", "Rumuomasi Road", "Water Line",
    "Presidential Hotel Road", "Isaac Boro Park Road"
  ],
  "Trans Amadi PH": [
    "Trans Amadi Industrial Layout", "SIAT Nigeria Road", "Iwofe Road",
    "East West Road", "Forces Avenue", "Choba Road", "School Road Trans Amadi",
    "Elelenwo Road", "Rumuibekwe Road", "Woji Road", "Ada George Road",
    "Captain Amangala Street", "MCC Road", "Bori Camp Road"
  ],
  "Rumuola": [
    "Rumuola Road", "Rumuibekwe Road", "Eleme Junction", "Rumuwoji",
    "Stadium Road", "Peter Odili Road", "Nkpolu Rumuigbo", "Ogbunabali",
    "Borokiri", "Abuloma Road", "School Road", "Eliozu Road"
  ],

  /* IBADAN */
  "Ibadan GRA": [
    "Agodi GRA", "Circular Road", "Awolowo Avenue", "Cocoa House Road",
    "Ring Road", "Iyaganku GRA", "Police Headquarters Road", "Government House Road",
    "Secretariat Road", "Oluyole Estate", "UCH Road", "University of Ibadan Road"
  ],
  "Bodija": [
    "Bodija Market Road", "Bodija Estate Road", "UI Road", "Bodija-UI Road",
    "Lagos Bypass", "Sango Road", "Challenge Market Road", "Orita Challenge",
    "Bodija Bus Stop", "Bodija High Court", "Bodija GRA", "Sango Roundabout"
  ],
  "Mokola": [
    "Mokola Hill Road", "Liberty Road", "Adeoyo Road", "Agodi Gate Road",
    "Samonda Road", "Aminalari Road", "Abiola Road", "New Garage Road",
    "Ogunpa River Bridge", "Mapo Hill Road", "Dugbe Market Road",
    "Gbagi International Market"
  ],
  "Challenge Ibadan": [
    "Challenge Road", "Orita Challenge", "Elewe Road", "Ogunsanya Road",
    "Oremeji Road", "Ojo Road Challenge", "New Court Road", "Yemetu Road",
    "Subuola Road", "Ologunde Road"
  ],

  /* ENUGU */
  "GRA Enugu": [
    "Independence Avenue", "Garden Avenue", "Presidential Road", "Coal Camp Road",
    "Bishop Shannon Street", "Thompson Avenue", "Okpara Avenue", "Abakaliki Road",
    "Agbani Road", "Zik Avenue", "Nine Mile Corner", "Milliken Hill"
  ],
  "Independence Layout Enugu": [
    "Emene Road", "Ogui Road", "Abakaliki Road", "Presidential Road",
    "Achara Layout Road", "Trans Ekulu Road", "Kenyatta Street",
    "Michael Okpara Avenue", "Okpara Avenue Extension"
  ],
  "New Haven Enugu": [
    "New Haven Road", "Nike Road", "Ugwuaji Road", "Agbudu Umana",
    "Adazie Street", "Agida Road", "New Haven Market", "New Haven Expressway"
  ],

  /* BENIN CITY */
  "Benin City GRA": [
    "1st Ugbor Road", "2nd Ugbor Road", "3rd Ugbor Road", "Reservation Road",
    "Oba Ovoranmwen Road", "Akpakpava Road", "Airport Road", "Mission Road",
    "Forestry Road", "Boundary Road", "Government House Road",
    "Ekenwan Road", "Urubi Street", "Sokponba Road"
  ],
  "Ring Road Benin": [
    "Ring Road", "Sakponba Road", "Oliha Market Road", "Siluko Road",
    "Upper Siluko Road", "Ugbor Road", "Adesuwa Grammar School Road",
    "Ekehuan Road", "Igun Street", "Iduowina Street"
  ],
  "Ugbowo": [
    "Ugbowo Road", "University of Benin Road", "UNIBEN Medical School Road",
    "Ekosodin Road", "Osagie Road", "Uselu Road", "Lagos Street Benin",
    "Adolo Street", "BDPA Road"
  ],

  /* KANO */
  "Nassarawa GRA Kano": [
    "Ibrahim Taiwo Road", "Ali Akilu Road", "Sani Abacha Way", "Yakubu Gowon Way",
    "Muhammad Abubakar Road", "Civic Centre Road", "Emir Palace Road",
    "Bayero University Road", "Government House Road", "State Secretariat Road"
  ],
  "Sabon Gari Kano": [
    "Zaria Road", "Sabon Gari Market Road", "Bompai Road", "Maiduguri Road",
    "Kofar Nasarawa Road", "Ring Road Kano", "Sharada Road",
    "Kano City Road", "Fagge Road", "Challawa Road"
  ],
  "Bompai Industrial": [
    "Bompai Road", "Chalawa Industrial Road", "Sharada Industrial Road",
    "Kano Free Trade Zone Road", "Textile Industrial Road",
    "Dan Zuwo Road", "Zaria Road Kano"
  ],

  /* KADUNA */
  "Kaduna GRA": [
    "Ali Akilu Road Kaduna", "Tafawa Balewa Way Kaduna", "Constitution Road Kaduna",
    "Independence Way Kaduna", "Lady Lolo Road", "Television Road",
    "Yakubu Gowon Way Kaduna", "Lugard Hall Road", "Government House Road Kaduna"
  ],
  "Ungwan Rimi": [
    "Ungwan Rimi Road", "Rabah Road", "Mando Road", "Kachia Road",
    "Abakpa Road", "Kakuri Road", "Rigachikun Road",
    "Narayi Road", "Kinkiba Road"
  ],
  "Barnawa": [
    "Barnawa Road", "Kachia Road Kaduna", "Barnawa Market", "Olympic Estate",
    "Barnawa Abakpa Junction", "Tudun Wada Road Kaduna"
  ],

  /* JOS */
  "Jos GRA": [
    "Raymond Dikko Street", "Ali Monguno Street", "Yakubu Gowon Way Jos",
    "Government House Road Jos", "Secretariat Road Jos", "Stadium Road Jos",
    "Bauchi Road Jos", "Airport Road Jos", "Plateau Hotel Road",
    "St. Piran's Road", "College Road Jos"
  ],
  "Rayfield": [
    "Zaria Road Rayfield", "Bukuru Expressway", "Rayfield Road",
    "Lower Rayfield", "Upper Rayfield", "Wildlife Park Road",
    "Vom Road", "Rayfield Resort Road"
  ],

  /* CALABAR */
  "Calabar GRA": [
    "Calabar Road", "IBB Way Calabar", "Murtala Muhammed Highway Calabar",
    "Ekpo Abasi Street", "Mbukpa Road", "Wilkie Street", "Goldie Street",
    "Ndidem Usang Iso Road", "Etta Agbo Road", "UNICAL Road"
  ],

  /* UYO */
  "Uyo GRA": [
    "Oron Road Uyo", "Abak Road Uyo", "Ikot Ekpene Road Uyo",
    "Stadium Road Uyo", "Wellington Bassey Way", "Owutu Road",
    "Use Offot Road", "Aka Road", "Udo Umana Road", "IBB Avenue Uyo"
  ],

  /* WARRI */
  "Warri GRA": [
    "Warri-Sapele Road", "Effurun-Otor Road", "PTI Road Warri",
    "Airport Road Warri", "Okumagba Avenue", "Jakpa Road", "Petroleum Road",
    "DSC Highway", "Ughelli Road", "NNPC Road Warri"
  ],

  /* ASABA */
  "Asaba GRA": [
    "Nnebisi Road Asaba", "Okpanam Road Asaba", "DBS Road Asaba",
    "Summit Road", "Cable Point Road", "West End Estate",
    "INEC Road Asaba", "Government House Road Asaba",
    "Mariam Babangida Way Asaba", "King Oskar Road"
  ],

  /* MINNA */
  "Minna GRA": [
    "Minna-Bida Road", "Kpakungu Road", "Bosso Road", "Tunga Road",
    "Paiko Road", "Shiroro Road", "Gidan Mangoro", "Gwari Road",
    "IBB Way Minna", "Airport Road Minna"
  ],

  /* ILORIN */
  "Ilorin GRA": [
    "Ahmadu Bello Way Ilorin", "Ibrahim Taiwo Road Ilorin", "Challenge Road Ilorin",
    "Bank Road Ilorin", "Fate Road Ilorin", "Okekele Road", "Unity Road Ilorin",
    "Market Road Ilorin", "Mosque Road Ilorin", "University Road Ilorin",
    "UNILORIN Road", "Tanke Road"
  ],

  /* OWERRI */
  "Owerri GRA": [
    "Wetheral Road Owerri", "Chukwuemeka Odumegwu-Ojukwu Avenue",
    "Okigwe Road Owerri", "Port Harcourt Road Owerri", "World Bank Road Owerri",
    "New Owerri Estate Road", "Government House Road Owerri",
    "Egbu Road", "Imo Concorde Hotel Road", "Relief Market Road"
  ],

  /* ABEOKUTA */
  "Abeokuta GRA": [
    "Kuto Road Abeokuta", "Oke Mosan Road", "Kobape Road",
    "Governor's Office Road", "Panseke Road", "Elega Road",
    "Ibara GRA Road", "Kuto Market Road", "Kemta Road"
  ],
};

/* ─── NIGERIA STATES METADATA ─────────────────────────────────────────── */
const NIGERIA_STATES = {
  "Abia": { capital: "Umuahia", majorCity: "Aba", disco: "EEDC", geoPolitical: "South East" },
  "Adamawa": { capital: "Yola", disco: "YEDC", geoPolitical: "North East" },
  "Akwa Ibom": { capital: "Uyo", disco: "PHED", geoPolitical: "South South" },
  "Anambra": { capital: "Awka", majorCity: "Onitsha", disco: "EEDC", geoPolitical: "South East" },
  "Bauchi": { capital: "Bauchi", disco: "YEDC", geoPolitical: "North East" },
  "Bayelsa": { capital: "Yenagoa", disco: "PHED", geoPolitical: "South South" },
  "Benue": { capital: "Makurdi", disco: "JED", geoPolitical: "North Central" },
  "Borno": { capital: "Maiduguri", disco: "YEDC", geoPolitical: "North East" },
  "Cross River": { capital: "Calabar", disco: "PHED", geoPolitical: "South South" },
  "Delta": { capital: "Asaba", majorCity: "Warri", disco: "BEDC", geoPolitical: "South South" },
  "Ebonyi": { capital: "Abakaliki", disco: "EEDC", geoPolitical: "South East" },
  "Edo": { capital: "Benin City", disco: "BEDC", geoPolitical: "South South" },
  "Ekiti": { capital: "Ado Ekiti", disco: "BEDC", geoPolitical: "South West" },
  "Enugu": { capital: "Enugu", disco: "EEDC", geoPolitical: "South East" },
  "FCT": { capital: "Abuja", disco: "AEDC", geoPolitical: "North Central" },
  "Gombe": { capital: "Gombe", disco: "YEDC", geoPolitical: "North East" },
  "Imo": { capital: "Owerri", disco: "EEDC", geoPolitical: "South East" },
  "Jigawa": { capital: "Dutse", disco: "KEDCO", geoPolitical: "North West" },
  "Kaduna": { capital: "Kaduna", disco: "KAEDCO", geoPolitical: "North West" },
  "Kano": { capital: "Kano", disco: "KEDCO", geoPolitical: "North West" },
  "Katsina": { capital: "Katsina", disco: "KEDCO", geoPolitical: "North West" },
  "Kebbi": { capital: "Birnin Kebbi", disco: "KAEDCO", geoPolitical: "North West" },
  "Kogi": { capital: "Lokoja", disco: "AEDC", geoPolitical: "North Central" },
  "Kwara": { capital: "Ilorin", disco: "IBEDC", geoPolitical: "North Central" },
  "Lagos": { capital: "Ikeja", disco: "IE/EKEDC", geoPolitical: "South West" },
  "Nasarawa": { capital: "Lafia", disco: "AEDC", geoPolitical: "North Central" },
  "Niger": { capital: "Minna", disco: "AEDC", geoPolitical: "North Central" },
  "Ogun": { capital: "Abeokuta", disco: "IBEDC", geoPolitical: "South West" },
  "Ondo": { capital: "Akure", disco: "BEDC", geoPolitical: "South West" },
  "Osun": { capital: "Osogbo", disco: "IBEDC", geoPolitical: "South West" },
  "Oyo": { capital: "Ibadan", disco: "IBEDC", geoPolitical: "South West" },
  "Plateau": { capital: "Jos", disco: "JED", geoPolitical: "North Central" },
  "Rivers": { capital: "Port Harcourt", disco: "PHED", geoPolitical: "South South" },
  "Sokoto": { capital: "Sokoto", disco: "KAEDCO", geoPolitical: "North West" },
  "Taraba": { capital: "Jalingo", disco: "YEDC", geoPolitical: "North East" },
  "Yobe": { capital: "Damaturu", disco: "YEDC", geoPolitical: "North East" },
  "Zamfara": { capital: "Gusau", disco: "KAEDCO", geoPolitical: "North West" },
};

/* ─── AREA PARENT RELATIONSHIPS FOR NIGERIA ──────────────────────────── */
const NIGERIA_AREA_PARENT = {
  /* Abuja hierarchy */
  "Jabi": "Maitama", "UN Drive": "Maitama",
  "Garki": "Central Business District Abuja",
  "Citec Estate": "Gwarinpa", "Games Village Abuja": "Gwarinpa",
  "Pyakasa": "Kubwa", "Ushafa": "Kubwa",
  "Karu": "Nyanya",

  /* Port Harcourt hierarchy */
  "Old GRA PH": "Port Harcourt GRA Phase 1",
  "Rumuola": "Trans Amadi PH",
  "Mile 1 PH": "Diobu", "Mile 2 PH": "Diobu", "Mile 3 PH": "Diobu",
  "Choba": "Eliozu",

  /* Ibadan hierarchy */
  "Bodija Market Road": "Bodija",

  /* Benin City hierarchy */
  "Ikpoba Hill": "Ring Road Benin",
  "New Benin": "Ring Road Benin",
};

/* ─── FUNCTION TO MERGE NIGERIA DATA INTO APP ────────────────────────── */
function initNigeriaData() {
  /* Merge AREA_BANDS */
  if (typeof AREA_BANDS !== 'undefined') {
    Object.assign(AREA_BANDS, NIGERIA_AREA_BANDS);
  }
  /* Merge AREA_COORDS */
  if (typeof AREA_COORDS !== 'undefined') {
    Object.assign(AREA_COORDS, NIGERIA_AREA_COORDS);
  }
  /* Merge AREA_PARENT */
  if (typeof AREA_PARENT !== 'undefined') {
    Object.assign(AREA_PARENT, NIGERIA_AREA_PARENT);
  }
  /* Add all Nigeria cities streets to LOCS */
  if (typeof LOCS !== 'undefined' && typeof sl === 'function') {
    for (const [area, streets] of Object.entries(NIGERIA_CITIES)) {
      /* Add the area itself */
      if (!LOCS.find(l => l.name === area && !l.street)) {
        LOCS.push({ id: sl(area), name: area, area, street: null, label: area, custom: false });
      }
      /* Add each street */
      for (const street of streets) {
        const id = sl(`${street} ${area}`);
        if (!LOCS.find(l => l.id === id)) {
          LOCS.push({ id, name: street, area, street, label: `${street}, ${area}`, custom: false });
        }
      }
    }
    /* Also add area-only entries for NIGERIA_AREA_COORDS areas not in NIGERIA_CITIES */
    for (const area of Object.keys(NIGERIA_AREA_COORDS)) {
      if (!NIGERIA_CITIES[area] && !LOCS.find(l => l.name === area && !l.street)) {
        LOCS.push({ id: sl(area), name: area, area, street: null, label: area, custom: false });
      }
    }
  }
  /* Merge DISCO list */
  if (typeof DISCO !== 'undefined') {
    /* Remove old 2-disco Lagos-only list and replace with full Nigeria DISCOs */
    DISCO.length = 0;
    for (const d of NIGERIA_DISCOS) {
      DISCO.push({ name: d.name, lgas: d.lgas, color: d.color, shortName: d.shortName });
    }
  }
  console.log('[NEPAWatch] Nigeria data loaded — all 36 states + FCT, 11 DISCOs.');
}
