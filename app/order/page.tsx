import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OrderForm from '@/components/order/OrderForm';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function OrderPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in?redirect_url=/order');
  }

  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Place an Order" 
        subtitle="Get anything delivered, anywhere." 
      />
      <div className="mt-8">
        <OrderForm />
      </div>
    </OtwPageShell>
  );
}
