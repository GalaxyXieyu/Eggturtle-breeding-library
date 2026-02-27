import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ADMIN_ACCESS_COOKIE_NAME, validateAdminAccessToken } from '../../lib/admin-auth';

export async function DashboardAccessGuard({ children }: { children: ReactNode }) {
  const token = cookies().get(ADMIN_ACCESS_COOKIE_NAME)?.value;

  if (!token) {
    redirect('/login');
  }

  const validationResult = await validateAdminAccessToken(token);

  if (!validationResult.ok) {
    redirect('/login');
  }

  return <>{children}</>;
}
