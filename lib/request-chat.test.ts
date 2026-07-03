import { describe, expect, it } from 'vitest';
import { DeliveryRequestStatus, Role } from '@prisma/client';
import { isRequestChatOpen, isRequestParticipant, type ChatGateRequest } from './request-chat';

const baseRequest: ChatGateRequest = {
  id: 'req_123',
  userId: 'customer_user',
  assignedDriverId: 'driver_profile',
  status: DeliveryRequestStatus.ASSIGNED,
  chatEnabled: true,
  chatClosedAt: null,
  assignedDriver: { userId: 'driver_user' },
};

describe('request chat gates', () => {
  it('is open only after assignment and before closure states', () => {
    expect(isRequestChatOpen(baseRequest)).toBe(true);

    expect(
      isRequestChatOpen({
        ...baseRequest,
        assignedDriverId: null,
      }),
    ).toBe(false);

    expect(
      isRequestChatOpen({
        ...baseRequest,
        status: DeliveryRequestStatus.DELIVERED,
      }),
    ).toBe(false);

    expect(
      isRequestChatOpen({
        ...baseRequest,
        status: DeliveryRequestStatus.CANCELED,
      }),
    ).toBe(false);

    expect(
      isRequestChatOpen({
        ...baseRequest,
        chatClosedAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('recognizes only request participants and admins', () => {
    expect(
      isRequestParticipant(baseRequest, {
        id: 'customer_user',
        role: Role.CUSTOMER,
      }),
    ).toBe(true);

    expect(
      isRequestParticipant(baseRequest, {
        id: 'driver_user',
        role: Role.DRIVER,
      }),
    ).toBe(true);

    expect(
      isRequestParticipant(baseRequest, {
        id: 'admin_user',
        role: Role.ADMIN,
      }),
    ).toBe(true);

    expect(
      isRequestParticipant(baseRequest, {
        id: 'random_user',
        role: Role.CUSTOMER,
      }),
    ).toBe(false);
  });
});
