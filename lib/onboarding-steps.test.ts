import { describe, expect, it } from 'vitest'
import { clampStepIndex, ONBOARDING_STEPS } from './onboarding-steps'

describe('clampStepIndex', () => {
  it('giữ nguyên index khi còn trong khoảng hợp lệ', () => {
    expect(clampStepIndex(2, 5)).toBe(2)
  })

  it('chặn ở 0 khi index âm', () => {
    expect(clampStepIndex(-1, 5)).toBe(0)
  })

  it('chặn ở phần tử cuối khi index vượt quá độ dài', () => {
    expect(clampStepIndex(10, 5)).toBe(4)
  })
})

describe('ONBOARDING_STEPS', () => {
  it('mỗi step có key, titleKey, bodyKey và image duy nhất', () => {
    const keys = ONBOARDING_STEPS.map((step) => step.key)
    expect(new Set(keys).size).toBe(ONBOARDING_STEPS.length)
    for (const step of ONBOARDING_STEPS) {
      expect(step.titleKey).toMatch(/^onboarding\.steps\./)
      expect(step.bodyKey).toMatch(/^onboarding\.steps\./)
      expect(step.image).toMatch(/^\/onboarding\//)
    }
  })
})
