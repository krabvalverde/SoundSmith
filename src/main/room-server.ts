// src/main/room-server.ts
import { WebSocketServer, WebSocket } from 'ws'
import { createServer, IncomingMessage, ServerResponse, Server } from 'http'
import { createReadStream } from 'fs'

const MAX_PLAYERS = 6
const AMBIGUOUS = new Set(['0', 'O', '1', 'I'])
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('').filter(c => !AMBIGUOUS.has(c))
const AVATAR_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#06b6d4']

function generateCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

function generateInitials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean)
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase()
  return name.trim().slice(0, 2).toUpperCase()
}

function generateAvatarColor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export type PlayerStatus = 'connecting' | 'syncing' | 'synced'

export interface PlayerInfo {
  id: string
  name: string
  avatarColor: string
  initials: string
  status: PlayerStatus
  latencyMs: number | null
}

interface Player extends PlayerInfo {
  ws: WebSocket
  pingTimer: ReturnType<typeof setInterval> | null
}

export interface LoopManifest {
  id: number
  name: string
  color: string
  startMs: number
  endMs: number
  fadeInMs: number
  fadeOutMs: number
  orderIndex: number
}

export interface TrackManifest {
  id: number
  title: string
  originalFilename: string
  format: string
  durationMs: number | null
  loops: LoopManifest[]
}

export interface CampaignManifest {
  id: number
  name: string
  initials: string
  colorBase: string
  colorGlow: string
  tracks: TrackManifest[]
}

export interface RoomPlaybackState {
  trackId: number | null
  playing: boolean
  positionMs: number
  updatedAt: number  // host Date.now() at time of update
  loopMode: 'none' | 'full' | { startMs: number; endMs: number; fadeInMs: number; fadeOutMs: number } | null
}

interface TrackFileEntry {
  id: number
  filePath: string
  format: string
}

export class RoomServer {
  private wss: WebSocketServer | null = null
  private http: Server | null = null
  private players = new Map<string, Player>()
  private _code = ''
  private _port: number
  private _syncBufferMs: number
  private manifest: CampaignManifest | null = null
  private trackFiles = new Map<number, TrackFileEntry>()
  private playbackState: RoomPlaybackState | null = null
  private onPlayersChanged: (players: PlayerInfo[]) => void

  constructor(
    port: number,
    syncBufferMs: number,
    onPlayersChanged: (players: PlayerInfo[]) => void
  ) {
    this._port = port
    this._syncBufferMs = syncBufferMs
    this.onPlayersChanged = onPlayersChanged
  }

  get code() { return this._code }
  get port() { return this._port }
  get active() { return this.wss !== null }

  getPlayers(): PlayerInfo[] {
    return Array.from(this.players.values()).map(({ id, name, avatarColor, initials, status, latencyMs }) =>
      ({ id, name, avatarColor, initials, status, latencyMs }))
  }

  setManifest(manifest: CampaignManifest, files: TrackFileEntry[]) {
    this.manifest = manifest
    this.trackFiles.clear()
    for (const f of files) this.trackFiles.set(f.id, f)
  }

  setPlaybackState(state: RoomPlaybackState) {
    this.playbackState = state
  }

  broadcastCmd(cmd: Record<string, unknown>) {
    const atHostTime = Date.now() + this._syncBufferMs
    this._broadcast({ type: 'CMD', ...cmd, atHostTime })
    // Also update our playback state with the command info
    if (this.playbackState && cmd.cmd === 'PLAY') {
      this.playbackState = {
        ...this.playbackState,
        playing: true,
        positionMs: typeof cmd.positionMs === 'number' ? cmd.positionMs : this.playbackState.positionMs,
        updatedAt: Date.now(),
      }
    }
    if (this.playbackState && cmd.cmd === 'PAUSE') {
      this.playbackState = { ...this.playbackState, playing: false, updatedAt: Date.now() }
    }
  }

  async start(): Promise<void> {
    this._code = generateCode()
    this.http = createServer((req, res) => this._serveFile(req, res))
    this.wss = new WebSocketServer({ server: this.http })
    this.wss.on('connection', ws => this._handleConnection(ws))
    return new Promise((resolve, reject) => {
      this.http!.listen(this._port, '0.0.0.0', () => resolve())
      this.http!.once('error', reject)
    })
  }

  stop() {
    this._broadcast({ type: 'END_SESSION' })
    for (const p of this.players.values()) {
      if (p.pingTimer) clearInterval(p.pingTimer)
    }
    this.players.clear()
    this.playbackState = null
    if (this.wss) { this.wss.close(); this.wss = null }
    if (this.http) { this.http.close(); this.http = null }
    this.onPlayersChanged([])
  }

  private _broadcast(msg: unknown) {
    const str = JSON.stringify(msg)
    for (const p of this.players.values()) {
      if (p.ws.readyState === WebSocket.OPEN) p.ws.send(str)
    }
  }

  private _handleConnection(ws: WebSocket) {
    let playerId: string | null = null

    ws.on('message', data => {
      let msg: Record<string, unknown>
      try { msg = JSON.parse(data.toString()) as Record<string, unknown> } catch { return }

      if (msg.type === 'JOIN') {
        if (this.players.size >= MAX_PLAYERS) {
          ws.send(JSON.stringify({ type: 'ERROR', code: 'ROOM_FULL', message: 'Sala cheia (máximo 6 jogadores)' }))
          ws.close()
          return
        }
        if (msg.code !== this._code) {
          ws.send(JSON.stringify({ type: 'ERROR', code: 'INVALID_CODE', message: 'Código de sala inválido' }))
          ws.close()
          return
        }
        const name = String(msg.name ?? 'Jogador').trim().slice(0, 32) || 'Jogador'
        playerId = Math.random().toString(36).slice(2, 10)

        const player: Player = {
          id: playerId,
          name,
          avatarColor: generateAvatarColor(name),
          initials: generateInitials(name),
          status: 'connecting',
          latencyMs: null,
          ws,
          pingTimer: null,
        }
        this.players.set(playerId, player)

        ws.send(JSON.stringify({
          type: 'WELCOME',
          playerId,
          manifest: this.manifest,
          filePort: this._port,
          syncBufferMs: this._syncBufferMs,
          playbackState: this.playbackState,
        }))

        player.pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING', t1: Date.now() }))
          }
        }, 3000)

        this.onPlayersChanged(this.getPlayers())
        return
      }

      if (!playerId) return
      const player = this.players.get(playerId)
      if (!player) return

      if (msg.type === 'PONG') {
        const t1 = Number(msg.t1)
        const rtt = Date.now() - t1
        player.latencyMs = Math.max(0, Math.round(rtt / 2))
        this.onPlayersChanged(this.getPlayers())
        return
      }

      if (msg.type === 'SYNCING') {
        player.status = 'syncing'
        this.onPlayersChanged(this.getPlayers())
        return
      }

      if (msg.type === 'READY') {
        player.status = 'synced'
        if (this.playbackState) {
          ws.send(JSON.stringify({ type: 'STATE', ...this.playbackState }))
        }
        this.onPlayersChanged(this.getPlayers())
        return
      }
    })

    ws.on('close', () => {
      if (playerId) {
        const p = this.players.get(playerId)
        if (p?.pingTimer) clearInterval(p.pingTimer)
        this.players.delete(playerId)
        this.onPlayersChanged(this.getPlayers())
      }
    })

    ws.on('error', () => {
      // handled by 'close'
    })
  }

  private _serveFile(req: IncomingMessage, res: ServerResponse) {
    // GET /files/{trackId}
    const match = /^\/files\/(\d+)$/.exec(req.url ?? '')
    if (!match) { res.writeHead(404); res.end(); return }

    const trackId = parseInt(match[1])
    const entry = this.trackFiles.get(trackId)
    if (!entry) { res.writeHead(404); res.end(); return }

    const CONTENT_TYPES: Record<string, string> = {
      mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
      ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac',
    }
    const ct = CONTENT_TYPES[entry.format] ?? 'application/octet-stream'

    res.writeHead(200, {
      'Content-Type': ct,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
    })
    createReadStream(entry.filePath).on('error', () => { res.end() }).pipe(res)
  }
}
