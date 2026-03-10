import { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { validateAdminAccessToken } from '@/lib/admin-auth';
import { getSessionToken, resolveProfileFromToken } from '@/lib/server-session';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const token = getSessionToken();

  if (!token) {
    redirect('/login?redirect=/dashboard');
  }

  const validationResult = await validateAdminAccessToken(token);
  if (!validationResult.ok) {
    redirect('/login?redirect=/dashboard');
  }

  const profile = await resolveProfileFromToken(token);
  if (!profile) {
    redirect('/login?redirect=/dashboard');
  }

  return (
    <DashboardShell
      currentUserEmail={validationResult.user.email}
      mustChangePassword={profile.passwordUpdatedAt === null}
    >
      {children}
    </DashboardShell>
  );
}
