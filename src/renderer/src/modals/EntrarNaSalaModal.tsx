// src/renderer/src/modals/EntrarNaSalaModal.tsx
import { useState, useRef, useEffect } from 'react'
import { X, Check, Loader, AlertCircle, Volume2, VolumeX } from 'lucide-react'
import { getAudioEngine, LoopMode } from '../audio/AudioEngine'
import type { CampaignManifest, TrackManifestEntry, LoopManifestEntry, RoomPlaybackState } from '../types/soundsmith'
import './EntrarNaSalaModal.css'

interface Props {
  onClose: () => void
}

type ModalPhase = 'form' | 'connecting' | 'session'
type StepStatus = 'pending' | 'progress' | 'done' | 'error'

interface DownloadProgress {
  current: number
  total: number
}

// Client-side playback state (mirrored from host via WebSocket messages)
interface ClientState {
  trackId: number | null
  trackTitle: string
  campaignName: string
  playing: boolean
  positionMs: number
  durationMs: number
  updatedAt: number  // host time
  activeLoopName: string | null
}

function msToTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

function modeFromManifest(
  loopMode: RoomPlaybackState['loopMode'],
  _track: TrackManifestEntry | undefined
): LoopMode {
  if (!loopMode || loopMode === 'none') return 'none'
  if (loopMode === 'full') return 'full'
  return { startMs: loopMode.startMs, endMs: loopMode.endMs, fadeInMs: loopMode.fadeInMs, fadeOutMs: loopMode.fadeOutMs }
}

function loopNameForMode(
  loopMode: RoomPlaybackState['loopMode'],
  track: TrackManifestEntry | undefined
): string | null {
  if (!loopMode || loopMode === 'none') return null
  if (loopMode === 'full') return 'FAIXA EM LOOP'
  if (!track) return 'LOOP ATIVO'
  const l = track.loops.find(
    (lp: LoopManifestEntry) => lp.startMs === loopMode.startMs && lp.endMs === loopMode.endMs
  )
  return l ? `LOOP: ${l.name}` : 'LOOP ATIVO'
}

export function EntrarNaSalaModal({ onClose }: Props) {
  // Form state
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [hostIp, setHostIp] = useState('')
  const [playerName, setPlayerName] = useState('')
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  // Connection state
  const [phase, setPhase] = useState<ModalPhase>('form')
  const [stepConnect, setStepConnect] = useState<StepStatus>('pending')
  const [stepDownload, setStepDownload] = useState<StepStatus>('pending')
  const [stepSync, setStepSync] = useState<StepStatus>('pending')
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({ current: 0, total: 0 })
  const [connectError, setConnectError] = useState('')

  // Session state
  const [manifest, setManifest] = useState<CampaignManifest | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const [clientState, setClientState] = useState<ClientState>({
    trackId: null, trackTitle: '—', campaignName: '—',
    playing: false, positionMs: 0, durationMs: 0, updatedAt: 0, activeLoopName: null,
  })
  const [volume, setVolume] = useState(70)
  const [audioState, setAudioState] = useState(() => getAudioEngine().getState())

  // Refs for stale-closure safety
  const wsRef = useRef<WebSocket | null>(null)
  const clockOffsetRef = useRef(0)   // serverTime - clientTime (rough)
  const syncBufferMsRef = useRef(120)
  const audioBufsRef = useRef<Map<number, ArrayBuffer>>(new Map())
  const manifestRef = useRef<CampaignManifest | null>(null)

  // RAF for position display in session mode
  useEffect(() => {
    if (phase !== 'session') return
    let raf: number
    const tick = () => {
      setAudioState(getAudioEngine().getState())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // Apply volume
  useEffect(() => {
    getAudioEngine().setVolume(volume / 100)
  }, [volume])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close()
      wsRef.current = null
      getAudioEngine().stop()
    }
  }, [])

  const codeStr = code.join('')
  const formValid = codeStr.length === 6 && hostIp.trim().length > 0 && playerName.trim().length > 0

  // ── Form handlers ──────────────────────────────────────────────

  function handleCodeInput(idx: number, val: string) {
    const ch = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!ch) {
      const next = [...code]
      next[idx] = ''
      setCode(next)
      return
    }
    // Paste: distribute characters
    if (ch.length > 1) {
      const chars = ch.split('').slice(0, 6 - idx)
      const next = [...code]
      chars.forEach((c, i) => { next[idx + i] = c })
      setCode(next)
      const focusIdx = Math.min(idx + chars.length, 5)
      codeRefs.current[focusIdx]?.focus()
      return
    }
    const next = [...code]
    next[idx] = ch
    setCode(next)
    if (idx < 5) codeRefs.current[idx + 1]?.focus()
  }

  function handleCodeKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && idx > 0) codeRefs.current[idx - 1]?.focus()
    if (e.key === 'ArrowRight' && idx < 5) codeRefs.current[idx + 1]?.focus()
  }

  // ── Connection flow ────────────────────────────────────────────

  function handleConnect() {
    const ip = hostIp.trim()
    const name = playerName.trim()
    const code6 = codeStr
    if (!formValid) return

    setPhase('connecting')
    setRoomCode(code6)
    setConnectError('')
    setStepConnect('progress')
    setStepDownload('pending')
    setStepSync('pending')

    const portGuess = 7842  // player doesn't know port; uses default
    // Actually host sends port... but we need to connect to the WS first
    // Use default port 7842 (configured in settings; player needs to know it)
    // For now: hard-code default. TODO: let player specify port
    const ws = new WebSocket(`ws://${ip}:${portGuess}`)
    wsRef.current = ws

    ws.onopen = () => {
      setStepConnect('done')
      ws.send(JSON.stringify({ type: 'JOIN', code: code6, name, have: [] }))
    }

    ws.onerror = () => {
      setStepConnect('error')
      setConnectError(`Não foi possível conectar a ws://${ip}:${portGuess}`)
    }

    ws.onclose = (e) => {
      if (phase !== 'session') {
        setStepConnect('error')
        setConnectError(e.reason || 'Conexão encerrada pelo host.')
        setPhase('form')
      }
    }

    ws.onmessage = async (e) => {
      let msg: Record<string, unknown>
      try { msg = JSON.parse(e.data as string) as Record<string, unknown> } catch { return }

      if (msg.type === 'ERROR') {
        setConnectError(String(msg.message))
        setStepConnect('error')
        setPhase('form')
        ws.close()
        return
      }

      if (msg.type === 'WELCOME') {
        const m = msg.manifest as CampaignManifest
        const filePort = msg.filePort as number
        const syncBuf = (msg.syncBufferMs as number) ?? 120
        syncBufferMsRef.current = syncBuf
        manifestRef.current = m
        setManifest(m)

        // Notify server we're syncing
        ws.send(JSON.stringify({ type: 'SYNCING' }))
        setStepDownload('progress')

        // Download all tracks
        await downloadAllTracks(m, ip, filePort)

        setStepDownload('done')
        setStepSync('progress')

        // Apply initial playback state if provided
        const ps = msg.playbackState as RoomPlaybackState | null
        if (ps) applyState(ps, m)

        // Ready
        ws.send(JSON.stringify({ type: 'READY' }))
        setStepSync('done')

        setTimeout(() => setPhase('session'), 400)
        return
      }

      if (msg.type === 'PING') {
        const t1 = Number(msg.t1)
        const now = Date.now()
        clockOffsetRef.current = t1 - now  // rough: offset = serverTime - clientTime
        ws.send(JSON.stringify({ type: 'PONG', t1, t2: now }))
        return
      }

      if (msg.type === 'CMD') {
        const atHostTime = Number(msg.atHostTime)
        const offset = clockOffsetRef.current
        const delay = Math.max(0, atHostTime - offset - Date.now())
        setTimeout(() => executeCommand(msg), delay)
        return
      }

      if (msg.type === 'STATE') {
        const ps = msg as unknown as RoomPlaybackState
        if (manifestRef.current) applyState(ps, manifestRef.current)
        return
      }

      if (msg.type === 'END_SESSION') {
        getAudioEngine().stop()
        wsRef.current = null
        setPhase('form')
        setCode(['', '', '', '', '', ''])
        return
      }
    }
  }

  async function downloadAllTracks(m: CampaignManifest, ip: string, port: number) {
    const tracks = m.tracks
    for (let i = 0; i < tracks.length; i++) {
      setDownloadProgress({ current: i, total: tracks.length })
      try {
        const resp = await fetch(`http://${ip}:${port}/files/${tracks[i].id}`)
        const buf = await resp.arrayBuffer()
        audioBufsRef.current.set(tracks[i].id, buf)
      } catch {
        // Skip on error — play will fail gracefully later
      }
    }
    setDownloadProgress({ current: tracks.length, total: tracks.length })
  }

  function applyState(ps: RoomPlaybackState, m: CampaignManifest) {
    const track = ps.trackId !== null ? m.tracks.find(t => t.id === ps.trackId) : undefined
    setClientState({
      trackId: ps.trackId,
      trackTitle: track?.title ?? '—',
      campaignName: m.name,
      playing: ps.playing,
      positionMs: ps.positionMs,
      durationMs: track?.durationMs ?? 0,
      updatedAt: ps.updatedAt,
      activeLoopName: loopNameForMode(ps.loopMode, track),
    })

    if (ps.trackId !== null) {
      const buf = audioBufsRef.current.get(ps.trackId)
      if (buf) {
        const loopMode = modeFromManifest(ps.loopMode, track)
        // Estimate current position
        const elapsed = Date.now() - (ps.updatedAt - clockOffsetRef.current)
        const seekMs = ps.playing ? ps.positionMs + Math.max(0, elapsed) : ps.positionMs
        getAudioEngine().loadTrack(String(ps.trackId), buf).then(() => {
          if (ps.playing) {
            getAudioEngine().play({ loop: loopMode, startMs: seekMs })
          }
        })
      }
    }
  }

  function executeCommand(msg: Record<string, unknown>) {
    const cmd = String(msg.cmd)
    const m = manifestRef.current

    if (cmd === 'LOAD_TRACK') {
      const trackId = Number(msg.trackId)
      const buf = audioBufsRef.current.get(trackId)
      const track = m?.tracks.find(t => t.id === trackId)
      if (buf && m) {
        getAudioEngine().loadTrack(String(trackId), buf).then(() => {
          setClientState(prev => ({
            ...prev,
            trackId,
            trackTitle: track?.title ?? '—',
            durationMs: track?.durationMs ?? 0,
            positionMs: 0,
            playing: false,
            activeLoopName: null,
          }))
        })
      }
    }

    if (cmd === 'PLAY') {
      const loopMode = msg.loopMode as RoomPlaybackState['loopMode']
      const positionMs = Number(msg.positionMs ?? 0)
      const track = clientState.trackId !== null && m
        ? m.tracks.find(t => t.id === clientState.trackId) : undefined
      const mode = modeFromManifest(loopMode, track)
      getAudioEngine().play({ loop: mode, startMs: positionMs })
      setClientState(prev => ({
        ...prev,
        playing: true,
        positionMs,
        updatedAt: Date.now() + clockOffsetRef.current,
        activeLoopName: loopNameForMode(loopMode, track),
      }))
    }

    if (cmd === 'PAUSE') {
      getAudioEngine().pause()
      setClientState(prev => ({ ...prev, playing: false, positionMs: getAudioEngine().getState().positionMs }))
    }

    if (cmd === 'SEEK') {
      const posMs = Number(msg.positionMs)
      getAudioEngine().seek(posMs)
      setClientState(prev => ({ ...prev, positionMs: posMs }))
    }

    if (cmd === 'SET_LOOP') {
      const loopMode = msg.loopMode as RoomPlaybackState['loopMode']
      const track = clientState.trackId !== null && m
        ? m.tracks.find(t => t.id === clientState.trackId) : undefined
      const mode = modeFromManifest(loopMode, track)
      getAudioEngine().scheduleLoopChange(mode)
      setClientState(prev => ({
        ...prev,
        activeLoopName: loopNameForMode(loopMode, track),
      }))
    }

    if (cmd === 'NEXT_TRACK' || cmd === 'LOAD_TRACK') {
      // handled by LOAD_TRACK above
    }
  }

  function handleLeave() {
    getAudioEngine().stop()
    wsRef.current?.close()
    wsRef.current = null
    setPhase('form')
    setManifest(null)
  }

  // ── Render ────────────────────────────────────────────────────

  if (phase === 'session' && manifest) {
    const progress = clientState.durationMs > 0 ? audioState.positionMs / clientState.durationMs : 0
    const volPct = volume
    const loopBadge = clientState.activeLoopName ?? 'FAIXA COMPLETA'

    return (
      <div className="session-overlay">
        <header className="session-header">
          <div className="session-header-left">
            <span className="session-role">EM SESSÃO · JOGADOR</span>
          </div>
          <div className="session-header-center">
            <span className={`session-live-dot${audioState.playing ? ' session-live-dot--hot' : ''}`} />
            <span className={`session-live-text${audioState.playing ? ' session-live-text--hot' : ''}`}>AO VIVO</span>
            <span className="session-code">Sala {roomCode}</span>
          </div>
          <button className="btn btn-ghost" onClick={handleLeave}>
            <X size={14} /> Sair
          </button>
        </header>

        <div className="session-body">
          <div className="session-now-playing">
            {/* Cover */}
            <div
              className="session-cover"
              style={{
                '--c-base': manifest.colorBase,
                '--c-glow': manifest.colorGlow,
              } as React.CSSProperties}
            >
              <span className="session-cover-initials">{manifest.initials}</span>
            </div>

            {/* Info */}
            <div className="session-info">
              <span className={`session-loop-badge${audioState.playing ? ' session-loop-badge--active' : ''}`}>
                {loopBadge}
              </span>
              <p className="session-track-title">{clientState.trackTitle}</p>
              <p className="session-campaign-name">{manifest.name}</p>
              <div className={`eq-bars${audioState.playing ? ' eq-bars--playing' : ''}`} aria-hidden="true">
                <span /><span /><span /><span /><span />
              </div>
            </div>
          </div>

          {/* Progress (read-only) */}
          <div className="session-progress-section">
            <div
              className="session-progress-track"
              style={{ '--progress': progress } as React.CSSProperties}
            >
              <div className="progress-fill" />
            </div>
            <div className="session-times">
              <span>{msToTime(audioState.positionMs)}</span>
              <span>{msToTime(clientState.durationMs)}</span>
            </div>
            <p className="session-readonly-hint">somente leitura</p>
          </div>

          {/* Volume */}
          <div className="session-volume">
            {volPct === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <input
              type="range" min={0} max={100} value={volPct}
              onChange={e => setVolume(parseInt(e.target.value))}
              className="volume-slider"
              aria-label="Volume"
            />
            <span className="volume-value">{volPct}</span>
            <span className="session-volume-hint">VOLUME (somente você)</span>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'connecting') {
    const pct = downloadProgress.total > 0
      ? Math.round((downloadProgress.current / downloadProgress.total) * 100)
      : 0

    return (
      <div className="modal-backdrop">
        <div className="modal entrar-modal">
          <div className="modal-header">
            <h2 className="modal-title">Entrando na sala <span className="mono">{roomCode}</span></h2>
          </div>

          <div className="connect-steps">
            <Step status={stepConnect} label="Conectado ao host" />
            <Step
              status={stepDownload}
              label="Baixando a trilha"
              extra={downloadProgress.total > 0 ? (
                <div className="download-progress">
                  <div className="download-bar">
                    <div className="download-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="download-info">
                    {downloadProgress.current} / {downloadProgress.total} faixas · {pct}%
                  </span>
                </div>
              ) : undefined}
            />
            <Step status={stepSync} label="Sincronizando relógio" />
          </div>

          {manifest && (
            <div className="connect-campaign">
              <div
                className="cc-cover"
                style={{ '--c-base': manifest.colorBase, '--c-glow': manifest.colorGlow } as React.CSSProperties}
              >
                <span>{manifest.initials}</span>
              </div>
              <div className="cc-info">
                <span className="cc-name">{manifest.name}</span>
                <span className="cc-count">{manifest.tracks.length} faixas</span>
              </div>
            </div>
          )}

          {connectError && (
            <p className="connect-error">
              <AlertCircle size={13} /> {connectError}
            </p>
          )}

          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => { wsRef.current?.close(); setPhase('form') }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Phase: form
  return (
    <div className="modal-backdrop">
      <div className="modal entrar-modal">
        <div className="modal-header">
          <div>
            <div className="modal-badge">SESSÃO MULTIPLAYER</div>
            <h2 className="modal-title">Entrar em Sala</h2>
            <p className="modal-subtitle">Conecte-se à mesa do seu Mestre.</p>
          </div>
          <button className="btn btn-ghost modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {connectError && (
          <p className="connect-error"><AlertCircle size={13} /> {connectError}</p>
        )}

        <div className="form-section">
          <label className="form-label">CÓDIGO DA SALA</label>
          <div className="code-inputs">
            {code.map((ch, i) => (
              <input
                key={i}
                ref={el => { codeRefs.current[i] = el }}
                className="code-box"
                type="text"
                maxLength={6}
                value={ch}
                onChange={e => handleCodeInput(i, e.target.value)}
                onKeyDown={e => handleCodeKeyDown(i, e)}
                onFocus={e => e.target.select()}
                autoCapitalize="characters"
                spellCheck={false}
              />
            ))}
          </div>
        </div>

        <div className="form-section">
          <label className="form-label" htmlFor="host-ip">IP DA VPN DO HOST</label>
          <input
            id="host-ip"
            className="input"
            type="text"
            placeholder="10.84.0.1"
            value={hostIp}
            onChange={e => setHostIp(e.target.value)}
          />
        </div>

        <div className="form-section">
          <label className="form-label" htmlFor="player-name">SEU NOME</label>
          <input
            id="player-name"
            className="input"
            type="text"
            placeholder="Thalíndra"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && formValid) handleConnect() }}
          />
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={!formValid}
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  )
}

function Step({ status, label, extra }: { status: StepStatus; label: string; extra?: React.ReactNode }) {
  return (
    <div className={`step step--${status}`}>
      <span className="step-icon">
        {status === 'done' && <Check size={14} />}
        {status === 'progress' && <Loader size={14} className="spin" />}
        {status === 'error' && <AlertCircle size={14} />}
        {status === 'pending' && <span className="step-circle" />}
      </span>
      <div className="step-content">
        <span className="step-label">{label}</span>
        {extra && <div className="step-extra">{extra}</div>}
      </div>
    </div>
  )
}
