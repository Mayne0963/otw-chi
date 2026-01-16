# Coupon Code Diagnosis Report - ZAFJDE5E

## Executive Summary

The 100% off promo code **ZAFJDE5E** is failing during checkout due to a **minimum order total validation** that prevents orders below $0.50 from being processed. This is a critical business logic issue that blocks free orders from being completed.

---

## Root Cause Analysis

### Primary Issue: Minimum Total Validation

**Location:** `/app/api/stripe/delivery-checkout/route.ts` (Lines 79-82)

```typescript
const finalTotal = Math.max(0, baseTotal - discountCents);
if (finalTotal < 50) {
  return NextResponse.json({ error: "Total must be at least $0.50" }, { status: 400 });
}
```

**Problem:** When a 100% discount coupon is applied, the `finalTotal` becomes `0` cents, which is less than the required minimum of `50` cents ($0.50). This triggers an immediate rejection with the error message **"Total must be at least $0.50"**.

### Secondary Issue: Coupon Configuration

**Location:** `/scripts/fix-coupon.ts` (Lines 18, 24)

```typescript
percentOff: 50, // Assuming 50% as before
```

**Problem:** The fix script shows the coupon `ZAFJDE5E` is configured with only **50% off** instead of **100% off**. The comment "Assuming 50% as before" indicates uncertainty about the correct discount amount.

---

## Error Flow Diagram

```
User enters ZAFJDE5E at checkout
    ↓
Code normalizes to uppercase: ZAFJDE5E
    ↓
System checks internal database (Prisma)
    ↓
If found: Calculate discount (50% or 100%)
    ↓
Calculate finalTotal = baseTotal - discountCents
    ↓
If finalTotal < 50 cents → ❌ ERROR: "Total must be at least $0.50"
    ↓
Checkout blocked
```

---

## Code Analysis

### 1. Coupon Validation Flow

The checkout process follows this sequence:

1. **Normalization** (`lib/coupons.ts`, line 12-17):
   - Removes non-alphanumeric characters
   - Converts to uppercase
   - `ZAFJDE5E` → `ZAFJDE5E` ✅

2. **Database Lookup** (`lib/coupons.ts`, line 19-52):
   - Checks internal `PromoCode` table first
   - Validates: active status, date range, redemption limits, user eligibility
   - Falls back to Stripe if not found internally

3. **Discount Calculation** (`lib/coupons.ts`, line 54-71):
   ```typescript
   if (coupon.percentOff && coupon.percentOff > 0) {
     const raw = Math.round((baseTotal * coupon.percentOff) / 100);
     return Math.min(baseTotal, raw);
   }
   ```
   - For 100% off: `discountCents = baseTotal`
   - For 50% off: `discountCents = baseTotal / 2`

4. **Final Total Validation** (`app/api/stripe/delivery-checkout/route.ts`, line 79-82):
   - **This is where the error occurs**
   - Rejects any order with `finalTotal < 50` cents

### 2. Stripe Integration

**Location:** `/app/api/stripe/delivery-checkout/route.ts` (Lines 47-77)

The system has dual coupon support:

- **Internal coupons** (stored in Prisma database)
- **Stripe promotion codes** (stored in Stripe)

For internal coupons with 100% discount, the code manually calculates `discountCents` and sets `finalTotal = 0`, but Stripe still requires creating a checkout session with a line item amount of at least $0.50.

**Stripe Limitation:** Stripe Checkout does not support $0.00 payment sessions. The minimum amount is $0.50 USD.

---

## Why This Breaks 100% Off Coupons

### Scenario: Order with $10.00 total + ZAFJDE5E (100% off)

```
baseTotal = 1000 cents ($10.00)
discountCents = 1000 cents (100% off)
finalTotal = 1000 - 1000 = 0 cents

Validation check: 0 < 50 → TRUE
Result: ❌ Error "Total must be at least $0.50"
```

### Scenario: Order with $10.00 total + ZAFJDE5E (50% off - current config)

```
baseTotal = 1000 cents ($10.00)
discountCents = 500 cents (50% off)
finalTotal = 1000 - 500 = 500 cents ($5.00)

Validation check: 500 < 50 → FALSE
Result: ✅ Proceeds to Stripe checkout
```

---

## Additional Findings

### 1. Database Schema

The `PromoCode` model supports both percentage and fixed amount discounts:

```prisma
model PromoCode {
  percentOff      Int?
  amountOffCents  Int?
  maxRedemptions  Int?
  redemptions     Int @default(0)
  // ... other fields
}
```

### 2. Coupon Preview API

**Location:** `/app/api/coupons/preview/route.ts` (Lines 98-100)

The preview endpoint has the **same validation**:

```typescript
if (discount <= 0 || baseTotal - discount < 50) {
  return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
}
```

This means users will see the error even before attempting checkout.

### 3. Order Creation API

**Location:** `/app/api/orders/route.ts` (Lines 113-131)

The order creation endpoint accepts `couponCode` and `discountCents` but does **not** have the $0.50 minimum validation. However, it requires `deliveryFeePaid: true` for orders with delivery fees, which would still require payment through the checkout flow.

---

## Recommendations

### Option 1: Bypass Payment for 100% Discounts (Recommended)

Modify the checkout flow to skip Stripe entirely when `finalTotal === 0`:

```typescript
// In /app/api/stripe/delivery-checkout/route.ts

const finalTotal = Math.max(0, baseTotal - discountCents);

if (finalTotal === 0) {
  // Handle 100% discount - no payment needed
  // Mark order as paid and redirect to success
  return NextResponse.json({ 
    url: `${appUrl}${successPath || "/order?checkout=success&free=true"}`,
    free: true 
  });
}

if (finalTotal < 50) {
  return NextResponse.json({ error: "Total must be at least $0.50" }, { status: 400 });
}
```

### Option 2: Set Minimum Order Amount

Add a minimum order subtotal requirement (e.g., $5.00) before allowing coupon application:

```typescript
const MIN_ORDER_SUBTOTAL_CENTS = 500; // $5.00

if (subtotalCents < MIN_ORDER_SUBTOTAL_CENTS) {
  return NextResponse.json({ 
    error: "Minimum order amount is $5.00" 
  }, { status: 400 });
}
```

### Option 3: Adjust Coupon to 99% Off

Change the coupon to 99% off instead of 100% off, ensuring `finalTotal >= 50` cents:

```typescript
// In /scripts/fix-coupon.ts
percentOff: 99, // 99% off instead of 100%
```

This ensures orders always have at least $0.01-$0.50 remaining.

---

## Fix Priority

**Critical:** This blocks all 100% off promotional campaigns and developer testing with free codes.

**Impact:**
- Developers cannot test checkout flow with free codes
- Marketing campaigns offering 100% off are non-functional
- Poor user experience with unclear error messages

**Recommended Action:** Implement **Option 1** to properly handle free orders by bypassing Stripe when the final total is $0.00.

---

## Configuration Issues to Address

### 1. Update Coupon Percentage

The `ZAFJDE5E` coupon needs to be updated to 100% off:

```typescript
// In /scripts/fix-coupon.ts
const coupon = await prisma.promoCode.upsert({
  where: { code: correctCode },
  update: { 
    active: true,
    percentOff: 100, // ← Change from 50 to 100
    maxRedemptions: 1000 
  },
  create: {
    code: correctCode,
    active: true,
    percentOff: 100, // ← Change from 50 to 100
    maxRedemptions: 1000,
    startsAt: new Date(),
  },
});
```

### 2. Verify Stripe Configuration

If using Stripe promotion codes, ensure the code exists in Stripe with 100% off:

- Code: `ZAFJDE5E`
- Discount: 100% off
- Active: Yes
- Applies to: All products

---

## Testing Recommendations

After implementing the fix:

1. **Test 100% off coupon** with various order amounts
2. **Test 50% off coupon** to ensure existing functionality works
3. **Test without coupon** to ensure normal checkout flow is unaffected
4. **Test coupon preview API** to ensure it shows correct discount
5. **Test order creation** to ensure free orders are properly recorded
6. **Verify database** to ensure coupon redemptions are tracked correctly

---

## Conclusion

The coupon code `ZAFJDE5E` fails during checkout because:

1. **The checkout validation requires a minimum of $0.50** after discounts are applied
2. **A 100% off coupon reduces the total to $0.00**, which is below the minimum
3. **The coupon may be configured as 50% off** instead of 100% off in the database

**Immediate Fix:** Update the checkout logic to handle $0.00 totals by bypassing Stripe payment and marking the order as paid.

**Secondary Fix:** Update the coupon configuration to ensure it's set to 100% off if that's the intended discount.
