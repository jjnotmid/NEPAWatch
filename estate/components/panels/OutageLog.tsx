'use client'
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { PowerEvent } from '@/types'
import { sevenDayPowerBreakdown } from '@/lib/utils'

interface Props { events: PowerEvent[] }

export default function OutageLog({ events }: Props) {
  const chartData = useMemo(() => sevenDayPowerBreakdown(events), [events])

  const totals = useMemo(() => chartData.reduce((acc, d) => ({
    nepa: acc.nepa + d.nepa, generator: acc.generator + d.generator, none: acc.none + d.none,
  }), { nepa: 0, generator: 0, none: 0 }), [chartData])

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
        <p style={{ color: 'var(--text2)', marginBottom: '6px', fontWeight: 600 }}>{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.name === 'nepa' ? 'var(--green)' : p.name === 'generator' ? 'var(--amber)' : 'var(--red)', margin: '2px 0' }}>
            {p.name === 'nepa' ? 'NEPA' : p.name === 'generator' ? 'Generator' : 'No Power'}: {p.value.toFixed(1)}h
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '24px' }}>
      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '20px' }}>7-Day Power Log</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[{label:'Grid',value:`${totals.nepa.toFixed(0)}h`,color:'var(--green)'},{label:'Generator',value:`${totals.generator.toFixed(0)}h`,color:'var(--amber)'},{label:'No Power',value:`${totals.none.toFixed(0)}h`,color:'var(--red)'}].map(s => (
          <div key={s.label} style={{ background: `${s.color}12`, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1.1rem', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ height: '180px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barSize={20} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="day" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border)' }} />
            <Bar dataKey="nepa" stackId="a" fill="var(--green)" name="nepa" />
            <Bar dataKey="generator" stackId="a" fill="var(--amber)" name="generator" />
            <Bar dataKey="none" stackId="a" fill="var(--red)" radius={[4,4,0,0]} name="none" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', justifyContent: 'center' }}>
        {[{label:'Grid (NEPA)',color:'var(--green)'},{label:'Generator',color:'var(--amber)'},{label:'No Power',color:'var(--red)'}].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text2)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '2px', background: l.color }} />{l.label}
          </div>
        ))}
      </div>

      {events.slice(0, 6).length > 0 && (
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Recent events</p>
          {events.slice(0, 6).map(ev => (
            <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px', alignItems: 'center' }}>
              <span style={{ color: ev.event_type === 'nepa_on' ? 'var(--green)' : ev.event_type === 'generator' ? 'var(--amber)' : 'var(--red)', fontWeight: 600, width: '100px' }}>
                {ev.event_type === 'nepa_on' ? 'NEPA On' : ev.event_type === 'generator' ? 'Generator' : 'No Power'}
              </span>
              <span style={{ color: 'var(--text3)' }}>{new Date(ev.started_at).toLocaleString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
              <span style={{ color: 'var(--text2)', textAlign: 'right', minWidth: '48px' }}>
                {ev.duration_minutes != null ? ev.duration_minutes >= 60 ? `${(ev.duration_minutes/60).toFixed(1)}h` : `${ev.duration_minutes}m` : ev.ended_at ? '—' : 'Active'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
