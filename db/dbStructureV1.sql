-- =========================
-- Extensions
-- =========================
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- =========================
-- Enums (puedes cambiarlos por tablas lookup si prefieres)
-- =========================
DO $$ BEGIN
  CREATE TYPE test_plan_status AS ENUM ('draft','active','completed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE test_case_status AS ENUM ('draft','ready','deprecated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE test_run_type AS ENUM ('manual','automated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE test_run_status AS ENUM ('queued','running','completed','canceled','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE test_result_status AS ENUM ('passed','failed','skipped','blocked','not_run');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE artifact_type AS ENUM ('screenshot','video','log','report','link','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('admin','editor','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- =========================
-- Security / Users
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE,
  full_name         text,
  password_hash     text NOT NULL,             -- bcrypt/argon2 hash (desde app)
  is_active         boolean NOT NULL DEFAULT true,
  last_login_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Si quieres refresh tokens/sessions en DB (opcional)
CREATE TABLE IF NOT EXISTS user_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token     text NOT NULL UNIQUE,      -- random token/uuid (desde app)
  expires_at        timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- =========================
-- Projects
-- =========================
CREATE TABLE IF NOT EXISTS projects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key               text NOT NULL UNIQUE,       -- e.g. "PAYMENTS"
  name              text NOT NULL,
  description       text,
  is_active         boolean NOT NULL DEFAULT true,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role              member_role NOT NULL DEFAULT 'viewer',
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- =========================
-- Test Plans
-- =========================
CREATE TABLE IF NOT EXISTS test_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  status            test_plan_status NOT NULL DEFAULT 'draft',
  starts_on         date,
  ends_on           date,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_test_plans_project ON test_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_test_plans_status ON test_plans(status);

-- =========================
-- Suites (jerárquicas)
-- =========================
CREATE TABLE IF NOT EXISTS test_suites (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id      uuid NOT NULL REFERENCES test_plans(id) ON DELETE CASCADE,
  parent_suite_id   uuid REFERENCES test_suites(id) ON DELETE SET NULL,
  name              text NOT NULL,
  description       text,
  display_order     int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(test_plan_id, parent_suite_id, name)
);

CREATE INDEX IF NOT EXISTS idx_suites_plan ON test_suites(test_plan_id);
CREATE INDEX IF NOT EXISTS idx_suites_parent ON test_suites(parent_suite_id);

-- =========================
-- Test Cases
-- =========================
CREATE TABLE IF NOT EXISTS test_cases (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id          uuid NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,

  -- Identificador humano por proyecto (opcional)
  external_key      text,                       -- e.g. "TC-1024" (lo genera la app)

  title             text NOT NULL,
  description       text,
  preconditions     text,

  -- Pasos en JSON para flexibilidad (Azure Test Plan style)
  steps             jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{action, expected}...]

  status            test_case_status NOT NULL DEFAULT 'draft',

  -- Automatización
  is_automated      boolean NOT NULL DEFAULT false,
  automation_type   text,                       -- e.g. 'playwright','selenium','k6'
  automation_ref    text,                       -- e.g. repo path / test id / tag
  automation_owner  uuid REFERENCES users(id),

  priority          smallint NOT NULL DEFAULT 3, -- 1 alta, 4 baja (ejemplo)
  created_by        uuid REFERENCES users(id),

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_cases_suite ON test_cases(suite_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_status ON test_cases(status);
CREATE INDEX IF NOT EXISTS idx_test_cases_automated ON test_cases(is_automated);
CREATE INDEX IF NOT EXISTS idx_test_cases_steps_gin ON test_cases USING gin (steps);

-- =========================
-- Runs (corridas)
-- =========================
CREATE TABLE IF NOT EXISTS test_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  test_plan_id      uuid REFERENCES test_plans(id) ON DELETE SET NULL,
  suite_id          uuid REFERENCES test_suites(id) ON DELETE SET NULL,

  run_type          test_run_type NOT NULL,
  status            test_run_status NOT NULL DEFAULT 'queued',

  name              text,                       -- e.g. "Regression - build 182"
  triggered_by      uuid REFERENCES users(id),   -- user o system user
  environment       text,                       -- qa/uat/prod-like
  build_number      text,
  branch            text,
  commit_sha        text,
  ci_provider       text,                       -- github-actions/azure-devops/jenkins
  ci_run_url        text,

  started_at        timestamptz,
  finished_at       timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runs_project ON test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_plan ON test_runs(test_plan_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_type ON test_runs(run_type);

-- =========================
-- Resultados por test case en cada run
-- =========================
CREATE TABLE IF NOT EXISTS test_run_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_case_id      uuid NOT NULL REFERENCES test_cases(id) ON DELETE RESTRICT,

  status            test_result_status NOT NULL DEFAULT 'not_run',
  duration_ms       integer,
  executed_by       uuid REFERENCES users(id),   -- para manual
  executed_at       timestamptz,

  error_message     text,
  stacktrace        text,

  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE(run_id, test_case_id)
);

CREATE INDEX IF NOT EXISTS idx_run_items_run ON test_run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_run_items_case ON test_run_items(test_case_id);
CREATE INDEX IF NOT EXISTS idx_run_items_status ON test_run_items(status);

-- =========================
-- Evidencias / artifacts
-- =========================
CREATE TABLE IF NOT EXISTS test_run_artifacts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid REFERENCES test_runs(id) ON DELETE CASCADE,
  run_item_id       uuid REFERENCES test_run_items(id) ON DELETE CASCADE,

  type              artifact_type NOT NULL DEFAULT 'other',
  name              text,
  url               text NOT NULL,              -- storage URL (S3/R2/GCS/local)
  mime_type         text,
  size_bytes        bigint,
  checksum_sha256   text,

  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb, -- {browser, device, etc}

  created_at        timestamptz NOT NULL DEFAULT now(),

  -- al menos uno debe existir
  CONSTRAINT chk_artifact_scope CHECK (run_id IS NOT NULL OR run_item_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_artifacts_run ON test_run_artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_run_item ON test_run_artifacts(run_item_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_meta_gin ON test_run_artifacts USING gin (metadata);

-- =========================
-- Métricas agregadas por run (snapshot)
-- =========================
CREATE TABLE IF NOT EXISTS test_run_metrics (
  run_id            uuid PRIMARY KEY REFERENCES test_runs(id) ON DELETE CASCADE,

  total             int NOT NULL,
  passed            int NOT NULL,
  failed            int NOT NULL,
  skipped           int NOT NULL,
  blocked           int NOT NULL,
  not_run           int NOT NULL,

  pass_rate         numeric(5,2) NOT NULL,      -- 0.00 - 100.00
  duration_ms       bigint,

  created_at        timestamptz NOT NULL DEFAULT now()
);

-- =========================
-- Auditoría simple (opcional pero útil)
-- =========================
CREATE TABLE IF NOT EXISTS audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id     uuid REFERENCES users(id),
  entity_type       text NOT NULL,              -- 'test_case','suite','plan','run'
  entity_id         uuid NOT NULL,
  action            text NOT NULL,              -- 'create','update','delete','execute'
  details           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_user_id);
