import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Breeding Traceability Record - 蛋龟繁育溯源管理平台',
  description: '专业的种龟繁育管理系统，提供完整的血统追溯、交配产蛋记录、证书生成与验真功能',
  keywords: ['种龟管理', '繁育记录', '血统追溯', '证书验真', 'AI助手'],
  openGraph: {
    title: 'Breeding Traceability Record - 蛋龟繁育溯源管理平台',
    description: '专业的种龟繁育管理系统，提供完整的血统追溯、交配产蛋记录、证书生成与验真功能',
    type: 'website',
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
