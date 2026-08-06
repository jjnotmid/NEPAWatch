import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

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

  if (action === 'approve_api_key') {
    const { keyId } = body
    if (!keyId) return json({ error: 'Missing keyId' }, 400)
    const { error } = await supabaseAdmin.from('api_keys')
      .update({ status: 'active', approved_at: new Date().toISOString() })
      .eq('id', keyId)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  if (action === 'revoke_api_key') {
    const { keyId } = body
    if (!keyId) return json({ error: 'Missing keyId' }, 400)
    const { error } = await supabaseAdmin.from('api_keys')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', keyId)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  return json({ error: 'Unknown action' }, 400)
})
