import { redirect } from 'next/navigation';

export default async function AdminCustomerAliasEditPage({
  params
}: {
  params: { id: string };
}) {
  redirect(`/admin/customers/${params.id}/edit`);
}
