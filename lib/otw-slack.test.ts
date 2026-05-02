import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildSlackOtwAutomationAlert, buildSlackOtwRequestAlert } from '@/lib/otw-slack';

describe('OTW Slack alerts', () => {
  it('formats delivery request alerts', () => {
    const message = buildSlackOtwRequestAlert({
      requestId: 'req_123',
      customerName: 'Jordan Lee',
      customerEmail: 'jordan@example.com',
      customerPhone: '+12605550123',
      serviceType: 'FOOD',
      pickupAddress: '123 Main St',
      dropoffAddress: '456 Elm St',
      notes: 'Leave at front desk',
      scheduledFor: 'Fri, May 2, 2026, 5:30 PM',
      paymentRequired: true,
      totalEstimated: 42.5,
    });

    expect(message).toContain('NEW OTW REQUEST');
    expect(message).toContain('Awaiting Payment');
    expect(message).toContain('$42.50');
    expect(message).toContain('Pickup:* 123 Main St');
  });

  it('formats automation intake alerts', () => {
    const message = buildSlackOtwAutomationAlert({
      requestId: 'req_456',
      payload: {
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
      },
    });

    expect(message).toContain('NEW OTW INTAKE REQUEST');
    expect(message).toContain('Service Type:* catering');
    expect(message).toContain('Pickup:* 123 Main St');
    expect(message).toContain('Dropoff:* 456 Elm St');
  });
});
