// @vitest-environment jsdom
// ============================================================================
// NEXUS — ErrorBoundary Tests
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  it('renderuje children gdy nie ma błędu', () => {
    render(
      <ErrorBoundary>
        <div>Test child</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Test child')).toBeInTheDocument();
  });

  it('wyświetla domyślny fallback UI gdy komponent rzuca błędem', () => {
    const ThrowingComponent = () => {
      throw new Error('Test error');
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByText('Reload App')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('wyświetla niestandardowy fallback z prop gdy wystąpił błąd', () => {
    const ThrowingComponent = () => {
      throw new Error('Another error');
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom fallback')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
