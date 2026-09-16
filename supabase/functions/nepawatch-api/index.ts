import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* ═══════════════════════════════════════════════════════════════════════════
   NEPAWatch — public reports API

   Auth: X-API-Key header, validated against the api_keys table. This function
   runs with verify_jwt = false (see supabase/config.toml) because third-party
   consumers have no Supabase JWT.
   ═══════════════════════════════════════════════════════════════════════════ */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers':
    'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After',
}

/* Reports filed by the prediction engine carry this user_id. Every row is
   labelled so consumers always know what is crowd data and what is a model
   prediction. */
const AI_USER_ID = '00000000-0000-0000-0000-000000000001'

/* The reports table stores location_area only — there is no state column.
   State is derived from this map so ?state= works and every row can carry a
   location_state field, without a schema migration or a join. */
const STATE_AREAS: Record<string, string[]> = {
  "Abia": ["Aba GRA","Aba Road Aba","Ngwa Road","Ubakala","Umuahia GRA","Umuola Road"],
  "Adamawa": ["Doubeli","Jimeta","Karewa Yola","Yola GRA"],
  "Akwa Ibom": ["Eket","Ewet Housing","Ikot Ekpene","Uyo GRA","Wellington Bassey Way Uyo"],
  "Anambra": ["Awka GRA","Bridge Head Onitsha","Ekwueme Square Awka","Fegge Onitsha","Nnewi","Okpuno","Onitsha GRA","Unizik Road Awka"],
  "Bauchi": ["Bauchi GRA","Wunti","Yelwa"],
  "Bayelsa": ["Amarata","Kpansia","Opolo","Swali","Tombia","Yenagoa GRA"],
  "Benue": ["High Level Makurdi","Makurdi GRA","North Bank Makurdi","Wadata","Wurukum"],
  "Borno": ["Bolori","Gwange","Maiduguri GRA"],
  "Cross River": ["Calabar GRA","Calabar South","Etta Agbo","Marian","UNICAL Road"],
  "Delta": ["Agbarho","Asaba GRA","Cable Point Asaba","Effurun","Okpanam","Okumagba Avenue","Ovwian","PTI Road Warri","Summit Asaba","Warri GRA"],
  "Ebonyi": ["Abakaliki GRA","Ishieke","Mile 50 Abakaliki"],
  "Edo": ["Airport Road Benin","Benin City GRA","Ekehuan Road","Ikpoba Hill","New Benin","Ring Road Benin","Sakponba","Sapele Road Benin","Ugbowo","Upper Siluko","Uselu"],
  "Ekiti": ["Ado Ekiti GRA","Basiri","Ido Ekiti","Ikole Ekiti"],
  "Enugu": ["Abakpa","Achara Layout","Coal Camp","GRA Enugu","Garden Avenue Enugu","Independence Layout Enugu","Maryland Enugu","New Haven Enugu","Obiagu","Ogui","Trans Ekulu","Uwani"],
  "FCT": ["Abaji","Apo","Asokoro","Bwari","Central Business District Abuja","Durumi","Garki","Gudu","Gwagwalada","Gwarinpa","Jabi","Karu","Kubwa","Kuje","Kwali","Lokogoma","Maitama","Nyanya","Utako","Wuse","Wuse 2"],
  "Gombe": ["Gombe GRA","Pantami","Tudun Wada Gombe"],
  "Imo": ["Aladinma","Naze Owerri","New Owerri","Okigwe","Orlu","Owerri GRA","Trans Amadi Owerri","World Bank Owerri"],
  "Jigawa": ["Dutse GRA Jigawa","Kazaure"],
  "Kaduna": ["Barnawa","Gonin Gora","Hayin Banki","Kaduna GRA","Kawo","Malali","Rigasa","Sabon Gari Kaduna","Tudun Wada Kaduna","Ungwan Rimi"],
  "Kano": ["Bompai Industrial","Dorayi","Fagge","Gwale","Hotoro","Kiru","Kofar Mata","Nassarawa GRA Kano","Panshekara","Sabon Gari Kano","Tarauni","Wudil","Zaria Road Kano"],
  "Katsina": ["Daura Road","Katsina GRA"],
  "Kebbi": ["Argungu","Birnin Kebbi GRA","Kalgo Road","Koko"],
  "Kogi": ["Idah","Kabba","Lokoja","Lokoja GRA","Okene"],
  "Kwara": ["Ilorin GRA","Offa","Oloje Ilorin","Omu Aran","Taiwo Road Ilorin","Tanke Ilorin"],
  "Lagos": ["Agege","Ajah","Alimosho/Ipaja","Amuwo Odofin","Apapa","Badagry","Chevron/Lekki-Epe Expressway","Computer Village Ikeja","Ebute Metta","Epe","Festac Town","Gbagada","Ibeju-Lekki","Igbo Efon/Ilasan","Ikeja (Allen/Opebi)","Ikeja GRA","Ikorodu","Ikoyi","Ilupeju","Kosofe/Ketu","Lagos Island","Lekki Phase 1","Lekki Phase 2/Ikota","Magodo","Maryland/Anthony","Murtala Muhammed Airport","Mushin","Obalende/CMS","Ogba","Ojo/Alaba","Ojodu/Omole","Ojota/Oregun","Oshodi/Isolo","Shomolu/Bariga","Surulere","Victoria Island","Yaba"],
  "Nasarawa": ["Akwanga","Keffi","Lafia","Lafia GRA","Nasarawa Egon"],
  "Niger": ["Bida","Bosso Minna","Kontagora","Maikunkele","Minna","Minna GRA","Suleja"],
  "Ogun": ["Abeokuta GRA","Ifo","Ijebu Igbo","Ijebu Ode","Ilaro","Kemta","Kuto","Oke Mosan","Panseke","Sagamu","Sapon","Shagamu"],
  "Ondo": ["Ado Road Akure","Akure GRA","FUTA Road","Ikare","Ondo Town","Owo"],
  "Osun": ["Ede","Ile Ife","Ilesa","Oke Baale","Osogbo GRA","Station Road Osogbo"],
  "Oyo": ["Agege Ibadan","Agodi","Bodija","Challenge Ibadan","Dugbe","Ekotedo","Ibadan GRA","Iseyin","Iwo Road","Iyaganku","Mokola","Ogbomoso","Ojoo","Oke Ado","Oluyole","Oyo Town","Ring Road Ibadan","Saki","Sango Ibadan"],
  "Plateau": ["Anglo-Jos","Bauchi Road Jos","Bukuru","Jos GRA","Kabong","Rantya","Rayfield","Tudun Wada Jos","Zaria Road Jos"],
  "Rivers": ["Aba Road PH","Artillery PH","Choba","D-Line PH","Diobu","Eliozu","GRA Phase 3","Mile 1 PH","Mile 2 PH","Mile 3 PH","Old GRA PH","Peter Odili Road","Port Harcourt GRA Phase 1","Port Harcourt GRA Phase 2","Rumuibekwe","Rumuokoro","Rumuokwuta","Rumuola","Rumuomasi","Trans Amadi PH","Woji"],
  "Sokoto": ["Gawon Nama Sokoto","Mabera","Runjin Sambo","Sokoto GRA"],
  "Taraba": ["Hammaruwa","Jalingo GRA","Mayo-Belwa"],
  "Yobe": ["Damaturu GRA"],
  "Zamfara": ["Gusau GRA","Tudun Wada Gusau"],
};

/* area -> state, built once at cold start */
const AREA_STATE: Record<string, string> = {}
for (const [st, areas] of Object.entries(STATE_AREAS)) {
  for (const a of areas) AREA_STATE[a] = st
}

/* Case- and punctuation-insensitive lookup of a state name. Accepts "lagos",
   "LAGOS", "Cross River", "cross-river", "FCT", "abuja". */
const STATE_LOOKUP: Record<string, string> = {}
for (const st of Object.keys(STATE_AREAS)) {
  STATE_LOOKUP[st.toLowerCase().replace(/[^a-z]/g, '')] = st
}
STATE_LOOKUP['abuja'] = 'FCT'
STATE_LOOKUP['fctabuja'] = 'FCT'

function resolveState(input: string): string | null {
  return STATE_LOOKUP[input.toLowerCase().replace(/[^a-z]/g, '')] ?? null
}

function json(body: object, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

/* Consistent error shape so clients can branch on `code` rather than parsing
   prose. Every error carries a `docs` link. */
function fail(code: string, message: string, status: number, extra: object = {}) {
  return json({ error: message, code, docs: 'https://nepawatch.app/api.html', ...extra }, status)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET') return fail('METHOD_NOT_ALLOWED', 'Use GET.', 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) {
    return fail('MISSING_API_KEY',
      'Missing X-API-Key header. Get a free key at nepawatch.app/developer.html', 401)
  }

  const { data: k, error: kErr } = await supabase
    .from('api_keys')
    .select('id, status, tier, daily_limit, requests_today, total_requests, last_reset_date')
    .eq('key', apiKey)
    .maybeSingle()

  if (kErr)  return fail('LOOKUP_FAILED', 'Could not validate API key.', 500)
  if (!k)    return fail('INVALID_API_KEY', 'Invalid API key.', 403)
  if (k.status === 'pending') return fail('KEY_PENDING', 'This key is pending approval.', 403)
  if (k.status === 'revoked') return fail('KEY_REVOKED', 'This API key has been revoked.', 403)

  const today = new Date().toISOString().split('T')[0]
  const requestsToday = k.last_reset_date !== today ? 0 : (k.requests_today ?? 0)
  const TIER_FALLBACK: Record<string, number> = {
  free: 100, starter: 1000, pro: 10000, scale: 50000, business: 200000,
};
const dailyLimit = k.daily_limit ?? TIER_FALLBACK[k.tier ?? 'free'] ?? 100
  const resetAt = today + 'T23:59:59Z'

  /* Standard rate-limit headers on every response, not just on 429, so
     clients can back off before they are cut off. */
  const rateHeaders = (remaining: number) => ({
    'X-RateLimit-Limit':     String(dailyLimit),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset':     resetAt,
  })

  if (requestsToday >= dailyLimit) {
    const secondsToMidnight = Math.max(
      1, Math.floor((new Date(resetAt).getTime() - Date.now()) / 1000))
    return json({
      error: `Daily limit of ${dailyLimit} requests reached.`,
      code: 'RATE_LIMITED',
      docs: 'https://nepawatch.app/api.html',
      tier: k.tier ?? 'free',
      daily_limit: dailyLimit,
      requests_today: requestsToday,
      resets_at: resetAt,
      upgrade: 'https://nepawatch.app/developer.html',
    }, 429, { ...rateHeaders(0), 'Retry-After': String(secondsToMidnight) })
  }

  const url = new URL(req.url)
  const p = url.searchParams

  /* ── Validate params up front and say exactly what was wrong ───────────── */
  const rawLimit = p.get('limit')
  if (rawLimit !== null && (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1)) {
    return fail('INVALID_LIMIT', 'limit must be a positive integer (max 100).', 400)
  }
  const rawOffset = p.get('offset')
  if (rawOffset !== null && !/^\d+$/.test(rawOffset)) {
    return fail('INVALID_OFFSET', 'offset must be a non-negative integer.', 400)
  }
  const limit  = Math.min(rawLimit ? Number(rawLimit) : 50, 100)
  const offset = rawOffset ? Number(rawOffset) : 0

  const type = p.get('type')
  if (type && !['out', 'bck'].includes(type)) {
    return fail('INVALID_TYPE', "type must be 'out' (outage) or 'bck' (restored).", 400)
  }

  const source = p.get('source')
  if (source && !['crowd', 'ai'].includes(source)) {
    return fail('INVALID_SOURCE', "source must be 'crowd' or 'ai'.", 400)
  }

  const order = (p.get('order') ?? 'desc').toLowerCase()
  if (!['asc', 'desc'].includes(order)) {
    return fail('INVALID_ORDER', "order must be 'asc' or 'desc'.", 400)
  }

  for (const [param, val] of [['since', p.get('since')], ['until', p.get('until')]] as const) {
    if (val && isNaN(Date.parse(val))) {
      return fail('INVALID_DATE',
        `${param} must be an ISO 8601 timestamp, e.g. 2026-01-01T00:00:00Z.`, 400)
    }
  }

  const stateParam = p.get('state')
  let stateAreas: string[] | null = null
  if (stateParam) {
    const st = resolveState(stateParam)
    if (!st) {
      return fail('UNKNOWN_STATE',
        `Unknown state "${stateParam}".`, 400,
        { valid_states: Object.keys(STATE_AREAS).sort() })
    }
    stateAreas = STATE_AREAS[st]
  }

  /* ── Build the query ───────────────────────────────────────────────────── */
  let q = supabase
    .from('reports')
    .select(
      'id, type, user_id, location_name, location_area, confirms, ai_prob, created_at',
      { count: 'exact' }   /* total, so clients can paginate properly */
    )

  /* `area` and `lga` both match location_area. Our data is area-level, and
     `lga` is kept as an alias so existing integrations keep working. */
  const area = p.get('area') ?? p.get('lga')
  if (area) q = q.ilike('location_area', `%${area}%`)
  if (stateAreas) q = q.in('location_area', stateAreas)
  if (type)  q = q.eq('type', type)
  if (p.get('since')) q = q.gte('created_at', new Date(p.get('since')!).toISOString())
  if (p.get('until')) q = q.lte('created_at', new Date(p.get('until')!).toISOString())
  if (source === 'crowd')   q = q.neq('user_id', AI_USER_ID)
  else if (source === 'ai') q = q.eq('user_id', AI_USER_ID)

  q = q.order('created_at', { ascending: order === 'asc' })
       .range(offset, offset + limit - 1)

  const { data: rows, error: qErr, count } = await q
  if (qErr) {
    console.error('nepawatch-api query:', qErr)
    return fail('QUERY_FAILED', 'Could not fetch reports.', 500)
  }

  /* Label the source and attach the derived state. user_id is stripped — it
     is internal and not part of the public contract. */
  const data = (rows ?? []).map((r: Record<string, unknown>) => {
    const isAI = r.user_id === AI_USER_ID
    const { user_id: _omit, ai_prob, location_area, ...rest } = r
    return {
      ...rest,
      location_area,
      location_state: AREA_STATE[location_area as string] ?? null,
      source: isAI ? 'ai' : 'crowd',
      ...(isAI ? { ai_probability: ai_prob ?? null } : {}),
    }
  })

  // Non-blocking usage update
  supabase.from('api_keys').update({
    requests_today: requestsToday + 1,
    total_requests: (k.total_requests ?? 0) + 1,
    last_request_at: new Date().toISOString(),
    last_reset_date: today,
  }).eq('id', k.id).then(() => {})

  supabase.from('api_logs').insert({
    api_key_id: k.id,
    endpoint: 'reports',
    query_params: p.toString(),
    status_code: 200,
  }).then(() => {})

  const total = count ?? data.length
  return json({
    data,
    meta: {
      count: data.length,
      total,
      limit,
      offset,
      has_more: offset + data.length < total,
      source: source ?? 'all',
      order,
      requests_today: requestsToday + 1,
      requests_remaining: dailyLimit - requestsToday - 1,
      daily_limit: dailyLimit,
      tier: k.tier ?? 'free',
    },
  }, 200, rateHeaders(dailyLimit - requestsToday - 1))
})
