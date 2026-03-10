import type { Metadata } from 'next';

import '../../../packages/shared/styles/ui-foundation.css';
import './globals.css';
import { UiPreferencesProvider } from '@/components/ui-preferences';
import { getPlatformBrandingServer } from '@/lib/branding-server';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBrandingServer();

  return {
    title: branding.adminTitle.zh,
    description: branding.adminSubtitle.zh,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <UiPreferencesProvider>{children}</UiPreferencesProvider>
      </body>
    </html>
  );
}
