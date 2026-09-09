<script setup lang="ts">
import { ref } from 'vue'
import { i18n } from '#i18n'
import { ExternalLink, Heart, X } from 'lucide-vue-next'
import { DialogDescription } from 'reka-ui'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { supporters } from '@/lib/supporters'
import { buildDonationTradeUrl } from '@/lib/donation'
import { sendMessage } from '@/lib/extension-messaging'
import type { TradePage } from '@/types/trading'

const props = defineProps<{ page: TradePage | null }>()
const failedIcons = ref(new Set<string>())

async function openDonationTrade() {
  if (!props.page) return
  const url = await buildDonationTradeUrl(props.page)
  if (url) await sendMessage('openUrl', url)
}
</script>

<template>
  <Dialog>
    <DialogTrigger
      class="inline-flex size-[22px] shrink-0 items-center justify-center border border-bronze bg-raised text-[#d6ad73] transition-colors hover:border-bronze-strong hover:bg-hover hover:text-cream focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-tan"
      :aria-label="i18n.t('supporters.openLabel')"
      :title="i18n.t('supporters.openLabel')"
    >
      <Heart class="size-3.5 fill-current" :stroke-width="1.5" aria-hidden="true" />
    </DialogTrigger>
    <DialogContent class="supporters-modal max-h-[85dvh] overflow-y-auto" style="width: 840px">
      <div class="flex items-center justify-between gap-3">
        <DialogTitle class="flex items-center gap-2 font-display text-[17px] text-cream">
          <Heart class="size-5 fill-current text-tan" :stroke-width="1.5" aria-hidden="true" />
          {{ i18n.t('supporters.title') }}
        </DialogTitle>
        <DialogClose class="icon-btn shrink-0" :aria-label="i18n.t('supporters.closeLabel')">
          <X aria-hidden="true" />
        </DialogClose>
      </div>
      <DialogDescription class="mt-3 text-[13px] leading-5 text-grey">
        {{ i18n.t('supporters.description') }}
      </DialogDescription>
      <div class="supporters-columns mt-5 grid gap-5">
        <section class="min-w-0" :aria-label="i18n.t('supporters.title')">
          <ul v-if="supporters.length" class="space-y-2">
            <li v-for="supporter in supporters" :key="supporter.url">
              <a
                :href="supporter.url"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-3 border border-rule p-3 transition-colors hover:border-bronze-strong hover:bg-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-tan"
              >
                <span class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-bronze bg-raised text-tan">
                  <img
                    v-if="supporter.icon && !failedIcons.has(supporter.icon)"
                    :src="supporter.icon"
                    alt=""
                    class="size-full object-cover"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    @error="failedIcons.add(supporter.icon)"
                  >
                  <Heart v-else class="size-5" aria-hidden="true" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block break-words text-[14px] font-medium text-cream">{{ supporter.name }}</span>
                  <span class="mt-1 block truncate text-[12px] text-grey">{{ supporter.url }}</span>
                </span>
                <ExternalLink class="size-4 shrink-0 text-tan" aria-hidden="true" />
              </a>
            </li>
          </ul>
          <p v-else class="flex min-h-44 items-center justify-center border border-dashed border-bronze p-5 text-center text-[13px] leading-5 text-grey">
            {{ i18n.t('supporters.empty') }}
          </p>
        </section>
        <aside class="border border-bronze bg-row p-4" :aria-label="i18n.t('supporters.donateTitle')">
          <p class="text-[13px] leading-5 text-grey">{{ i18n.t('supporters.donateDescription') }}</p>
          <button
            type="button"
            :disabled="!page"
            class="poe-btn poe-btn-primary mt-5 w-full justify-center"
            @click="openDonationTrade"
          >
            {{ i18n.t('supporters.donateCta') }}
          </button>
        </aside>
      </div>
    </DialogContent>
  </Dialog>
</template>
