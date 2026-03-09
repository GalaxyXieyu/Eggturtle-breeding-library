'use client';

import { useMemo, useState } from 'react';

import {
  AdminActionLink,
  AdminPageHeader,
  AdminPanel
} from '@/components/dashboard/polish-primitives';

import DashboardTenantsPage from '@/app/dashboard/tenants/page';
import DashboardMembershipsPage from '@/app/dashboard/memberships/page';

type TabKey = 'directory' | 'memberships';

const COPY = {
  zh: {
    title: '用户管理',
    desc: '在这里统一管理平台用户目录与成员权限。',
    directory: '用户目录',
    memberships: '成员权限',
    legacyHint: '原成员权限页面已合并到此处。'
  },
  en: {
    title: 'Tenant management',
    desc: 'Manage tenant directory and memberships in one place.',
    directory: 'Directory',
    memberships: 'Memberships',
    legacyHint: 'Legacy memberships page has been consolidated here.'
  }
} as const;

export default function DashboardTenantManagementPage() {
  // admin app目前的 locale 来源比较分散，这里先用浏览器语言做个轻量兜底。
  const locale = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return 'zh' as const;
    }

    return navigator.language?.toLowerCase().startsWith('zh') ? ('zh' as const) : ('en' as const);
  }, []);

  const copy = COPY[locale];
  const [activeTab, setActiveTab] = useState<TabKey>('directory');

  return (
    <section className="page admin-page">
      <AdminPageHeader eyebrow="Tenant Management" title={copy.title} description={copy.desc} />

      <AdminPanel className="stack">
        <div className="admin-section-head" style={{ gap: 12 }}>
          <div className="stack row-tight">
            <div className="stack" style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={activeTab === 'directory' ? 'button primary' : 'button'}
                onClick={() => setActiveTab('directory')}
              >
                {copy.directory}
              </button>
              <button
                type="button"
                className={activeTab === 'memberships' ? 'button primary' : 'button'}
                onClick={() => setActiveTab('memberships')}
              >
                {copy.memberships}
              </button>
              <AdminActionLink href="/dashboard/memberships" className="muted">
                {copy.legacyHint}
              </AdminActionLink>
            </div>
          </div>
        </div>

        <div style={{ display: activeTab === 'directory' ? 'block' : 'none' }}>
          <DashboardTenantsPage />
        </div>
        <div style={{ display: activeTab === 'memberships' ? 'block' : 'none' }}>
          <DashboardMembershipsPage />
        </div>
      </AdminPanel>
    </section>
  );
}
