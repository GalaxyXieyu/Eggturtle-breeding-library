import '../../../packages/shared/styles/ui-foundation.css';
import './globals.css';

export const metadata = {
  title: 'Eggturtle 平台后台',
  description: '平台超级管理员后台'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
