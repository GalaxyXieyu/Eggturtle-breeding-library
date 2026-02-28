import { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { DashboardShell } from '../../components/dashboard/dashboard-shell';
import { getSessionToken, resolveSessionFromToken } from '../../lib/server-session';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const token = getSessionToken();

  if (!token) {
    redirect('/login?redirect=/dashboard');
  }

  const session = await resolveSessionFromToken(token);
  if (!session) {
    redirect('/login?redirect=/dashboard');
  }

  return <DashboardShell currentUserEmail={session.user.email}>{children}</DashboardShell>;
}
