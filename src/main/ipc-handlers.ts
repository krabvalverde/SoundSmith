// src/main/ipc-handlers.ts
import Database from 'better-sqlite3'
import { ipcMain, app, dialog } from 'electron'
import { networkInterfaces } from 'os'
import { readdirSync } from 'fs'
import { extname } from 'path'
import { getDb } from './db'

const AUDIO_EXTS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'])

interface LibraryPathRow {
  id: number
  path: string
  added_at: string
}

// --- Pure functions (testable without IPC) ---

export function profileGet(db: Database.Database): Record<string, unknown> | null {
  return (db.prepare('SELECT * FROM profile WHERE id = 1').get() as Record<string, unknown>) ?? null
}

function generateInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.trim().slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#06b6d4']

function generateAvatarColor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export function profileCreate(db: Database.Database, name: string): Record<string, unknown> {
  const now = new Date().toISOString()
  db.prepare('INSERT INTO profile (id,name,initials,avatar_color,created_at,updated_at) VALUES (1,?,?,?,?,?)')
    .run(name, generateInitials(name), generateAvatarColor(name), now, now)
  return profileGet(db)!
}

export function profileUpdate(db: Database.Database, name: string): Record<string, unknown> {
  const now = new Date().toISOString()
  db.prepare('UPDATE profile SET name=?,initials=?,avatar_color=?,updated_at=? WHERE id=1')
    .run(name, generateInitials(name), generateAvatarColor(name), now)
  return profileGet(db)!
}

export function settingsGet(db: Database.Database, key: string): string | null {
  return (
    (db.prepare('SELECT value FROM app_settings WHERE key=?').get(key) as { value: string } | undefined)
      ?.value ?? null
  )
}

export function settingsSet(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO app_settings (key,value) VALUES (?,?)').run(key, value)
}

export function settingsGetAll(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT key,value FROM app_settings').all() as { key: string; value: string }[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export function libraryPathsList(db: Database.Database): LibraryPathRow[] {
  return db.prepare('SELECT * FROM library_paths ORDER BY added_at DESC').all() as LibraryPathRow[]
}

export function libraryPathsAdd(db: Database.Database, path: string): LibraryPathRow {
  const now = new Date().toISOString()
  const { lastInsertRowid } = db.prepare('INSERT INTO library_paths (path,added_at) VALUES (?,?)').run(path, now)
  return db.prepare('SELECT * FROM library_paths WHERE id=?').get(lastInsertRowid) as LibraryPathRow
}

export function libraryPathsRemove(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM library_paths WHERE id=?').run(id)
}

function countAudioFiles(dirPath: string): number {
  try {
    return readdirSync(dirPath).filter((f) => AUDIO_EXTS.has(extname(f).toLowerCase())).length
  } catch {
    return 0
  }
}

// --- IPC registration ---

export function registerIpcHandlers(): void {
  const db = getDb()

  ipcMain.handle('profile:get', () => profileGet(db))
  ipcMain.handle('profile:create', (_e, name: string) => profileCreate(db, name))
  ipcMain.handle('profile:update', (_e, name: string) => profileUpdate(db, name))

  ipcMain.handle('settings:get', (_e, key: string) => settingsGet(db, key))
  ipcMain.handle('settings:set', (_e, key: string, value: string) => settingsSet(db, key, value))
  ipcMain.handle('settings:getAll', () => settingsGetAll(db))

  ipcMain.handle('libraryPaths:list', () => libraryPathsList(db))
  ipcMain.handle('libraryPaths:add', (_e, path: string) => libraryPathsAdd(db, path))
  ipcMain.handle('libraryPaths:remove', (_e, id: number) => libraryPathsRemove(db, id))
  ipcMain.handle('libraryPaths:countAudio', (_e, path: string) => countAudioFiles(path))

  ipcMain.handle('system:getNetworkInterfaces', () => {
    const result: { name: string; address: string }[] = []
    for (const [name, addrs] of Object.entries(networkInterfaces())) {
      for (const a of addrs ?? []) {
        if (a.family === 'IPv4' && !a.internal) result.push({ name, address: a.address })
      }
    }
    return result
  })

  ipcMain.handle('system:openDirectoryDialog', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('system:getAppVersion', () => app.getVersion())
}
