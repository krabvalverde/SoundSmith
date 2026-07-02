// src/main/db.ts
import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import migration001 from './migrations/001_initial.sql?raw'

let _db: Database.Database | null = null

export function applyMigrations(db: Database.Database): void {
  db.pragma('foreign_keys = ON')
  const version = db.pragma('user_version', { simple: true }) as number
  if (version < 1) {
    db.exec(migration001)
    db.pragma('user_version = 1')
  }
}

export function getDb(): Database.Database {
  if (!_db) {
    const path = join(app.getPath('userData'), 'soundsmith.db')
    _db = new Database(path)
    applyMigrations(_db)
  }
  return _db
}

export function closeDb(): void {
  _db?.close()
  _db = null
}
