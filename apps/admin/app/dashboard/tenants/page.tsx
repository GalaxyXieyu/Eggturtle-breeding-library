import { redirect } from 'next/navigation'

export default function DashboardTenantsRedirectPage() {
  redirect('/dashboard/tenant-management')
}
