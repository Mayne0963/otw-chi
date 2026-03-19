'use client';

import { useEffect, useRef } from 'react';
import { AuthView } from '@neondatabase/auth/react';

type AuthViewWithPasswordToggleProps = {
  path: string;
};

function applyPasswordToggle(scope: HTMLElement) {
  const inputs = scope.querySelectorAll('input');

  inputs.forEach((node) => {
    if (!(node instanceof HTMLInputElement)) return;

    const input = node;
    const isBound = input.dataset.otwPasswordToggleBound === 'true';
    const isPasswordField = input.type === 'password';

    if (!isPasswordField || isBound) return;

    const container = input.parentElement;
    if (!container) return;

    input.dataset.otwPasswordToggleBound = 'true';
    input.dataset.otwOriginalPaddingRight = input.style.paddingRight || '';

    const computedPaddingRight = Number.parseFloat(getComputedStyle(input).paddingRight) || 0;
    if (computedPaddingRight < 60) {
      input.style.paddingRight = '4.25rem';
    }

    const containerPosition = getComputedStyle(container).position;
    if (containerPosition === 'static') {
      container.dataset.otwOriginalPosition = container.style.position || '';
      container.style.position = 'relative';
    }

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.dataset.otwPasswordToggleButton = 'true';
    toggleButton.textContent = 'Show';
    toggleButton.setAttribute('aria-label', 'Show password');
    toggleButton.style.position = 'absolute';
    toggleButton.style.top = '50%';
    toggleButton.style.right = '0.75rem';
    toggleButton.style.transform = 'translateY(-50%)';
    toggleButton.style.border = 'none';
    toggleButton.style.background = 'transparent';
    toggleButton.style.color = 'rgba(255, 255, 255, 0.72)';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.padding = '0.125rem 0.25rem';
    toggleButton.style.fontSize = '0.75rem';
    toggleButton.style.fontWeight = '600';
    toggleButton.style.lineHeight = '1';

    toggleButton.addEventListener('click', () => {
      const showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      toggleButton.textContent = showPassword ? 'Hide' : 'Show';
      toggleButton.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
      input.focus({ preventScroll: true });
    });

    container.appendChild(toggleButton);
  });
}

export default function AuthViewWithPasswordToggle({ path }: AuthViewWithPasswordToggleProps) {
  const scopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    applyPasswordToggle(scope);

    const observer = new MutationObserver(() => {
      applyPasswordToggle(scope);
    });

    observer.observe(scope, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['type'],
    });

    return () => {
      observer.disconnect();

      const buttons = scope.querySelectorAll('button[data-otw-password-toggle-button="true"]');
      buttons.forEach((button) => {
        button.remove();
      });

      const passwordInputs = scope.querySelectorAll('input[data-otw-password-toggle-bound="true"]');
      passwordInputs.forEach((node) => {
        if (!(node instanceof HTMLInputElement)) return;
        const input = node;
        input.style.paddingRight = input.dataset.otwOriginalPaddingRight || '';
        delete input.dataset.otwPasswordToggleBound;
        delete input.dataset.otwOriginalPaddingRight;
      });
    };
  }, []);

  return (
    <div ref={scopeRef}>
      <AuthView path={path} />
    </div>
  );
}
