import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

const LOCAL_ADMIN_ORIGIN = 'http://localhost:30020';

type DeprecatedAdminEntryProps = {
  targetPath: string;
};

export function DeprecatedAdminEntry({ targetPath }: DeprecatedAdminEntryProps) {
  const configuredAdminOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_ADMIN_APP_ORIGIN);

  if (configuredAdminOrigin) {
    const blockLoopbackRedirect =
      process.env.NODE_ENV === 'production' && isLoopbackOrigin(configuredAdminOrigin);
    if (!blockLoopbackRedirect) {
      redirect(`${configuredAdminOrigin}${targetPath}`);
    }
  }

  const requestHost = headers().get('host') ?? '当前域名';

  return (
    <main className="workspace-shell">
      <section className="card panel stack">
        <p className="super-admin-banner">已迁移</p>
        <h1>后台入口已迁移到 apps/admin</h1>
        <p className="muted">
          当前未配置可用的 <code>NEXT_PUBLIC_ADMIN_APP_ORIGIN</code>，或配置为本地地址（
          <code>{LOCAL_ADMIN_ORIGIN}</code>），生产环境已阻止跳转。
        </p>
        <p>
          请将 <code>NEXT_PUBLIC_ADMIN_APP_ORIGIN</code> 设置为可公网访问的后台地址，然后重新部署。
        </p>
        <p className="muted">
          当前访问域名：<code>{requestHost}</code>
        </p>
      </section>
    </main>
  );
}

export function normalizeAdminSubPath(path: string[] | undefined) {
  if (!path || path.length === 0) {
    return '/dashboard';
  }

  return `/${path.map((segment) => segment.trim()).filter(Boolean).join('/')}`;
}

function normalizeOrigin(rawValue: string | undefined) {
  return (rawValue ?? '').trim().replace(/\/+$/, '');
}

function isLoopbackOrigin(origin: string) {
  return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
}
