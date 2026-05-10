import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

export async function getEstateForUser(userId: string) {
  const { data } = await supabase
    .from('estate_managers')
    .select('*, estates(*)')
    .eq('user_id', userId)
    .single()
  return data
}

export async function getCurrentPowerStatus(estateId: string) {
  const { data } = await supabase
    .from('power_events')
    .select('*')
    .eq('estate_id', estateId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

export async function getLatestDieselLevel(estateId: string) {
  const { data } = await supabase
    .from('diesel_logs')
    .select('*')
    .eq('estate_id', estateId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single()
  return data
}

export async function logPowerEvent(
  estateId: string,
  eventType: string,
  loggedBy: string,
  notes?: string
) {
  const { data: prev } = await supabase
    .from('power_events')
    .select('id, started_at')
    .eq('estate_id', estateId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (prev) {
    const durationMins = Math.round(
      (Date.now() - new Date(prev.started_at).getTime()) / 60000
    )
    await supabase
      .from('power_events')
      .update({ ended_at: new Date().toISOString(), duration_minutes: durationMins })
      .eq('id', prev.id)
  }

  const { data, error } = await supabase
    .from('power_events')
    .insert({
      estate_id: estateId,
      event_type: eventType,
      started_at: new Date().toISOString(),
      logged_by: loggedBy,
      notes: notes || null,
    })
    .select()
    .single()

  return { data, error }
}
