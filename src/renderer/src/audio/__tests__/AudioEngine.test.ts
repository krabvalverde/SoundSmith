import { describe, it, expect } from 'vitest'
import { clampVolume, msToSeconds, secondsToMs, calcPositionMs, computeClockOffset, livePositionMs, continuationStartMs } from '../AudioEngine'

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

describe('computeClockOffset', () => {
  it('sem latência: offset = t1 − t2Recv', () => {
    expect(computeClockOffset(1000, 1000, 0)).toBe(0)
    expect(computeClockOffset(5000, 4800, 0)).toBe(200)
  })
  it('compensa a latência one-way', () => {
    // host mandou em t1=1000, chegou no cliente em 1200, one-way=50 → offset -150
    expect(computeClockOffset(1000, 1200, 50)).toBe(-150)
  })
})

describe('livePositionMs', () => {
  const dur = 120000
  it('none tocando: extrapola pela diferença de tempo', () => {
    expect(livePositionMs({ positionMs: 3000, updatedAt: 1000, playing: true }, 3000, 'none', dur)).toBe(5000)
  })
  it('pausado: ignora o tempo decorrido', () => {
    expect(livePositionMs({ positionMs: 3000, updatedAt: 1000, playing: false }, 9000, 'none', dur)).toBe(3000)
  })
  it('full: enrola após o fim da faixa', () => {
    expect(livePositionMs({ positionMs: 119000, updatedAt: 0, playing: true }, 3000, 'full', dur)).toBe(2000)
  })
  it('região: enrola de volta ao início do loop', () => {
    const loop = { startMs: 30000, endMs: 60000, fadeInMs: 0, fadeOutMs: 0 }
    // pos 55s + 10s = 65s → 5s dentro da segunda volta → 35s
    expect(livePositionMs({ positionMs: 55000, updatedAt: 0, playing: true }, 10000, loop, dur)).toBe(35000)
  })
  it('offset negativo (hostNow < updatedAt) não retrocede: elapsed clampado a 0', () => {
    expect(livePositionMs({ positionMs: 3000, updatedAt: 5000, playing: true }, 4000, 'none', dur)).toBe(3000)
  })
})

describe('continuationStartMs', () => {
  const regionA = { startMs: 30000, endMs: 60000, fadeInMs: 0, fadeOutMs: 0 }
  const regionB = { startMs: 90000, endMs: 100000, fadeInMs: 0, fadeOutMs: 0 }

  it('região → sem repetição: continua do fim da região atual', () => {
    expect(continuationStartMs('none', regionA, 45000)).toBe(60000)
  })
  it('região → faixa em loop: continua do fim da região atual', () => {
    expect(continuationStartMs('full', regionA, 45000)).toBe(60000)
  })
  it('faixa em loop → sem repetição: continua da posição corrente', () => {
    expect(continuationStartMs('none', 'full', 42000)).toBe(42000)
  })
  it('sem repetição → faixa em loop: continua da posição corrente', () => {
    expect(continuationStartMs('full', 'none', 42000)).toBe(42000)
  })
  it('região → outra região: pula pro início da nova região (não regride)', () => {
    expect(continuationStartMs(regionB, regionA, 45000)).toBe(90000)
  })
  it('none/full → região: pula pro início da região', () => {
    expect(continuationStartMs(regionB, 'none', 42000)).toBe(90000)
  })
})
