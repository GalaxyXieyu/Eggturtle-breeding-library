'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="auth-shell auth-shell-not-found">
      <section className="not-found-layout" aria-live="polite">
        <p className="login-kicker">404 · Not Found</p>
        <h1 className="not-found-title">页面未找到</h1>
        <p className="not-found-subtitle">抱歉，你访问的页面不存在、已被移动或暂时不可访问。</p>
        <p className="muted not-found-muted">The page you requested could not be found.</p>

        <div className="not-found-actions" role="group" aria-label="导航操作">
          <Link href="/" className="auth-action auth-action-primary">
            返回首页
          </Link>
          <button type="button" className="auth-action auth-action-ghost" onClick={() => router.back()}>
            返回上一页
          </button>
          <Link href="/login" className="auth-action auth-action-ghost">
            重新登录
          </Link>
        </div>
      </section>
    </main>
  );
}
