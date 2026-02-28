import Link from 'next/link';
import { redirect } from 'next/navigation';

const defaultAdminOrigin = 'http://localhost:30020';

export default function DeprecatedWebAdminEntry() {
  const adminOrigin = (process.env.NEXT_PUBLIC_ADMIN_APP_ORIGIN ?? defaultAdminOrigin).replace(/\/+$/, '');

  if (adminOrigin) {
    redirect(`${adminOrigin}/dashboard`);
  }

  return (
    <main className="workspace-shell">
      <section className="card panel stack">
        <p className="super-admin-banner">已迁移</p>
        <h1>后台入口已迁移到 apps/admin</h1>
        <p className="muted">
          请启动 <code>apps/admin</code>（端口 <code>30020</code>），并访问：
        </p>
        <p>
          <Link href={`${defaultAdminOrigin}/dashboard`}>{defaultAdminOrigin}/dashboard</Link>
        </p>
      </section>
    </main>
  );
}
