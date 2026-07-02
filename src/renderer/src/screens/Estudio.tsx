// src/renderer/src/screens/Estudio.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, Square, Volume2, Plus, Save, ZoomIn, ZoomOut, GripVertical, Trash2, Eye, Pencil } from 'lucide-react'
import { CampaignWithCount, Track, LoopInput } from '../types/soundsmith'
import { getAudioEngine } from '../audio/AudioEngine'
import './Estudio.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const LOOP_COLORS = ['#2dd4bf', '#60a5fa', '#f87171', '#a78bfa', '#e879f9', '#fbbf24']
const CANVAS_H = 120
const MIN_LOOP_MS = 200
const NUM_PEAKS = 1000

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditableLoop {
  key: string
  id?: number
  name: string
  color: string
  start_ms: number
  end_ms: number
  fade_in_ms: number
  fade_out_ms: number
  notes: string
  order_index: number
  created_at?: string
}

interface DragHandle {
  key: string
  side: 'start' | 'end'
  startClientX: number
  originalMs: number
  innerWidth: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msToDisplay(ms: number): string {
  const totalS = ms / 1000
  const m = Math.floor(totalS / 60)
  const s = totalS % 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

function parseTimeInput(str: string): number | null {
  const s = str.trim()
  const mss = s.match(/^(\d+):(\d+(?:\.\d*)?)$/)
  if (mss) {
    const mins = parseInt(mss[1], 10)
    const secs = parseFloat(mss[2])
    if (!isNaN(secs)) return Math.round((mins * 60 + secs) * 1000)
  }
  const raw = parseFloat(s)
  if (!isNaN(raw)) return Math.round(raw * 1000)
  return null
}

function pathToFileUrl(p: string): string {
  const n = p.replace(/\\/g, '/')
  return n.match(/^[a-zA-Z]:/) ? `file:///${n}` : `file://${n}`
}

function calcPeaks(buf: AudioBuffer): number[] {
  const data = buf.getChannelData(0)
  const step = Math.floor(data.length / NUM_PEAKS)
  return Array.from({ length: NUM_PEAKS }, (_, i) => {
    let max = 0
    const from = i * step
    const to = Math.min(from + step, data.length)
    for (let j = from; j < to; j++) {
      const v = Math.abs(data[j])
      if (v > max) max = v
    }
    return max
  })
}

function hasOverlap(loops: EditableLoop[], start: number, end: number, excludeKey: string): boolean {
  return loops
    .filter((l) => l.key !== excludeKey)
    .some((l) => start < l.end_ms && end > l.start_ms)
}

function nextLoopColor(loops: EditableLoop[]): string {
  return LOOP_COLORS[loops.length % LOOP_COLORS.length]
}

// ─── TimeInput sub-component ──────────────────────────────────────────────────

function TimeInput({
  value, onChange, max,
}: {
  value: number
  onChange: (ms: number) => void
  max?: number
}) {
  const [local, setLocal] = useState(msToDisplay(value))
  const [err, setErr] = useState(false)

  useEffect(() => {
    if (!err) setLocal(msToDisplay(value))
  }, [value, err])

  function commit() {
    const parsed = parseTimeInput(local)
    const valid =
      parsed !== null &&
      parsed >= 0 &&
      (max === undefined || parsed <= max)
    if (!valid) {
      setErr(true)
      setLocal(msToDisplay(value))
      setTimeout(() => setErr(false), 300)
      return
    }
    setErr(false)
    if (parsed !== value) onChange(parsed)
  }

  return (
    <input
      className={`input time-input${err ? ' input--error' : ''}`}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Estudio() {
  // Selection
  const [campaigns, setCampaigns] = useState<CampaignWithCount[]>([])
  const [campaignId, setCampaignId] = useState<number | null>(null)
  const [trackList, setTrackList] = useState<Track[]>([])
  const [trackId, setTrackId] = useState<number | null>(null)
  const [track, setTrack] = useState<Track | null>(null)

  // Loops (local edit state)
  const [loops, setLoops] = useState<EditableLoop[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null)

  // Audio
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [durationMs, setDurationMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [volume, setVolume] = useState(1)

  // Zoom
  const [zoom, setZoom] = useState(1)

  // Waveform drag (loop handles)
  const [dragHandle, setDragHandle] = useState<DragHandle | null>(null)
  const dragHandleRef = useRef<DragHandle | null>(null)
  useEffect(() => { dragHandleRef.current = dragHandle }, [dragHandle])
  const loopsRef = useRef<EditableLoop[]>([])
  useEffect(() => { loopsRef.current = loops }, [loops])

  // Loop list reorder drag
  const [dragReorderKey, setDragReorderKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  // Track rename
  const [renamingTrack, setRenamingTrack] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  // Refs
  const waveformAreaRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  // ─── Canvas draw ──────────────────────────────────────────────────────────

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)
    const surface3 = getComputedStyle(document.documentElement).getPropertyValue('--color-surface-3').trim()
    ctx.fillStyle = surface3 || '#282026'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(0, h / 2, w, 1)

    if (peaks) {
      const barW = Math.max(1, w / peaks.length)
      const mid = h / 2
      ctx.fillStyle = '#818cf8'
      for (let i = 0; i < peaks.length; i++) {
        const x = (i / peaks.length) * w
        const barH = Math.max(1, peaks[i] * mid * 0.88)
        ctx.fillRect(x, mid - barH, barW - 0.2, barH * 2)
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(0, h / 2 - 1, w, 2)
    }
  }, [peaks])

  // Resize observer keeps canvas pixel dimensions in sync with CSS size
  useEffect(() => {
    const area = waveformAreaRef.current
    const canvas = canvasRef.current
    if (!area || !canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width = area.clientWidth
      canvas.height = CANVAS_H
      drawCanvas()
    })
    ro.observe(area)
    return () => ro.disconnect()
  }, [drawCanvas])

  useEffect(() => { drawCanvas() }, [drawCanvas])

  // ─── RAF — playhead ───────────────────────────────────────────────────────

  useEffect(() => {
    function tick() {
      const s = getAudioEngine().getState()
      setPlaying(s.playing)
      setPositionMs(s.positionMs)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  // ─── Load campaigns ───────────────────────────────────────────────────────

  useEffect(() => {
    window.soundsmith.campaigns.list().then(setCampaigns)
  }, [])

  // ─── Load tracks when campaign changes ────────────────────────────────────

  useEffect(() => {
    if (campaignId === null) { setTrackList([]); setTrackId(null); return }
    window.soundsmith.campaigns.getTracks(campaignId).then((ts) => {
      setTrackList(ts)
      setTrackId(ts[0]?.id ?? null)
    })
  }, [campaignId])

  // ─── Load audio + peaks + loops when track changes ────────────────────────

  useEffect(() => {
    if (!trackId) {
      setTrack(null)
      setLoops([])
      setSelectedKey(null)
      setDirty(false)
      setPeaks(null)
      setDurationMs(0)
      getAudioEngine().stop()
      return
    }
    const found = trackList.find((t) => t.id === trackId) ?? null
    setTrack(found)
    setSelectedKey(null)
    setDirty(false)
    setSaveError(null)
    if (!found?.file_path) return

    setAudioLoading(true)

    Promise.all([
      window.soundsmith.tracks.getWaveformPeaks(trackId),
      window.soundsmith.loops.getByTrack(trackId),
      fetch(pathToFileUrl(found.file_path)).then((r) => r.arrayBuffer()),
    ]).then(async ([savedPeaks, savedLoops, buf]) => {
      const decoded = await getAudioEngine().loadTrack(String(trackId), buf)
      const dur = decoded.duration * 1000
      setDurationMs(dur)

      if (found.duration_ms === null) {
        window.soundsmith.tracks.updateDuration(trackId, dur).catch(() => {})
        setTrack((t) => (t ? { ...t, duration_ms: dur } : t))
      }

      if (savedPeaks) {
        setPeaks(savedPeaks)
      } else {
        const calc = calcPeaks(decoded)
        setPeaks(calc)
        window.soundsmith.tracks.saveWaveformPeaks(trackId, calc).catch(() => {})
      }

      const editableLoops: EditableLoop[] = savedLoops.map((l) => ({
        key: String(l.id),
        id: l.id,
        name: l.name,
        color: l.color,
        start_ms: l.start_ms,
        end_ms: l.end_ms,
        fade_in_ms: l.fade_in_ms,
        fade_out_ms: l.fade_out_ms,
        notes: l.notes ?? '',
        order_index: l.order_index,
        created_at: l.created_at,
      }))
      setLoops(editableLoops)
      setAudioLoading(false)
    }).catch(() => setAudioLoading(false))
  }, [trackId, trackList])

  // ─── Global mousemove for loop handle drag ────────────────────────────────

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const dh = dragHandleRef.current
      if (!dh || !durationMs || !waveformAreaRef.current) return
      const rect = waveformAreaRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const rawMs = (x / rect.width) * durationMs
      const currentLoops = loopsRef.current
      const loop = currentLoops.find((l) => l.key === dh.key)
      if (!loop) return
      const others = currentLoops.filter((l) => l.key !== dh.key)

      let newMs: number
      if (dh.side === 'start') {
        const prevEnd = Math.max(0, ...others.filter((l) => l.end_ms <= loop.end_ms).map((l) => l.end_ms))
        newMs = Math.max(prevEnd, Math.min(rawMs, loop.end_ms - MIN_LOOP_MS))
        newMs = Math.max(0, newMs)
      } else {
        const candidates = others.filter((l) => l.start_ms >= loop.start_ms).map((l) => l.start_ms)
        const nextStart = candidates.length ? Math.min(...candidates) : durationMs
        newMs = Math.min(nextStart, Math.max(rawMs, loop.start_ms + MIN_LOOP_MS))
        newMs = Math.min(durationMs, newMs)
      }

      setLoops((prev) =>
        prev.map((l) =>
          l.key === dh.key
            ? { ...l, [dh.side === 'start' ? 'start_ms' : 'end_ms']: Math.round(newMs) }
            : l
        )
      )
      setDirty(true)
    }
    function onUp() { setDragHandle(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [durationMs])

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function guardDirty(): boolean {
    if (!dirty) return true
    return window.confirm('Há alterações não salvas. Descartar e continuar?')
  }

  function updateLoop(key: string, patch: Partial<EditableLoop>) {
    setLoops((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
    setDirty(true)
    setSaveError(null)
  }

  // ─── Track rename ─────────────────────────────────────────────────────────

  async function commitRenameTrack() {
    if (!track) return
    const title = renameValue.trim()
    if (!title) { setRenamingTrack(false); return }
    await window.soundsmith.tracks.rename(track.id, title)
    setTrack({ ...track, title })
    setTrackList((prev) => prev.map((t) => (t.id === track.id ? { ...t, title } : t)))
    setRenamingTrack(false)
  }

  // ─── Create loop ──────────────────────────────────────────────────────────

  function createLoop() {
    if (!durationMs) return
    const sorted = [...loops].sort((a, b) => a.start_ms - b.start_ms)
    let startMs = Math.round(positionMs / 100) * 100
    let endMs = Math.min(startMs + 30000, durationMs)

    // Check if startMs overlaps anything → find next free position
    const blocker = sorted.find((l) => l.start_ms <= startMs && l.end_ms > startMs)
    if (blocker) startMs = blocker.end_ms

    // Clamp end to next loop start
    const nextLoopStart = sorted.find((l) => l.start_ms > startMs)?.start_ms ?? durationMs
    endMs = Math.min(endMs, nextLoopStart)

    // If no room, scan for a gap ≥ 1 second
    if (endMs - startMs < 1000) {
      let found = false
      for (const l of sorted) {
        const gs = l.end_ms
        const ge = sorted.find((n) => n.start_ms >= gs && n.start_ms > gs)?.start_ms ?? durationMs
        if (ge - gs >= 1000) {
          startMs = gs
          endMs = Math.min(gs + 30000, ge)
          found = true
          break
        }
      }
      if (!found && durationMs >= 1000) {
        startMs = 0
        endMs = Math.min(30000, sorted[0]?.start_ms ?? durationMs)
      }
    }

    if (endMs - startMs < MIN_LOOP_MS) return // truly no space

    const key = `new-${Date.now()}`
    const newLoop: EditableLoop = {
      key,
      name: `Loop ${loops.length + 1}`,
      color: nextLoopColor(loops),
      start_ms: Math.round(startMs),
      end_ms: Math.round(endMs),
      fade_in_ms: 0,
      fade_out_ms: 0,
      notes: '',
      order_index: loops.length,
    }
    setLoops((prev) => [...prev, newLoop])
    setSelectedKey(key)
    setDirty(true)
    setSaveError(null)
  }

  // ─── Delete loop ──────────────────────────────────────────────────────────

  function confirmDelete(key: string) {
    setLoops((prev) => prev.filter((l) => l.key !== key))
    if (selectedKey === key) setSelectedKey(null)
    setDeleteConfirmKey(null)
    setDirty(true)
  }

  // ─── Loop list reorder ────────────────────────────────────────────────────

  function handleLoopDrop(targetKey: string) {
    if (!dragReorderKey || dragReorderKey === targetKey) return
    const reordered = [...loops]
    const from = reordered.findIndex((l) => l.key === dragReorderKey)
    const to = reordered.findIndex((l) => l.key === targetKey)
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    const withIndex = reordered.map((l, i) => ({ ...l, order_index: i }))
    setLoops(withIndex)
    setDragReorderKey(null)
    setDragOverKey(null)
    setDirty(true)
  }

  // ─── Preview ──────────────────────────────────────────────────────────────

  function previewLoop(loop: EditableLoop) {
    getAudioEngine().play({
      loop: {
        startMs: loop.start_ms,
        endMs: loop.end_ms,
        fadeInMs: loop.fade_in_ms,
        fadeOutMs: loop.fade_out_ms,
      },
      startMs: loop.start_ms,
    })
  }

  // ─── Transport ────────────────────────────────────────────────────────────

  function togglePlay() {
    const engine = getAudioEngine()
    if (playing) {
      engine.pause()
    } else {
      if (engine.getState().positionMs >= durationMs - 100) {
        engine.seek(0)
      }
      engine.resume()
    }
  }

  function stopPlayback() {
    getAudioEngine().stop()
  }

  function handleWaveformClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!durationMs || !waveformAreaRef.current || dragHandle) return
    const rect = waveformAreaRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ms = Math.max(0, Math.min((x / rect.width) * durationMs, durationMs))
    getAudioEngine().seek(ms)
    setPositionMs(ms)
  }

  // ─── Save ────────────────────────────────────────────────────────────────

  async function save() {
    if (!trackId) return
    // Validate
    for (const l of loops) {
      if (l.end_ms <= l.start_ms) {
        setSaveError(`"${l.name}": fim deve ser maior que início.`)
        return
      }
      if (l.fade_in_ms + l.fade_out_ms > l.end_ms - l.start_ms) {
        setSaveError(`"${l.name}": fades excedem duração do loop.`)
        return
      }
      if (hasOverlap(loops, l.start_ms, l.end_ms, l.key)) {
        setSaveError(`"${l.name}": sobreposição com outro loop.`)
        return
      }
    }
    setSaving(true)
    setSaveError(null)
    const loopsData: LoopInput[] = loops.map((l, i) => ({
      name: l.name,
      color: l.color,
      start_ms: l.start_ms,
      end_ms: l.end_ms,
      fade_in_ms: l.fade_in_ms,
      fade_out_ms: l.fade_out_ms,
      notes: l.notes || null,
      order_index: i,
      created_at: l.created_at,
    }))
    try {
      const saved = await window.soundsmith.loops.saveAll(trackId, loopsData)
      const editableLoops: EditableLoop[] = saved.map((l) => ({
        key: String(l.id),
        id: l.id,
        name: l.name,
        color: l.color,
        start_ms: l.start_ms,
        end_ms: l.end_ms,
        fade_in_ms: l.fade_in_ms,
        fade_out_ms: l.fade_out_ms,
        notes: l.notes ?? '',
        order_index: l.order_index,
        created_at: l.created_at,
      }))
      setLoops(editableLoops)
      // Keep the same selection after save (by name match since keys may change)
      if (selectedKey) {
        const oldLoop = loops.find((l) => l.key === selectedKey)
        if (oldLoop) {
          const newMatch = editableLoops.find((l) => l.name === oldLoop.name && l.start_ms === oldLoop.start_ms)
          setSelectedKey(newMatch?.key ?? null)
        }
      }
      setDirty(false)
    } catch {
      setSaveError('Erro ao salvar. Tente novamente.')
    }
    setSaving(false)
  }

  // ─── Derived ─────────────────────────────────────────────────────────────

  const selectedLoop = loops.find((l) => l.key === selectedKey) ?? null

  const rulerTicks = (() => {
    if (!durationMs) return []
    const totalS = durationMs / 1000
    let step = 10
    if (totalS > 600) step = 60
    else if (totalS > 300) step = 30
    else if (totalS > 120) step = 15
    const ticks: { ms: number; label: string }[] = []
    for (let t = 0; t <= totalS; t += step / zoom) {
      const m = Math.floor(t / 60)
      const s = Math.round(t % 60)
      ticks.push({ ms: t * 1000, label: `${m}:${String(s).padStart(2, '0')}` })
    }
    return ticks
  })()

  const playheadPct = durationMs > 0 ? (positionMs / durationMs) * 100 : 0

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="estudio-screen">
      {/* Header */}
      <div className="estudio-header">
        <div className="estudio-header-left">
          <h1 className="screen-title estudio-title">Estúdio</h1>
          <div className="estudio-label">Editor de Trilha</div>
          <div className="estudio-selectors">
            <select
              className="input est-select"
              value={campaignId ?? ''}
              onChange={(e) => {
                if (!guardDirty()) return
                const id = e.target.value ? Number(e.target.value) : null
                setCampaignId(id)
                setDirty(false)
              }}
            >
              <option value="">Selecionar campanha…</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              className="input est-select"
              value={trackId ?? ''}
              disabled={!campaignId}
              onChange={(e) => {
                if (!guardDirty()) return
                const id = e.target.value ? Number(e.target.value) : null
                setTrackId(id)
                setDirty(false)
              }}
            >
              <option value="">Selecionar faixa…</option>
              {trackList.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="estudio-header-right">
          <div className="zoom-controls">
            <button
              className="btn btn-ghost zoom-btn"
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.5).toFixed(1)))}
              disabled={zoom <= 0.5}
              title="Zoom out"
            >
              <ZoomOut size={15} />
            </button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              className="btn btn-ghost zoom-btn"
              onClick={() => setZoom((z) => Math.min(8, +(z + 0.5).toFixed(1)))}
              disabled={zoom >= 8}
              title="Zoom in"
            >
              <ZoomIn size={15} />
            </button>
          </div>
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={!dirty || saving}
          >
            <Save size={15} /> {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="estudio-error">{saveError}</div>
      )}

      {!trackId ? (
        <div className="estudio-empty">
          {campaigns.length === 0
            ? 'Nenhuma campanha. Crie uma na aba Campanhas.'
            : !campaignId
              ? 'Selecione uma campanha.'
              : trackList.length === 0
                ? 'Campanha sem faixas. Adicione faixas no editor de campanhas.'
                : 'Selecione uma faixa para editar.'}
        </div>
      ) : (
        <div className="estudio-body">
          {/* ─── Left: waveform ─── */}
          <div className="estudio-left">
            {/* Track name */}
            <div className="track-name-row">
              {renamingTrack ? (
                <div className="track-rename-inline">
                  <input
                    className="input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRenameTrack()
                      if (e.key === 'Escape') setRenamingTrack(false)
                    }}
                    autoFocus
                    maxLength={80}
                  />
                  <button className="btn btn-primary btn-sm" onClick={commitRenameTrack}>OK</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setRenamingTrack(false)}>✕</button>
                </div>
              ) : (
                <div className="track-name-display">
                  <span className="track-title-text">{track?.title}</span>
                  <button
                    className="btn btn-ghost track-rename-btn"
                    onClick={() => { setRenameValue(track?.title ?? ''); setRenamingTrack(true) }}
                    title="Renomear faixa"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Waveform card */}
            <div className="waveform-card">
              {audioLoading && (
                <div className="waveform-loading">Carregando áudio…</div>
              )}
              <div
                className="waveform-scroll"
                style={{ overflowX: zoom > 1 ? 'auto' : 'hidden' }}
              >
                <div
                  className="waveform-inner"
                  style={{ width: `${zoom * 100}%` }}
                >
                  {/* Ruler */}
                  <div className="waveform-ruler">
                    {rulerTicks.map((t) => (
                      <div
                        key={t.ms}
                        className="ruler-tick"
                        style={{ left: `${(t.ms / durationMs) * 100}%` }}
                      >
                        <span className="ruler-label">{t.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Canvas + overlays */}
                  <div
                    ref={waveformAreaRef}
                    className="waveform-area"
                    onClick={handleWaveformClick}
                    style={{ cursor: 'crosshair' }}
                  >
                    <canvas ref={canvasRef} className="waveform-canvas" />

                    {/* Loop bands */}
                    {durationMs > 0 && loops.map((loop) => {
                      const left = (loop.start_ms / durationMs) * 100
                      const width = ((loop.end_ms - loop.start_ms) / durationMs) * 100
                      return (
                        <div
                          key={loop.key}
                          className={`loop-band${selectedKey === loop.key ? ' loop-band--selected' : ''}`}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            '--loop-color': loop.color,
                          } as React.CSSProperties}
                          onClick={(e) => { e.stopPropagation(); setSelectedKey(loop.key) }}
                        >
                          <div
                            className="loop-handle loop-handle--left"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setDragHandle({
                                key: loop.key, side: 'start',
                                startClientX: e.clientX,
                                originalMs: loop.start_ms,
                                innerWidth: waveformAreaRef.current?.clientWidth ?? 1,
                              })
                            }}
                          />
                          <span className="loop-band-label">{loop.name}</span>
                          <div
                            className="loop-handle loop-handle--right"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setDragHandle({
                                key: loop.key, side: 'end',
                                startClientX: e.clientX,
                                originalMs: loop.end_ms,
                                innerWidth: waveformAreaRef.current?.clientWidth ?? 1,
                              })
                            }}
                          />
                        </div>
                      )
                    })}

                    {/* Playhead */}
                    {durationMs > 0 && (
                      <div
                        className="playhead"
                        style={{ left: `${playheadPct}%` }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Transport */}
              <div className="transport">
                <button className="btn btn-ghost transport-btn" onClick={togglePlay} disabled={!durationMs}>
                  {playing ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button className="btn btn-ghost transport-btn" onClick={stopPlayback} disabled={!durationMs}>
                  <Square size={16} />
                </button>
                <span className="transport-time">
                  {msToDisplay(positionMs)} / {msToDisplay(durationMs)}
                </span>
                <div className="transport-volume">
                  <Volume2 size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                  <input
                    type="range" min={0} max={1} step={0.02}
                    value={volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setVolume(v)
                      getAudioEngine().setVolume(v)
                    }}
                    style={{ width: 80 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ─── Right: properties + loop list ─── */}
          <div className="estudio-right">
            {/* Properties panel */}
            {selectedLoop ? (
              <div className="props-panel card">
                <div className="props-header">
                  <div className="props-color-row">
                    <div
                      className="props-color-dot"
                      style={{ background: selectedLoop.color }}
                    />
                    <input
                      className="input props-name-input"
                      value={selectedLoop.name}
                      onChange={(e) => updateLoop(selectedKey!, { name: e.target.value })}
                      maxLength={60}
                    />
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => previewLoop(selectedLoop)}
                    title="Preview do loop"
                  >
                    <Eye size={14} /> Preview
                  </button>
                </div>

                {/* Color picker */}
                <div className="props-colors">
                  {LOOP_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`color-swatch${selectedLoop.color === c ? ' color-swatch--active' : ''}`}
                      style={{ '--sw': c } as React.CSSProperties}
                      onClick={() => updateLoop(selectedKey!, { color: c })}
                    />
                  ))}
                </div>

                <div className="props-grid">
                  <div>
                    <div className="label">Início</div>
                    <TimeInput
                      value={selectedLoop.start_ms}
                      max={selectedLoop.end_ms - MIN_LOOP_MS}
                      onChange={(ms) => updateLoop(selectedKey!, { start_ms: ms })}
                    />
                  </div>
                  <div>
                    <div className="label">Fim</div>
                    <TimeInput
                      value={selectedLoop.end_ms}
                      max={durationMs}
                      onChange={(ms) => updateLoop(selectedKey!, { end_ms: ms })}
                    />
                  </div>
                  <div>
                    <div className="label">Duração</div>
                    <input
                      className="input"
                      value={msToDisplay(selectedLoop.end_ms - selectedLoop.start_ms)}
                      readOnly
                    />
                  </div>
                  <div>
                    <div className="label">Fade In (ms)</div>
                    <input
                      className="input"
                      type="number" min={0}
                      value={selectedLoop.fade_in_ms}
                      onChange={(e) => updateLoop(selectedKey!, { fade_in_ms: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                  </div>
                  <div>
                    <div className="label">Fade Out (ms)</div>
                    <input
                      className="input"
                      type="number" min={0}
                      value={selectedLoop.fade_out_ms}
                      onChange={(e) => updateLoop(selectedKey!, { fade_out_ms: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="label">Observações</div>
                  <textarea
                    className="input props-notes"
                    value={selectedLoop.notes}
                    onChange={(e) => updateLoop(selectedKey!, { notes: e.target.value })}
                    placeholder="Dicas para a cena…"
                    rows={3}
                  />
                </div>

                <div className="props-footer">
                  {deleteConfirmKey === selectedKey ? (
                    <div className="delete-confirm-row">
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Excluir "{selectedLoop.name}"?</span>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => confirmDelete(selectedKey!)}>Sim</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirmKey(null)}>Não</button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-error)' }}
                      onClick={() => setDeleteConfirmKey(selectedKey!)}
                    >
                      <Trash2 size={13} /> Excluir Loop
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="props-empty card">
                Selecione um loop para editar propriedades.
              </div>
            )}

            {/* Loop list */}
            <div className="loop-list card">
              <div className="loop-list-header">
                <span className="section-title" style={{ fontSize: 14, marginBottom: 0 }}>
                  Loops da Faixa
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={createLoop}
                  disabled={!durationMs}
                >
                  <Plus size={14} /> Criar Loop
                </button>
              </div>

              {loops.length === 0 ? (
                <div className="loop-list-empty">Nenhum loop. Clique em "Criar Loop".</div>
              ) : (
                <div className="loop-items">
                  {[...loops].sort((a, b) => a.order_index - b.order_index).map((loop) => (
                    <div
                      key={loop.key}
                      className={`loop-item${selectedKey === loop.key ? ' loop-item--selected' : ''}${dragOverKey === loop.key ? ' loop-item--drag-over' : ''}`}
                      onClick={() => setSelectedKey(loop.key)}
                      draggable
                      onDragStart={() => setDragReorderKey(loop.key)}
                      onDragOver={(e) => { e.preventDefault(); setDragOverKey(loop.key) }}
                      onDrop={() => handleLoopDrop(loop.key)}
                      onDragEnd={() => { setDragReorderKey(null); setDragOverKey(null) }}
                      tabIndex={0}
                      role="button"
                      aria-current={selectedKey === loop.key ? 'true' : undefined}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedKey(loop.key) }
                      }}
                    >
                      <GripVertical size={13} className="loop-item-grip" />
                      <div
                        className="loop-item-color"
                        style={{ background: loop.color }}
                      />
                      <div className="loop-item-info">
                        <span className="loop-item-name">{loop.name}</span>
                        <span className="loop-item-range">
                          {msToDisplay(loop.start_ms)} – {msToDisplay(loop.end_ms)}
                        </span>
                      </div>
                      <span className="loop-item-dur">
                        {msToDisplay(loop.end_ms - loop.start_ms)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
