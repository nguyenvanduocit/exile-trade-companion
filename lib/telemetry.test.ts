import { describe, expect, it, vi } from 'vitest'
import { buildIntakeBody, createBatcher, intakeHost, intakeUrl, sanitizeProps, type TelemetryEvent } from './telemetry'

const context = { service: 'exile-trade-companion', version: '0.1.0', env: 'production', installId: 'abc' }

describe('intakeHost + intakeUrl', () => {
  it('suy host intake từ site Datadog', () => {
    expect(intakeHost('datadoghq.com')).toBe('browser-intake-datadoghq.com')
    expect(intakeHost('us5.datadoghq.com')).toBe('browser-intake-us5-datadoghq.com')
    expect(intakeHost('datadoghq.eu')).toBe('browser-intake-datadoghq.eu')
    expect(intakeHost('ap1.datadoghq.com')).toBe('browser-intake-ap1-datadoghq.com')
  })

  it('url mang ddsource, client token và evp origin', () => {
    expect(intakeUrl('datadoghq.com', 'pub123')).toBe('https://browser-intake-datadoghq.com/api/v2/logs?ddsource=browser&dd-api-key=pub123&dd-evp-origin=browser')
  })
})

describe('sanitizeProps', () => {
  it('chỉ giữ nguyên thuỷ, cắt chuỗi dài, bỏ object/undefined/NaN', () => {
    expect(sanitizeProps({ a: 1, b: 'x', c: true, d: null, e: undefined, f: { nested: 1 }, g: [1], h: Number.NaN, i: 'y'.repeat(600) }))
      .toEqual({ a: 1, b: 'x', c: true, d: null, i: 'y'.repeat(500) })
    expect(sanitizeProps(undefined)).toEqual({})
  })
})

describe('buildIntakeBody', () => {
  it('mỗi event một dòng NDJSON với service, tags, install id; .error thành status error', () => {
    const body = buildIntakeBody([{ name: 'import.load', props: { items: 23 } }, { name: 'import.error', props: { reason: 'network' } }], context, 1700000000000)
    const lines = body.split('\n').map((line) => JSON.parse(line))
    expect(lines).toHaveLength(2)
    expect(lines[0]).toEqual({
      ddsource: 'browser', ddtags: 'version:0.1.0,env:production', service: 'exile-trade-companion', status: 'info',
      message: 'import.load', event: 'import.load', install_id: 'abc', date: 1700000000000, items: 23,
    })
    expect(lines[1]).toMatchObject({ status: 'error', event: 'import.error', reason: 'network' })
  })
})

describe('createBatcher', () => {
  function setup(maxBatch = 3) {
    const flush = vi.fn(async (_events: TelemetryEvent[]) => undefined)
    const timers: { callback: () => void; ms: number }[] = []
    const batcher = createBatcher({
      flush,
      maxBatch,
      delayMs: 5000,
      setTimer: (callback, ms) => { timers.push({ callback, ms }); return timers.length },
      clearTimer: () => undefined,
    })
    return { flush, timers, batcher }
  }

  it('gửi khi đủ maxBatch', () => {
    const { flush, batcher } = setup(3)
    batcher.push({ name: 'a' }); batcher.push({ name: 'b' })
    expect(flush).not.toHaveBeenCalled()
    batcher.push({ name: 'c' })
    expect(flush).toHaveBeenCalledTimes(1)
    expect(flush.mock.calls[0]![0].map((event) => event.name)).toEqual(['a', 'b', 'c'])
    expect(batcher.size()).toBe(0)
  })

  it('gửi sau delayMs kể từ event đầu, một timer cho cả batch', () => {
    const { flush, timers, batcher } = setup(10)
    batcher.push({ name: 'a' }); batcher.push({ name: 'b' })
    expect(timers).toHaveLength(1)
    expect(timers[0]!.ms).toBe(5000)
    timers[0]!.callback()
    expect(flush).toHaveBeenCalledWith([{ name: 'a', props: {} }, { name: 'b', props: {} }])
  })

  it('flush lỗi thì bỏ batch, không ném ra ngoài, batch sau vẫn chạy', async () => {
    const flush = vi.fn(async () => { throw new Error('offline') })
    const batcher = createBatcher({ flush, maxBatch: 1, setTimer: () => 0, clearTimer: () => undefined })
    batcher.push({ name: 'a' })
    await batcher.flushNow()
    batcher.push({ name: 'b' })
    expect(flush).toHaveBeenCalledTimes(2)
    expect(batcher.size()).toBe(0)
  })
})
