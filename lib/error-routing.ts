export const ERROR_PAGE_PATH = '/app-error';

export type ErrorCategory =
  | 'quota'
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'payment'
  | 'network'
  | 'not_found'
  | 'unknown';

type ErrorCategoryDetail = {
  title: string;
  description: string;
};

const ERROR_CATEGORY_DETAILS: Record<ErrorCategory, ErrorCategoryDetail> = {
  quota: {
    title: 'Service temporarily unavailable',
    description: 'Our service is currently at capacity. Please try again shortly.',
  },
  unauthorized: {
    title: 'Sign-in required',
    description: 'Your session is missing or expired. Please sign in and try again.',
  },
  forbidden: {
    title: 'Access denied',
    description: 'You do not have permission to perform that action.',
  },
  validation: {
    title: 'Invalid input',
    description: 'Some required information was missing or invalid.',
  },
  payment: {
    title: 'Payment issue',
    description: 'We could not complete the payment-related action.',
  },
  network: {
    title: 'Connection issue',
    description: 'A network problem interrupted the request. Please try again.',
  },
  not_found: {
    title: 'Resource not found',
    description: 'The requested item could not be found.',
  },
  unknown: {
    title: 'Something went wrong',
    description: 'An unexpected error occurred while processing your request.',
  },
};

function truncateMessage(message: string, maxLength = 220): string {
  if (message.length <= maxLength) return message;
  return `${message.slice(0, maxLength - 1).trimEnd()}…`;
}

export function normalizeErrorMessage(input: unknown, fallback = 'Unexpected error'): string {
  if (typeof input === 'string') {
    const clean = input.replace(/\s+/g, ' ').trim();
    return clean ? truncateMessage(clean) : fallback;
  }

  if (input instanceof Error) {
    const clean = input.message.replace(/\s+/g, ' ').trim();
    return clean ? truncateMessage(clean) : fallback;
  }

  if (input && typeof input === 'object' && 'message' in input && typeof input.message === 'string') {
    const clean = input.message.replace(/\s+/g, ' ').trim();
    return clean ? truncateMessage(clean) : fallback;
  }

  return fallback;
}

export function classifyErrorMessage(message: string): ErrorCategory {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('exceeded the data transfer quota') ||
    (normalized.includes('quota') && normalized.includes('exceeded'))
  ) {
    return 'quota';
  }

  if (normalized.includes('unauthorized') || normalized.includes('not authenticated')) {
    return 'unauthorized';
  }

  if (normalized.includes('forbidden') || normalized.includes('permission')) {
    return 'forbidden';
  }

  if (
    normalized.includes('validation') ||
    normalized.includes('invalid') ||
    normalized.includes('required')
  ) {
    return 'validation';
  }

  if (
    normalized.includes('payment') ||
    normalized.includes('card') ||
    normalized.includes('stripe') ||
    normalized.includes('checkout')
  ) {
    return 'payment';
  }

  if (
    normalized.includes('network') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('timeout') ||
    normalized.includes('offline')
  ) {
    return 'network';
  }

  if (normalized.includes('not found') || normalized.includes('404')) {
    return 'not_found';
  }

  return 'unknown';
}

export function getErrorCategoryDetail(category: ErrorCategory): ErrorCategoryDetail {
  return ERROR_CATEGORY_DETAILS[category];
}

export function getErrorCategoryOrDefault(value: string | null | undefined): ErrorCategory {
  if (value && value in ERROR_CATEGORY_DETAILS) {
    return value as ErrorCategory;
  }
  return 'unknown';
}

export function buildErrorPageHref(error: unknown, source = 'runtime'): string {
  const message = normalizeErrorMessage(error);
  const category = classifyErrorMessage(message);
  const params = new URLSearchParams({
    category,
    message,
    source,
  });
  return `${ERROR_PAGE_PATH}?${params.toString()}`;
}
