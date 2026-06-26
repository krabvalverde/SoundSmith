// src/main/__tests__/ipc-handlers.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { applyMigrations } from '../db'
import {
  profileGet, profileCreate, profileUpdate,
  settingsGet, settingsSet, settingsGetAll,
  libraryPathsList, libraryPathsAdd, libraryPathsRemove
} from '../ipc-handlers'

describe('IPC handlers', () => {
  let tmpDir: string
  let db: Database.Database

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'soundsmith-ipc-'))
    db = new Database(join(tmpDir, 'test.db'))
    applyMigrations(db)
  })

  afterEach(() => { db.close(); rmSync(tmpDir, { recursive: true }) })

  describe('profile', () => {
    it('returns null when no profile', () => {
      expect(profileGet(db)).toBeNull()
    })
    it('creates profile with auto initials from single word', () => {
      const p = profileCreate(db, 'Gandalf')
      expect(p.name).toBe('Gandalf')
      expect(p.initials).toBe('GA')
      expect(p.avatar_color).toMatch(/^#[0-9a-f]{6}$/i)
    })
    it('creates profile with first letters of two words', () => {
      const p = profileCreate(db, 'Bilbo Baggins')
      expect(p.initials).toBe('BB')
    })
    it('updates name and recalculates initials', () => {
      profileCreate(db, 'Gandalf')
      const u = profileUpdate(db, 'Saruman The White')
      expect(u.name).toBe('Saruman The White')
      expect(u.initials).toBe('ST')
    })
  })

  describe('settings', () => {
    it('returns null for missing key', () => {
      expect(settingsGet(db, 'missing')).toBeNull()
    })
    it('stores and retrieves', () => {
      settingsSet(db, 'accent_color', '#3b82f6')
      expect(settingsGet(db, 'accent_color')).toBe('#3b82f6')
    })
    it('upserts on duplicate key', () => {
      settingsSet(db, 'host_port', '7842')
      settingsSet(db, 'host_port', '9000')
      expect(settingsGet(db, 'host_port')).toBe('9000')
    })
    it('getAll returns record of all settings', () => {
      settingsSet(db, 'crossfade_loops', 'true')
      settingsSet(db, 'host_port', '7842')
      const all = settingsGetAll(db)
      expect(all['crossfade_loops']).toBe('true')
      expect(all['host_port']).toBe('7842')
    })
  })

  describe('library paths', () => {
    it('empty initially', () => {
      expect(libraryPathsList(db)).toEqual([])
    })
    it('adds a path', () => {
      const p = libraryPathsAdd(db, '/music/rpg')
      expect(p.path).toBe('/music/rpg')
      expect(typeof p.id).toBe('number')
    })
    it('removes by id', () => {
      const p = libraryPathsAdd(db, '/music/rpg')
      libraryPathsRemove(db, p.id)
      expect(libraryPathsList(db)).toHaveLength(0)
    })
    it('rejects duplicate paths', () => {
      libraryPathsAdd(db, '/music/rpg')
      expect(() => libraryPathsAdd(db, '/music/rpg')).toThrow()
    })
  })
})
