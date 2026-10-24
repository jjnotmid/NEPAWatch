import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verify the caller is an admin
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  /* Authorisation comes from the admins table, not a list baked into this
     source file. Adding or removing an admin is a row change, not a deploy,
     and the privileged address appears in no artifact we ship. */
  const { data: adminRow } = await supabaseAdmin
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow) return json({ error: 'Forbidden' }, 403)

  const body = await req.json().catch(() => ({}))
  const { action } = body

  if (action === 'list_api_keys') {
    const { data, error } = await supabaseAdmin.from('api_keys')
      .select('id, developer_name, app_name, email, use_case, key, status, tier, daily_limit, requests_today, total_requests, last_request_at, last_reset_date, created_at, approved_at, revoked_at, partner_granted_at, partner_granted_by, partner_grant_reason')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return json({ error: error.message }, 400)
    const utcToday = new Date().toISOString().slice(0, 10)
    const keys = (data ?? []).map((key) => {
      const { key: rawKey, ...safeKey } = key
      return {
        ...safeKey,
        requests_today: key.last_reset_date === utcToday ? Number(key.requests_today ?? 0) : 0,
        key_hint: `${String(rawKey).slice(0, 8)}…${String(rawKey).slice(-4)}`,
      }
    })
    return json({ ok: true, keys, starter_daily_limit: Number(Deno.env.get('NW_LIMIT_STARTER') ?? 1000) })
  }

  if (action === 'delete_report') {
    const { id } = body
    if (!id) return json({ error: 'Missing id' }, 400)
    const { error } = await supabaseAdmin.from('reports').delete().eq('id', id)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  if (action === 'delete_user') {
    const { userId } = body
    if (!userId) return json({ error: 'Missing userId' }, 400)
    // Delete from auth (cascades to profiles via FK or trigger)
    const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authDelErr) return json({ error: authDelErr.message }, 400)
    // Also delete profile row directly in case no FK cascade
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    return json({ ok: true })
  }

  if (action === 'grant_partner_starter') {
    const keyId = String(body.keyId ?? '')
    const reason = String(body.reason ?? '').trim()
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(keyId)) {
      return json({ error: 'A valid keyId is required' }, 400)
    }
    if (reason.length < 3 || reason.length > 500) {
      return json({ error: 'A partnership reason of 3 to 500 characters is required' }, 400)
    }
    const dailyLimit = Number(Deno.env.get('NW_LIMIT_STARTER') ?? 1000)
    if (!Number.isSafeInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 2147483647) {
      return json({ error: 'Invalid NW_LIMIT_STARTER configuration' }, 500)
    }
    const { data, error } = await supabaseAdmin.rpc('grant_partner_starter', {
      p_key_id: keyId,
      p_admin_id: user.id,
      p_reason: reason,
      p_daily_limit: dailyLimit,
    })
    if (error) {
      if (['42883', '42703', 'PGRST202'].includes(error.code)) {
        return json({ error: 'Apply api-partner-grants.sql before granting Starter access' }, 503)
      }
      const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code === '22023' ? 400 : 409
      return json({ error: error.message }, status)
    }
    if (!data?.[0]) return json({ error: 'Partnership grant was not applied' }, 500)
    return json({ ok: true, key: data[0] })
  }

  if (action === 'approve_api_key') {
    const { keyId } = body
    if (!keyId) return json({ error: 'Missing keyId' }, 400)
    const { data: key } = await supabaseAdmin.from('api_keys')
      .select('id, tier').eq('id', keyId).maybeSingle()
    if (!key) return json({ error: 'API key not found' }, 404)
    if (key.tier !== 'free') {
      return json({ error: 'Paid keys can only be activated by a verified Flutterwave payment' }, 409)
    }
    const { error } = await supabaseAdmin.from('api_keys')
      .update({ status: 'active', approved_at: new Date().toISOString() })
      .eq('id', keyId)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  if (action === 'revoke_api_key') {
    const { keyId } = body
    if (!keyId) return json({ error: 'Missing keyId' }, 400)
    const { data: key, error: keyError } = await supabaseAdmin.from('api_keys')
      .select('id, tier').eq('id', keyId).maybeSingle()
    if (keyError) return json({ error: keyError.message }, 400)
    if (!key) return json({ error: 'API key not found' }, 404)
    if (key.tier !== 'free') {
      const { data: subscription, error: subError } = await supabaseAdmin
        .from('api_subscriptions').select('id').eq('api_key_id', keyId)
        .in('status', ['active', 'past_due']).limit(1)
      if (subError) return json({ error: subError.message }, 400)
      if (subscription?.length) {
        return json({ error: 'Cancel the Flutterwave subscription before revoking this paid key' }, 409)
      }
    }
    const { error } = await supabaseAdmin.from('api_keys')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', keyId)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  return json({ error: 'Unknown action' }, 400)
})
