import '../../../packages/shared/styles/ui-foundation.css';
import './globals.css';
import { Inter, Playfair_Display } from 'next/font/google';

import { UiPreferencesProvider } from '@/components/ui-preferences';

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fontDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata = {
  title: '选育溯源档案 | Breeding Traceability Record',
  description: 'Breeding Traceability Record 多用户选育与溯源管理平台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${fontSans.variable} ${fontDisplay.variable} app-body`}>
        <UiPreferencesProvider>{children}</UiPreferencesProvider>
      </body>
    </html>
  );
}
