import { beforeAll } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { generateChromeMessages, parseMessagesFile } from '@wxt-dev/i18n/build'

beforeAll(async () => {
  const parsed = await parseMessagesFile('locales/vi.json')
  const messages = generateChromeMessages(parsed)

  fakeBrowser.i18n.getMessage = ((key: string, substitutions?: string | string[]) => {
    const entry = messages[key]
    if (!entry) return ''
    const subs = substitutions == null ? [] : Array.isArray(substitutions) ? substitutions : [substitutions]
    return subs.reduce((text: string, sub, i) => text.replaceAll(`$${i + 1}`, String(sub)), entry.message)
  }) as typeof fakeBrowser.i18n.getMessage
})
