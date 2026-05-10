'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { AlertSent } from '@/types'
import AppShell from '@/components/AppShell'

export default function AlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<AlertSent[]>([])
  const [estateName, setEstateName] = useState('')
  const [loading, setLoading] = useState(true)

  const loadAlerts = useCallback(async (estateId: string) => {
    const { data } = await supabase.from('alerts_sent').select('*').eq('estate_id', estateId).order('sent_at', { ascending: false }).limit(100)
    if (data) setAlerts(data as AlertSent[])
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const { data: mgr } = await supabase.from('estate_managers').select('estate_id').eq('user_id', data.user.id).single()
      if (!mgr) { router.push('/onboarding'); return }
      const { data: est } = await supabase.from('estates').select('id,name').eq('id', mgr.estate_id).single()
      if (est) setEstateName(est.name)
      await loadAlerts(mgr.estate_id); setLoading(false)
    })
  }, [router, loadAlerts])

  const eventLabel = (t: string) => t === 'nepa_on' ? 'NEPA On' : t === 'generator' ? 'Generator' : t === 'no_power' ? 'No Power' : t
  const eventColor = (t: string) => t === 'nepa_on' ? 'var(--green)' : t === 'generator' ? 'var(--amber)' : 'var(--red)'

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}><p style={{ color: 'var(--text2)' }}>Loading…</p></div>

  return (
    <AppShell estateName={estateName}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1.5rem', marginBottom: '6px' }}>Alert History</h1>
        <p style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>{alerts.length} alerts sent in total</p>
        <div className="card" style={{ padding: '0' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Event','Channel','Recipients','Message','Sent At'].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 20px', color: 'var(--text3)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>)}</tr></thead>
              <tbody>
                {alerts.map(a => (<tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '12px 20px' }}><span style={{ color: eventColor(a.event_type), fontWeight: 600 }}>{eventLabel(a.event_type)}</span></td><td style={{ padding: '12px 20px', color: 'var(--text2)', textTransform: 'capitalize' }}>{a.channel}</td><td style={{ padding: '12px 20px' }}>{a.recipients_count}</td><td style={{ padding: '12px 20px', color: 'var(--text2)', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message_body || '—'}</td><td style={{ padding: '12px 20px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{new Date(a.sent_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}</td></tr>))}
                {alerts.length === 0 && <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>No alerts sent yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
