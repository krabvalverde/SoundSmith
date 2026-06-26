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
  volume: number
}

export class AudioEngine {
  private ctx: AudioContext
  private masterGain: GainNode
  private src: AudioBufferSourceNode | null = null
  private buf: AudioBuffer | null = null
  private trackId: string | null = null
  private _vol = 1
  private _playing = false
  private _startTime = 0
  private _startOffset = 0
  private _durationMs = 0
  private _activeLoop: LoopMode | null = null
  private _loopTimer: ReturnType<typeof setTimeout> | null = null

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

  async loadTrack(trackId: string, arrayBuffer: ArrayBuffer): Promise<void> {
    const decoded = await this.ctx.decodeAudioData(arrayBuffer)
    this.stop()
    this.buf = decoded
    this.trackId = trackId
    this._durationMs = secondsToMs(decoded.duration)
    this._activeLoop = null
  }

  play(opts: PlayOptions = {}): void {
    if (!this.buf) return
    this._stopSource()
    const { loop = 'none', startMs = 0 } = opts
    this._activeLoop = loop

    const node = this.ctx.createBufferSource()
    node.buffer = this.buf
    node.connect(this.masterGain)

    if (loop === 'full') {
      node.loop = true; node.loopStart = 0; node.loopEnd = this.buf.duration
      this._startOffset = msToSeconds(startMs)
    } else if (loop !== 'none' && loop) {
      node.loop = true
      node.loopStart = msToSeconds(loop.startMs)
      node.loopEnd = msToSeconds(loop.endMs)
      this._startOffset = Math.max(msToSeconds(startMs), msToSeconds(loop.startMs))
    } else {
      this._startOffset = msToSeconds(startMs)
    }

    node.start(0, this._startOffset)
    this._startTime = this.ctx.currentTime - this._startOffset
    this._playing = true
    this.src = node
    node.onended = () => { if (this._playing && loop === 'none') this._playing = false }
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
    this._startOffset = 0; this._playing = false; this._activeLoop = null
    if (this._loopTimer) { clearTimeout(this._loopTimer); this._loopTimer = null }
  }

  scheduleLoopChange(newLoop: LoopMode): void {
    if (this._loopTimer) { clearTimeout(this._loopTimer); this._loopTimer = null }
    const current = this._activeLoop
    if (current && typeof current === 'object') {
      const remaining = current.endMs - secondsToMs(this._positionSeconds)
      this._loopTimer = setTimeout(() => { this.play({ loop: newLoop }) }, Math.max(0, remaining))
    } else {
      this.play({ loop: newLoop })
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
      volume: this._vol
    }
  }

  private get _positionSeconds(): number {
    return this._playing ? this.ctx.currentTime - this._startTime : this._startOffset
  }

  private _stopSource(): void {
    if (this.src) {
      this.src.onended = null
      try { this.src.stop() } catch { /* already stopped */ }
      this.src.disconnect(); this.src = null
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
