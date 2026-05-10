'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Resident } from '@/types'
import AppShell from '@/components/AppShell'
import Papa from 'papaparse'

export default function ResidentsPage() {
  const router = useRouter()
  const [estateId, setEstateId] = useState<string | null>(null)
  const [estateName, setEstateName] = useState('')
  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ unit_number: '', name: '', phone_number: '' })
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ added: number; errors: number } | null>(null)

  const loadResidents = useCallback(async (eid: string) => {
    const { data } = await supabase.from('residents').select('*').eq('estate_id', eid).eq('active', true).order('unit_number')
    if (data) setResidents(data as Resident[])
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const { data: mgr } = await supabase.from('estate_managers').select('estate_id').eq('user_id', data.user.id).single()
      if (!mgr) { router.push('/onboarding'); return }
      const { data: est } = await supabase.from('estates').select('id,name').eq('id', mgr.estate_id).single()
      if (est) setEstateName(est.name)
      setEstateId(mgr.estate_id)
      await loadResidents(mgr.estate_id)
      setLoading(false)
    })
  }, [router, loadResidents])

  async function addResident() {
    if (!estateId) return
    setSaving(true)
    await supabase.from('residents').insert({ ...addForm, estate_id: estateId })
    setAddForm({ unit_number: '', name: '', phone_number: '' }); setShowAdd(false); setSaving(false)
    await loadResidents(estateId)
  }

  async function removeResident(id: string) {
    await supabase.from('residents').update({ active: false }).eq('id', id)
    setResidents(rs => rs.filter(r => r.id !== id))
  }

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !estateId) return
    setImporting(true)
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: async (results) => {
      let added = 0, errors = 0
      for (const row of results.data as Record<string, string>[]) {
        const unit = row.unit_number || row['Unit Number'] || row.unit
        const name = row.name || row.Name
        const phone = row.phone_number || row.phone || row.Phone
        if (!unit) { errors++; continue }
        const { error } = await supabase.from('residents').upsert({ estate_id: estateId, unit_number: String(unit).trim(), name: name ? String(name).trim() : null, phone_number: phone ? String(phone).trim() : null }, { onConflict: 'estate_id,unit_number' })
        if (error) errors++; else added++
      }
      setImportResult({ added, errors }); setImporting(false); await loadResidents(estateId)
    }})
  }

  const filtered = residents.filter(r => !search || r.unit_number.toLowerCase().includes(search.toLowerCase()) || (r.name || '').toLowerCase().includes(search.toLowerCase()) || (r.phone_number || '').includes(search))

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}><p style={{ color: 'var(--text2)' }}>Loading…</p></div>

  return (
    <AppShell estateName={estateName}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 800, fontSize: '1.5rem' }}>Residents</h1>
            <p style={{ color: 'var(--text2)', fontSize: '13px' }}>{residents.length} active residents</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <label className="btn-ghost" style={{ cursor: 'pointer', fontSize: '13px' }}>{importing ? 'Importing…' : 'Import CSV'}<input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSV} /></label>
            <button className="btn-primary" onClick={() => setShowAdd(true)}>Add Resident</button>
          </div>
        </div>

        {importResult && <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green-border)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: 'var(--text2)' }}>Import complete: <strong style={{ color: 'var(--green)' }}>{importResult.added} added</strong>{importResult.errors > 0 && <span style={{ color: 'var(--red)', marginLeft: '8px' }}>{importResult.errors} errors</span>}<button style={{ marginLeft: '12px', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }} onClick={() => setImportResult(null)}>×</button></div>}

        {showAdd && (
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '14px' }}>Add Resident</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div><label className="field-label">Unit Number</label><input type="text" placeholder="e.g. A12" value={addForm.unit_number} onChange={e => setAddForm(f => ({ ...f, unit_number: e.target.value }))} /></div>
              <div><label className="field-label">Name</label><input type="text" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="field-label">Phone</label><input type="tel" value={addForm.phone_number} onChange={e => setAddForm(f => ({ ...f, phone_number: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" disabled={!addForm.unit_number || saving} onClick={addResident}>{saving ? 'Saving…' : 'Add Resident'}</button>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}><input type="search" placeholder="Search by unit, name, or phone…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', maxWidth: '360px' }} /></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Unit','Name','Phone','WhatsApp',''].map(h => <th key={h} style={{ textAlign: 'left', padding: '12px 20px', color: 'var(--text3)', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(r => (<tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '12px 20px', color: 'var(--green)', fontWeight: 700 }}>{r.unit_number}</td><td style={{ padding: '12px 20px' }}>{r.name || <span style={{ color: 'var(--text3)' }}>—</span>}</td><td style={{ padding: '12px 20px', color: 'var(--text2)' }}>{r.phone_number || <span style={{ color: 'var(--text3)' }}>—</span>}</td><td style={{ padding: '12px 20px' }}><span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: r.whatsapp_opt_in ? 'var(--green-dim)' : 'var(--border)', color: r.whatsapp_opt_in ? 'var(--green)' : 'var(--text3)' }}>{r.whatsapp_opt_in ? 'Opted in' : 'Opted out'}</span></td><td style={{ padding: '12px 20px' }}><button style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '12px' }} onClick={() => removeResident(r.id)}>Remove</button></td></tr>))}
                {filtered.length === 0 && <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)' }}>{residents.length === 0 ? 'No residents yet — add one above or import a CSV' : 'No results'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
