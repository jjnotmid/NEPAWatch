'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const STEPS = ['Estate Details', 'Generator Setup', 'Add Residents', 'Alert Setup']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [estateId, setEstateId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [estate, setEstate] = useState({ name: '', address: '', num_units: 50, num_generators: 1 })
  const [gen, setGen] = useState({
    generator_capacity_kva: 100, diesel_consumption_rate: 3.5,
    diesel_tank_size: 500, low_fuel_threshold: 20,
    diesel_price_per_litre: 1200, current_diesel_level: 400,
  })
  const [managerName, setManagerName] = useState('')
  const [phone, setPhone] = useState('')
  const [alertPhone, setAlertPhone] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
      setManagerName(data.user.user_metadata?.name || '')
      setPhone(data.user.user_metadata?.phone || '')
    })
  }, [router])

  async function saveEstateDetails() {
    setSaving(true); setError('')
    const { data, error: err } = await supabase
      .from('estates').insert({ ...estate, ...gen }).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    setEstateId(data.id)
    await supabase.from('estate_managers').insert({
      user_id: userId, estate_id: data.id, role: 'manager', name: managerName, phone,
    })
    await supabase.from('diesel_logs').insert({
      estate_id: data.id, log_type: 'level_check',
      litres_amount: gen.current_diesel_level,
      price_per_litre: gen.diesel_price_per_litre,
      total_cost: 0, supplier: null,
      current_level_after: gen.current_diesel_level,
      timestamp: new Date().toISOString(), logged_by: userId,
    })
    setSaving(false); setStep(2)
  }

  function ProgressBar() {
    return (
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, background: i <= step ? 'var(--green)' : 'var(--border)', color: i <= step ? '#0A0A0A' : 'var(--text3)' }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '10px', color: i === step ? 'var(--green)' : 'var(--text3)', marginTop: '4px', textAlign: 'center' }}>{s}</span>
            </div>
          ))}
        </div>
        <div style={{ height: '2px', background: 'var(--border)', borderRadius: '1px', position: 'relative' }}>
          <div style={{ height: '100%', background: 'var(--green)', width: `${(step / (STEPS.length - 1)) * 100}%`, borderRadius: '1px', transition: 'width 0.4s' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1.2rem' }}>
            NEPA<span style={{ color: 'var(--green)' }}>Watch</span> <span style={{ color: 'var(--text2)', fontWeight: 500 }}>Estate</span>
          </span>
          <p style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '4px' }}>Let’s set up your estate — takes about 3 minutes</p>
        </div>

        <div className="card" style={{ padding: '28px' }}>
          <ProgressBar />

          {error && <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red-border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--red)', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

          {step === 0 && (
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '20px' }}>Tell us about your estate</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div><label className="field-label">Estate Name</label><input type="text" placeholder="e.g. Parkview Estate" value={estate.name} onChange={e => setEstate(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="field-label">Estate Address</label><input type="text" placeholder="e.g. 15 Admiralty Way, Lekki Phase 1" value={estate.address} onChange={e => setEstate(f => ({ ...f, address: e.target.value }))} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label className="field-label">Number of Units</label><input type="number" min={1} value={estate.num_units} onChange={e => setEstate(f => ({ ...f, num_units: +e.target.value }))} /></div>
                  <div><label className="field-label">Number of Generators</label><input type="number" min={1} value={estate.num_generators} onChange={e => setEstate(f => ({ ...f, num_generators: +e.target.value }))} /></div>
                </div>
                <div><label className="field-label">Your Name</label><input type="text" value={managerName} onChange={e => setManagerName(e.target.value)} /></div>
                <div><label className="field-label">Your Phone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
              </div>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '20px' }} disabled={!estate.name || !estate.address} onClick={() => setStep(1)}>Continue</button>
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '20px' }}>Generator & fuel details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label className="field-label">Generator Capacity (KVA)</label><input type="number" value={gen.generator_capacity_kva} onChange={e => setGen(f => ({ ...f, generator_capacity_kva: +e.target.value }))} /></div>
                  <div><label className="field-label">Diesel Tank Size (litres)</label><input type="number" value={gen.diesel_tank_size} onChange={e => setGen(f => ({ ...f, diesel_tank_size: +e.target.value }))} /></div>
                  <div><label className="field-label">Burn Rate (litres/hour)</label><input type="number" step="0.1" value={gen.diesel_consumption_rate} onChange={e => setGen(f => ({ ...f, diesel_consumption_rate: +e.target.value }))} /></div>
                  <div><label className="field-label">Current Diesel Level (L)</label><input type="number" value={gen.current_diesel_level} onChange={e => setGen(f => ({ ...f, current_diesel_level: +e.target.value }))} /></div>
                  <div><label className="field-label">Diesel Price (₦/litre)</label><input type="number" value={gen.diesel_price_per_litre} onChange={e => setGen(f => ({ ...f, diesel_price_per_litre: +e.target.value }))} /></div>
                  <div><label className="field-label">Low Fuel Alert (%)</label><input type="number" min={5} max={50} value={gen.low_fuel_threshold} onChange={e => setGen(f => ({ ...f, low_fuel_threshold: +e.target.value }))} /></div>
                </div>
                <div style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber-border)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: 'var(--amber)' }}>
                  Estimated runtime at current level: <strong>{(gen.current_diesel_level / gen.diesel_consumption_rate).toFixed(1)} hours</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="btn-ghost" onClick={() => setStep(0)}>Back</button>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={saveEstateDetails} disabled={saving}>{saving ? 'Saving…' : 'Continue'}</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>Import residents</h3>
              <p style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '20px' }}>Add your resident list now or do it later from the Residents panel.</p>
              <div style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '32px', textAlign: 'center' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" style={{ margin: '0 auto 10px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <p style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '12px' }}>Upload a CSV with columns: unit_number, name, phone_number</p>
                <input type="file" accept=".csv" style={{ display: 'none' }} id="csv-upload" />
                <button className="btn-secondary" onClick={() => document.getElementById('csv-upload')?.click()}>Choose CSV File</button>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(3)}>Skip for now</button>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(3)}>Continue</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>Set up resident alerts</h3>
              <p style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '20px' }}>Residents receive automatic power status updates via WhatsApp or SMS.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div><label className="field-label">WhatsApp Group Number or Link</label><input type="text" placeholder="e.g. +234 80X XXX XXXX or wa.me/link" value={alertPhone} onChange={e => setAlertPhone(e.target.value)} /></div>
                <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green-border)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: 'var(--text2)' }}>
                  <strong style={{ color: 'var(--green)' }}>Pilot mode:</strong> In the 30-day pilot, the system generates pre-written messages you can copy and paste into your estate WhatsApp group. Full API integration available in the paid tier.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="btn-ghost" onClick={() => setStep(2)}>Back</button>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => router.push('/dashboard')}>Go to Dashboard</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
