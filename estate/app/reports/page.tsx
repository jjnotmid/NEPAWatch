'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { MonthlyReport } from '@/types'
import { formatNaira } from '@/lib/utils'
import AppShell from '@/components/AppShell'

export default function ReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<MonthlyReport[]>([])
  const [estateName, setEstateName] = useState('')
  const [loading, setLoading] = useState(true)

  const loadReports = useCallback(async (estateId: string) => {
    const { data } = await supabase.from('monthly_reports').select('*').eq('estate_id', estateId).order('month', { ascending: false })
    if (data) setReports(data as MonthlyReport[])
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const { data: mgr } = await supabase.from('estate_managers').select('estate_id').eq('user_id', data.user.id).single()
      if (!mgr) { router.push('/onboarding'); return }
      const { data: est } = await supabase.from('estates').select('id,name').eq('id', mgr.estate_id).single()
      if (est) setEstateName(est.name)
      await loadReports(mgr.estate_id); setLoading(false)
    })
  }, [router, loadReports])

  const monthName = (key: string) => { const [y, m] = key.split('-'); return new Date(+y, +m - 1).toLocaleString('en-NG', { month: 'long', year: 'numeric' }) }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}><p style={{ color: 'var(--text2)' }}>Loading…</p></div>

  return (
    <AppShell estateName={estateName}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1.5rem', marginBottom: '6px' }}>Monthly Reports</h1>
        <p style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>Download and re-generate PDFs from the Monthly Report panel on the dashboard.</p>
        {reports.length === 0
          ? <div className="card" style={{ padding: '48px', textAlign: 'center' }}><p style={{ color: 'var(--text3)', fontSize: '14px' }}>No reports generated yet — use the Monthly Report panel on the dashboard.</p></div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reports.map(r => (
                <div key={r.id} className="card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{monthName(r.month)}</div>
                    <div style={{ color: 'var(--text2)', fontSize: '12px', marginTop: '4px' }}>Generated {new Date(r.generated_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                    {[{label:'Grid',value:`${(r.grid_hours??0).toFixed(0)}h`,color:'var(--green)'},{label:'Generator',value:`${(r.generator_hours??0).toFixed(0)}h`,color:'var(--amber)'},{label:'No Power',value:`${(r.no_power_hours??0).toFixed(0)}h`,color:'var(--red)'},{label:'Diesel Cost',value:formatNaira(r.total_diesel_cost??0),color:'var(--text1)'},{label:'Reliability',value:`${(r.grid_reliability_pct??0).toFixed(0)}%`,color:'var(--text2)'}].map(s => (
                      <div key={s.label} style={{ textAlign: 'center' }}><div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, color: s.color }}>{s.value}</div><div style={{ color: 'var(--text3)', fontSize: '11px' }}>{s.label}</div></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </AppShell>
  )
}
