import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  GitBranch,
  Heart,
  Award,
  Share2,
  Sparkles,
  Check,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: '蛋龟图鉴 · 专业繁育溯源管理平台',
  description: '为蛋龟繁育者打造的专业管理工具。完整血统追溯、交配产蛋记录、证书生成验真、AI 智能助手，让每一只蛋龟都有可信赖的繁育档案。',
};

const FEATURES = [
  {
    icon: GitBranch,
    title: '家族谱系追溯',
    desc: '可视化展示多代血统关系，自动构建家族树，有效规避近亲繁殖风险。',
  },
  {
    icon: Heart,
    title: '繁育全程记录',
    desc: '交配配对、产蛋批次、孵化状态一站式管理，形成完整可追溯的繁育链路。',
  },
  {
    icon: Award,
    title: '证书生成与验真',
    desc: '为每只种龟生成专属溯源证书，二维码扫码即可公开验真，建立信任背书。',
  },
  {
    icon: Share2,
    title: '公开分享与邀请',
    desc: '一键生成分享链接，访客无需登录即可浏览档案，注册后自动绑定邀请奖励。',
  },
  {
    icon: Sparkles,
    title: 'AI 智能助手',
    desc: '语音或文字快速录入繁育事件，智能查询统计数据，大幅降低记录成本。',
  },
];

const SCREENSHOTS = [
  {
    src: '/images/feature-showcase/family-pedigree.png',
    alt: '家族谱系',
    label: '多代血统可视化',
  },
  {
    src: '/images/feature-showcase/timeline-events.png',
    alt: '时间线事件',
    label: '繁育事件时间线',
  },
  {
    src: '/images/feature-showcase/certificate-pair.jpg',
    alt: '证书生成',
    label: '专属溯源证书',
  },
  {
    src: '/images/feature-showcase/dashboard-overview.png',
    alt: '数据总览',
    label: '数据总览仪表盘',
  },
];

const PLANS = [
  {
    name: 'FREE',
    label: '免费版',
    price: 0,
    unit: '',
    highlight: false,
    features: ['最多 10 只种龟', '基础档案管理', '家族谱系查看', 'AI 查询 10 次/月'],
  },
  {
    name: 'BASIC',
    label: '基础版',
    price: 28,
    unit: '/月',
    highlight: true,
    badge: '推荐',
    features: ['最多 30 只种龟', '完整繁育记录', '证书生成与验真', 'AI 自动记录 120 次/月', 'AI 查询 300 次/月'],
  },
  {
    name: 'PRO',
    label: '专业版',
    price: 49,
    unit: '/月',
    highlight: false,
    features: ['最多 200 只种龟', '完整繁育记录', '证书生成与验真', 'AI 自动记录 600 次/月', 'AI 查询 2000 次/月', '优先客服支持'],
  },
];

export default function LandingPage() {
  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>
              专业的蛋龟
              <br />
              <span className={styles.heroTitleAccent}>繁育溯源管理</span>
            </h1>
            <p className={styles.heroSubtitle}>
              完整血统追溯 · 交配产蛋记录 · 证书生成验真 · AI 智能助手
              <br />
              让每一只蛋龟都有可信赖的繁育档案
            </p>
            <div className={styles.heroCta}>
              <Link href="/login" className={styles.ctaPrimary}>
                开始使用
                <ArrowRight size={18} className="ml-1" />
              </Link>
              <a href="#features" className={styles.ctaSecondary}>
                了解更多
                <ChevronRight size={18} className="ml-1" />
              </a>
            </div>
          </div>
          <div className={styles.heroImage}>
            <Image
              src="/images/mg_04.jpg"
              alt="蛋龟繁育管理"
              width={600}
              height={600}
              className={styles.heroImageInner}
              priority
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={styles.features}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>核心功能</h2>
          <p className={styles.sectionSubtitle}>为蛋龟繁育者打造的专业工具</p>
        </div>
        <div className={styles.featureGrid}>
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <Icon size={28} />
                </div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Screenshots Section */}
      <section className={styles.screenshots}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>产品截图</h2>
          <p className={styles.sectionSubtitle}>直观了解平台功能</p>
        </div>
        <div className={styles.screenshotGrid}>
          {SCREENSHOTS.map((screenshot, index) => (
            <div key={index} className={styles.screenshotCard}>
              <div className={styles.screenshotImageWrapper}>
                <Image
                  src={screenshot.src}
                  alt={screenshot.alt}
                  width={800}
                  height={600}
                  className={styles.screenshotImage}
                  loading="lazy"
                />
              </div>
              <p className={styles.screenshotLabel}>{screenshot.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className={styles.pricing}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>选择适合您的套餐</h2>
          <p className={styles.sectionSubtitle}>灵活的订阅方案，满足不同规模需求</p>
        </div>
        <div className={styles.pricingGrid}>
          {PLANS.map((plan, index) => (
            <div
              key={index}
              className={`${styles.pricingCard} ${plan.highlight ? styles.pricingCardHighlight : ''}`}
            >
              {plan.badge ? <div className={styles.pricingBadge}>{plan.badge}</div> : null}
              <h3 className={styles.pricingName}>{plan.label}</h3>
              <div className={styles.pricingPrice}>
                <span className={styles.pricingPriceAmount}>¥{plan.price}</span>
                <span className={styles.pricingPriceUnit}>{plan.unit}</span>
              </div>
              <ul className={styles.pricingFeatures}>
                {plan.features.map((feature, fIndex) => (
                  <li key={fIndex} className={styles.pricingFeature}>
                    <Check size={16} className={styles.pricingFeatureIcon} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={plan.highlight ? styles.pricingCtaPrimary : styles.pricingCtaSecondary}
              >
                {plan.price === 0 ? '免费开始' : '立即订阅'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <h2 className={styles.ctaTitle}>开始您的专业繁育管理之旅</h2>
        <p className={styles.ctaSubtitle}>立即注册，免费体验完整功能</p>
        <Link href="/login" className={styles.ctaButton}>
          免费注册
          <ArrowRight size={20} className="ml-2" />
        </Link>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>© 2026 Breeding Traceability Record. 长期专注蛋龟繁育与选育记录。</p>
      </footer>
    </div>
  );
}
