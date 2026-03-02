import { AdminPlaceholderRoute } from '../../../../components/dashboard/polish-primitives';

export default function DashboardAnalyticsRevenuePage() {
  return (
    <AdminPlaceholderRoute
      title={{ zh: '营收分析', en: 'Revenue Analytics' }}
      description={{
        zh: '用于追踪订阅结构、续费率与收入变化。',
        en: 'For subscription mix, renewal rates and revenue changes.'
      }}
      panelTitle={{ zh: '营收报表占位', en: 'Revenue Report Placeholder' }}
      emptyState={{
        zh: '尚未接入账单聚合与营收分析图表。',
        en: 'Billing aggregation and revenue charts are not connected yet.'
      }}
    />
  );
}
