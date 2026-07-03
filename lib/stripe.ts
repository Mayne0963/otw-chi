import Stripe from 'stripe';

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Stripe secret not configured');
  }
  return new Stripe(key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: '2024-12-18.acacia' as any,
    typescript: true,
  });
}

export function constructStripeEvent(payload: string, signature: string, secret: string) {
  return Stripe.webhooks.constructEvent(payload, signature, secret);
}
