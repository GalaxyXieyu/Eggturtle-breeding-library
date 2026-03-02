import { AdminPlaceholderRoute } from '../../../components/dashboard/polish-primitives';

export default function DashboardBillingPage() {
  return (
    <AdminPlaceholderRoute
      title={{ zh: '计费中心', en: 'Billing Center' }}
      description={{
        zh: '用于管理账单、发票和支付状态。',
        en: 'For managing invoices, statements and payment status.'
      }}
      panelTitle={{ zh: '计费模块占位', en: 'Billing Module Placeholder' }}
      emptyState={{
        zh: '尚未接入账单列表与支付处理流程。',
        en: 'Billing list and payment workflows are not connected yet.'
      }}
    />
  );
}
