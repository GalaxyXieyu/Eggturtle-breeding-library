'use client';

import Image from 'next/image';
import Link from 'next/link';

import { useUiPreferences } from '../components/ui-preferences';
import styles from './page.module.css';

type HomeCopy = {
  navLogin: string;
  heroKicker: string;
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroSubtitle: string;
  heroPrimaryAction: string;
  heroSecondaryAction: string;
  heroMeta: Array<{ title: string; desc: string }>;
  heroStockLabel: string;
  heroHatchLabel: string;
  featuresKicker: string;
  featuresTitle: string;
  features: Array<{ title: string; desc: string; icon: string }>;
  stats: Array<{ value: string; label: string }>;
  ctaKicker: string;
  ctaTitle: string;
  ctaDesc: string;
  ctaAction: string;
  footerLogin: string;
  footerFeatures: string;
  gallery: Array<{ src: string; alt: string; large: boolean }>;
};

const COPY: Record<'zh' | 'en', HomeCopy> = {
  zh: {
    navLogin: '登录控制台',
    heroKicker: '专业繁育管理',
    heroTitleLine1: '专业种龟繁育',
    heroTitleLine2: '数字化管理',
    heroSubtitle: '从种龟档案、交配记录到产蛋孵化，构建一条可追溯、可协作、可持续优化的繁育工作流。',
    heroPrimaryAction: '进入控制台',
    heroSecondaryAction: '查看能力',
    heroMeta: [
      { title: '多租户', desc: '团队独立管理' },
      { title: '可审计', desc: '关键操作可追踪' },
      { title: '结构化', desc: '数据与业务对齐' }
    ],
    heroStockLabel: '在库种龟',
    heroHatchLabel: '平均孵化率',
    featuresKicker: '核心能力',
    featuresTitle: '核心能力',
    features: [
      {
        title: '种龟档案',
        desc: '完整记录血统、性别、年龄、体重等关键数据，支持按系列与编码快速检索。',
        icon: '档'
      },
      {
        title: '交配管理',
        desc: '记录交配对象与时间线，自动沉淀繁育关系，辅助规避近亲繁殖风险。',
        icon: '配'
      },
      {
        title: '孵化追踪',
        desc: '覆盖产蛋批次、孵化周期与状态变化，形成可追溯的繁育过程。',
        icon: '孵'
      },
      {
        title: '经营数据',
        desc: '通过统计面板查看关键繁育指标，支持团队按租户独立运营。',
        icon: '数'
      }
    ],
    stats: [
      { value: '5000+', label: '种龟档案' },
      { value: '10K+', label: '产蛋记录' },
      { value: '98%', label: '孵化率' },
      { value: '24/7', label: '在线管理' }
    ],
    ctaKicker: '准备开始',
    ctaTitle: '开始你的数字化繁育之旅',
    ctaDesc: '登录控制台，体验为繁育团队设计的管理工作台。',
    ctaAction: '立即登录',
    footerLogin: '登录',
    footerFeatures: '功能',
    gallery: [
      { src: '/images/mg_02.jpg', alt: '种龟近景', large: true },
      { src: '/images/mg_03.jpg', alt: '养殖环境', large: false },
      { src: '/images/mg_04.jpg', alt: '种龟特写', large: false },
      { src: '/images/mg_05.jpg', alt: '繁育场景', large: false }
    ]
  },
  en: {
    navLogin: 'Sign in',
    heroKicker: 'Professional Breeding Management',
    heroTitleLine1: 'Pro Turtle Breeding',
    heroTitleLine2: 'Digital Operations',
    heroSubtitle: 'From breeder records and mating history to hatch tracking, build a traceable and collaborative workflow.',
    heroPrimaryAction: 'Open Console',
    heroSecondaryAction: 'View Features',
    heroMeta: [
      { title: 'Multi-tenant', desc: 'Independent team workspaces' },
      { title: 'Auditable', desc: 'Critical operations are traceable' },
      { title: 'Structured', desc: 'Data aligned with business flow' }
    ],
    heroStockLabel: 'Breeders in Stock',
    heroHatchLabel: 'Average Hatch Rate',
    featuresKicker: 'Features',
    featuresTitle: 'Core Capabilities',
    features: [
      {
        title: 'Breeder Records',
        desc: 'Track lineage, sex, age and weight with quick lookup by series and code.',
        icon: 'BR'
      },
      {
        title: 'Mating Management',
        desc: 'Capture pair history and timeline to reduce inbreeding risk.',
        icon: 'MM'
      },
      {
        title: 'Hatch Tracking',
        desc: 'Follow egg batches, incubation stages and status changes end to end.',
        icon: 'HT'
      },
      {
        title: 'Ops Metrics',
        desc: 'Use dashboards for key breeding indicators across tenant teams.',
        icon: 'OM'
      }
    ],
    stats: [
      { value: '5000+', label: 'Breeder records' },
      { value: '10K+', label: 'Egg batches' },
      { value: '98%', label: 'Hatch rate' },
      { value: '24/7', label: 'Online access' }
    ],
    ctaKicker: 'Ready to Start',
    ctaTitle: 'Start your digital breeding journey',
    ctaDesc: 'Sign in to the console and experience a workspace built for breeding teams.',
    ctaAction: 'Sign in now',
    footerLogin: 'Login',
    footerFeatures: 'Features',
    gallery: [
      { src: '/images/mg_02.jpg', alt: 'Breeder close-up', large: true },
      { src: '/images/mg_03.jpg', alt: 'Breeding environment', large: false },
      { src: '/images/mg_04.jpg', alt: 'Shell detail', large: false },
      { src: '/images/mg_05.jpg', alt: 'Breeding scene', large: false }
    ]
  }
};

export default function HomePage() {
  const { locale } = useUiPreferences();
  const copy = COPY[locale];

  return (
    <div className={styles.page}>
      <header className={styles.navbar}>
        <div className={styles.container}>
          <div className={styles.logoGroup}>
            <span className={styles.logoMark}>ET</span>
            <div>
              <p className={styles.logoName}>Eggturtle</p>
              <p className={styles.logoSub}>Breeding Library</p>
            </div>
          </div>
          <Link href="/login" className={styles.navLogin}>
            {copy.navLogin}
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>{copy.heroKicker}</p>
            <h1>
              {copy.heroTitleLine1}
              <span>{copy.heroTitleLine2}</span>
            </h1>
            <p className={styles.subtitle}>{copy.heroSubtitle}</p>
            <div className={styles.heroActions}>
              <Link href="/login" className={styles.primaryAction}>
                {copy.heroPrimaryAction}
              </Link>
              <a href="#features" className={styles.secondaryAction}>
                {copy.heroSecondaryAction}
              </a>
            </div>
            <div className={styles.heroMeta}>
              {copy.heroMeta.map((item) => (
                <article key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.desc}</span>
                </article>
              ))}
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.heroImageWrap}>
              <picture className={styles.heroPicture}>
                <source media="(max-width: 640px)" srcSet="/images/mg_02.jpg" />
                <img src="/images/mg_01.jpg" alt={copy.gallery[0]?.alt ?? ''} className={styles.heroImage} loading="eager" decoding="async" />
              </picture>
            </div>
            <div className={styles.floatingCard}>
              <p>{copy.heroStockLabel}</p>
              <strong>5000+</strong>
            </div>
            <div className={`${styles.floatingCard} ${styles.floatingCardAlt}`}>
              <p>{copy.heroHatchLabel}</p>
              <strong>98%</strong>
            </div>
          </div>
        </section>

        <section className={styles.features} id="features">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>{copy.featuresKicker}</p>
            <h2>{copy.featuresTitle}</h2>
          </div>
          <div className={styles.featureGrid}>
            {copy.features.map((feature) => (
              <article key={feature.title} className={styles.featureCard}>
                <span aria-hidden="true" className={styles.featureIcon}>
                  {feature.icon}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.gallery}>
          <div className={styles.galleryGrid}>
            {copy.gallery.map((item) => (
              <figure key={item.src} className={`${styles.galleryItem} ${item.large ? styles.galleryItemLarge : ''}`}>
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  sizes={item.large ? '(max-width: 900px) 100vw, 50vw' : '(max-width: 900px) 100vw, 24vw'}
                  className={styles.galleryImage}
                />
              </figure>
            ))}
          </div>
        </section>

        <section className={styles.stats}>
          {copy.stats.map((item) => (
            <article key={item.label} className={styles.statCard}>
              <strong>{item.value}</strong>
              <p>{item.label}</p>
            </article>
          ))}
        </section>

        <section className={styles.cta}>
          <p className={styles.kicker}>{copy.ctaKicker}</p>
          <h2>{copy.ctaTitle}</h2>
          <p>{copy.ctaDesc}</p>
          <Link href="/login" className={styles.primaryAction}>
            {copy.ctaAction}
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <p>© 2026 TurtleAlbum. All rights reserved.</p>
          <div className={styles.footerLinks}>
            <Link href="/login">{copy.footerLogin}</Link>
            <a href="#features">{copy.footerFeatures}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
