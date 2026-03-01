import { Inter, Playfair_Display } from 'next/font/google';

import '../../../packages/shared/styles/ui-foundation.css';
import './globals.css';
import { UiPreferencesProvider } from '../components/ui-preferences';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap'
});

export const metadata = {
  title: 'Eggturtle 平台后台',
  description: '平台超级管理员后台'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.variable} ${playfairDisplay.variable}`}>
        <UiPreferencesProvider>{children}</UiPreferencesProvider>
      </body>
    </html>
  );
}
