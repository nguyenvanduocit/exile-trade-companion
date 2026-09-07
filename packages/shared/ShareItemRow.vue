<script setup lang="ts">
defineProps<{
  title: string
  note?: string
  href: string | null
}>()
</script>

<template>
  <div class="share-item-row">
    <div class="share-item-row__title">{{ title }}</div>
    <p v-if="note" class="share-item-row__note">{{ note }}</p>
    <a v-if="href" :href="href" target="_blank" rel="noopener noreferrer" class="share-item-row__link">
      Mở trên pathofexile.com/trade
    </a>
    <span v-else class="share-item-row__link share-item-row__link--disabled">
      Không dựng lại được URL (thiếu dữ liệu query)
    </span>
  </div>
</template>

<style scoped>
.share-item-row {
  padding: 12px 0;
  border-bottom: 1px solid #3a2a12;
}
.share-item-row__title {
  font-weight: 600;
  color: #e9cf9f;
}
.share-item-row__note {
  margin-top: 4px;
  font-size: 13px;
  color: #9c8f7a;
  white-space: pre-wrap;
}
.share-item-row__link {
  display: inline-block;
  margin-top: 6px;
  font-size: 13px;
  color: #c9a227;
  text-decoration: underline;
}
.share-item-row__link--disabled {
  color: #6b6153;
  text-decoration: none;
  cursor: default;
}
</style>
