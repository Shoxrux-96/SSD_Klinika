-- SSD KLINIKA — schema

CREATE TABLE IF NOT EXISTS employees (
  id          TEXT PRIMARY KEY,
  category    TEXT NOT NULL CHECK (category IN ('medical', 'service')),
  full_name   TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  position    TEXT NOT NULL DEFAULT '',
  specialty   TEXT NOT NULL DEFAULT '',
  experience  TEXT NOT NULL DEFAULT '',
  diploma     TEXT NOT NULL DEFAULT '',
  photo       TEXT,
  added_at    BIGINT NOT NULL,
  archived    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS service_categories (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#999'
);

CREATE TABLE IF NOT EXISTS services (
  id            TEXT PRIMARY KEY,
  category_id   TEXT NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price         NUMERIC NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'som',
  som_value     NUMERIC,
  doctor_share  NUMERIC NOT NULL DEFAULT 0,
  archived      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS assignments (
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  service_id  TEXT NOT NULL REFERENCES services(id)  ON DELETE CASCADE,
  PRIMARY KEY (employee_id, service_id)
);

CREATE TABLE IF NOT EXISTS appointments (
  id       TEXT PRIMARY KEY,
  date     TEXT NOT NULL,
  time     TEXT NOT NULL,
  patient  TEXT NOT NULL,
  doctor   TEXT NOT NULL,
  service  TEXT NOT NULL,
  status   TEXT NOT NULL DEFAULT 'kutilmoqda'
);

CREATE TABLE IF NOT EXISTS patients (
  id         TEXT PRIMARY KEY,
  full_name  TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  address    TEXT NOT NULL DEFAULT '',
  region     TEXT,
  district   TEXT,
  gender     TEXT CHECK (gender IN ('erkak', 'ayol')),
  added_at   BIGINT NOT NULL,
  archived   BOOLEAN NOT NULL DEFAULT FALSE
);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS birth_date TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS passport TEXT;
CREATE INDEX IF NOT EXISTS patients_passport_idx ON patients(passport);

CREATE TABLE IF NOT EXISTS queue (
  id        TEXT PRIMARY KEY,
  number    TEXT NOT NULL,
  patient   TEXT NOT NULL,
  doctor    TEXT NOT NULL,
  service   TEXT NOT NULL,
  added_at  BIGINT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'navbatda'
);
