import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

/* Reports filed by the prediction engine carry this user_id. Used to label
   every row as 'crowd' or 'ai' so API consumers always know what they got. */
const AI_USER_ID = '00000000-0000-0000-0000-000000000001'

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET') return json({ error: 'Use GET.' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey) {
    return json({ error: 'Missing X-API-Key header. Get a free key at nepawatch.app/api.html' }, 401)
  }

  const { data: k, error: kErr } = await supabase
    .from('api_keys')
    .select('id, status, tier, requests_today, total_requests, last_reset_date')
    .eq('key', apiKey)
    .single()

  if (kErr || !k) return json({ error: 'Invalid API key.' }, 403)
  if (k.status === 'pending') return json({ error: 'Key pending approval. Check your email.' }, 403)
  if (k.status === 'revoked') return json({ error: 'This API key has been revoked.' }, 403)

  const today = new Date().toISOString().split('T')[0]
  const requestsToday = k.last_reset_date !== today ? 0 : (k.requests_today ?? 0)
  const dailyLimit = k.tier === 'pro' ? 10000 : 100

  if (requestsToday >= dailyLimit) {
    return json({
      error: `Daily limit of ${dailyLimit} requests reached.`,
      tier: k.tier ?? 'free',
      daily_limit: dailyLimit,
      requests_today: requestsToday,
      resets_at: today + 'T23:59:59Z',
      upgrade: 'https://nepawatch.app/api.html#pricing',
    }, 429)
  }

  const url = new URL(req.url)
  const p = url.searchParams
  const limit = Math.min(parseInt(p.get('limit') ?? '50'), 100)
  const offset = parseInt(p.get('offset') ?? '0')

  let q = supabase
    .from('reports')
    .select('id, type, user_id, location_name, location_area, location_state, location_lga, confirms, ai_prob, created_at')

  const state  = p.get('state')
  const lga    = p.get('lga')
  const area   = p.get('area')
  const type   = p.get('type')
  const since  = p.get('since')
  const source = p.get('source')   // 'crowd' | 'ai' — omit for both

  if (state) q = q.ilike('location_state', `%${state}%`)
  if (lga)   q = q.ilike('location_lga',   `%${lga}%`)
  if (area)  q = q.ilike('location_area',  `%${area}%`)
  if (type && ['out', 'bck'].includes(type)) q = q.eq('type', type)
  if (since) q = q.gte('created_at', since)

  /* Source filter — 'crowd' returns human reports only, 'ai' returns model
     predictions only. Omitting the param returns both, each labelled.        */
  if (source === 'crowd')   q = q.neq('user_id', AI_USER_ID)
  else if (source === 'ai') q = q.eq('user_id', AI_USER_ID)

  q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

  const { data: rows, error: qErr } = await q
  if (qErr) return json({ error: qErr.message }, 400)

  /* Label every row so consumers can always tell crowd data from model output.
     user_id is stripped — it is internal and not part of the public contract. */
  const data = (rows ?? []).map((r: Record<string, unknown>) => {
    const isAI = r.user_id === AI_USER_ID
    const { user_id: _omit, ai_prob, ...rest } = r
    return {
      ...rest,
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

  return json({
    data,
    meta: {
      count: data.length,
      limit,
      offset,
      source: source ?? 'all',
      requests_today: requestsToday + 1,
      requests_remaining: dailyLimit - requestsToday - 1,
      daily_limit: dailyLimit,
      tier: k.tier ?? 'free',
    },
  })
})
