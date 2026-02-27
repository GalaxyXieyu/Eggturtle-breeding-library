import { ReactNode } from 'react';

export function DashboardAccessGuard({ children }: { children: ReactNode }) {
  // TODO(T29): replace with real server-side session and permission checks.
  return <>{children}</>;
}
