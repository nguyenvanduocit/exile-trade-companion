export interface OnboardingStep {
  key: string
  titleKey: string
  bodyKey: string
  image: string
}

export function clampStepIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1)
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: 'welcome',
    titleKey: 'onboarding.steps.welcome.title',
    bodyKey: 'onboarding.steps.welcome.body',
    image: '/onboarding/welcome.png',
  },
  {
    key: 'save',
    titleKey: 'onboarding.steps.save.title',
    bodyKey: 'onboarding.steps.save.body',
    image: '/onboarding/save.jpg',
  },
  {
    key: 'panel',
    titleKey: 'onboarding.steps.panel.title',
    bodyKey: 'onboarding.steps.panel.body',
    image: '/onboarding/panel.jpg',
  },
  {
    key: 'statFilter',
    titleKey: 'onboarding.steps.statFilter.title',
    bodyKey: 'onboarding.steps.statFilter.body',
    image: '/onboarding/stat-filter.png',
  },
  {
    key: 'propertyFilter',
    titleKey: 'onboarding.steps.propertyFilter.title',
    bodyKey: 'onboarding.steps.propertyFilter.body',
    image: '/onboarding/property-filter.png',
  },
  {
    key: 'priceHistory',
    titleKey: 'onboarding.steps.priceHistory.title',
    bodyKey: 'onboarding.steps.priceHistory.body',
    image: '/onboarding/price-history.png',
  },
  {
    key: 'shareFolder',
    titleKey: 'onboarding.steps.shareFolder.title',
    bodyKey: 'onboarding.steps.shareFolder.body',
    image: '/onboarding/share-folder.png',
  },
  {
    key: 'shortcut',
    titleKey: 'onboarding.steps.shortcut.title',
    bodyKey: 'onboarding.steps.shortcut.body',
    image: '/onboarding/shortcut.png',
  },
]
