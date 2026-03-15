import '../../../packages/shared/styles/ui-foundation.css';
import './globals.css';
import './styles/auth/auth-shell.css';
import './styles/auth/auth-panels.css';
import './styles/public/share-primitives.css';
import './styles/public/public-feed.css';
import './styles/public/public-share.css';
import './styles/tenant/tenant-layout.css';
import './styles/tenant/app-body-theme.css';
import './styles/tenant/tenant-mobile-nav.css';
import './styles/app-overrides.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';

import { UiPreferencesProvider } from '@/components/ui-preferences';
import { getPlatformBrandingServer } from '@/lib/branding-server';

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

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBrandingServer();

  return {
    title: `${branding.appName.zh} | ${branding.appName.en}`,
    description: branding.appDescription.zh,
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
