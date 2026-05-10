'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Estate, PowerEvent } from '@/types'
import { elapsedSince, getStatusColor, getStatusLabel } from '@/lib/utils'

interface Props {
  estate: Estate
  events: PowerEvent[]
  userId: string
  onRefresh: () => void
}

const STATUS_ICONS: Record<string, string> = {
  nepa_on: '⚡',
  generator: '🔋',
  no_power: '🌑',
  scheduled_maintenance: '🔧',
}

export default function LivePowerStatus({ estate, events, userId, onRefresh }: Props) {
  const [elapsed, setElapsed] = useState('')
  const [saving, setSaving] = useState(false)

  const current = events.find(e => !e.ended_at) ?? events[0] ?? null
  const status = current?.event_type ?? 'no_power'

  useEffect(() => {
    if (!current) return
    const update = () => setElapsed(elapsedSince(current.started_at))
    update()
    const t = setInterval(update, 10000)
    return () => clearInterval(t)
  }, [current])

  async function switchStatus(newType: string) {
    if (newType === status) return
    setSaving(true)
    if (current && !current.ended_at) {
      const durationMinutes = Math.round((Date.now() - new Date(current.started_at).getTime()) / 60000)
      await supabase.from('power_events').update({ ended_at: new Date().toISOString(), duration_minutes: durationMinutes }).eq('id', current.id)
    }
    await supabase.from('power_events').insert({
      estate_id: estate.id, event_type: newType,
      started_at: new Date().toISOString(), logged_by: userId,
    })
    setSaving(false)
    onRefresh()
  }

  const statusColor = getStatusColor(status)
  const statusLabel = getStatusLabel(status)
  const recentHistory = events.filter(e => e.ended_at).slice(0, 5)

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${statusColor}18`, border: `2px solid ${statusColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: `0 0 20px ${statusColor}30` }}>
            {STATUS_ICONS[status]}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1.4rem', color: statusColor }}>{statusLabel}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block', animation: 'pulse-green 2s infinite' }} />
            </div>
            <p style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '2px' }}>{elapsed ? `Running for ${elapsed}` : 'No active event'}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { type: 'nepa_on', label: 'NEPA On', color: 'var(--green)' },
            { type: 'generator', label: 'Generator', color: 'var(--amber)' },
            { type: 'no_power', label: 'No Power', color: 'var(--red)' },
          ].map(({ type, label, color }) => (
            <button key={type} onClick={() => switchStatus(type)} disabled={saving || type === status}
              style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${color}`, background: type === status ? `${color}18` : 'transparent', color: type === status ? color : 'var(--text2)', fontSize: '13px', fontWeight: type === status ? 700 : 500, cursor: type === status ? 'default' : 'pointer', opacity: saving ? 0.6 : 1, transition: 'all 0.15s' }}>
              {type === status ? '● ' : ''}{label}
            </button>
          ))}
        </div>
      </div>

      {recentHistory.length > 0 && (
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Recent history</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recentHistory.map(ev => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                <span style={{ color: getStatusColor(ev.event_type), fontSize: '16px', width: '20px' }}>{STATUS_ICONS[ev.event_type]}</span>
                <span style={{ color: 'var(--text1)', flex: 1 }}>{getStatusLabel(ev.event_type)}</span>
                <span style={{ color: 'var(--text3)' }}>{ev.duration_minutes != null ? ev.duration_minutes >= 60 ? `${(ev.duration_minutes / 60).toFixed(1)}h` : `${ev.duration_minutes}m` : '—'}</span>
                <span style={{ color: 'var(--text3)', fontSize: '11px' }}>{new Date(ev.started_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
