// src/renderer/src/audio/AudioEngine.ts

export function clampVolume(v: number): number { return Math.max(0, Math.min(1, v)) }
export function msToSeconds(ms: number): number { return ms / 1000 }
export function secondsToMs(s: number): number { return s * 1000 }

export interface LoopRegion {
  startMs: number
  endMs: number
  fadeInMs: number
  fadeOutMs: number
}

export type LoopMode = LoopRegion | 'full' | 'none'

// COR-RN-02: position with wrap over the active loop region.
export function calcPositionMs(linearMs: number, loop: LoopMode, durationMs: number): number {
  if (loop === 'full') {
    if (durationMs <= 0) return 0
    return linearMs % durationMs
  }
  if (loop !== 'none' && loop) {
    const { startMs, endMs } = loop
    const span = endMs - startMs
    if (span <= 0) return startMs
    if (linearMs < endMs) return linearMs
    return startMs + ((linearMs - startMs) % span)
  }
  return Math.min(linearMs, durationMs)
}

export interface PlayOptions {
  loop?: LoopMode
  startMs?: number
}

export interface AudioState {
  currentTrackId: string | null
  positionMs: number
  durationMs: number
  playing: boolean
  activeLoop: LoopMode | null
  pendingLoop: LoopMode | null
  volume: number
}

export class AudioEngine {
  private ctx: AudioContext
  private masterGain: GainNode
  private src: AudioBufferSourceNode | null = null
  private srcGain: GainNode | null = null
  private buf: AudioBuffer | null = null
  private trackId: string | null = null
  private _vol = 1
  private _playing = false
  private _startTime = 0
  private _startOffset = 0
  private _durationMs = 0
  private _activeLoop: LoopMode | null = null
  private _pendingLoop: LoopMode | null = null
  private _loopTimer: ReturnType<typeof setTimeout> | null = null
  private _onTrackEnded: (() => void) | null = null

  constructor() {
    this.ctx = new AudioContext()
    this.masterGain = this.ctx.createGain()
    this.masterGain.connect(this.ctx.destination)
  }

  async setSinkId(deviceId: string): Promise<void> {
    if ('setSinkId' in this.ctx) {
      await (this.ctx as AudioContext & { setSinkId(id: string): Promise<void> }).setSinkId(deviceId)
    }
  }

  async loadTrack(trackId: string, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const decoded = await this.ctx.decodeAudioData(arrayBuffer)
    this.stop()
    this.buf = decoded
    this.trackId = trackId
    this._durationMs = secondsToMs(decoded.duration)
    this._activeLoop = null
    this._pendingLoop = null
    return decoded
  }

  seek(ms: number): void {
    const wasPlaying = this._playing
    const currentLoop = this._activeLoop
    this._stopSource()
    this._startOffset = msToSeconds(ms)
    this._playing = false
    if (wasPlaying) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this.play({ loop: currentLoop ?? 'none', startMs: ms })
        })
      } else {
        this.play({ loop: currentLoop ?? 'none', startMs: ms })
      }
    }
  }

  setOnTrackEnded(cb: (() => void) | null): void {
    this._onTrackEnded = cb
  }

  play(opts: PlayOptions = {}, fadeInMs = 0): void {
    if (!this.buf) return
    this._stopSource()
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { /* ignore */ })
    const { loop = 'none', startMs = 0 } = opts
    this._activeLoop = loop
    this._pendingLoop = null

    const perGain = this.ctx.createGain()
    perGain.connect(this.masterGain)
    this.srcGain = perGain

    const node = this.ctx.createBufferSource()
    node.buffer = this.buf
    node.connect(perGain)

    if (loop === 'full') {
      node.loop = true
      node.loopStart = 0
      node.loopEnd = this.buf.duration
      this._startOffset = msToSeconds(startMs)
    } else if (loop !== 'none' && loop) {
      node.loop = true
      node.loopStart = msToSeconds(loop.startMs)
      node.loopEnd = msToSeconds(loop.endMs)
      this._startOffset = Math.max(msToSeconds(startMs), msToSeconds(loop.startMs))
    } else {
      this._startOffset = msToSeconds(startMs)
    }

    if (fadeInMs > 0) {
      const now = this.ctx.currentTime
      perGain.gain.setValueAtTime(0, now)
      perGain.gain.linearRampToValueAtTime(1, now + msToSeconds(fadeInMs))
    }

    node.start(0, this._startOffset)
    this._startTime = this.ctx.currentTime - this._startOffset
    this._playing = true
    this.src = node
    node.onended = () => {
      if (this._playing && loop === 'none') {
        this._playing = false
        this._onTrackEnded?.()
      }
    }
  }

  pause(): void {
    if (!this._playing) return
    this._startOffset = this._positionSeconds
    this._stopSource()
    this.ctx.suspend()
    this._playing = false
  }

  resume(): void {
    if (this._playing) return
    this.ctx.resume().then(() => {
      this.play({ loop: this._activeLoop ?? 'none', startMs: secondsToMs(this._startOffset) })
    })
  }

  stop(): void {
    this._stopSource()
    this._startOffset = 0
    this._playing = false
    this._activeLoop = null
    this._pendingLoop = null
    if (this._loopTimer) { clearTimeout(this._loopTimer); this._loopTimer = null }
  }

  scheduleLoopChange(newLoop: LoopMode, opts: { crossfade?: boolean } = {}): void {
    if (this._loopTimer) { clearTimeout(this._loopTimer); this._loopTimer = null }
    const current = this._activeLoop
    const crossfade = opts.crossfade ?? false

    const fadeInMs = typeof newLoop === 'object' ? newLoop.fadeInMs : 0
    const startMs = typeof newLoop === 'object' ? newLoop.startMs : 0

    if (current && typeof current === 'object') {
      const posMs = secondsToMs(this._positionSeconds)
      const remaining = current.endMs - posMs

      if (remaining <= 0) {
        this.play({ loop: newLoop, startMs }, fadeInMs)
        return
      }

      this._pendingLoop = newLoop

      // Schedule fade-out on current source gain
      const fadeOutMs = current.fadeOutMs
      if (fadeOutMs > 0 && this.srcGain) {
        const now = this.ctx.currentTime
        const fadeStartRel = Math.max(0, remaining / 1000 - msToSeconds(fadeOutMs))
        this.srcGain.gain.setValueAtTime(1, now + fadeStartRel)
        this.srcGain.gain.linearRampToValueAtTime(0, now + remaining / 1000)
      }

      // Crossfade: start new source early so fades overlap
      const overlap = crossfade && fadeOutMs > 0 && fadeInMs > 0
        ? Math.min(fadeOutMs, fadeInMs)
        : 0

      const delay = Math.max(0, remaining - overlap)

      this._loopTimer = setTimeout(() => {
        this._loopTimer = null
        this.play({ loop: newLoop, startMs }, fadeInMs)
      }, delay)
    } else {
      // No active region → switch immediately
      this.play({ loop: newLoop, startMs }, fadeInMs)
    }
  }

  setVolume(v: number): void {
    this._vol = clampVolume(v)
    this.masterGain.gain.setValueAtTime(this._vol, this.ctx.currentTime)
  }

  getState(): AudioState {
    return {
      currentTrackId: this.trackId,
      positionMs: secondsToMs(this._positionSeconds),
      durationMs: this._durationMs,
      playing: this._playing,
      activeLoop: this._activeLoop,
      pendingLoop: this._pendingLoop,
      volume: this._vol,
    }
  }

  private get _positionSeconds(): number {
    if (!this._playing) return this._startOffset
    const linearMs = secondsToMs(this.ctx.currentTime - this._startTime)
    return msToSeconds(calcPositionMs(linearMs, this._activeLoop ?? 'none', this._durationMs))
  }

  private _stopSource(): void {
    if (this.src) {
      this.src.onended = null
      try { this.src.stop() } catch { /* already stopped */ }
      this.src.disconnect()
      this.src = null
    }
    if (this.srcGain) {
      this.srcGain.disconnect()
      this.srcGain = null
    }
  }
}

// Lazy singleton — avoids calling new AudioContext() at module load time,
// which would fail in Node/test environments where AudioContext is not defined.
let _audioEngine: AudioEngine | null = null
export function getAudioEngine(): AudioEngine {
  if (!_audioEngine) _audioEngine = new AudioEngine()
  return _audioEngine
}
