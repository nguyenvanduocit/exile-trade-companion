import { describe, expect, it } from 'vitest'
import { scaleChartPoints } from './chart-scale'

const opts = { width: 200, height: 100, padding: { top: 10, right: 10, bottom: 10, left: 10 } }

describe('scaleChartPoints', () => {
  it('returns empty result for no data', () => {
    expect(scaleChartPoints([], opts)).toEqual({ points: [], minY: 0, maxY: 0 })
  })

  it('scales two points across the full padded viewBox', () => {
    const result = scaleChartPoints([{ x: 0, y: 0 }, { x: 100, y: 200 }], opts)
    expect(result).toEqual({
      points: [{ x: 10, y: 90 }, { x: 190, y: 10 }],
      minY: 0,
      maxY: 200,
    })
  })

  it('centers a single point in the viewBox', () => {
    const result = scaleChartPoints([{ x: 50, y: 100 }], opts)
    expect(result.points).toEqual([{ x: 100, y: 50 }])
  })

  it('centers vertically when every point has the same y (flat price)', () => {
    const result = scaleChartPoints([{ x: 0, y: 50 }, { x: 100, y: 50 }], opts)
    expect(result.points).toEqual([{ x: 10, y: 50 }, { x: 190, y: 50 }])
    expect(result.minY).toBe(50)
    expect(result.maxY).toBe(50)
  })

  it('respects asymmetric per-side padding', () => {
    const result = scaleChartPoints([{ x: 0, y: 0 }, { x: 100, y: 100 }], {
      width: 200,
      height: 100,
      padding: { top: 0, right: 0, bottom: 20, left: 40 },
    })
    expect(result.points).toEqual([{ x: 40, y: 80 }, { x: 200, y: 0 }])
  })
})
