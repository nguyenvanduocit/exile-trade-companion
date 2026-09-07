import { LiveMap, LiveObject, createClient } from '@liveblocks/client'
import type { Room } from '@liveblocks/client'
import type { SharedFolderMeta, SharedSearchFields } from './folder-sync-types'

export type FolderRoomStorage = {
  folder: LiveObject<SharedFolderMeta>
  searches: LiveMap<string, LiveObject<SharedSearchFields>>
}

let client: ReturnType<typeof createClient> | undefined

function getClient() {
  if (!client) {
    const publicApiKey = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY
    if (!publicApiKey) throw new Error('VITE_LIVEBLOCKS_PUBLIC_KEY chưa được cấu hình trong .env')
    client = createClient({ publicApiKey })
  }
  return client
}

export function enterFolderRoom(
  shareKey: string,
  seed?: { folder: SharedFolderMeta; searches: Record<string, SharedSearchFields> },
) {
  return getClient().enterRoom<Record<string, never>, FolderRoomStorage>(shareKey, {
    initialPresence: {},
    initialStorage: seed
      ? {
          folder: new LiveObject(seed.folder),
          searches: new LiveMap(Object.entries(seed.searches).map(([id, fields]) => [id, new LiveObject(fields)])),
        }
      : {
          folder: new LiveObject({ name: '', color: '', mode: 'live' }),
          searches: new LiveMap(),
        },
  })
}

export type { Room }
