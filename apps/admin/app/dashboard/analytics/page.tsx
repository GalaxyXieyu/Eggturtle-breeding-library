import { AdminPlaceholderRoute } from '../../../components/dashboard/polish-primitives';

export default function DashboardAnalyticsPage() {
  return (
    <AdminPlaceholderRoute
      title={{ zh: '分析总览', en: 'Analytics Overview' }}
      description={{
        zh: '统一承载活跃度、营收与增长分析入口。',
        en: 'Unified entry for activity, revenue and growth analytics.'
      }}
      panelTitle={{ zh: '分析能力建设中', en: 'Analytics Capabilities in Progress' }}
      emptyState={{
        zh: '当前暂无可展示分析卡片与报表。',
        en: 'No analytics cards or reports are available yet.'
      }}
    />
  );
}
