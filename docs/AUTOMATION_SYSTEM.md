# Broski and OTW Automation System

This app exposes a production intake endpoint for Zapier-based automation:

- `POST /api/automation/intake`
- Server Zapier sender: `lib/automation/zapier.ts`
- Shared payload schema: `lib/automation/intake.ts`
- Client submit helper: `lib/automation/form-handler.ts`

Set `ZAPIER_WEBHOOK_URL` to the Zapier Catch Hook URL in every environment that accepts real form submissions.
To send one submission to multiple Zaps, set `ZAPIER_WEBHOOK_URLS` to a comma-separated list of Catch Hook URLs (this takes precedence over `ZAPIER_WEBHOOK_URL`).

## 1. Next.js form handler code

Use the reusable client helper from a form component. Keep the Zapier webhook URL server-only; never post to Zapier directly from the browser.

```tsx
'use client';

import { useState } from 'react';
import { submitAutomationForm, type AutomationSubmitResult } from '@/lib/automation/form-handler';

export function AutomationRequestForm() {
  const [result, setResult] = useState<AutomationSubmitResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const businessType = String(form.get('businessType') ?? 'broski');

    const payload = {
      businessType,
      customerName: String(form.get('customerName') ?? ''),
      phone: String(form.get('phone') ?? ''),
      email: String(form.get('email') ?? ''),
      serviceType: String(form.get('serviceType') ?? ''),
      address: String(form.get('address') ?? ''),
      pickupAddress: String(form.get('pickupAddress') ?? ''),
      dropoffAddress: String(form.get('dropoffAddress') ?? ''),
      notes: String(form.get('notes') ?? ''),
      price: String(form.get('price') ?? ''),
      source: 'website',
    };

    const nextResult = await submitAutomationForm(payload);
    setResult(nextResult);
    setIsSubmitting(false);

    if (nextResult.ok) {
      event.currentTarget.reset();
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {/* Render businessType, customer, address, notes, and price fields here. */}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Submit request'}
      </button>
      {result ? <p>{result.message}</p> : null}
    </form>
  );
}
```

The helper validates required fields, posts JSON to `/api/automation/intake`, and returns one of these outcomes:

```ts
type AutomationSubmitResult =
  | { ok: true; id: string; message: string }
  | {
      ok: false;
      error: 'VALIDATION_ERROR' | 'REQUEST_FAILED' | 'NETWORK_ERROR';
      message: string;
      status?: number;
      fieldErrors?: Record<string, string[]>;
    };
```

## 2. Example webhook request

Website to Next.js endpoint:

```bash
curl -X POST https://your-domain.com/api/automation/intake \
  -H 'Content-Type: application/json' \
  -d '{
    "businessType": "otw",
    "customerName": "Jordan Lee",
    "phone": "+12605550123",
    "email": "jordan@example.com",
    "serviceType": "concierge delivery",
    "pickupAddress": "110 W Berry St, Fort Wayne, IN",
    "dropoffAddress": "200 E Main St, Fort Wayne, IN",
    "notes": "Pick up at front desk.",
    "price": 42.50,
    "source": "website"
  }'
```

Next.js sends this normalized top-level payload to Zapier:

```json
{
  "event": "business_intake_submitted",
  "requestId": "5f1b5d4f-9c18-42f6-a1f0-0c47cc8a66c4",
  "submittedAt": "2026-04-26T18:00:00.000Z",
  "businessType": "otw",
  "customerName": "Jordan Lee",
  "phone": "+12605550123",
  "email": "jordan@example.com",
  "serviceType": "concierge delivery",
  "pickupAddress": "110 W Berry St, Fort Wayne, IN",
  "dropoffAddress": "200 E Main St, Fort Wayne, IN",
  "notes": "Pick up at front desk.",
  "price": 42.5,
  "priceCents": 4250,
  "source": "website",
  "orderSource": "OTW",
  "status": "New",
  "paid": false,
  "completed": false,
  "followUpSent": false
}
```

Broski request payloads use `businessType: "broski"` and `address` instead of pickup/dropoff addresses.

## 3. Data structure definitions

Canonical incoming payload:

```ts
type AutomationIntakePayload =
  | {
      businessType: 'broski';
      customerName: string;
      phone: string;
      email: string;
      serviceType: string;
      address: string;
      notes?: string;
      price: number;
      source: string;
    }
  | {
      businessType: 'otw';
      customerName: string;
      phone: string;
      email: string;
      serviceType: string;
      pickupAddress: string;
      dropoffAddress: string;
      notes?: string;
      price: number;
      source: string;
    };
```

Storage tables should include these fields.

Common fields:

| Field | Type | Default |
| --- | --- | --- |
| Record ID | Text | Zapier record id or `requestId` |
| Customer Name | Text | From `customerName` |
| Phone | Phone/Text | From `phone` |
| Email | Email | From `email` |
| Service Type | Text/Single select | From `serviceType` |
| Notes | Long text | From `notes` |
| Price | Currency | From `price` |
| Status | Single select | `New` |
| Paid | Checkbox | `false` |
| Completed | Checkbox | `false` |
| Follow-up Sent | Checkbox | `false` |
| Order Source | Text/Single select | From `orderSource` |
| Stripe Link | URL | Empty until payment automation runs |
| Created At | Date/time | From `submittedAt` |

Broski Orders fields:

| Field | Type | Source |
| --- | --- | --- |
| Address | Long text | `address` |

OTW Jobs fields:

| Field | Type | Source |
| --- | --- | --- |
| Pickup Address | Long text | `pickupAddress` |
| Dropoff Address | Long text | `dropoffAddress` |

## 4. Zapier routing configuration

Zap 1: Website intake to storage.

1. Trigger: Webhooks by Zapier, Catch Hook.
2. Test the hook with the example request above.
3. Add Paths by Zapier.
4. Path A filter: `businessType` exactly matches `broski`.
5. Path A action: Create Record in `Broski Orders`.
6. Path A field mapping: map common fields, set `Status = New`, `Paid = false`, `Completed = false`, `Follow-up Sent = false`, map `Address` from `address`.
7. Path B filter: `businessType` exactly matches `otw`.
8. Path B action: Create Record in `OTW Jobs`.
9. Path B field mapping: map common fields, set `Status = New`, `Paid = false`, `Completed = false`, `Follow-up Sent = false`, map `Pickup Address` and `Dropoff Address`.
10. Turn on Zapier error notifications for failed Zap runs.

Zapier should branch on the top-level `businessType`, not on a nested `data.businessType` field.

## 5. Stripe integration logic

Use two payment Zaps, one watching `Broski Orders` and one watching `OTW Jobs`, or one Zap with Paths if your storage app supports both tables in one trigger.

Payment-link Zap:

1. Trigger: New or Updated Record in the storage table.
2. Filter: `Status` equals `Awaiting Payment`.
3. Filter: `Stripe Link` is empty.
4. Formatter: convert `Price` to cents if your Zapier Stripe action needs `unit_amount`.
5. Stripe action: Create Payment Link.
6. Attach metadata:
   - `record_id`: storage record id
   - `customer_name`: customer name
   - `service_type`: service type
7. Also attach the same values to `payment_intent_data.metadata` so payment completion events carry the record id.
8. Storage action: update the record with `Stripe Link` from Stripe.
9. Email action: send the customer the payment link.

If the built-in Zapier Stripe action does not expose metadata fields, use Webhooks by Zapier as a Custom Request to Stripe:

```http
POST https://api.stripe.com/v1/payment_links
Authorization: Bearer {{STRIPE_SECRET_KEY}}
Content-Type: application/x-www-form-urlencoded

line_items[0][price_data][currency]=usd&
line_items[0][price_data][unit_amount]={{priceCents}}&
line_items[0][price_data][product_data][name]={{serviceType}}&
line_items[0][quantity]=1&
metadata[record_id]={{recordId}}&
metadata[customer_name]={{customerName}}&
metadata[service_type]={{serviceType}}&
payment_intent_data[metadata][record_id]={{recordId}}&
payment_intent_data[metadata][customer_name]={{customerName}}&
payment_intent_data[metadata][service_type]={{serviceType}}
```

Payment-completed Zap:

1. Trigger: Stripe, Checkout Session Completed or Payment Intent Succeeded.
2. Read `record_id` from Stripe metadata.
3. Find the matching record in `Broski Orders` or `OTW Jobs`.
4. Update `Status = Paid / Booked`.
5. Update `Paid = true`.
6. Optionally store `Stripe Payment ID`, `Paid At`, and `Amount Paid`.
7. Send a payment confirmation email or SMS.

Keep the Stripe secret key inside Zapier's connected Stripe account or Zapier secrets. Do not expose it in browser code or public environment variables.

## 6. Follow-up automation

Create one follow-up Zap per storage table.

1. Trigger: New or Updated Record.
2. Filter: `Completed = true`.
3. Filter: `Follow-up Sent = false`.
4. Action: send immediate thank-you message.
5. Delay by Zapier: Delay For 2 days.
6. Action: send rebook or repeat message.
7. Action: update original record with `Follow-up Sent = true`.

Use the `Follow-up Sent` guard to prevent duplicate messages when a completed record is edited later.

## 7. Error handling best practices

- Validate on the server and client. The server schema is authoritative.
- Return `422` for field validation errors and include `fieldErrors` keyed by field name.
- Return `503` when `ZAPIER_WEBHOOK_URL` and `ZAPIER_WEBHOOK_URLS` are missing in the deployment environment.
- Return `502` when Zapier rejects or times out.
- Use a short timeout and bounded retry when posting to Zapier. This implementation uses a 5 second timeout and 2 attempts.
- Include a stable `requestId` in every Zapier payload for debugging and dedupe.
- Do not mark a website submission successful unless Zapier accepted it or you have stored it in a durable fallback queue.
- For high volume, add a database dead-letter table or queue so failed submissions can be replayed.
- Add Zapier filters that stop payment-link creation when `Stripe Link` is already populated.
- Use Stripe webhooks or Zapier Stripe triggers to update `Paid`; never trust a redirect URL alone as proof of payment.
- Keep all secrets server-side: `ZAPIER_WEBHOOK_URL` / `ZAPIER_WEBHOOK_URLS`, Stripe secret key, and storage API keys.
