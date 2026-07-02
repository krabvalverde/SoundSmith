// src/main/ipc-handlers.ts
import Database from 'better-sqlite3'
import { ipcMain, app, dialog, clipboard } from 'electron'
import { networkInterfaces } from 'os'
import { readdirSync, mkdirSync, statSync, unlinkSync } from 'fs'
import { copyFile, rm } from 'fs/promises'
import { extname, basename, join } from 'path'
import { getDb } from './db'
import { RoomServer, CampaignManifest, RoomPlaybackState, PlayerInfo } from './room-server'

const AUDIO_EXTS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'])

interface LibraryPathRow {
  id: number
  path: string
  added_at: string
}

interface CampaignRow {
  id: number
  name: string
  initials: string
  color_base: string
  color_glow: string
  created_at: string
  updated_at: string
}

interface CampaignWithCount extends CampaignRow {
  track_count: number
}

interface TrackRow {
  id: number
  campaign_id: number
  title: string
  file_path: string
  original_filename: string
  format: string
  duration_ms: number | null
  file_size_bytes: number | null
  sample_rate: number | null
  channels: number | null
  order_index: number
  import_status: string
  created_at: string
  updated_at: string
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

// --- Loop / Track helpers ---

interface LoopRow {
  id: number
  track_id: number
  name: string
  color: string
  start_ms: number
  end_ms: number
  fade_in_ms: number
  fade_out_ms: number
  notes: string | null
  order_index: number
  created_at: string
  updated_at: string
}

interface LoopInput {
  name: string
  color: string
  start_ms: number
  end_ms: number
  fade_in_ms: number
  fade_out_ms: number
  notes: string | null
  order_index: number
  created_at?: string
}

export function loopsGetByTrack(db: Database.Database, trackId: number): LoopRow[] {
  return db
    .prepare('SELECT * FROM loops WHERE track_id=? ORDER BY order_index ASC')
    .all(trackId) as LoopRow[]
}

export function loopsSaveAll(db: Database.Database, trackId: number, loopsData: LoopInput[]): LoopRow[] {
  const now = new Date().toISOString()
  db.transaction(() => {
    db.prepare('DELETE FROM loops WHERE track_id=?').run(trackId)
    for (const l of loopsData) {
      db.prepare(
        `INSERT INTO loops
         (track_id,name,color,start_ms,end_ms,fade_in_ms,fade_out_ms,notes,order_index,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        trackId, l.name, l.color, l.start_ms, l.end_ms,
        l.fade_in_ms, l.fade_out_ms, l.notes ?? null, l.order_index,
        l.created_at ?? now, now
      )
    }
    db.prepare('UPDATE tracks SET updated_at=? WHERE id=?').run(now, trackId)
    const track = db.prepare('SELECT campaign_id FROM tracks WHERE id=?').get(trackId) as
      | { campaign_id: number }
      | undefined
    if (track) db.prepare('UPDATE campaigns SET updated_at=? WHERE id=?').run(now, track.campaign_id)
  })()
  return loopsGetByTrack(db, trackId)
}

export function tracksRename(db: Database.Database, trackId: number, title: string): void {
  const t = title.trim() || 'Sem Título'
  const now = new Date().toISOString()
  db.prepare('UPDATE tracks SET title=?,updated_at=? WHERE id=?').run(t, now, trackId)
  const track = db.prepare('SELECT campaign_id FROM tracks WHERE id=?').get(trackId) as
    | { campaign_id: number }
    | undefined
  if (track) db.prepare('UPDATE campaigns SET updated_at=? WHERE id=?').run(now, track.campaign_id)
}

export function tracksGetWaveformPeaks(db: Database.Database, trackId: number): number[] | null {
  const row = db.prepare('SELECT waveform_peaks FROM tracks WHERE id=?').get(trackId) as
    | { waveform_peaks: Buffer | null }
    | undefined
  if (!row?.waveform_peaks) return null
  try {
    return JSON.parse(row.waveform_peaks.toString('utf8')) as number[]
  } catch {
    return null
  }
}

export function tracksSaveWaveformPeaks(
  db: Database.Database,
  trackId: number,
  peaks: number[]
): void {
  db.prepare('UPDATE tracks SET waveform_peaks=? WHERE id=?').run(
    Buffer.from(JSON.stringify(peaks), 'utf8'),
    trackId
  )
}

export function tracksUpdateDuration(db: Database.Database, trackId: number, durationMs: number): void {
  db.prepare('UPDATE tracks SET duration_ms=? WHERE id=?').run(Math.round(durationMs), trackId)
}

// --- Campaign helpers ---

const CAMPAIGN_PALETTES = [
  { color_base: '#1e1433', color_glow: '#8b5cf6' },
  { color_base: '#0f1e33', color_glow: '#3b82f6' },
  { color_base: '#0f281a', color_glow: '#10b981' },
  { color_base: '#2b1a0e', color_glow: '#f59e0b' },
  { color_base: '#2b0f1a', color_glow: '#ec4899' },
  { color_base: '#2b0f0f', color_glow: '#ef4444' },
  { color_base: '#0f2229', color_glow: '#06b6d4' },
]

const PT_STOP_WORDS = new Set([
  'a', 'as', 'o', 'os', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'e', 'ou', 'um', 'uma',
])

export function generateCampaignInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !PT_STOP_WORDS.has(w.toLowerCase()))
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return name.trim().slice(0, 2).toUpperCase()
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
}

export function campaignsList(db: Database.Database): CampaignWithCount[] {
  return db
    .prepare(
      `SELECT c.*, COUNT(t.id) as track_count
       FROM campaigns c
       LEFT JOIN tracks t ON t.campaign_id = c.id
       GROUP BY c.id
       ORDER BY c.updated_at DESC`
    )
    .all() as CampaignWithCount[]
}

async function importTrack(
  db: Database.Database,
  sender: Electron.WebContents,
  campaignId: number,
  filePath: string,
  orderIndex: number,
  current: number,
  total: number
): Promise<TrackRow> {
  const ext = extname(filePath).toLowerCase()
  const originalFilename = basename(filePath)
  const title = basename(filePath, ext)
  const format = ext.replace('.', '')
  let fileSize: number | null = null
  try {
    fileSize = statSync(filePath).size
  } catch {}

  const now = new Date().toISOString()
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO tracks
       (campaign_id,title,file_path,original_filename,format,file_size_bytes,order_index,import_status,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .run(campaignId, title, '', originalFilename, format, fileSize, orderIndex, 'pending', now, now)

  const trackId = Number(lastInsertRowid)
  const destFilename = `${trackId}__${sanitizeFilename(originalFilename)}`
  const destDir = join(app.getPath('userData'), 'library', String(campaignId))
  const destPath = join(destDir, destFilename)

  mkdirSync(destDir, { recursive: true })

  let status: 'ready' | 'error' = 'ready'
  try {
    await copyFile(filePath, destPath)
    db.prepare('UPDATE tracks SET file_path=?,import_status=?,updated_at=? WHERE id=?').run(
      destPath,
      'ready',
      new Date().toISOString(),
      trackId
    )
  } catch {
    status = 'error'
    db.prepare('UPDATE tracks SET import_status=?,updated_at=? WHERE id=?').run(
      'error',
      new Date().toISOString(),
      trackId
    )
  }

  sender.send('campaigns:import:progress', { trackId, current, total, status, filename: originalFilename })

  return db.prepare('SELECT * FROM tracks WHERE id=?').get(trackId) as TrackRow
}

export async function campaignsCreate(
  db: Database.Database,
  sender: Electron.WebContents,
  name: string,
  filePaths: string[]
): Promise<{ campaign: CampaignWithCount; tracks: TrackRow[] }> {
  const campaignName = name.trim() || 'Nova Campanha'
  const count = (db.prepare('SELECT COUNT(*) as c FROM campaigns').get() as { c: number }).c
  const palette = CAMPAIGN_PALETTES[count % CAMPAIGN_PALETTES.length]
  const now = new Date().toISOString()

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO campaigns (name,initials,color_base,color_glow,created_at,updated_at) VALUES (?,?,?,?,?,?)`
    )
    .run(
      campaignName,
      generateCampaignInitials(campaignName),
      palette.color_base,
      palette.color_glow,
      now,
      now
    )

  const campaignId = Number(lastInsertRowid)
  const tracks: TrackRow[] = []

  for (let i = 0; i < filePaths.length; i++) {
    const track = await importTrack(db, sender, campaignId, filePaths[i], i, i + 1, filePaths.length)
    tracks.push(track)
  }

  if (filePaths.length > 0) {
    db.prepare('UPDATE campaigns SET updated_at=? WHERE id=?').run(new Date().toISOString(), campaignId)
  }

  const campaign = db
    .prepare(
      `SELECT c.*, COUNT(t.id) as track_count FROM campaigns c LEFT JOIN tracks t ON t.campaign_id=c.id WHERE c.id=? GROUP BY c.id`
    )
    .get(campaignId) as CampaignWithCount

  return { campaign, tracks }
}

export function campaignsUpdate(db: Database.Database, id: number, name: string): CampaignRow {
  const campaignName = name.trim() || 'Nova Campanha'
  const now = new Date().toISOString()
  db.prepare('UPDATE campaigns SET name=?,initials=?,updated_at=? WHERE id=?').run(
    campaignName,
    generateCampaignInitials(campaignName),
    now,
    id
  )
  return db.prepare('SELECT * FROM campaigns WHERE id=?').get(id) as CampaignRow
}

export async function campaignsDelete(db: Database.Database, id: number): Promise<void> {
  const libDir = join(app.getPath('userData'), 'library', String(id))
  db.prepare('DELETE FROM campaigns WHERE id=?').run(id)
  try {
    await rm(libDir, { recursive: true, force: true })
  } catch {}
}

export function campaignsGetTracks(db: Database.Database, campaignId: number): TrackRow[] {
  return db
    .prepare('SELECT * FROM tracks WHERE campaign_id=? ORDER BY order_index ASC')
    .all(campaignId) as TrackRow[]
}

export async function campaignsAddTracks(
  db: Database.Database,
  sender: Electron.WebContents,
  campaignId: number,
  filePaths: string[]
): Promise<TrackRow[]> {
  const { c: startIndex } = db
    .prepare('SELECT COUNT(*) as c FROM tracks WHERE campaign_id=?')
    .get(campaignId) as { c: number }

  const tracks: TrackRow[] = []
  for (let i = 0; i < filePaths.length; i++) {
    const track = await importTrack(
      db,
      sender,
      campaignId,
      filePaths[i],
      startIndex + i,
      i + 1,
      filePaths.length
    )
    tracks.push(track)
  }

  db.prepare('UPDATE campaigns SET updated_at=? WHERE id=?').run(new Date().toISOString(), campaignId)
  return tracks
}

export async function campaignsRemoveTrack(db: Database.Database, trackId: number): Promise<void> {
  const track = db.prepare('SELECT * FROM tracks WHERE id=?').get(trackId) as TrackRow | undefined
  if (!track) return
  db.prepare('DELETE FROM tracks WHERE id=?').run(trackId)
  db.prepare('UPDATE campaigns SET updated_at=? WHERE id=?').run(
    new Date().toISOString(),
    track.campaign_id
  )
  if (track.file_path) {
    try {
      unlinkSync(track.file_path)
    } catch {}
  }
}

export function campaignsReorderTracks(
  db: Database.Database,
  campaignId: number,
  orderedTrackIds: number[]
): void {
  const stmt = db.prepare(
    'UPDATE tracks SET order_index=?,updated_at=? WHERE id=? AND campaign_id=?'
  )
  const now = new Date().toISOString()
  db.transaction(() => {
    orderedTrackIds.forEach((id, i) => stmt.run(i, now, id, campaignId))
  })()
}

export function campaignsRenameTrack(db: Database.Database, trackId: number, title: string): TrackRow {
  const t = title.trim() || 'Sem Título'
  const now = new Date().toISOString()
  db.prepare('UPDATE tracks SET title=?,updated_at=? WHERE id=?').run(t, now, trackId)
  const track = db.prepare('SELECT * FROM tracks WHERE id=?').get(trackId) as TrackRow
  db.prepare('UPDATE campaigns SET updated_at=? WHERE id=?').run(now, track.campaign_id)
  return track
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

  // Campaigns
  ipcMain.handle('campaigns:list', () => campaignsList(db))

  ipcMain.handle('campaigns:create', async (e, name: string, filePaths: string[]) =>
    campaignsCreate(db, e.sender, name, filePaths)
  )

  ipcMain.handle('campaigns:update', (_e, id: number, name: string) => campaignsUpdate(db, id, name))

  ipcMain.handle('campaigns:delete', (_e, id: number) => campaignsDelete(db, id))

  ipcMain.handle('campaigns:getTracks', (_e, campaignId: number) => campaignsGetTracks(db, campaignId))

  ipcMain.handle('campaigns:addTracks', async (e, campaignId: number, filePaths: string[]) =>
    campaignsAddTracks(db, e.sender, campaignId, filePaths)
  )

  ipcMain.handle('campaigns:removeTrack', (_e, trackId: number) => campaignsRemoveTrack(db, trackId))

  ipcMain.handle(
    'campaigns:reorderTracks',
    (_e, campaignId: number, orderedTrackIds: number[]) =>
      campaignsReorderTracks(db, campaignId, orderedTrackIds)
  )

  ipcMain.handle('campaigns:renameTrack', (_e, trackId: number, title: string) =>
    campaignsRenameTrack(db, trackId, title)
  )

  // Loops
  ipcMain.handle('loops:getByTrack', (_e, trackId: number) => loopsGetByTrack(db, trackId))

  ipcMain.handle('loops:saveAll', (_e, trackId: number, loopsData: LoopInput[]) =>
    loopsSaveAll(db, trackId, loopsData)
  )

  // Tracks (studio operations)
  ipcMain.handle('tracks:rename', (_e, trackId: number, title: string) =>
    tracksRename(db, trackId, title)
  )
  ipcMain.handle('tracks:getWaveformPeaks', (_e, trackId: number) =>
    tracksGetWaveformPeaks(db, trackId)
  )
  ipcMain.handle('tracks:saveWaveformPeaks', (_e, trackId: number, peaks: number[]) =>
    tracksSaveWaveformPeaks(db, trackId, peaks)
  )
  ipcMain.handle('tracks:updateDuration', (_e, trackId: number, durationMs: number) =>
    tracksUpdateDuration(db, trackId, durationMs)
  )

  // ── Room ─────────────────────────────────────────────────────────────────

  let roomServer: RoomServer | null = null
  let roomEventSender: Electron.WebContents | null = null

  function getRoomInfo(): {
    active: boolean; code: string; port: number; players: PlayerInfo[]
  } {
    if (!roomServer?.active) return { active: false, code: '', port: 0, players: [] }
    return { active: true, code: roomServer.code, port: roomServer.port, players: roomServer.getPlayers() }
  }

  ipcMain.handle('room:create', async (e, campaignId: number, port: number, syncBufferMs: number) => {
    if (roomServer?.active) roomServer.stop()

    roomEventSender = e.sender

    roomServer = new RoomServer(port, syncBufferMs, () => {
      if (roomEventSender && !roomEventSender.isDestroyed()) {
        roomEventSender.send('room:stateChanged', getRoomInfo())
      }
    })

    const campaign = db.prepare('SELECT * FROM campaigns WHERE id=?').get(campaignId) as CampaignRow | undefined
    if (!campaign) throw new Error('Campaign not found')

    const tracks = campaignsGetTracks(db, campaignId)
    const manifest: CampaignManifest = {
      id: campaign.id,
      name: campaign.name,
      initials: campaign.initials,
      colorBase: campaign.color_base,
      colorGlow: campaign.color_glow,
      tracks: tracks.map(t => ({
        id: t.id,
        title: t.title,
        originalFilename: t.original_filename,
        format: t.format,
        durationMs: t.duration_ms,
        loops: loopsGetByTrack(db, t.id).map(l => ({
          id: l.id,
          name: l.name,
          color: l.color,
          startMs: l.start_ms,
          endMs: l.end_ms,
          fadeInMs: l.fade_in_ms,
          fadeOutMs: l.fade_out_ms,
          orderIndex: l.order_index,
        })),
      })),
    }
    roomServer.setManifest(manifest, tracks.map(t => ({ id: t.id, filePath: t.file_path, format: t.format })))

    await roomServer.start()
    return getRoomInfo()
  })

  ipcMain.handle('room:close', () => {
    roomServer?.stop()
    roomServer = null
    return { active: false, code: '', port: 0, players: [] }
  })

  ipcMain.handle('room:getState', () => getRoomInfo())

  ipcMain.handle('room:broadcastCmd', (_e, cmd: Record<string, unknown>) => {
    roomServer?.broadcastCmd(cmd)
  })

  ipcMain.handle('room:updatePlayback', (_e, state: RoomPlaybackState) => {
    roomServer?.setPlaybackState(state)
  })

  ipcMain.handle('room:copyInfo', () => {
    if (!roomServer?.active) return
    const vpnIp = (db.prepare("SELECT value FROM app_settings WHERE key='vpn_ip'").get() as { value: string } | undefined)?.value ?? ''
    const text = `Sala SoundSmith\nIP: ${vpnIp}\nCódigo: ${roomServer.code}\nPorta: ${roomServer.port}`
    clipboard.writeText(text)
  })

  // ── File dialog (legacy position) ────────────────────────────────────────
  ipcMain.handle('campaigns:openAudioFilesDialog', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Arquivos de Áudio', extensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'] }],
    })
    if (r.canceled) return []
    return r.filePaths.map((p) => ({
      path: p,
      name: basename(p),
      size: (() => {
        try {
          return statSync(p).size
        } catch {
          return 0
        }
      })(),
    }))
  })
}
