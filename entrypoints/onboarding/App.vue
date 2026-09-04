<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { browser } from 'wxt/browser'
import { i18n } from '#i18n'
import { ArrowLeft, ArrowRight, Bookmark } from 'lucide-vue-next'
import { clampStepIndex, ONBOARDING_STEPS } from '@/lib/onboarding-steps'

const TRADE_URL = 'https://www.pathofexile.com/trade/'

// Step titleKey/bodyKey đến từ data ONBOARDING_STEPS (string thường), không phải literal union
// mà i18n.t() sinh ra từ locale — không cách nào thoả overload filtered-by-key mà không cast.
function t(key: string): string {
  return i18n.t(key as Parameters<typeof i18n.t>[0])
}

const index = ref(0)
const step = computed(() => ONBOARDING_STEPS[index.value]!)
const isFirst = computed(() => index.value === 0)
const isLast = computed(() => index.value === ONBOARDING_STEPS.length - 1)

function goTo(target: number) {
  index.value = clampStepIndex(target, ONBOARDING_STEPS.length)
}

async function closeSelf() {
  const tab = await browser.tabs.getCurrent()
  if (tab?.id !== undefined) void browser.tabs.remove(tab.id)
}

function skip() {
  void closeSelf()
}

async function goNext() {
  if (isLast.value) {
    await browser.tabs.create({ url: TRADE_URL })
    await closeSelf()
    return
  }
  goTo(index.value + 1)
}

function goPrev() {
  goTo(index.value - 1)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowRight') void goNext()
  else if (event.key === 'ArrowLeft') goPrev()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center px-6 py-10 font-body text-grey">
    <div class="w-full max-w-6xl">
      <div class="mb-6 flex items-center justify-between">
        <span class="flex items-center gap-2 font-display text-[14px] text-tan">
          <Bookmark class="size-[14px]" />
          {{ i18n.t('onboarding.stepLabel', { current: index + 1, total: ONBOARDING_STEPS.length }) }}
        </span>
        <button v-if="!isLast" class="poe-btn" type="button" @click="skip">{{ i18n.t('onboarding.skip') }}</button>
      </div>

      <Transition name="onboarding-step" mode="out-in">
        <div :key="step.key" class="flex flex-col items-center">
          <div class="flex w-full justify-center border border-bronze bg-raised p-3">
            <img :src="step.image" :alt="t(step.titleKey)" class="max-h-[68vh] w-auto object-contain">
          </div>
          <div class="mt-6 max-w-2xl text-center">
            <h1 class="font-display text-[28px] leading-tight text-cream">{{ t(step.titleKey) }}</h1>
            <p class="mt-4 text-[15px] leading-6 text-grey">{{ t(step.bodyKey) }}</p>
          </div>
        </div>
      </Transition>

      <div class="mt-8 flex items-center justify-between">
        <button class="poe-btn" type="button" :disabled="isFirst" @click="goPrev">
          <ArrowLeft /> {{ i18n.t('onboarding.back') }}
        </button>

        <div class="flex gap-2" role="tablist" :aria-label="i18n.t('onboarding.stepLabel', { current: index + 1, total: ONBOARDING_STEPS.length })">
          <button
            v-for="(s, i) in ONBOARDING_STEPS"
            :key="s.key"
            type="button"
            class="size-2 transition-colors"
            :class="i === index ? 'bg-bronze-strong' : 'bg-rule'"
            :aria-label="i18n.t('onboarding.goToStep', { step: i + 1 })"
            :aria-current="i === index"
            @click="goTo(i)"
          />
        </div>

        <button class="poe-btn poe-btn-primary" type="button" @click="goNext">
          {{ isLast ? i18n.t('onboarding.start') : i18n.t('onboarding.next') }} <ArrowRight />
        </button>
      </div>
    </div>
  </main>
</template>
