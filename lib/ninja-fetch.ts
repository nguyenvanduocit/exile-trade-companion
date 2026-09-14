import { ninjaCharacterUrl, ninjaIndexStateUrl, parseNinjaUrl, resolveNinjaSnapshot, type NinjaCharacter, type NinjaFetchResult, type NinjaIndexState, type NinjaLink } from './ninja-import'

// Profile versions come from the character event stream, independently of ladder snapshots.
async function fetchProfileCharacter(link: NinjaLink): Promise<NinjaFetchResult> {
  const path = [link.account, link.leagueSlug, link.character].map(encodeURIComponent).join('/')
  const base = `https://poe.ninja/${link.game}/api`
  const signal = AbortSignal.timeout(15_000)
  const response = await fetch(`${base}/events/character/${path}`, { signal, headers: { Accept: 'text/event-stream' } })
  if (response.status === 404) return { ok: false, reason: 'character-not-found' }
  if (!response.ok || !response.body) return { ok: false, reason: 'network' }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let version: number | undefined
  try {
    while (version === undefined) {
      const { done, value } = await reader.read()
      if (done) return { ok: false, reason: 'network' }
      buffer += decoder.decode(value, { stream: true })
      let boundary: RegExpExecArray | null
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const lines = buffer.slice(0, boundary.index).split(/\r?\n/)
        buffer = buffer.slice(boundary.index + boundary[0].length)
        const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim()
        if (event === 'notfound') return { ok: false, reason: 'character-not-found' }
        if (event === 'unauthorized') return { ok: false, reason: 'network' }
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
        if (!data || (event && event !== 'message')) continue
        const update = JSON.parse(data) as { version?: number }
        if (Number.isInteger(update.version) && update.version! >= 0) {
          version = update.version
          break
        }
      }
    }
  } finally {
    await reader.cancel()
  }
  const modelResponse = await fetch(`${base}/profile/characters/${path}/model/${version}`, { signal, headers: { Accept: 'application/json' } })
  if (modelResponse.status === 404) return { ok: false, reason: 'character-not-found' }
  if (!modelResponse.ok) return { ok: false, reason: 'network' }
  const model = await modelResponse.json() as { type: string; charModel?: NinjaCharacter }
  if (model.type !== 'found' || !model.charModel || !Array.isArray(model.charModel.items)) return { ok: false, reason: 'character-not-found' }
  return { ok: true, character: model.charModel }
}

export async function fetchNinjaCharacter(url: string): Promise<NinjaFetchResult> {
  const link = parseNinjaUrl(url)
  if (!link) return { ok: false, reason: 'invalid-url' }
  try {
    if (link.source === 'profile') return await fetchProfileCharacter(link)
    const indexResponse = await fetch(ninjaIndexStateUrl(link.game), { headers: { Accept: 'application/json' } })
    if (!indexResponse.ok) return { ok: false, reason: 'network' }
    const snapshot = resolveNinjaSnapshot((await indexResponse.json()) as NinjaIndexState, link.leagueSlug)
    if (!snapshot) return { ok: false, reason: 'league-not-found' }

    const characterResponse = await fetch(ninjaCharacterUrl(link, snapshot), { headers: { Accept: 'application/json' } })
    if (characterResponse.status === 404) return { ok: false, reason: 'character-not-found' }
    if (!characterResponse.ok) return { ok: false, reason: 'network' }
    const character = (await characterResponse.json()) as NinjaCharacter & { status?: number }
    if (character.status === 404 || !Array.isArray(character.items)) return { ok: false, reason: 'character-not-found' }
    return { ok: true, character }
  } catch {
    return { ok: false, reason: 'network' }
  }
}
