import { AdminPlaceholderRoute } from '../../../../components/dashboard/polish-primitives';

export default function DashboardAnalyticsActivityPage() {
  return (
    <AdminPlaceholderRoute
      title={{ zh: '活跃度分析', en: 'Activity Analytics' }}
      description={{
        zh: '用于展示租户、成员与关键操作的活跃趋势。',
        en: 'For tenant, membership and key-operation activity trends.'
      }}
      panelTitle={{ zh: '活跃度报表占位', en: 'Activity Report Placeholder' }}
      emptyState={{
        zh: '尚未接入活跃度指标与时间序列图。',
        en: 'Activity metrics and time-series charts are not connected yet.'
      }}
    />
  );
}
