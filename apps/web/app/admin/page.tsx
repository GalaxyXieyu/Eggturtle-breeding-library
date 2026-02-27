import Link from 'next/link';
import { redirect } from 'next/navigation';

const defaultAdminOrigin = 'http://localhost:30020';

export default function DeprecatedWebAdminEntry() {
  const adminOrigin = (process.env.NEXT_PUBLIC_ADMIN_APP_ORIGIN ?? defaultAdminOrigin).replace(/\/+$/, '');

  if (adminOrigin) {
    redirect(`${adminOrigin}/dashboard`);
  }

  return (
    <main>
      <p className="super-admin-banner">Moved</p>
      <h1>Super-admin dashboard moved</h1>
      <p>
        The backoffice UI now lives in <code>apps/admin</code> and routes under <code>/dashboard/*</code>.
      </p>
      <p>
        Start the admin app on port <code>30020</code>, then open{' '}
        <Link href={`${defaultAdminOrigin}/dashboard`}>{defaultAdminOrigin}/dashboard</Link>.
      </p>
    </main>
  );
}
