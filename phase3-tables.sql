-- ============================================================
-- NEPAWatch Phase 3: ML Data Pipeline Tables
-- Run in Supabase SQL Editor after Phases 1 & 2.
-- ============================================================

-- 1. weather_log: stores Open-Meteo readings per 1-degree grid cell per hour.
--    The predict.js WeatherCache now writes here after every fetch so we have
--    a historical record to correlate with outages during ML training.
CREATE TABLE IF NOT EXISTS weather_log (
  id           BIGSERIAL     PRIMARY KEY,
  lat_key      NUMERIC(4,1)  NOT NULL,
  lon_key      NUMERIC(4,1)  NOT NULL,
  logged_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  weather_code INT,
  rain_mm      NUMERIC(6,3)  NOT NULL DEFAULT 0,
  wind_kmh     NUMERIC(5,2)  NOT NULL DEFAULT 0,
  is_raining   BOOLEAN       GENERATED ALWAYS AS (rain_mm > 0.5) STORED
);

ALTER TABLE weather_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wl_select" ON weather_log FOR SELECT USING (true);
CREATE POLICY "wl_insert" ON weather_log FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS wl_latlon_idx    ON weather_log (lat_key, lon_key);
CREATE INDEX IF NOT EXISTS wl_logged_at_idx ON weather_log (logged_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS wl_unique_hourly ON weather_log (lat_key, lon_key, date_trunc('hour', logged_at));

-- 2. nerc_baselines: NERC SAIDI/SAIFI data per DISCO per band.
--    Pre-seeded from the values hardcoded in predict.js (DISCO_BAND_BASELINE +
--    DISCO_BAND_SUPPLY_HOURS). Admin can edit these when NERC publishes new
--    quarterly reports — changes take effect on next predict.js loadHistory().
CREATE TABLE IF NOT EXISTS nerc_baselines (
  disco         TEXT          NOT NULL,
  band          TEXT          NOT NULL CHECK (band IN ('A','B','C','D','E')),
  outage_prob   NUMERIC(5,4)  NOT NULL,
  supply_hours  NUMERIC(4,1)  NOT NULL,
  saidi_annual  NUMERIC(8,2),  -- System Average Interruption Duration Index (min/yr)
  saifi_annual  NUMERIC(6,2),  -- System Average Interruption Frequency Index (#/yr)
  source_period TEXT          DEFAULT 'predict.js defaults (NERC 2022-24)',
  updated_at    TIMESTAMPTZ   DEFAULT NOW(),
  PRIMARY KEY (disco, band)
);

ALTER TABLE nerc_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nb_select" ON nerc_baselines FOR SELECT USING (true);
CREATE POLICY "nb_upsert" ON nerc_baselines FOR ALL   USING (true);

-- Seed NERC baselines from predict.js constants
-- Source: NERC Annual Reports 2022-2024 + SBT scorecard calibration
INSERT INTO nerc_baselines (disco, band, outage_prob, supply_hours) VALUES
  ('IE',     'A', 0.18, 22), ('IE',     'B', 0.28, 18), ('IE',     'C', 0.42, 13), ('IE',     'D', 0.58, 9),  ('IE',     'E', 0.74, 7),
  ('EKEDC',  'A', 0.18, 22), ('EKEDC',  'B', 0.28, 18), ('EKEDC',  'C', 0.42, 13), ('EKEDC',  'D', 0.58, 9),  ('EKEDC',  'E', 0.74, 7),
  ('AEDC',   'A', 0.22, 20), ('AEDC',   'B', 0.34, 16), ('AEDC',   'C', 0.50, 12), ('AEDC',   'D', 0.64, 8),  ('AEDC',   'E', 0.78, 6),
  ('IBEDC',  'A', 0.32, 17), ('IBEDC',  'B', 0.44, 13), ('IBEDC',  'C', 0.57, 10), ('IBEDC',  'D', 0.70, 7),  ('IBEDC',  'E', 0.82, 5),
  ('PHED',   'A', 0.38, 14), ('PHED',   'B', 0.50, 11), ('PHED',   'C', 0.62, 9),  ('PHED',   'D', 0.74, 6),  ('PHED',   'E', 0.86, 3),
  ('EEDC',   'A', 0.42, 14), ('EEDC',   'B', 0.53, 11), ('EEDC',   'C', 0.64, 9),  ('EEDC',   'D', 0.75, 6),  ('EEDC',   'E', 0.86, 3),
  ('BEDC',   'A', 0.32, 17), ('BEDC',   'B', 0.45, 13), ('BEDC',   'C', 0.58, 10), ('BEDC',   'D', 0.71, 7),  ('BEDC',   'E', 0.84, 4),
  ('JED',    'A', 0.45, 13), ('JED',    'B', 0.56, 10), ('JED',    'C', 0.67, 8),  ('JED',    'D', 0.77, 6),  ('JED',    'E', 0.88, 3),
  ('KEDCO',  'A', 0.40, 14), ('KEDCO',  'B', 0.52, 11), ('KEDCO',  'C', 0.64, 9),  ('KEDCO',  'D', 0.76, 6),  ('KEDCO',  'E', 0.88, 3),
  ('KAEDCO', 'A', 0.48, 12), ('KAEDCO', 'B', 0.59, 9),  ('KAEDCO', 'C', 0.70, 7),  ('KAEDCO', 'D', 0.81, 5),  ('KAEDCO', 'E', 0.92, 2),
  ('YEDC',   'A', 0.55, 10), ('YEDC',   'B', 0.65, 8),  ('YEDC',   'C', 0.74, 6),  ('YEDC',   'D', 0.84, 4),  ('YEDC',   'E', 0.94, 2)
ON CONFLICT (disco, band) DO NOTHING;
