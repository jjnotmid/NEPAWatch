'use client'
import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Estate, PowerEvent, DieselLog } from '@/types'
import { formatNaira, calcGeneratorHours, calcMonthlyDieselCost, calcGridReliability, formatDuration } from '@/lib/utils'

interface Props { estate: Estate; events: PowerEvent[]; dieselLogs: DieselLog[]; userId: string }

function monthLabel(offset = 0) { const d = new Date(); d.setMonth(d.getMonth() + offset); return d.toLocaleString('en-NG', { month: 'long', year: 'numeric' }) }
function monthKey(offset = 0) { const d = new Date(); d.setMonth(d.getMonth() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

export default function MonthlyReport({ estate, events, dieselLogs, userId }: Props) {
  const [generating, setGenerating] = useState(false)
  const [saved, setSaved] = useState(false)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const endOfMonth = Date.now()
  const totalHours = (endOfMonth - startOfMonth) / 3600000

  const gridHours = useMemo(() => {
    let ms = 0
    for (const ev of events) {
      if (ev.event_type !== 'nepa_on') continue
      const s = Math.max(new Date(ev.started_at).getTime(), startOfMonth)
      const e = ev.ended_at ? Math.min(new Date(ev.ended_at).getTime(), endOfMonth) : Math.min(Date.now(), endOfMonth)
      if (e > s) ms += e - s
    }
    return ms / 3600000
  }, [events, startOfMonth, endOfMonth])

  const genHours = useMemo(() => calcGeneratorHours(events, startOfMonth, endOfMonth), [events, startOfMonth, endOfMonth])
  const noPowerHours = Math.max(0, totalHours - gridHours - genHours)
  const dieselCost = useMemo(() => calcMonthlyDieselCost(dieselLogs), [dieselLogs])
  const gridReliability = useMemo(() => calcGridReliability(events), [events])
  const costPerUnit = dieselCost / (estate.num_units ?? 50)

  async function saveAndDownload() {
    setGenerating(true)
    await supabase.from('monthly_reports').upsert({ estate_id: estate.id, month: monthKey(), grid_hours: gridHours, generator_hours: genHours, no_power_hours: noPowerHours, total_diesel_cost: dieselCost, avg_daily_runtime: genHours / 30, grid_reliability_pct: gridReliability, generated_at: new Date().toISOString(), generated_by: userId }, { onConflict: 'estate_id,month' })
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()
      doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(170, 255, 0)
      doc.text('NEPAWatch Estate', 14, 20)
      doc.setFontSize(14); doc.setTextColor(30, 30, 30)
      doc.text(`Monthly Power Report — ${monthLabel()}`, 14, 30)
      doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
      doc.text(`${estate.name} · ${estate.address}`, 14, 38)
      doc.text(`Generated ${new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 44)
      autoTable(doc, { startY: 54, head: [['Metric','Value']], body: [['Grid (NEPA) Hours',`${gridHours.toFixed(1)}h`],['Generator Hours',`${genHours.toFixed(1)}h`],['No Power Hours',`${noPowerHours.toFixed(1)}h`],['Grid Reliability',`${gridReliability.toFixed(1)}%`],['Total Diesel Cost',formatNaira(dieselCost)],['Cost Per Unit',formatNaira(costPerUnit)],['Number of Units',String(estate.num_units)]], styles: { fontSize: 11, cellPadding: 6 }, headStyles: { fillColor: [20,20,20], textColor: [170,255,0] }, alternateRowStyles: { fillColor: [245,245,245] } })
      const evRows = events.filter(e => { const t = new Date(e.started_at).getTime(); return t >= startOfMonth && t <= endOfMonth && e.ended_at }).slice(0, 40).map(e => [e.event_type === 'nepa_on' ? 'NEPA On' : e.event_type === 'generator' ? 'Generator' : 'No Power', new Date(e.started_at).toLocaleString('en-NG'), e.duration_minutes != null ? formatDuration(e.duration_minutes) : '—'])
      if (evRows.length > 0) autoTable(doc, { startY: (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14, head: [['Event','Started','Duration']], body: evRows, styles: { fontSize: 9, cellPadding: 4 }, headStyles: { fillColor: [20,20,20], textColor: [200,200,200] } })
      doc.save(`NEPAWatch-${estate.name.replace(/\s+/g,'-')}-${monthKey()}.pdf`)
    } catch { /* PDF failed, report still saved */ }
    setSaved(true); setGenerating(false); setTimeout(() => setSaved(false), 3000)
  }

  const stats = [
    { label: 'Grid (NEPA)', value: `${gridHours.toFixed(1)}h`, color: 'var(--green)' },
    { label: 'Generator', value: `${genHours.toFixed(1)}h`, color: 'var(--amber)' },
    { label: 'No Power', value: `${noPowerHours.toFixed(1)}h`, color: 'var(--red)' },
    { label: 'Grid Reliability', value: `${gridReliability.toFixed(0)}%`, color: 'var(--text1)' },
    { label: 'Diesel Spend', value: formatNaira(dieselCost), color: 'var(--red)' },
    { label: 'Per Unit', value: formatNaira(costPerUnit), color: 'var(--green)' },
  ]

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div><h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>Monthly Report</h3><p style={{ color: 'var(--text2)', fontSize: '12px', marginTop: '2px' }}>{monthLabel()}</p></div>
        <button className="btn-primary" style={{ fontSize: '12px', padding: '7px 14px' }} onClick={saveAndDownload} disabled={generating}>{generating ? 'Generating…' : saved ? '✓ Saved!' : 'Download PDF'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '18px' }}>
        {stats.map(s => (<div key={s.label} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}><div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1rem', color: s.color }}>{s.value}</div><div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '3px' }}>{s.label}</div></div>))}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text3)', marginBottom: '6px' }}><span>Power source breakdown</span><span>{totalHours.toFixed(0)}h total</span></div>
        <div style={{ height: '12px', borderRadius: '6px', background: 'var(--border)', overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${(gridHours/totalHours)*100}%`, background: 'var(--green)', transition: 'width 0.6s' }} />
          <div style={{ width: `${(genHours/totalHours)*100}%`, background: 'var(--amber)', transition: 'width 0.6s' }} />
          <div style={{ flex: 1, background: 'var(--red)' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '10px', color: 'var(--text3)' }}>
          <span style={{ color: 'var(--green)' }}>■ Grid {((gridHours/totalHours)*100).toFixed(0)}%</span>
          <span style={{ color: 'var(--amber)' }}>■ Gen {((genHours/totalHours)*100).toFixed(0)}%</span>
          <span style={{ color: 'var(--red)' }}>■ Off {((noPowerHours/totalHours)*100).toFixed(0)}%</span>
        </div>
      </div>

      <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green-border)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--text2)' }}>Download PDF to share with residents committee and estate chairman.</div>
    </div>
  )
}
