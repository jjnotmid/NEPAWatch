'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Estate, PowerEvent, DieselLog, Resident } from '@/types'
import AppShell from '@/components/AppShell'
import LivePowerStatus from '@/components/panels/LivePowerStatus'
import DieselTracker from '@/components/panels/DieselTracker'
import OutageLog from '@/components/panels/OutageLog'
import CostCalculator from '@/components/panels/CostCalculator'
import ResidentAlerts from '@/components/panels/ResidentAlerts'
import MonthlyReport from '@/components/panels/MonthlyReport'

export default function DashboardPage() {
  const router = useRouter()
  const [estate, setEstate] = useState<Estate | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [events, setEvents] = useState<PowerEvent[]>([])
  const [dieselLogs, setDieselLogs] = useState<DieselLog[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (estateId: string) => {
    const [evRes, dlRes, rrRes] = await Promise.all([
      supabase.from('power_events').select('*').eq('estate_id', estateId).order('started_at', { ascending: false }).limit(200),
      supabase.from('diesel_logs').select('*').eq('estate_id', estateId).order('timestamp', { ascending: false }).limit(100),
      supabase.from('residents').select('*').eq('estate_id', estateId).eq('active', true).order('unit_number'),
    ])
    if (evRes.data) setEvents(evRes.data as PowerEvent[])
    if (dlRes.data) setDieselLogs(dlRes.data as DieselLog[])
    if (rrRes.data) setResidents(rrRes.data as Resident[])
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
      const { data: mgr } = await supabase.from('estate_managers').select('estate_id').eq('user_id', data.user.id).single()
      if (!mgr) { router.push('/onboarding'); return }
      const { data: est } = await supabase.from('estates').select('*').eq('id', mgr.estate_id).single()
      if (est) { setEstate(est as Estate); await load(est.id) }
      setLoading(false)
    })
  }, [router, load])

  useEffect(() => {
    if (!estate) return
    const ch = supabase.channel(`estate-${estate.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'power_events', filter: `estate_id=eq.${estate.id}` }, () => load(estate.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'diesel_logs', filter: `estate_id=eq.${estate.id}` }, () => load(estate.id))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [estate, load])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Loading dashboard…</p>
      </div>
    )
  }

  if (!estate) return null

  return (
    <AppShell estateName={estate.name}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1.5rem', marginBottom: '2px' }}>{estate.name}</h1>
        <p style={{ color: 'var(--text2)', fontSize: '13px' }}>{estate.address} · {estate.num_units} units</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <LivePowerStatus estate={estate} events={events} userId={userId!} onRefresh={() => load(estate.id)} />
        </div>
        <DieselTracker estate={estate} dieselLogs={dieselLogs} userId={userId!} onRefresh={() => load(estate.id)} />
        <OutageLog events={events} />
        <CostCalculator estate={estate} dieselLogs={dieselLogs} events={events} />
        <ResidentAlerts estate={estate} residents={residents} events={events} userId={userId!} />
        <MonthlyReport estate={estate} events={events} dieselLogs={dieselLogs} userId={userId!} />
      </div>
    </AppShell>
  )
}
