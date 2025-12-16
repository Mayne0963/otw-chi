import { redirect } from 'next/navigation';

export default function DriverDashboardRedirectPage() {
  redirect('/driver/jobs');
}
