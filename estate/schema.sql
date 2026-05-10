-- NEPAWatch Estate — Database Schema
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS estates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  num_units integer NOT NULL DEFAULT 50,
  num_generators integer NOT NULL DEFAULT 1,
  generator_capacity_kva numeric(8,2) DEFAULT 100,
  diesel_consumption_rate numeric(6,2) DEFAULT 3.5,
  diesel_tank_size numeric(8,2) DEFAULT 500,
  low_fuel_threshold integer DEFAULT 20,
  diesel_price_per_litre numeric(10,2) DEFAULT 1200,
  current_diesel_level numeric(8,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estate_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estate_id uuid NOT NULL REFERENCES estates(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'manager' CHECK (role IN ('owner','manager','viewer')),
  name text,
  phone text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, estate_id)
);

CREATE TABLE IF NOT EXISTS power_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES estates(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('nepa_on','generator','no_power','scheduled_maintenance')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_minutes integer,
  notes text,
  logged_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diesel_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES estates(id) ON DELETE CASCADE,
  log_type text NOT NULL CHECK (log_type IN ('purchase','level_check','consumption_calc')),
  litres_amount numeric(8,2) NOT NULL,
  price_per_litre numeric(10,2),
  total_cost numeric(12,2),
  supplier text,
  current_level_after numeric(8,2),
  timestamp timestamptz NOT NULL DEFAULT now(),
  notes text,
  logged_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS residents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES estates(id) ON DELETE CASCADE,
  unit_number text NOT NULL,
  name text,
  phone_number text,
  whatsapp_opt_in boolean DEFAULT true,
  sms_opt_in boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(estate_id, unit_number)
);

CREATE TABLE IF NOT EXISTS alerts_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES estates(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','sms','push')),
  message_body text,
  recipients_count integer DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES estates(id) ON DELETE CASCADE,
  month text NOT NULL,
  grid_hours numeric(6,2) DEFAULT 0,
  generator_hours numeric(6,2) DEFAULT 0,
  no_power_hours numeric(6,2) DEFAULT 0,
  total_diesel_cost numeric(12,2) DEFAULT 0,
  total_litres_used numeric(8,2) DEFAULT 0,
  avg_daily_runtime numeric(6,2) DEFAULT 0,
  grid_reliability_pct numeric(5,2) DEFAULT 0,
  generated_at timestamptz DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id),
  UNIQUE(estate_id, month)
);

CREATE INDEX IF NOT EXISTS idx_power_events_estate ON power_events(estate_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_diesel_logs_estate ON diesel_logs(estate_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_residents_estate ON residents(estate_id);
CREATE INDEX IF NOT EXISTS idx_alerts_estate ON alerts_sent(estate_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_managers_user ON estate_managers(user_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS estates_updated_at ON estates;
CREATE TRIGGER estates_updated_at BEFORE UPDATE ON estates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE estates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estate_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE diesel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION user_manages_estate(eid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM estate_managers WHERE estate_id = eid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "estates_select" ON estates FOR SELECT USING (user_manages_estate(id));
CREATE POLICY "estates_insert" ON estates FOR INSERT WITH CHECK (true);
CREATE POLICY "estates_update" ON estates FOR UPDATE USING (user_manages_estate(id));
CREATE POLICY "managers_select" ON estate_managers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "managers_insert" ON estate_managers FOR INSERT WITH CHECK (true);
CREATE POLICY "managers_update" ON estate_managers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "pevents_select" ON power_events FOR SELECT USING (user_manages_estate(estate_id));
CREATE POLICY "pevents_insert" ON power_events FOR INSERT WITH CHECK (user_manages_estate(estate_id));
CREATE POLICY "pevents_update" ON power_events FOR UPDATE USING (user_manages_estate(estate_id));
CREATE POLICY "diesel_select" ON diesel_logs FOR SELECT USING (user_manages_estate(estate_id));
CREATE POLICY "diesel_insert" ON diesel_logs FOR INSERT WITH CHECK (user_manages_estate(estate_id));
CREATE POLICY "residents_select" ON residents FOR SELECT USING (user_manages_estate(estate_id));
CREATE POLICY "residents_insert" ON residents FOR INSERT WITH CHECK (user_manages_estate(estate_id));
CREATE POLICY "residents_update" ON residents FOR UPDATE USING (user_manages_estate(estate_id));
CREATE POLICY "residents_delete" ON residents FOR DELETE USING (user_manages_estate(estate_id));
CREATE POLICY "alerts_select" ON alerts_sent FOR SELECT USING (user_manages_estate(estate_id));
CREATE POLICY "alerts_insert" ON alerts_sent FOR INSERT WITH CHECK (user_manages_estate(estate_id));
CREATE POLICY "reports_select" ON monthly_reports FOR SELECT USING (user_manages_estate(estate_id));
CREATE POLICY "reports_insert" ON monthly_reports FOR INSERT WITH CHECK (user_manages_estate(estate_id));
CREATE POLICY "reports_update" ON monthly_reports FOR UPDATE USING (user_manages_estate(estate_id));
