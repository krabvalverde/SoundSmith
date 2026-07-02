import { describe, it, expect } from 'vitest'
import { clampVolume, msToSeconds, secondsToMs, calcPositionMs } from '../AudioEngine'

describe('AudioEngine utilities', () => {
  it('clampVolume clamps below 0 to 0', () => { expect(clampVolume(-1)).toBe(0) })
  it('clampVolume clamps above 1 to 1', () => { expect(clampVolume(2)).toBe(1) })
  it('clampVolume passes 0.5 through', () => { expect(clampVolume(0.5)).toBe(0.5) })
  it('msToSeconds 1000ms → 1s', () => { expect(msToSeconds(1000)).toBe(1) })
  it('msToSeconds 2500ms → 2.5s', () => { expect(msToSeconds(2500)).toBe(2.5) })
  it('secondsToMs 1s → 1000ms', () => { expect(secondsToMs(1)).toBe(1000) })
  it('secondsToMs 0.5s → 500ms', () => { expect(secondsToMs(0.5)).toBe(500) })
})

describe('calcPositionMs (COR-RN-02)', () => {
  it('"none": returns linear position before end of track', () => {
    expect(calcPositionMs(3000, 'none', 10000)).toBe(3000)
  })

  it('"none": clamps position to duration once track has ended', () => {
    expect(calcPositionMs(15000, 'none', 10000)).toBe(10000)
  })

  it('"full": returns linear position before first wrap', () => {
    expect(calcPositionMs(4000, 'full', 10000)).toBe(4000)
  })

  it('"full": wraps back to 0 after one full pass', () => {
    expect(calcPositionMs(12000, 'full', 10000)).toBe(2000)
  })

  it('"full": wraps correctly after multiple passes', () => {
    expect(calcPositionMs(25000, 'full', 10000)).toBe(5000)
  })

  it('named loop: returns linear position while inside the region on first pass', () => {
    const loop = { startMs: 30000, endMs: 60000, fadeInMs: 0, fadeOutMs: 0 }
    expect(calcPositionMs(45000, loop, 120000)).toBe(45000)
  })

  it('named loop: wraps to region start right at the boundary', () => {
    const loop = { startMs: 30000, endMs: 60000, fadeInMs: 0, fadeOutMs: 0 }
    expect(calcPositionMs(60000, loop, 120000)).toBe(30000)
  })

  it('named loop: wraps inside the region after one lap', () => {
    const loop = { startMs: 30000, endMs: 60000, fadeInMs: 0, fadeOutMs: 0 }
    // one full lap (30s) + 10s into the second lap
    expect(calcPositionMs(70000, loop, 120000)).toBe(40000)
  })

  it('named loop: wraps correctly after many laps', () => {
    const loop = { startMs: 30000, endMs: 60000, fadeInMs: 0, fadeOutMs: 0 }
    // 30s region, 5.5 laps in => halfway through a lap => 45000
    expect(calcPositionMs(30000 + 30000 * 5.5, loop, 120000)).toBe(45000)
  })
})
