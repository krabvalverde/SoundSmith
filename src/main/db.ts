// src/main/db.ts
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

let _db: Database.Database | null = null

export function applyMigrations(db: Database.Database): void {
  db.pragma('foreign_keys = ON')
  const version = db.pragma('user_version', { simple: true }) as number
  if (version < 1) {
    const sql = readFileSync(join(__dirname, 'migrations', '001_initial.sql'), 'utf-8')
    db.exec(sql)
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
