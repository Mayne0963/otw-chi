import type { ServiceType } from '@prisma/client';

export function isServiceTypeAllowedForPlan(
  allowedServiceTypes: unknown,
  serviceType: ServiceType
): boolean {
  if (allowedServiceTypes == null) return true;

  if (typeof allowedServiceTypes === 'string') {
    return allowedServiceTypes === '*' || allowedServiceTypes === serviceType;
  }

  if (Array.isArray(allowedServiceTypes)) {
    const allowed = allowedServiceTypes.filter((value): value is string => typeof value === 'string');
    return allowed.includes('*') || allowed.includes(serviceType);
  }

  return false;
}

