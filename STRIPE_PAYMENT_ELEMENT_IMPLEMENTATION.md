# Stripe Payment Element Implementation Guide

## Overview

This guide provides step-by-step instructions to replace the insecure custom payment form with Stripe's embedded Payment Element in the Otw delivery system.

## Current Issues

### ❌ Security Vulnerabilities

The current implementation (`/app/(public)/order/page.tsx`):

1. **Collects raw card data** in plain text inputs
2. **Does NOT tokenize** card information
3. **Does NOT process payments** through Stripe
4. **Stores card last 4 digits** without PCI compliance
5. **Uses fake payment API** (`/api/payments/native-charge`) that just marks transactions as "AUTHORIZED" without actual payment

### Code Location

- **Frontend:** `/app/(public)/order/page.tsx` (lines 1291-1342)
- **Backend:** `/app/api/payments/native-charge/route.ts`

## New Implementation

### ✅ What's Been Created

1. **Stripe Payment Intent API** (`/app/api/stripe/create-payment-intent/route.ts`)
   - Creates PaymentIntent with Stripe
   - Handles free orders (100% discount)
   - Returns client secret for Payment Element

2. **Stripe Payment Form Component** (`/components/stripe/StripePaymentForm.tsx`)
   - Uses `@stripe/react-stripe-js` and `@stripe/stripe-js`
   - Embeds Stripe Payment Element
   - Handles payment confirmation
   - Supports free orders

## Implementation Steps

### Step 1: Install Required Packages

```bash
cd /home/ubuntu/otw-chi
pnpm add @stripe/stripe-js @stripe/react-stripe-js
```

### Step 2: Set Environment Variables

Add to Vercel environment variables:

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Your Stripe publishable key
STRIPE_SECRET_KEY=sk_test_...                    # Already set
```

### Step 3: Update Order Page

Replace the payment form section in `/app/(public)/order/page.tsx`:

#### A. Add Import

```typescript
import StripePaymentForm from "@/components/stripe/StripePaymentForm";
```

#### B. Replace State Variables

**Remove:**
```typescript
const [cardName, setCardName] = useState("");
const [cardNumber, setCardNumber] = useState("");
const [cardExpiry, setCardExpiry] = useState("");
const [cardCvc, setCardCvc] = useState("");
```

**Add:**
```typescript
const [showStripePayment, setShowStripePayment] = useState(false);
```

#### C. Replace `handlePayDeliveryFee` Function

**Find (around line 670):**
```typescript
const handlePayDeliveryFee = async () => {
  // ... existing code with cardName, cardNumber validation
  // ... fetch to /api/payments/native-charge
};
```

**Replace with:**
```typescript
const handlePayDeliveryFee = async () => {
  if (feePaid) {
    toast({
      title: "Already paid",
      description: "You've already authorized payment for this delivery.",
    });
    return;
  }

  if (requiresReceipt && !receiptImageData) {
    if (step !== "receipt") {
      toast({
        title: "Receipt required",
        description: "Please upload a receipt before paying.",
        variant: "destructive",
      });
      setStep("receipt");
      return;
    }
  }

  if (requiresReceipt && receiptAnalysis) {
    if (!receiptAnalysis.items.length) {
      toast({
        title: "Receipt items missing",
        description: "Add at least one receipt item before paying.",
        variant: "destructive",
      });
      setStep("receipt");
      return;
    }
  }

  // Show Stripe payment form
  setShowStripePayment(true);
};

const handleStripePaymentSuccess = async (paymentIntentId: string) => {
  try {
    const cachedImageData = await ensureReceiptImageData();
    
    setFeePaid(true);
    setDeliveryCheckoutSessionId(paymentIntentId);
    setShowStripePayment(false);
    
    await persistDraft(
      buildDraftPayload({
        deliveryCheckoutSessionId: paymentIntentId,
        feePaid: true,
        receiptImageData: cachedImageData,
      })
    ).catch(() => null);

    toast({
      title: "Payment successful",
      description: "Your delivery payment is ready. You can place your order.",
    });
  } catch (error) {
    console.error(error);
    toast({
      title: "Error",
      description: "Payment succeeded but failed to update order. Please contact support.",
      variant: "destructive",
    });
  }
};

const handleStripePaymentError = (error: string) => {
  toast({
    title: "Payment failed",
    description: error || "Please try again.",
    variant: "destructive",
  });
  setShowStripePayment(false);
};
```

#### D. Replace Payment Form UI

**Find (around line 1291):**
```typescript
<div className="rounded-lg border border-border/70 bg-card/80 p-3 space-y-3">
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <CreditCard className="h-4 w-4" />
    <span>Pay securely with your card</span>
  </div>
  <div className="space-y-3">
    <Input value={cardName} ... />
    <Input value={cardNumber} ... />
    <div className="grid grid-cols-2 gap-3">
      <Input value={cardExpiry} ... />
      <Input value={cardCvc} ... />
    </div>
  </div>
</div>
```

**Replace with:**
```typescript
{showStripePayment && !feePaid ? (
  <div className="rounded-lg border border-border/70 bg-card/80 p-4 space-y-3">
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
      <CreditCard className="h-4 w-4" />
      <span>Pay securely with Stripe</span>
    </div>
    <StripePaymentForm
      amountCents={Math.max(0, orderTotalCents - discountCents)}
      couponCode={couponCode}
      onSuccess={handleStripePaymentSuccess}
      onError={handleStripePaymentError}
    />
    <Button
      variant="outline"
      onClick={() => setShowStripePayment(false)}
      className="w-full"
    >
      Cancel
    </Button>
  </div>
) : (
  <div className="rounded-lg border border-border/70 bg-card/80 p-3">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <CreditCard className="h-4 w-4" />
      <span>Secure payment powered by Stripe</span>
    </div>
  </div>
)}
```

### Step 4: Update Payment Button

The existing payment button should work as-is, but ensure it calls `handlePayDeliveryFee`:

```typescript
<Button
  onClick={handlePayDeliveryFee}
  disabled={paymentProcessing || feePaid || !deliveryFeeReady}
  className="gap-2"
>
  {feePaid ? (
    <>
      <CheckCircle2 className="h-4 w-4" /> Payment ready
    </>
  ) : (
    <>
      {deliveryFeeReady
        ? `Pay ${formatCurrency(Math.max(0, orderTotalCents - discountCents))}`
        : "Payment pending estimate"}{" "}
      <CreditCard className="h-4 w-4" />
    </>
  )}
</Button>
```

### Step 5: Test the Implementation

1. **Install packages:**
   ```bash
   cd /home/ubuntu/otw-chi
   pnpm install
   ```

2. **Test locally:**
   ```bash
   pnpm dev
   ```

3. **Test scenarios:**
   - ✅ Regular payment (e.g., $21.21)
   - ✅ Partial discount (e.g., 50% off)
   - ✅ 100% discount (free order with code ZAFJDE5E)
   - ✅ Payment failure handling
   - ✅ Payment cancellation

4. **Verify Stripe Dashboard:**
   - Check that PaymentIntents are created
   - Verify successful payments appear
   - Confirm free orders don't create PaymentIntents

### Step 6: Deploy to Production

```bash
git add .
git commit -m "feat: Implement Stripe Payment Element for secure payments"
git push origin main
```

## How It Works

### Regular Payment Flow

1. User clicks "Pay $X.XX"
2. `handlePayDeliveryFee()` sets `showStripePayment = true`
3. `StripePaymentForm` component mounts
4. Component calls `/api/stripe/create-payment-intent`
5. API creates PaymentIntent with Stripe
6. API returns `clientSecret`
7. Stripe Payment Element loads in iframe
8. User enters card details securely
9. User clicks "Pay" button in form
10. Stripe processes payment
11. `handleStripePaymentSuccess()` called with `paymentIntentId`
12. Order updated with payment confirmation

### Free Order Flow (100% Discount)

1. User applies coupon code ZAFJDE5E
2. Discount calculation: $21.21 - 100% = $0.00
3. User clicks "Pay $0.00"
4. `handlePayDeliveryFee()` sets `showStripePayment = true`
5. `StripePaymentForm` component mounts
6. Component calls `/api/stripe/create-payment-intent` with `amountCents: 0`
7. API detects free order, returns `{ free: true }`
8. Component shows "Order is free" message
9. `handleStripePaymentSuccess()` called with `"free_order"`
10. Order marked as paid without Stripe transaction

## Security Benefits

### ✅ PCI Compliance

- Card data never touches your server
- Stripe handles all sensitive data
- Automatic PCI DSS compliance

### ✅ Tokenization

- Card details tokenized by Stripe
- Only tokens sent to your server
- No raw card data stored

### ✅ 3D Secure Support

- Automatic 3DS authentication
- Reduces fraud and chargebacks
- Meets Strong Customer Authentication (SCA) requirements

### ✅ Real Payment Processing

- Actual charges through Stripe
- Proper payment confirmation
- Webhook support for async updates

## Cleanup (Optional)

After implementation is verified, you can remove:

1. **Old payment API:**
   ```bash
   rm /home/ubuntu/otw-chi/app/api/payments/native-charge/route.ts
   ```

2. **Old state variables** (already removed in Step 3B)

3. **Old validation logic** for card fields

## Troubleshooting

### Issue: "Stripe publishable key not found"

**Solution:** Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in Vercel environment variables

### Issue: Payment Element not loading

**Solution:** Check browser console for errors, verify Stripe key is correct

### Issue: "Amount must be at least $0.50"

**Solution:** This is expected for free orders - the component handles this automatically

### Issue: Payment succeeds but order not updated

**Solution:** Check `handleStripePaymentSuccess()` implementation and error logs

## Testing with Stripe Test Cards

Use these test cards in development:

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 9995 | Declined payment |
| 4000 0025 0000 3155 | Requires 3D Secure |

**Expiry:** Any future date (e.g., 12/34)  
**CVC:** Any 3 digits (e.g., 123)

## Support

For issues or questions:
- Check Stripe Dashboard logs
- Review browser console errors
- Verify environment variables
- Test with Stripe test cards

---

**Implementation Status:** ✅ Ready to implement  
**Security Level:** ✅ PCI Compliant  
**Coupon Support:** ✅ Fully integrated  
**Free Orders:** ✅ Supported
