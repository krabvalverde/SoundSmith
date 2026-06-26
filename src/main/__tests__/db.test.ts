// src/main/__tests__/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '../db'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync } from 'fs'

describe('database migrations', () => {
  let tmpDir: string
  let db: Database.Database

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'soundsmith-db-'))
    db = new Database(join(tmpDir, 'test.db'))
  })

  afterEach(() => { db.close(); rmSync(tmpDir, { recursive: true }) })

  it('creates all tables', () => {
    applyMigrations(db)
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]).map(r => r.name)
    expect(names).toContain('profile')
    expect(names).toContain('app_settings')
    expect(names).toContain('library_paths')
    expect(names).toContain('campaigns')
    expect(names).toContain('tracks')
    expect(names).toContain('loops')
    expect(names).toContain('room_config')
  })

  it('is idempotent — running twice does not throw', () => {
    expect(() => { applyMigrations(db); applyMigrations(db) }).not.toThrow()
  })

  it('enables foreign keys', () => {
    applyMigrations(db)
    expect((db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys).toBe(1)
  })

  it('enforces profile single-row CHECK (id = 1)', () => {
    applyMigrations(db)
    const now = new Date().toISOString()
    db.prepare('INSERT INTO profile (id,name,initials,avatar_color,created_at,updated_at) VALUES (1,?,?,?,?,?)').run('A','AA','#8b5cf6',now,now)
    expect(() =>
      db.prepare('INSERT INTO profile (id,name,initials,avatar_color,created_at,updated_at) VALUES (2,?,?,?,?,?)').run('B','BB','#3b82f6',now,now)
    ).toThrow()
  })

  it('sets user_version to 1 after migration', () => {
    applyMigrations(db)
    expect(db.pragma('user_version', { simple: true })).toBe(1)
  })
})
