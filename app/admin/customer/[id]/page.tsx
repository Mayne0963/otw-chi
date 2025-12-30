import { redirect } from 'next/navigation';

export default async function AdminCustomerAliasPage({
  params
}: {
  params: { id: string };
}) {
  redirect(`/admin/customers/${params.id}`);
}
