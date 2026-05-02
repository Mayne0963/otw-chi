import { describe, expect, it } from 'vitest';

import { automationIntakeSchema, buildAutomationStorageRecord, buildZapierAutomationRecord } from './intake';

describe('automation intake schema', () => {
  it('normalizes a Broski request and builds Zapier defaults', () => {
    const parsed = automationIntakeSchema.parse({
      businessType: 'broski',
      customerName: ' Jordan Lee ',
      phone: '+12605550123',
      email: 'jordan@example.com',
      serviceType: 'catering',
      address: '123 Main St',
      notes: ' Leave at front desk ',
      price: '$42.50',
      source: 'website',
    });

    expect(parsed.customerName).toBe('Jordan Lee');
    expect(parsed.notes).toBe('Leave at front desk');
    expect(parsed.price).toBe(42.5);

    const record = buildZapierAutomationRecord(parsed, {
      requestId: 'req_123',
      submittedAt: '2026-04-26T18:00:00.000Z',
    });

    expect(record).toMatchObject({
      event: 'business_intake_submitted',
      requestId: 'req_123',
      businessType: 'broski',
      address: '123 Main St',
      status: 'New',
      paid: false,
      completed: false,
      followUpSent: false,
      priceCents: 4250,
    });
  });

  it('builds a Neon storage record with shared lifecycle fields', () => {
    const parsed = automationIntakeSchema.parse({
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
    });

    const record = buildAutomationStorageRecord(parsed, {
      requestId: 'req_456',
      submittedAt: '2026-04-26T18:00:00.000Z',
    });

    expect(record).toMatchObject({
      id: 'req_456',
      businessType: 'otw',
      customerName: 'Jordan Lee',
      pickupAddress: '123 Main St',
      dropoffAddress: '456 Elm St',
      price: 42.5,
      priceCents: 4250,
      orderSource: 'OTW',
      status: 'New',
      paid: false,
      completed: false,
      followUpSent: false,
    });
    expect(record.submittedAt.toISOString()).toBe('2026-04-26T18:00:00.000Z');
  });

  it('requires a Broski address', () => {
    const result = automationIntakeSchema.safeParse({
      businessType: 'broski',
      customerName: 'Jordan Lee',
      phone: '+12605550123',
      email: 'jordan@example.com',
      serviceType: 'catering',
      price: 42.5,
      source: 'website',
    });

    expect(result.success).toBe(false);
  });

  it('requires OTW pickup and dropoff addresses', () => {
    const result = automationIntakeSchema.safeParse({
      businessType: 'otw',
      customerName: 'Jordan Lee',
      phone: '+12605550123',
      email: 'jordan@example.com',
      serviceType: 'concierge',
      pickupAddress: '123 Main St',
      price: 42.5,
      source: 'website',
    });

    expect(result.success).toBe(false);
  });
});
