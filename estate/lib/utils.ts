import type { PowerEvent, DieselLog } from '@/types'

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
}

export function formatLitres(litres: number): string {
  return `${litres.toFixed(1)}L`
}

export function elapsedSince(timestamp: string | Date): string {
  const ms = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

export function calcGeneratorHours(events: PowerEvent[], startMs: number, endMs: number): number {
  let totalMs = 0
  for (const ev of events) {
    if (ev.event_type !== 'generator') continue
    const evStart = Math.max(new Date(ev.started_at).getTime(), startMs)
    const evEnd = ev.ended_at
      ? Math.min(new Date(ev.ended_at).getTime(), endMs)
      : Math.min(Date.now(), endMs)
    if (evEnd > evStart) totalMs += evEnd - evStart
  }
  return totalMs / 3600000
}

export function calcGridReliability(events: PowerEvent[], days = 30): number {
  const now = Date.now()
  const startMs = now - days * 86400000
  let gridMs = 0
  for (const ev of events) {
    if (ev.event_type !== 'nepa_on') continue
    const evStart = Math.max(new Date(ev.started_at).getTime(), startMs)
    const evEnd = ev.ended_at
      ? Math.min(new Date(ev.ended_at).getTime(), now)
      : Math.min(Date.now(), now)
    if (evEnd > evStart) gridMs += evEnd - evStart
  }
  const totalHours = days * 24
  return Math.min(100, (gridMs / 3600000 / totalHours) * 100)
}

export function calcMonthlyDieselCost(logs: DieselLog[], monthStr?: string): number {
  const month = monthStr || new Date().toISOString().slice(0, 7)
  return logs
    .filter(l => l.log_type === 'purchase' && l.timestamp.startsWith(month))
    .reduce((sum, l) => sum + (l.total_cost ?? 0), 0)
}

export function calcBurnRate(logs: DieselLog[], events: PowerEvent[]): number {
  const sorted = [...logs]
    .filter(l => l.current_level_after != null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  if (sorted.length < 2) return 3.5

  const rates: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const consumed = (sorted[i - 1].current_level_after ?? 0) - (sorted[i].current_level_after ?? 0)
    if (consumed <= 0) continue
    const start = new Date(sorted[i - 1].timestamp).getTime()
    const end = new Date(sorted[i].timestamp).getTime()
    const genH = calcGeneratorHours(events, start, end)
    if (genH <= 0) continue
    rates.push(consumed / genH)
  }
  if (!rates.length) return 3.5
  return rates.reduce((a, b) => a + b, 0) / rates.length
}

export function getStatusLabel(type: string): string {
  const map: Record<string, string> = {
    nepa_on: 'NEPA On',
    generator: 'Generator',
    no_power: 'No Power',
    scheduled_maintenance: 'Maintenance',
  }
  return map[type] || type
}

export function getStatusColor(type: string): string {
  if (type === 'nepa_on') return 'var(--green)'
  if (type === 'generator') return 'var(--amber)'
  return 'var(--red)'
}

export function sevenDayPowerBreakdown(events: PowerEvent[]) {
  const result = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const day = date.toLocaleDateString('en-NG', { weekday: 'short' })
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const dayEnd = dayStart + 86400000

    let nepa = 0, generator = 0
    for (const ev of events) {
      if (ev.event_type !== 'nepa_on' && ev.event_type !== 'generator') continue
      const evStart = Math.max(new Date(ev.started_at).getTime(), dayStart)
      const evEnd = ev.ended_at
        ? Math.min(new Date(ev.ended_at).getTime(), dayEnd)
        : Math.min(Date.now(), dayEnd)
      if (evEnd <= evStart) continue
      const hours = (evEnd - evStart) / 3600000
      if (ev.event_type === 'nepa_on') nepa += hours
      else generator += hours
    }

    const none = Math.max(0, 24 - nepa - generator)
    result.push({ day, nepa: +nepa.toFixed(2), generator: +generator.toFixed(2), none: +none.toFixed(2) })
  }
  return result
}
