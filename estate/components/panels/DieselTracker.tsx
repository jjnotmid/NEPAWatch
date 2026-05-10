'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Estate, DieselLog } from '@/types'
import { formatNaira, formatLitres } from '@/lib/utils'

interface Props { estate: Estate; dieselLogs: DieselLog[]; userId: string; onRefresh: () => void }

export default function DieselTracker({ estate, dieselLogs, userId, onRefresh }: Props) {
  const [showPurchase, setShowPurchase] = useState(false)
  const [showLevelCheck, setShowLevelCheck] = useState(false)
  const [purchaseForm, setPurchaseForm] = useState({ litres: '', pricePerLitre: String(estate.diesel_price_per_litre), supplier: '' })
  const [levelForm, setLevelForm] = useState({ level: '' })
  const [saving, setSaving] = useState(false)

  const latest = dieselLogs[0]
  const currentLevel = latest?.current_level_after ?? estate.current_diesel_level ?? 0
  const tankSize = estate.diesel_tank_size ?? 500
  const pct = Math.min(100, Math.max(0, (currentLevel / tankSize) * 100))
  const burnRate = estate.diesel_consumption_rate ?? 3.5
  const hoursLeft = burnRate > 0 ? currentLevel / burnRate : 0
  const isLow = pct <= (estate.low_fuel_threshold ?? 20)
  const fuelColor = isLow ? 'var(--red)' : pct < 40 ? 'var(--amber)' : 'var(--green)'

  async function logPurchase() {
    setSaving(true)
    const litres = parseFloat(purchaseForm.litres)
    const ppl = parseFloat(purchaseForm.pricePerLitre)
    const newLevel = Math.min(tankSize, currentLevel + litres)
    await supabase.from('diesel_logs').insert({ estate_id: estate.id, log_type: 'purchase', litres_amount: litres, price_per_litre: ppl, total_cost: litres * ppl, supplier: purchaseForm.supplier || null, current_level_after: newLevel, timestamp: new Date().toISOString(), logged_by: userId })
    await supabase.from('estates').update({ current_diesel_level: newLevel }).eq('id', estate.id)
    setPurchaseForm({ litres: '', pricePerLitre: String(estate.diesel_price_per_litre), supplier: '' })
    setShowPurchase(false); setSaving(false); onRefresh()
  }

  async function logLevelCheck() {
    setSaving(true)
    const level = parseFloat(levelForm.level)
    await supabase.from('diesel_logs').insert({ estate_id: estate.id, log_type: 'level_check', litres_amount: level, current_level_after: level, timestamp: new Date().toISOString(), logged_by: userId })
    await supabase.from('estates').update({ current_diesel_level: level }).eq('id', estate.id)
    setLevelForm({ level: '' }); setShowLevelCheck(false); setSaving(false); onRefresh()
  }

  const recentPurchases = dieselLogs.filter(d => d.log_type === 'purchase').slice(0, 3)

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>Diesel Tracker</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-ghost" style={{ fontSize: '12px', padding: '5px 10px' }} onClick={() => { setShowLevelCheck(true); setShowPurchase(false) }}>Check Level</button>
          <button className="btn-secondary" style={{ fontSize: '12px', padding: '5px 10px' }} onClick={() => { setShowPurchase(true); setShowLevelCheck(false) }}>Log Purchase</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
        <FuelGauge pct={pct} color={fuelColor} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '2rem', color: fuelColor, lineHeight: 1 }}>{formatLitres(currentLevel)}</div>
          <div style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '4px' }}>of {formatLitres(tankSize)} tank · {pct.toFixed(0)}% full</div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '16px' }}>
            <div><div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: '1rem' }}>{hoursLeft.toFixed(1)}h</div><div style={{ color: 'var(--text3)', fontSize: '11px' }}>Hours left</div></div>
            <div><div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: '1rem' }}>{burnRate}L/hr</div><div style={{ color: 'var(--text3)', fontSize: '11px' }}>Burn rate</div></div>
          </div>
        </div>
      </div>

      {isLow && <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red-border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--red)', fontSize: '12px', marginBottom: '16px' }}>⚠ Fuel below {estate.low_fuel_threshold}% — consider purchasing diesel</div>}

      {showPurchase && (
        <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: '1px solid var(--border)' }}>
          <p style={{ fontWeight: 700, fontSize: '13px', marginBottom: '12px' }}>Log Diesel Purchase</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div><label className="field-label">Litres Purchased</label><input type="number" placeholder="e.g. 200" value={purchaseForm.litres} onChange={e => setPurchaseForm(f => ({ ...f, litres: e.target.value }))} /></div>
            <div><label className="field-label">Price/Litre (₦)</label><input type="number" value={purchaseForm.pricePerLitre} onChange={e => setPurchaseForm(f => ({ ...f, pricePerLitre: e.target.value }))} /></div>
          </div>
          <div style={{ marginBottom: '12px' }}><label className="field-label">Supplier (optional)</label><input type="text" placeholder="e.g. Total Energies VI" value={purchaseForm.supplier} onChange={e => setPurchaseForm(f => ({ ...f, supplier: e.target.value }))} /></div>
          {purchaseForm.litres && purchaseForm.pricePerLitre && <div style={{ color: 'var(--green)', fontSize: '13px', marginBottom: '12px' }}>Total: {formatNaira(parseFloat(purchaseForm.litres) * parseFloat(purchaseForm.pricePerLitre))}</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-ghost" onClick={() => setShowPurchase(false)}>Cancel</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!purchaseForm.litres || saving} onClick={logPurchase}>{saving ? 'Saving…' : 'Save Purchase'}</button>
          </div>
        </div>
      )}

      {showLevelCheck && (
        <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: '1px solid var(--border)' }}>
          <p style={{ fontWeight: 700, fontSize: '13px', marginBottom: '12px' }}>Log Current Level</p>
          <div style={{ marginBottom: '12px' }}><label className="field-label">Current Diesel Level (litres)</label><input type="number" value={levelForm.level} onChange={e => setLevelForm({ level: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-ghost" onClick={() => setShowLevelCheck(false)}>Cancel</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!levelForm.level || saving} onClick={logLevelCheck}>{saving ? 'Saving…' : 'Update Level'}</button>
          </div>
        </div>
      )}

      {recentPurchases.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Recent purchases</p>
          {recentPurchases.map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text1)' }}>{formatLitres(d.litres_amount)}</span>
              <span style={{ color: 'var(--text2)' }}>{d.supplier || '—'}</span>
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>{formatNaira(d.total_cost ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FuelGauge({ pct, color }: { pct: number; color: string }) {
  const r = 36, stroke = 8, cx = 44, cy = 44
  const circumference = 2 * Math.PI * r
  const dashoffset = circumference * (1 - pct / 100)
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={dashoffset} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s' }} />
      <text x={cx} y={cy + 5} textAnchor="middle" fill={color} fontFamily="Bricolage Grotesque" fontWeight="800" fontSize="16">{pct.toFixed(0)}%</text>
    </svg>
  )
}
