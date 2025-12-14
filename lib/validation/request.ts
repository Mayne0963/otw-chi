import { z } from 'zod';

export const ServiceTypeEnum = z.enum(['FOOD', 'STORE', 'FRAGILE', 'CONCIERGE']);

export const CreateRequestSchema = z.object({
  pickup: z.string().min(2, 'Pickup required'),
  dropoff: z.string().min(2, 'Dropoff required'),
  serviceType: ServiceTypeEnum,
  notes: z.string().optional(),
});

export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;

