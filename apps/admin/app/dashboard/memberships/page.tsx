import { redirect } from 'next/navigation'

export default function DashboardMembershipsRedirectPage() {
  redirect('/dashboard/tenant-management')
}
