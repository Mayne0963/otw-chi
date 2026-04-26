import { z } from 'zod';

export const AUTOMATION_INTAKE_EVENT = 'business_intake_submitted' as const;

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required`);
const optionalText = z
  .preprocess((value) => (typeof value === 'string' ? value.trim() : value), z.string().optional())
  .transform((value) => value ?? '');
const priceSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string') {
      const normalized = value.replace(/[$,]/g, '').trim();
      return normalized ? Number(normalized) : Number.NaN;
    }
    return value;
  },
  z.number({ message: 'Price is required' }).finite('Price must be a valid number').nonnegative('Price cannot be negative'),
);

const commonFields = {
  customerName: requiredText('Customer name'),
  phone: requiredText('Phone'),
  email: requiredText('Email').email('Enter a valid email address'),
  serviceType: requiredText('Service type'),
  notes: optionalText,
  price: priceSchema,
  source: requiredText('Order source'),
};

export const broskiAutomationIntakeSchema = z.object({
  businessType: z.literal('broski'),
  ...commonFields,
  address: requiredText('Address'),
  pickupAddress: optionalText.optional(),
  dropoffAddress: optionalText.optional(),
});

export const otwAutomationIntakeSchema = z.object({
  businessType: z.literal('otw'),
  ...commonFields,
  address: optionalText.optional(),
  pickupAddress: requiredText('Pickup address'),
  dropoffAddress: requiredText('Dropoff address'),
});

export const automationIntakeSchema = z.discriminatedUnion('businessType', [
  broskiAutomationIntakeSchema,
  otwAutomationIntakeSchema,
]);

export type AutomationBusinessType = z.infer<typeof automationIntakeSchema>['businessType'];
export type AutomationIntakeInput = z.input<typeof automationIntakeSchema>;
export type AutomationIntakePayload = z.output<typeof automationIntakeSchema>;

export type AutomationFieldErrors = Record<string, string[]>;

export type AutomationZapierRecord = {
  event: typeof AUTOMATION_INTAKE_EVENT;
  requestId: string;
  submittedAt: string;
  businessType: AutomationBusinessType;
  customerName: string;
  phone: string;
  email: string;
  serviceType: string;
  notes: string;
  price: number;
  priceCents: number;
  source: string;
  orderSource: string;
  status: 'New';
  paid: false;
  completed: false;
  followUpSent: false;
  address?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
};

export function formatAutomationValidationErrors(error: z.ZodError): AutomationFieldErrors {
  return error.issues.reduce<AutomationFieldErrors>((acc, issue) => {
    const key = issue.path.length ? issue.path.join('.') : 'form';
    acc[key] = [...(acc[key] ?? []), issue.message];
    return acc;
  }, {});
}

export function buildZapierAutomationRecord(
  payload: AutomationIntakePayload,
  context: { requestId: string; submittedAt: string },
): AutomationZapierRecord {
  const base = {
    event: AUTOMATION_INTAKE_EVENT,
    requestId: context.requestId,
    submittedAt: context.submittedAt,
    businessType: payload.businessType,
    customerName: payload.customerName,
    phone: payload.phone,
    email: payload.email,
    serviceType: payload.serviceType,
    notes: payload.notes,
    price: payload.price,
    priceCents: Math.round(payload.price * 100),
    source: payload.source,
    orderSource: payload.source,
    status: 'New',
    paid: false,
    completed: false,
    followUpSent: false,
  } satisfies Omit<AutomationZapierRecord, 'address' | 'pickupAddress' | 'dropoffAddress'>;

  if (payload.businessType === 'broski') {
    return {
      ...base,
      address: payload.address,
    };
  }

  return {
    ...base,
    pickupAddress: payload.pickupAddress,
    dropoffAddress: payload.dropoffAddress,
  };
}

export function getAutomationConfirmationMessage(payload: AutomationIntakePayload) {
  return payload.businessType === 'broski'
    ? "Your Broski request was received. We'll review it and follow up with next steps."
    : "Your OTW request was received. We'll review it and follow up with next steps.";
}
