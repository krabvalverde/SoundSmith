// src/renderer/src/screens/Player.tsx
import { useState, useEffect, useRef } from 'react'
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Repeat, Check, Music
} from 'lucide-react'
import { Infinity as InfinityIcon } from 'lucide-react'
import { getAudioEngine, LoopMode } from '../audio/AudioEngine'
import { useSettingsStore } from '../store/settings-store'
import type { CampaignWithCount, Track, Loop, RoomPlaybackState } from '../types/soundsmith'
import './Player.css'

function toRoomLoopMode(mode: LoopMode): RoomPlaybackState['loopMode'] {
  if (mode === 'none' || mode === null) return 'none'
  if (mode === 'full') return 'full'
  return { startMs: mode.startMs, endMs: mode.endMs, fadeInMs: mode.fadeInMs, fadeOutMs: mode.fadeOutMs }
}

function msToTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

function pathToFileUrl(p: string): string {
  if (p.startsWith('file://')) return p
  return 'file:///' + p.replace(/\\/g, '/').replace(/^\//, '')
}

function loopMatchesRegion(mode: LoopMode | null, loop: Loop): boolean {
  return typeof mode === 'object' && mode !== null
    && mode.startMs === loop.start_ms && mode.endMs === loop.end_ms
}

interface Props {
  onNavigateToCampanhas?: () => void
}

export function Player({ onNavigateToCampanhas }: Props) {
  const { settings } = useSettingsStore()

  const [campaigns, setCampaigns] = useState<CampaignWithCount[]>([])
  const [campaignId, setCampaignId] = useState<number | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [trackIdx, setTrackIdx] = useState(0)
  const [loops, setLoops] = useState<Loop[]>([])
  const [loading, setLoading] = useState(false)
  const [loopMode, setLoopMode] = useState<LoopMode>('none')

  const [audioState, setAudioState] = useState(() => getAudioEngine().getState())

  const tracksRef = useRef<Track[]>([])
  const trackIdxRef = useRef(0)
  const loadCounterRef = useRef(0)
  const roomActiveRef = useRef(false)

  function broadcastCmd(cmd: Record<string, unknown>) {
    if (!roomActiveRef.current) return
    window.soundsmith.room.broadcastCmd(cmd)
  }

  function updateRoomPlayback(overrides: Partial<RoomPlaybackState> = {}) {
    if (!roomActiveRef.current) return
    const s = getAudioEngine().getState()
    const state: RoomPlaybackState = {
      trackId: s.currentTrackId !== null ? parseInt(s.currentTrackId) : null,
      playing: s.playing,
      positionMs: s.positionMs,
      updatedAt: Date.now(),
      loopMode: toRoomLoopMode(s.activeLoop ?? 'none'),
      ...overrides,
    }
    window.soundsmith.room.updatePlayback(state)
  }

  useEffect(() => { tracksRef.current = tracks }, [tracks])
  useEffect(() => { trackIdxRef.current = trackIdx }, [trackIdx])

  // Sync room active state
  useEffect(() => {
    window.soundsmith.room.getState().then(s => { roomActiveRef.current = s.active })
    window.soundsmith.room.onStateChanged(s => { roomActiveRef.current = s.active })
    return () => { window.soundsmith.room.offStateChanged() }
  }, [])

  // RAF loop — polls engine state ~60fps
  useEffect(() => {
    let raf: number
    const tick = () => {
      setAudioState(getAudioEngine().getState())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Autoplay on track end (PLAY-RF-10/11)
  useEffect(() => {
    getAudioEngine().setOnTrackEnded(() => {
      setTrackIdx(prev => {
        const len = tracksRef.current.length
        const next = len > 0 ? (prev + 1) % len : 0
        const nextTrack = tracksRef.current[next]
        if (nextTrack) doLoadTrack(nextTrack, true)
        return next
      })
    })
    return () => getAudioEngine().setOnTrackEnded(null)
  }, [])

  // Initial load: campaigns + restore prefs
  useEffect(() => {
    window.soundsmith.campaigns.list().then(cs => {
      setCampaigns(cs)
      Promise.all([
        window.soundsmith.settings.get('player_campaign_id'),
        window.soundsmith.settings.get('player_volume'),
      ]).then(([savedCampaign, savedVol]) => {
        if (savedVol !== null) {
          const v = parseFloat(savedVol)
          if (!isNaN(v)) getAudioEngine().setVolume(v)
        }
        const id = savedCampaign ? parseInt(savedCampaign) : null
        const target = id && cs.find(c => c.id === id) ? id : cs[0]?.id ?? null
        if (target) doSelectCampaign(target, cs)
      })
    })
  }, [])

  async function doSelectCampaign(id: number, cs: CampaignWithCount[]) {
    const found = cs.find(c => c.id === id)
    if (!found) return
    setCampaignId(id)
    window.soundsmith.settings.set('player_campaign_id', String(id))
    const trackList = await window.soundsmith.campaigns.getTracks(id)
    setTracks(trackList)
    setTrackIdx(0)
    setLoopMode('none')
    if (trackList[0]) doLoadTrack(trackList[0], false)
  }

  async function doLoadTrack(track: Track, autoPlay: boolean) {
    const myLoad = ++loadCounterRef.current
    setLoading(true)
    try {
      const resp = await fetch(pathToFileUrl(track.file_path))
      const buf = await resp.arrayBuffer()
      if (loadCounterRef.current !== myLoad) return
      await getAudioEngine().loadTrack(String(track.id), buf)

      setLoopMode('none')
      getAudioEngine().play({ loop: 'none' })
      if (!autoPlay) getAudioEngine().pause()

      broadcastCmd({ cmd: 'LOAD_TRACK', trackId: track.id })
      if (autoPlay) {
        broadcastCmd({ cmd: 'PLAY', positionMs: 0, loopMode: 'none' })
        updateRoomPlayback({ trackId: track.id, playing: true, positionMs: 0, loopMode: 'none' })
      } else {
        updateRoomPlayback({ trackId: track.id, playing: false, positionMs: 0, loopMode: 'none' })
      }

      const trackLoops = await window.soundsmith.loops.getByTrack(track.id)
      if (loadCounterRef.current !== myLoad) return
      setLoops(trackLoops)

      if (!track.duration_ms) {
        const dur = getAudioEngine().getState().durationMs
        if (dur > 0) window.soundsmith.tracks.updateDuration(track.id, dur)
      }
    } catch (err) {
      console.error('Player: load error', err)
    } finally {
      if (loadCounterRef.current === myLoad) setLoading(false)
    }
  }

  function handleCampaignChange(id: number) {
    doSelectCampaign(id, campaigns)
  }

  function handleTrackClick(idx: number) {
    const track = tracks[idx]
    if (!track) return
    setTrackIdx(idx)
    setLoopMode('none')
    doLoadTrack(track, true)
  }

  function handlePlayPause() {
    const engine = getAudioEngine()
    const state = engine.getState()
    if (state.playing) {
      engine.pause()
      broadcastCmd({ cmd: 'PAUSE' })
      updateRoomPlayback({ playing: false })
    } else {
      const track = tracks[trackIdx]
      if (!track) return
      if (state.currentTrackId === String(track.id)) {
        engine.play({ loop: loopMode, startMs: state.positionMs })
        broadcastCmd({ cmd: 'PLAY', positionMs: state.positionMs, loopMode: toRoomLoopMode(loopMode) })
        updateRoomPlayback({ playing: true, positionMs: state.positionMs, loopMode: toRoomLoopMode(loopMode) })
      } else {
        doLoadTrack(track, true)
      }
    }
  }

  function selectLoop(mode: LoopMode) {
    setLoopMode(mode)
    const state = getAudioEngine().getState()
    if (state.playing) {
      const crossfade = settings['crossfade_loops'] === 'true'
      getAudioEngine().scheduleLoopChange(mode, { crossfade })
    }
    const rm = toRoomLoopMode(mode)
    broadcastCmd({ cmd: 'SET_LOOP', loopMode: rm })
    updateRoomPlayback({ loopMode: rm })
  }

  function navLoop(dir: 1 | -1) {
    if (!loops.length) return
    const currentIdx = loops.findIndex(l => loopMatchesRegion(displayActive, l))
    const newIdx = (currentIdx + dir + loops.length) % loops.length
    const l = loops[newIdx]
    if (l) selectLoop({ startMs: l.start_ms, endMs: l.end_ms, fadeInMs: l.fade_in_ms, fadeOutMs: l.fade_out_ms })
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value) / 100
    getAudioEngine().setVolume(v)
    window.soundsmith.settings.set('player_volume', String(v))
  }

  function handleProgressPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    function doSeek(x: number) {
      const rect = el.getBoundingClientRect()
      const frac = Math.max(0, Math.min(1, (x - rect.left) / rect.width))
      const ms = frac * audioState.durationMs
      getAudioEngine().seek(ms)
      broadcastCmd({ cmd: 'SEEK', positionMs: Math.round(ms) })
      updateRoomPlayback({ positionMs: Math.round(ms) })
    }
    doSeek(e.clientX)
    function onMove(ev: PointerEvent) { doSeek(ev.clientX) }
    function onUp() {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
  }

  // Derived display state
  const campaign = campaigns.find(c => c.id === campaignId) ?? null
  const currentTrack = tracks[trackIdx] ?? null
  const displayActive: LoopMode = audioState.playing
    ? (audioState.activeLoop ?? 'none')
    : loopMode
  const pendingLoop = audioState.pendingLoop
  const volPct = Math.round(audioState.volume * 100)
  const progress = audioState.durationMs > 0 ? audioState.positionMs / audioState.durationMs : 0

  function badgeText(): string {
    if (typeof displayActive === 'object') {
      const named = loops.find(l => loopMatchesRegion(displayActive, l))
      return named ? `LOOP: ${named.name}` : 'LOOP ATIVO'
    }
    return displayActive === 'full' ? 'FAIXA EM LOOP' : 'FAIXA COMPLETA'
  }

  const isNoneActive = displayActive === 'none' && pendingLoop !== 'none'
  const isNonePending = pendingLoop === 'none'
  const isFullActive = displayActive === 'full' && !loopMatchesRegion(pendingLoop, { start_ms: 0, end_ms: 0 } as Loop) && pendingLoop !== 'full'
  const isFullPending = pendingLoop === 'full'

  // Suppress TS unused warning for currentTrack — used in play/pause logic above
  void currentTrack

  return (
    <div className="player-screen">

      {/* ── Left: Now Playing ──────────────────────────── */}
      <div className="player-left">

        <h1 className="screen-title">Player</h1>

        <div className="now-playing-card">
          {/* Cover */}
          <div className="cover-area">
            <div className={`cover-halo${audioState.playing ? ' cover-halo--active' : ''}`} aria-hidden="true" />
            {campaign ? (
              <div
                className="player-cover"
                style={{ '--cover-base': campaign.color_base, '--cover-glow': campaign.color_glow } as React.CSSProperties}
              >
                <span className="player-cover-initials">{campaign.initials}</span>
              </div>
            ) : (
              <div className="player-cover player-cover--empty">
                <Music size={48} />
              </div>
            )}
            <span className={`loop-badge${audioState.playing ? ' loop-badge--playing' : ''}`}>
              {badgeText()}
            </span>
          </div>

          {/* Track info */}
          <div className="track-info">
            <p className="track-info-title">
              {loading ? 'Carregando…' : (tracks[trackIdx]?.title ?? '—')}
            </p>
            <p className="track-info-campaign">{campaign?.name ?? 'Nenhuma campanha'}</p>
          </div>

          {/* EQ animation */}
          <div
            className={`eq-bars${audioState.playing ? ' eq-bars--playing' : ''}`}
            aria-hidden="true"
          >
            <span /><span /><span /><span /><span />
          </div>
        </div>

        {/* Progress bar (PLAY-RF-02) */}
        <div className="progress-section">
          <div
            className="progress-track"
            onPointerDown={handleProgressPointerDown}
            style={{ '--progress': progress } as React.CSSProperties}
          >
            <div className={`progress-fill${audioState.playing ? ' progress-fill--playing' : ''}`} />
            <div className="progress-thumb" />
          </div>
          <div className="progress-times">
            <span>{msToTime(audioState.positionMs)}</span>
            <span>{msToTime(audioState.durationMs)}</span>
          </div>
        </div>

        {/* Transport (PLAY-RF-01/07) */}
        <div className="transport-row">
          <button
            className="btn btn-ghost transport-btn"
            onClick={() => navLoop(-1)}
            disabled={!loops.length}
            title="Loop anterior"
          >
            <SkipBack size={18} />
          </button>
          <button
            className="btn btn-primary transport-btn transport-btn--play"
            onClick={handlePlayPause}
          >
            {audioState.playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button
            className="btn btn-ghost transport-btn"
            onClick={() => navLoop(1)}
            disabled={!loops.length}
            title="Próximo loop"
          >
            <SkipForward size={18} />
          </button>
        </div>

        {/* Volume (PLAY-RF-03) */}
        <div className="volume-row">
          {volPct === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          <input
            type="range" min={0} max={100} value={volPct}
            onChange={handleVolumeChange}
            className="volume-slider"
            aria-label="Volume"
          />
          <span className="volume-value">{volPct}</span>
        </div>

        {/* Loop chooser (PLAY-RF-06/08) */}
        <div className="loop-chooser">
          <span className="section-label">ESCOLHER LOOP</span>
          <div className="loop-grid">

            <button
              className={`btn loop-btn${isNoneActive ? ' loop-btn--active' : ''}${isNonePending ? ' loop-btn--pending' : ''}`}
              onClick={() => selectLoop('none')}
            >
              <InfinityIcon size={14} />
              <span className="loop-btn-label">Sem Loop</span>
              {isNoneActive && <Check size={12} className="loop-btn-check" />}
              {isNonePending && <span className="loop-btn-pulse" />}
            </button>

            <button
              className={`btn loop-btn${isFullActive ? ' loop-btn--active' : ''}${isFullPending ? ' loop-btn--pending' : ''}`}
              onClick={() => selectLoop('full')}
            >
              <Repeat size={14} />
              <span className="loop-btn-label">Faixa em Loop</span>
              {isFullActive && <Check size={12} className="loop-btn-check" />}
              {isFullPending && <span className="loop-btn-pulse" />}
            </button>

            {loops.map(loop => {
              const active = loopMatchesRegion(displayActive, loop) && !loopMatchesRegion(pendingLoop, loop)
              const pending = loopMatchesRegion(pendingLoop, loop)
              return (
                <button
                  key={loop.id}
                  className={`btn loop-btn loop-btn--named${active ? ' loop-btn--active' : ''}${pending ? ' loop-btn--pending' : ''}`}
                  style={{ '--loop-color': loop.color } as React.CSSProperties}
                  onClick={() => selectLoop({
                    startMs: loop.start_ms, endMs: loop.end_ms,
                    fadeInMs: loop.fade_in_ms, fadeOutMs: loop.fade_out_ms,
                  })}
                >
                  <span className="loop-btn-dot" />
                  <span className="loop-btn-label">{loop.name}</span>
                  <span className="loop-btn-range">{msToTime(loop.start_ms)}–{msToTime(loop.end_ms)}</span>
                  {active && <Check size={12} className="loop-btn-check" />}
                  {pending && <span className="loop-btn-pulse" />}
                </button>
              )
            })}
          </div>

          {pendingLoop !== null && (
            <p className="loop-pending-hint">Aguardando fim da região atual…</p>
          )}
        </div>
      </div>

      {/* ── Right: Campaign + Queue ────────────────────── */}
      <div className="player-right">

        <div className="campaign-select-section">
          <span className="section-label">CAMPANHA</span>
          <select
            className="input"
            value={campaignId ?? ''}
            onChange={e => {
              const v = parseInt(e.target.value)
              if (!isNaN(v)) handleCampaignChange(v)
            }}
          >
            {campaigns.length === 0 && <option value="">Nenhuma campanha</option>}
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.track_count} faixa{c.track_count !== 1 ? 's' : ''})
              </option>
            ))}
          </select>
        </div>

        <div className="track-queue">
          <span className="section-label">FAIXAS DA CAMPANHA</span>
          {tracks.length === 0 ? (
            <div className="queue-empty-state">
              <Music size={28} className="queue-empty-icon" />
              <p className="queue-empty-text">Esta campanha ainda não tem faixas.</p>
              {onNavigateToCampanhas && (
                <button className="btn btn-secondary btn-sm" onClick={onNavigateToCampanhas}>
                  Adicionar faixas
                </button>
              )}
            </div>
          ) : (
            <div className="queue-list">
              {tracks.map((track, idx) => {
                const isNowPlaying =
                  idx === trackIdx && audioState.currentTrackId === String(track.id)
                return (
                  <div
                    key={track.id}
                    className={`queue-item${isNowPlaying ? ' queue-item--active' : ''}`}
                    onClick={() => handleTrackClick(idx)}
                    tabIndex={0}
                    role="button"
                    aria-current={isNowPlaying ? 'true' : undefined}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTrackClick(idx) }
                    }}
                  >
                    <span className="queue-num">{idx + 1}</span>
                    <div className="queue-info">
                      <span className="queue-title">{track.title}</span>
                      <span className="queue-status">
                        {isNowPlaying ? 'Tocando agora' : 'Na fila'}
                      </span>
                    </div>
                    {track.duration_ms !== null && (
                      <span className="queue-dur">{msToTime(track.duration_ms)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
