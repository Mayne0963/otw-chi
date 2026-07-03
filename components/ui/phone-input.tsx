'use client';

import * as React from 'react';
import { Input, type InputProps } from '@/components/ui/input';
import { formatPhoneNumber } from '@/lib/phone';

type PhoneInputProps = Omit<InputProps, 'type' | 'inputMode' | 'autoComplete'>;

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ defaultValue, value, onChange, maxLength = 18, ...props }, ref) => {
    const formattedValue =
      typeof value === 'string' || typeof value === 'number'
        ? formatPhoneNumber(String(value))
        : value;

    const formattedDefaultValue =
      typeof defaultValue === 'string' || typeof defaultValue === 'number'
        ? formatPhoneNumber(String(defaultValue))
        : defaultValue;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhoneNumber(event.target.value);
      if (event.target.value !== formatted) {
        event.target.value = formatted;
      }
      onChange?.(event);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={maxLength}
        value={formattedValue}
        defaultValue={formattedDefaultValue}
        onChange={handleChange}
      />
    );
  },
);

PhoneInput.displayName = 'PhoneInput';

export default PhoneInput;
