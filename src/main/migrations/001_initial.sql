-- src/main/migrations/001_initial.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profile (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  name          TEXT NOT NULL,
  initials      TEXT NOT NULL,
  avatar_color  TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT
);

CREATE TABLE IF NOT EXISTS library_paths (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  path      TEXT NOT NULL UNIQUE,
  added_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  initials    TEXT NOT NULL,
  color_base  TEXT NOT NULL,
  color_glow  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tracks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id       INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  file_path         TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  format            TEXT NOT NULL,
  duration_ms       INTEGER,
  file_size_bytes   INTEGER,
  sample_rate       INTEGER,
  channels          INTEGER,
  waveform_peaks    BLOB,
  order_index       INTEGER NOT NULL DEFAULT 0,
  import_status     TEXT NOT NULL DEFAULT 'ready',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loops (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id     INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL,
  start_ms     INTEGER NOT NULL,
  end_ms       INTEGER NOT NULL,
  fade_in_ms   INTEGER NOT NULL DEFAULT 0,
  fade_out_ms  INTEGER NOT NULL DEFAULT 0,
  notes        TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  CHECK (end_ms > start_ms)
);

CREATE TABLE IF NOT EXISTS room_config (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  last_code     TEXT,
  max_players   INTEGER NOT NULL DEFAULT 6,
  updated_at    TEXT
);
