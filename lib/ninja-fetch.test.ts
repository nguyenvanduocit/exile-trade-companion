import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchNinjaCharacter } from './ninja-fetch'

const profile = 'https://poe.ninja/poe2/profile/tuymaydi-7805/forbiddenrites/character/Satan_Rites'
const character = { name: 'Satan_Rites', league: 'Forbidden Rites', items: [] }

afterEach(() => vi.unstubAllGlobals())

function eventResponse(chunks: string[], cancel = vi.fn()) {
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
    },
    cancel,
  }), { headers: { 'Content-Type': 'text/event-stream' } })
}

describe('fetchNinjaCharacter', () => {
  it('loads the current profile model without requiring a ladder snapshot and closes the event stream', async () => {
    const cancel = vi.fn()
    const request = vi.fn()
      .mockResolvedValueOnce(eventResponse([': heartbeat\n\ndata: {"ver', 'sion":52}\r', '\n\r\n'], cancel))
      .mockResolvedValueOnce(Response.json({ type: 'found', charModel: character }))
    vi.stubGlobal('fetch', request)

    expect(await fetchNinjaCharacter(profile)).toEqual({ ok: true, character })
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      'https://poe.ninja/poe2/api/events/character/tuymaydi-7805/forbiddenrites/Satan_Rites',
      'https://poe.ninja/poe2/api/profile/characters/tuymaydi-7805/forbiddenrites/Satan_Rites/model/52',
    ])
    expect(cancel).toHaveBeenCalledOnce()
    expect(request.mock.calls[0]?.[1].signal).toBeInstanceOf(AbortSignal)
  })

  it.each(['notfound', 'unauthorized'])('stops on the profile %s event', async (event) => {
    const cancel = vi.fn()
    const request = vi.fn().mockResolvedValue(eventResponse([`event: ${event}\ndata: {}\n\n`], cancel))
    vi.stubGlobal('fetch', request)
    expect(await fetchNinjaCharacter(profile)).toEqual({ ok: false, reason: event === 'notfound' ? 'character-not-found' : 'network' })
    expect(request).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('rejects a profile model without character items', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(eventResponse(['data: {"version":7}\n\n']))
      .mockResolvedValueOnce(Response.json({ type: 'notfound' })))
    expect(await fetchNinjaCharacter(profile)).toEqual({ ok: false, reason: 'character-not-found' })
  })

  it('keeps builds snapshot and Time Machine requests intact', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ snapshotVersions: [{ url: 'forbiddenrites', version: 'snapshot-9', snapshotName: 'forbidden-rites' }] }))
      .mockResolvedValueOnce(Response.json(character))
    vi.stubGlobal('fetch', request)
    expect(await fetchNinjaCharacter('https://poe.ninja/poe2/builds/forbiddenrites/character/tuymaydi-7805/Satan_Rites?timemachine=day-1'))
      .toEqual({ ok: true, character })
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      'https://poe.ninja/poe2/api/data/index-state',
      'https://poe.ninja/poe2/api/builds/snapshot-9/character?account=tuymaydi-7805&name=Satan_Rites&overview=forbidden-rites&timeMachine=day-1',
    ])
  })
})
