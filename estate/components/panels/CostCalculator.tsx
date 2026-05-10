'use client'
import { useState, useMemo } from 'react'
import type { Estate, DieselLog, PowerEvent } from '@/types'
import { formatNaira, calcGeneratorHours, calcMonthlyDieselCost } from '@/lib/utils'

interface Props { estate: Estate; dieselLogs: DieselLog[]; events: PowerEvent[] }

const BENCHMARK_MONTHLY_HOURS = 18 * 30
const BENCHMARK_PRICE_PER_LITRE = 1200

export default function CostCalculator({ estate, dieselLogs, events }: Props) {
  const [customPricePerLitre, setCustomPricePerLitre] = useState(estate.diesel_price_per_litre ?? 1200)
  const [hoursPerDay, setHoursPerDay] = useState(18)

  const thisMonthCost = useMemo(() => calcMonthlyDieselCost(dieselLogs), [dieselLogs])
  const thisMonthGenHours = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    return calcGeneratorHours(events, startOfMonth, Date.now())
  }, [events])

  const burnRate = estate.diesel_consumption_rate ?? 3.5
  const projectedMonthlyLitres = burnRate * hoursPerDay * 30
  const projectedCost = projectedMonthlyLitres * customPricePerLitre
  const benchmarkCost = burnRate * BENCHMARK_MONTHLY_HOURS * BENCHMARK_PRICE_PER_LITRE
  const savingsVsBenchmark = benchmarkCost - projectedCost
  const costPerUnit = projectedCost / (estate.num_units ?? 50)
  const actualCostPerHour = thisMonthGenHours > 0 ? thisMonthCost / thisMonthGenHours : 0

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>Cost Calculator</h3>
        <p style={{ color: 'var(--text2)', fontSize: '12px', marginTop: '3px' }}>Model diesel costs & resident contributions</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'This month spent', value: formatNaira(thisMonthCost), color: 'var(--red)' },
          { label: 'Generator hours', value: `${thisMonthGenHours.toFixed(0)}h`, color: 'var(--amber)' },
          { label: 'Cost per hour', value: actualCostPerHour > 0 ? formatNaira(actualCostPerHour) : '—', color: 'var(--text2)' },
          { label: 'Per unit this month', value: thisMonthCost > 0 ? formatNaira(thisMonthCost / (estate.num_units ?? 50)) : '—', color: 'var(--green)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>{s.label}</div>
            <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1.05rem', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '18px', marginBottom: '18px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Projection tool</p>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label className="field-label" style={{ margin: 0 }}>Generator hours/day</label><span style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, color: 'var(--amber)' }}>{hoursPerDay}h</span></div>
          <input type="range" min={1} max={24} value={hoursPerDay} onChange={e => setHoursPerDay(+e.target.value)} style={{ width: '100%', accentColor: 'var(--amber)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}><span>1h</span><span>12h</span><span>24h</span></div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label className="field-label" style={{ margin: 0 }}>Diesel price (₦/litre)</label><span style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, color: 'var(--green)' }}>₦{customPricePerLitre.toLocaleString()}</span></div>
          <input type="range" min={800} max={3000} step={50} value={customPricePerLitre} onChange={e => setCustomPricePerLitre(+e.target.value)} style={{ width: '100%', accentColor: 'var(--green)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}><span>₦800</span><span>₦1,900</span><span>₦3,000</span></div>
        </div>
      </div>

      <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div><div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '2px' }}>Projected monthly cost</div><div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1.15rem' }}>{formatNaira(projectedCost)}</div></div>
          <div><div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '2px' }}>Per unit contribution</div><div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1.15rem', color: 'var(--green)' }}>{formatNaira(costPerUnit)}</div></div>
        </div>
        {savingsVsBenchmark > 0
          ? <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green-border)', borderRadius: '8px', padding: '10px', fontSize: '12px', color: 'var(--text2)' }}><span style={{ color: 'var(--green)', fontWeight: 700 }}>+{formatNaira(savingsVsBenchmark)}/mo savings</span> vs Lagos estate average</div>
          : <div style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber-border)', borderRadius: '8px', padding: '10px', fontSize: '12px', color: 'var(--amber)' }}>{formatNaira(Math.abs(savingsVsBenchmark))}/mo above Lagos estate average</div>
        }
      </div>
    </div>
  )
}
