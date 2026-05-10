export type PowerStatus = 'nepa_on' | 'generator' | 'no_power'
export type EventType = 'nepa_on' | 'generator' | 'no_power' | 'scheduled_maintenance'
export type LogType = 'purchase' | 'level_check' | 'consumption_calc'
export type UserRole = 'owner' | 'manager' | 'viewer'

export interface Estate {
  id: string
  name: string
  address: string
  num_units: number
  num_generators: number
  generator_capacity_kva: number
  diesel_consumption_rate: number
  diesel_tank_size: number
  low_fuel_threshold: number
  diesel_price_per_litre: number
  current_diesel_level: number
  created_at: string
  updated_at: string
}

export interface EstateManager {
  id: string
  user_id: string
  estate_id: string
  role: UserRole
  name: string | null
  phone: string | null
  created_at: string
}

export interface PowerEvent {
  id: string
  estate_id: string
  event_type: EventType
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  notes: string | null
  logged_by: string | null
  created_at: string
}

export interface DieselLog {
  id: string
  estate_id: string
  log_type: LogType
  litres_amount: number
  price_per_litre: number | null
  total_cost: number | null
  supplier: string | null
  current_level_after: number | null
  timestamp: string
  notes: string | null
  logged_by: string | null
}

export interface Resident {
  id: string
  estate_id: string
  unit_number: string
  name: string | null
  phone_number: string | null
  whatsapp_opt_in: boolean
  sms_opt_in: boolean
  active: boolean
  created_at: string
}

export interface AlertSent {
  id: string
  estate_id: string
  event_type: string
  channel: 'whatsapp' | 'sms' | 'push'
  message_body: string | null
  recipients_count: number
  sent_at: string
  sent_by: string | null
}

export interface MonthlyReport {
  id: string
  estate_id: string
  month: string
  grid_hours: number | null
  generator_hours: number | null
  no_power_hours: number | null
  total_diesel_cost: number | null
  total_litres_used: number | null
  avg_daily_runtime: number | null
  grid_reliability_pct: number | null
  generated_at: string
  generated_by: string | null
}
