'use client'
import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Estate, PowerEvent, Resident } from '@/types'

interface Props { estate: Estate; residents: Resident[]; events: PowerEvent[]; userId: string }

function buildMessage(eventType: string, estateName: string): string {
  const time = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true })
  switch (eventType) {
    case 'nepa_on': return `[${estateName}] ⚡ NEPA supply has been RESTORED as at ${time}. Please switch off your generator. — Management`
    case 'generator': return `[${estateName}] 🔋 NEPA supply is currently OFF. The estate generator has been activated as at ${time}. — Management`
    default: return `[${estateName}] 🌑 Power is currently UNAVAILABLE as at ${time}. We will update you shortly. — Management`
  }
}

export default function ResidentAlerts({ estate, residents, events, userId }: Props) {
  const [showCompose, setShowCompose] = useState(false)
  const [customMessage, setCustomMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const current = events.find(e => !e.ended_at) ?? events[0]
  const suggestedMessage = useMemo(() => buildMessage(current?.event_type ?? 'no_power', estate.name), [current, estate.name])
  const messageToSend = customMessage || suggestedMessage

  const filtered = residents.filter(r => !search || r.unit_number.toLowerCase().includes(search.toLowerCase()) || (r.name || '').toLowerCase().includes(search.toLowerCase()))

  async function logAlertSent() {
    setSaving(true)
    await supabase.from('alerts_sent').insert({ estate_id: estate.id, event_type: current?.event_type ?? 'manual', channel: 'whatsapp', message_body: messageToSend, recipients_count: residents.length, sent_at: new Date().toISOString(), sent_by: userId })
    setSaving(false); setShowCompose(false); setCustomMessage('')
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(messageToSend)
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>Resident Alerts</h3>
          <p style={{ color: 'var(--text2)', fontSize: '12px', marginTop: '2px' }}>{residents.length} residents · WhatsApp pilot mode</p>
        </div>
        <button className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setShowCompose(v => !v)}>{showCompose ? 'Close' : 'Send Alert'}</button>
      </div>

      {showCompose && (
        <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Alert message</p>
          <textarea rows={4} value={customMessage || suggestedMessage} onChange={e => setCustomMessage(e.target.value)} style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text1)', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
          <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green-border)', borderRadius: '8px', padding: '10px', fontSize: '12px', color: 'var(--text2)', margin: '10px 0' }}><strong style={{ color: 'var(--green)' }}>Pilot mode:</strong> Copy this message and paste into your estate WhatsApp group.</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={copyMessage}>{copied ? '✓ Copied!' : 'Copy Message'}</button>
            <button className="btn-ghost" disabled={saving} onClick={logAlertSent} style={{ fontSize: '12px' }}>{saving ? 'Logging…' : 'Mark as Sent'}</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '10px' }}><input type="search" placeholder="Search residents…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', fontSize: '13px' }} /></div>

      <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: '13px' }}>{residents.length === 0 ? 'No residents added yet' : 'No results'}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Unit','Name','Phone'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500, fontSize: '11px' }}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map(r => (<tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '8px 8px', color: 'var(--green)', fontWeight: 700 }}>{r.unit_number}</td><td style={{ padding: '8px 8px', color: 'var(--text1)' }}>{r.name || '—'}</td><td style={{ padding: '8px 8px', color: 'var(--text2)' }}>{r.phone_number || '—'}</td></tr>))}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}
