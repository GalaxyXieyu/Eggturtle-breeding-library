import { AdminPlaceholderRoute } from '../../../components/dashboard/polish-primitives';

export default function DashboardUsagePage() {
  return (
    <AdminPlaceholderRoute
      title={{ zh: '用量总览', en: 'Usage Overview' }}
      description={{
        zh: '用于展示配额消耗、调用频率与异常用量。',
        en: 'For quota usage, request throughput and abnormal consumption.'
      }}
      panelTitle={{ zh: '用量面板占位', en: 'Usage Panel Placeholder' }}
      emptyState={{
        zh: '尚未接入配额统计与调用明细。',
        en: 'Quota statistics and request-level usage details are not connected yet.'
      }}
    />
  );
}
