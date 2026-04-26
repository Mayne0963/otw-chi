'use client';

import {
  automationIntakeSchema,
  formatAutomationValidationErrors,
  getAutomationConfirmationMessage,
  type AutomationIntakeInput,
} from '@/lib/automation/intake';

export type AutomationSubmitResult =
  | { ok: true; id: string; message: string }
  | {
      ok: false;
      error: 'VALIDATION_ERROR' | 'REQUEST_FAILED' | 'NETWORK_ERROR';
      message: string;
      status?: number;
      fieldErrors?: Record<string, string[]>;
    };

export async function submitAutomationForm(
  input: AutomationIntakeInput,
  options: { endpoint?: string; fetcher?: typeof fetch } = {},
): Promise<AutomationSubmitResult> {
  const parsed = automationIntakeSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'VALIDATION_ERROR',
      message: 'Please check the highlighted fields and try again.',
      fieldErrors: formatAutomationValidationErrors(parsed.error),
    };
  }

  const endpoint = options.endpoint ?? '/api/automation/intake';
  const fetcher = options.fetcher ?? fetch;

  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    let responseBody: {
      id?: unknown;
      error?: unknown;
      message?: unknown;
      fieldErrors?: Record<string, string[]>;
    } = {};
    try {
      responseBody = await response.json();
    } catch {
      responseBody = {};
    }

    if (!response.ok) {
      return {
        ok: false,
        error: responseBody.error === 'VALIDATION_ERROR' ? 'VALIDATION_ERROR' : 'REQUEST_FAILED',
        status: response.status,
        message:
          typeof responseBody.message === 'string'
            ? responseBody.message
            : 'We could not submit your request right now. Please try again.',
        fieldErrors: responseBody.fieldErrors,
      };
    }

    return {
      ok: true,
      id: typeof responseBody.id === 'string' ? responseBody.id : '',
      message:
        typeof responseBody.message === 'string'
          ? responseBody.message
          : getAutomationConfirmationMessage(parsed.data),
    };
  } catch {
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Network error. Please check your connection and try again.',
    };
  }
}
