import Image from 'next/image';
import Link from 'next/link';

import styles from './page.module.css';

const features = [
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
] as const;

const stats = [
  { value: '5000+', label: '种龟档案' },
  { value: '10K+', label: '产蛋记录' },
  { value: '98%', label: '孵化率' },
  { value: '24/7', label: '在线管理' }
] as const;

const gallery = [
  { src: '/images/mg_02.jpg', alt: '种龟近景', large: true },
  { src: '/images/mg_03.jpg', alt: '养殖环境', large: false },
  { src: '/images/mg_04.jpg', alt: '种龟特写', large: false },
  { src: '/images/mg_05.jpg', alt: '繁育场景', large: false }
] as const;

export default function HomePage() {
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
            登录控制台
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Professional Breeding Management</p>
            <h1>
              专业种龟繁育
              <span>数字化管理</span>
            </h1>
            <p className={styles.subtitle}>
              从种龟档案、交配记录到产蛋孵化，构建一条可追溯、可协作、可持续优化的繁育工作流。
            </p>
            <div className={styles.heroActions}>
              <Link href="/login" className={styles.primaryAction}>
                进入控制台
              </Link>
              <a href="#features" className={styles.secondaryAction}>
                查看能力
              </a>
            </div>
            <div className={styles.heroMeta}>
              <article>
                <strong>多租户</strong>
                <span>团队独立管理</span>
              </article>
              <article>
                <strong>可审计</strong>
                <span>关键操作可追踪</span>
              </article>
              <article>
                <strong>结构化</strong>
                <span>数据与业务对齐</span>
              </article>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.heroImageWrap}>
              <picture className={styles.heroPicture}>
                <source media="(max-width: 640px)" srcSet="/images/mg_02.jpg" />
                <img
                  src="/images/mg_01.jpg"
                  alt="种龟繁育展示"
                  className={styles.heroImage}
                  loading="eager"
                  decoding="async"
                />
              </picture>
            </div>
            <div className={styles.floatingCard}>
              <p>在库种龟</p>
              <strong>5000+</strong>
            </div>
            <div className={`${styles.floatingCard} ${styles.floatingCardAlt}`}>
              <p>平均孵化率</p>
              <strong>98%</strong>
            </div>
          </div>
        </section>

        <section className={styles.features} id="features">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>Features</p>
            <h2>核心能力</h2>
          </div>
          <div className={styles.featureGrid}>
            {features.map((feature) => (
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
            {gallery.map((item) => (
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
          {stats.map((item) => (
            <article key={item.label} className={styles.statCard}>
              <strong>{item.value}</strong>
              <p>{item.label}</p>
            </article>
          ))}
        </section>

        <section className={styles.cta}>
          <p className={styles.kicker}>Ready to Start</p>
          <h2>开始你的数字化繁育之旅</h2>
          <p>登录控制台，体验为繁育团队设计的管理工作台。</p>
          <Link href="/login" className={styles.primaryAction}>
            立即登录
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <p>© 2026 TurtleAlbum. All rights reserved.</p>
          <div className={styles.footerLinks}>
            <Link href="/login">登录</Link>
            <a href="#features">功能</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
