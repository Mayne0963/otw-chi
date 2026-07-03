import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  buildAutomationAcknowledgementPreview,
  buildDeliveryRequestAcknowledgementPreview,
} from '@/lib/customer-acknowledgements';

describe('customer acknowledgment copy', () => {
  it('uses request-received wording for OTW delivery requests', () => {
    const preview = buildDeliveryRequestAcknowledgementPreview({
      requestId: 'req_123',
      customerName: 'Jordan',
      serviceType: 'FOOD',
      pickupAddress: '123 Main St',
      dropoffAddress: '456 Elm St',
      notes: 'Leave at the front desk',
    });

    expect(preview.subject).toContain('Request Received');
    expect(preview.subject).not.toContain('Confirmed');
    expect(preview.text).toContain('We received your delivery request');
  });

  it('uses received wording for OTW intake acknowledgments', () => {
    const preview = buildAutomationAcknowledgementPreview({
      businessType: 'otw',
      customerName: 'Jordan Lee',
      phone: '+12605550123',
      email: 'jordan@example.com',
      serviceType: 'catering',
      pickupAddress: '123 Main St',
      dropoffAddress: '456 Elm St',
      notes: 'Buffet setup requested',
      price: 42.5,
      source: 'website',
      address: '',
    });

    expect(preview.subject).toContain('OTW Request Received');
    expect(preview.text).toContain('We received your OTW request');
    expect(preview.text).toContain('before confirming next steps on our end');
  });
});
