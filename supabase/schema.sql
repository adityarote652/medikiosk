-- ============================================================
-- MediKiosk: AI-Powered Digital Clinical Intake Platform
-- Supabase PostgreSQL Schema
-- SIH26047 — Ministry of Ayush
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── patients table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patients (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Registration
  token_number              INTEGER,
  patient_name              TEXT,
  age                       SMALLINT,
  gender                    TEXT CHECK (gender IN ('Male', 'Female', 'Other', 'Unknown')),
  abha_id                   TEXT,
  clinical_mode             TEXT CHECK (clinical_mode IN ('ALLOPATHIC', 'AYUSH')) DEFAULT 'ALLOPATHIC',
  language                  TEXT DEFAULT 'en-IN',

  -- Consent & Compliance (DPDP Act 2023)
  consent_given             BOOLEAN DEFAULT FALSE,
  intake_duration_seconds   INTEGER,

  -- Voice & Document
  transcript                TEXT,
  image_url                 TEXT,

  -- AI Clinical Output
  triage_level              TEXT CHECK (triage_level IN ('EMERGENCY', 'URGENT', 'ROUTINE')) DEFAULT 'ROUTINE',
  red_flag_detected         BOOLEAN DEFAULT FALSE,
  red_flag_reason           TEXT,
  chief_complaint           TEXT,
  socrates                  JSONB DEFAULT '{}',
  ayush_pariksha            JSONB DEFAULT '{}',
  extracted_records         JSONB DEFAULT '{"medications": [], "abnormal_labs": []}',
  soap_note                 JSONB DEFAULT '{}',

  -- Workflow
  status                    TEXT CHECK (status IN ('WAITING', 'IN_PROGRESS', 'COMPLETED')) DEFAULT 'WAITING',
  cabin_assigned            TEXT
);

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON public.patients (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patients_triage_level ON public.patients (triage_level);
CREATE INDEX IF NOT EXISTS idx_patients_status ON public.patients (status);
CREATE INDEX IF NOT EXISTS idx_patients_abha_id ON public.patients (abha_id) WHERE abha_id IS NOT NULL;

-- ─── Row Level Security ───────────────────────────────────────
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- For SIH demo: allow all operations (no authentication required)
-- In production: restrict to authenticated staff roles
CREATE POLICY "demo_allow_all"
  ON public.patients
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ─── Realtime Publication ────────────────────────────────────
-- Add the table to the default Supabase realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;

-- ─── Audit trigger (optional — for production) ───────────────
-- This logs all inserts and updates to a separate audit table
-- CREATE TABLE IF NOT EXISTS public.audit_log (
--   id         BIGSERIAL PRIMARY KEY,
--   table_name TEXT,
--   operation  TEXT,
--   record_id  UUID,
--   actor      TEXT,
--   changed_at TIMESTAMPTZ DEFAULT now()
-- );
