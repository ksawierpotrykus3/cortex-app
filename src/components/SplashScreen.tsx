// ============================================================================
// NEXUS — SplashScreen
// Wyświetlany podczas inicjalizacji aplikacji (ładowanie workspace/FS)
// ============================================================================

import React from 'react';

interface SplashScreenProps {
  error?: string | null;
  onRetry?: () => void;
}

export function SplashScreen({ error, onRetry }: SplashScreenProps) {
  return (
    <div
      className="flex flex-col items-center justify-center h-screen w-screen bg-[rgb(var(--background))] text-[rgb(var(--text-main))]"
      role="status"
      aria-label={error ? 'Błąd inicjalizacji' : 'Inicjalizacja aplikacji'}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 select-none">
        <div className="w-4 h-4 rounded shadow-[0_0_15px_rgba(45,212,191,0.5)] bg-[rgb(var(--accent))] animate-pulse" />
        <span className="text-2xl font-bold tracking-wide">NEXUS</span>
      </div>

      {error ? (
        /* Error state */
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-400 text-sm font-medium">Nie udało się zainicjalizować aplikacji</p>
          <p className="text-[rgb(var(--text-secondary))] text-xs">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 px-4 py-2 bg-[rgb(var(--accent))] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              aria-label="Spróbuj ponownie"
            >
              Spróbuj ponownie
            </button>
          )}
        </div>
      ) : (
        /* Loading state */
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[rgb(var(--accent))] animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-[rgb(var(--accent))] animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-[rgb(var(--accent))] animate-bounce [animation-delay:300ms]" />
          </div>
          <p className="text-[rgb(var(--text-secondary))] text-sm">Inicjalizacja środowiska pracy...</p>
        </div>
      )}
    </div>
  );
}