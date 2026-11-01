-- Duet schema. Every biographical fact lives in source_items (from LinkedIn/Instagram)
-- or is a participant statement; observations always point back to one of those.

CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('demo', 'real')),
  display_name TEXT NOT NULL,
  linkedin_url TEXT NOT NULL,
  instagram_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  status_detail TEXT,
  consent_at TEXT,
  consent_version TEXT,
  dating_enabled INTEGER NOT NULL DEFAULT 0,
  token_hash TEXT,
  ip_hash TEXT,
  approved_at TEXT,
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX participants_kind ON participants(kind, status);

-- Participant statements: explicitly provided by the person, never inferred.
CREATE TABLE preferences (
  participant_id TEXT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
  age INTEGER,
  gender TEXT,
  open_to TEXT NOT NULL DEFAULT '[]',
  age_min INTEGER,
  age_max INTEGER,
  location TEXT,
  looking_for TEXT,
  priorities TEXT,
  boundaries TEXT
);

-- One row per retrieval attempt (or uploaded export) per platform.
CREATE TABLE source_documents (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'instagram')),
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  http_status INTEGER,
  detail TEXT,
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX source_documents_participant ON source_documents(participant_id);

CREATE TABLE source_items (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  field TEXT NOT NULL,
  url TEXT NOT NULL,
  text TEXT NOT NULL,
  ord INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX source_items_participant ON source_items(participant_id);

CREATE TABLE profiles (
  participant_id TEXT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
  headline TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  unknowns TEXT NOT NULL DEFAULT '[]',
  analysis_model TEXT,
  analyzed_at TEXT,
  dropped_claims INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE observations (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL CHECK (origin IN ('sourced', 'participant')),
  source_item_id TEXT REFERENCES source_items(id) ON DELETE SET NULL,
  quote TEXT,
  edited INTEGER NOT NULL DEFAULT 0,
  ord INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX observations_participant ON observations(participant_id);

CREATE TABLE ingest_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX ingest_events_participant ON ingest_events(participant_id, id);

CREATE TABLE dates (
  id TEXT PRIMARY KEY,
  pool TEXT NOT NULL CHECK (pool IN ('demo', 'real', 'practice')),
  a_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  b_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  started_at TEXT,
  heartbeat_at TEXT,
  completed_at TEXT,
  UNIQUE (a_id, b_id)
);
CREATE INDEX dates_status ON dates(status, created_at);
CREATE INDEX dates_a ON dates(a_id);
CREATE INDEX dates_b ON dates(b_id);

CREATE TABLE turns (
  date_id TEXT NOT NULL REFERENCES dates(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  speaker_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (date_id, idx)
);

CREATE TABLE assessments (
  date_id TEXT PRIMARY KEY REFERENCES dates(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  score_a REAL NOT NULL,
  score_b REAL NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
