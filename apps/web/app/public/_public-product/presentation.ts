import type { PublicSharePresentation } from '@eggturtle/shared';

export const DEFAULT_PUBLIC_SHARE_PRESENTATION: PublicSharePresentation = {
  feedTitle: '蛋龟图鉴 · 公开分享',
  feedSubtitle: '长期专注蛋龟繁育与选育记录',
  theme: {
    brandPrimary: '#FFD400',
    brandSecondary: '#1f2937'
  },
  hero: {
    images: ['/images/mg_04.jpg']
  },
  contact: {
    showWechatBlock: false,
    wechatQrImageUrl: null,
    wechatId: null
  }
};

export function resolvePublicSharePresentation(
  value: PublicSharePresentation | null | undefined
): PublicSharePresentation {
  if (!value) {
    return DEFAULT_PUBLIC_SHARE_PRESENTATION;
  }

  const heroImages = value.hero.images.length > 0 ? value.hero.images : DEFAULT_PUBLIC_SHARE_PRESENTATION.hero.images;

  return {
    ...value,
    hero: {
      images: heroImages
    }
  };
}
