'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Estate, EstateManager } from '@/types'

export default function SettingsPage() {
  const router = useRouter()
  const [estate, setEstate] = useState<Estate | null>(null)
  const [manager, setManager] = useState<EstateManager | null>(null)
  const [form, setForm] = useState<Partial<Estate>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const { data: mgr } = await supabase.from('estate_managers').select('*').eq('user_id', data.user.id).single()
      if (!mgr) { router.push('/onboarding'); return }
      setManager(mgr as EstateManager)
      const { data: est } = await supabase.from('estates').select('*').eq('id', mgr.estate_id).single()
      if (est) { setEstate(est as Estate); setForm(est as Estate) }
      setLoading(false)
    })
  }, [router])

  async function saveSettings() {
    if (!estate) return
    setSaving(true)
    await supabase.from('estates').update(form).eq('id', estate.id)
    setSaved(true); setSaving(false); setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}><p style={{ color: 'var(--text2)' }}>Loading…</p></div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <button className="btn-ghost" style={{ fontSize: '12px', marginBottom: '16px' }} onClick={() => router.push('/dashboard')}>← Back to Dashboard</button>
        <h1 style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1.5rem', marginBottom: '24px' }}>Settings</h1>

        <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '18px' }}>Estate Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div><label className="field-label">Estate Name</label><input type="text" value={(form.name as string) ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="field-label">Address</label><input type="text" value={(form.address as string) ?? ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label className="field-label">Number of Units</label><input type="number" min={1} value={(form.num_units as number) ?? ''} onChange={e => setForm(f => ({ ...f, num_units: +e.target.value }))} /></div>
              <div><label className="field-label">Number of Generators</label><input type="number" min={1} value={(form.num_generators as number) ?? ''} onChange={e => setForm(f => ({ ...f, num_generators: +e.target.value }))} /></div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '18px' }}>Generator & Fuel</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div><label className="field-label">Generator Capacity (KVA)</label><input type="number" value={(form.generator_capacity_kva as number) ?? ''} onChange={e => setForm(f => ({ ...f, generator_capacity_kva: +e.target.value }))} /></div>
            <div><label className="field-label">Tank Size (litres)</label><input type="number" value={(form.diesel_tank_size as number) ?? ''} onChange={e => setForm(f => ({ ...f, diesel_tank_size: +e.target.value }))} /></div>
            <div><label className="field-label">Burn Rate (litres/hour)</label><input type="number" step="0.1" value={(form.diesel_consumption_rate as number) ?? ''} onChange={e => setForm(f => ({ ...f, diesel_consumption_rate: +e.target.value }))} /></div>
            <div><label className="field-label">Diesel Price (₦/litre)</label><input type="number" value={(form.diesel_price_per_litre as number) ?? ''} onChange={e => setForm(f => ({ ...f, diesel_price_per_litre: +e.target.value }))} /></div>
            <div><label className="field-label">Low Fuel Alert (%)</label><input type="number" min={5} value={(form.low_fuel_threshold as number) ?? ''} onChange={e => setForm(f => ({ ...f, low_fuel_threshold: +e.target.value }))} /></div>
          </div>
        </div>

        {manager && (
          <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '14px' }}>Account</h3>
            <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
              <div style={{ marginBottom: '6px' }}><strong style={{ color: 'var(--text1)' }}>Name:</strong> {manager.name}</div>
              <div style={{ marginBottom: '6px' }}><strong style={{ color: 'var(--text1)' }}>Phone:</strong> {manager.phone}</div>
              <div><strong style={{ color: 'var(--text1)' }}>Role:</strong> <span style={{ textTransform: 'capitalize' }}>{manager.role}</span></div>
            </div>
          </div>
        )}

        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving} onClick={saveSettings}>{saving ? 'Saving…' : saved ? '✓ Settings Saved' : 'Save Settings'}</button>
      </div>
    </div>
  )
}
