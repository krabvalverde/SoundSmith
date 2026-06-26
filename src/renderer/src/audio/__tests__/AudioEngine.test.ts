import { describe, it, expect } from 'vitest'
import { clampVolume, msToSeconds, secondsToMs } from '../AudioEngine'

describe('AudioEngine utilities', () => {
  it('clampVolume clamps below 0 to 0', () => { expect(clampVolume(-1)).toBe(0) })
  it('clampVolume clamps above 1 to 1', () => { expect(clampVolume(2)).toBe(1) })
  it('clampVolume passes 0.5 through', () => { expect(clampVolume(0.5)).toBe(0.5) })
  it('msToSeconds 1000ms → 1s', () => { expect(msToSeconds(1000)).toBe(1) })
  it('msToSeconds 2500ms → 2.5s', () => { expect(msToSeconds(2500)).toBe(2.5) })
  it('secondsToMs 1s → 1000ms', () => { expect(secondsToMs(1)).toBe(1000) })
  it('secondsToMs 0.5s → 500ms', () => { expect(secondsToMs(0.5)).toBe(500) })
})
