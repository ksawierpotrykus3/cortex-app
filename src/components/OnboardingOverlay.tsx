// ============================================================================
// NEXUS — OnboardingOverlay (pierwsze uruchomienie / tutorial)
// Pokazuje się raz przy pierwszym uruchomieniu lub z Command Palette
// ============================================================================

import React, { useState, useEffect } from "react";
import { X, ArrowRight, ChevronLeft, Zap, GitBranch, Shield, Sparkles, Workflow, Bot, Network } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface OnboardingOverlayProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const STEPS = [
  {
    title: "Witaj w Nexus System",
    icon: Zap,
    description: "To jest Twój drugi mózg. Łączy mapy myśli, zadania, manuskrypty i agentów AI w jednym miejscu.",
    tip: "Użyj Ctrl+K aby otworzyć Command Palette z dowolnego miejsca.",
  },
  {
    title: "Topology — Mapa myśli",
    icon: Network,
    description: "Nieskończone płótno z notatkami. Twórz węzły, łącz je linkami, przeciągaj i grupuj w projekty.",
    tip: "Dwuklik na płótnie → nowa notatka. Dwuklik w projekcie → notatka w projekcie.",
  },
  {
    title: "Agenci AI",
    icon: Bot,
    description: "Twórz własnych agentów z promptami, triggerami i routingiem. Gemini, OpenRouter lub lokalny Ollama.",
    tip: "Każdy agent może działać automatycznie — timer, schowek, webhook.",
  },
  {
    title: "Pipeline DAG",
    icon: Network,
    description: "Łącz agentów w łańcuchy przetwarzania. Screenshot → OCR → Streszczenie → Wiki.",
    tip: "Pipeline działa jako jeden 'super-agent' z monitoringiem postępu.",
  },
  {
    title: "Workflows",
    icon: Workflow,
    description: "Sekwencje akcji z warunkami IF/THEN. Automatyzuj powtarzalne czynności.",
    tip: "Każdy workflow startuje w trybie Sandbox — bezpieczne testowanie bez skutków.",
  },
  {
    title: "Integracja z Gitem",
    icon: GitBranch,
    description: "Wbudowany klient Git. Commit, push, pull, branch, merge — bez terminala.",
    tip: "Skonfiguruj w Settings → Git. Auto-commit i harmonogram cykliczny dostępne.",
  },
  {
    title: "Kill Switch",
    icon: Shield,
    description: "Emergency stop dla wszystkich agentów, pipeline'ów i workflowów jednym kliknięciem.",
    tip: "Znajdziesz go w prawym górnym rogu — czerwona tarcza.",
  },
  {
    title: "Semantic Search",
    icon: Sparkles,
    description: "Szukaj AI po znaczeniu, nie po słowach. Ctrl+Shift+F → wpisz czego szukasz.",
    tip: "Działa na notatkach, taskach, manuskryptach i Wiki. Wymaga klucza Gemini.",
  },
];

export function OnboardingOverlay({ open, onClose, onComplete }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;

  const handleNext = () => {
    if (step < total - 1) {
      setStep(step + 1);
    } else {
      onComplete();
      onClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  // Focus trap (MUSI być przed warunkowym returnem — reguła hooków)
  const focusTrapRef = useFocusTrap(open);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); handleNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
      if (e.key === 'Escape') { onComplete(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, step]);

  if (!open) return null;

  const StepIcon = STEPS[step].icon;

  return (
    <div ref={focusTrapRef} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="Samouczek Nexus" className="bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-2xl shadow-2xl w-[480px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded shadow-[0_0_10px_rgba(140,150,255,0.5)] bg-[rgb(var(--accent))]" />
            <span className="text-[13px] font-bold tracking-wide text-[rgb(var(--text-main))]">NEXUS</span>
          </div>
          <button
            onClick={() => { onComplete(); onClose(); }}
            aria-label="Zamknij"
            className="p-1 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--bg-elevated))] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-3">
          <div className="flex gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={`dot-${i}`}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--border))]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 min-h-[220px] flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[rgb(var(--accent))]/10 border border-[rgb(var(--accent))]/20">
              <StepIcon className="w-5 h-5 text-[rgb(var(--accent))]" />
            </div>
            <h2 className="text-[16px] font-semibold text-[rgb(var(--text-main))]">
              {STEPS[step].title}
            </h2>
          </div>

          <p className="text-[13px] text-[rgb(var(--text-secondary))] leading-relaxed mb-4">
            {STEPS[step].description}
          </p>

          <div className="mt-auto p-3 rounded-xl bg-[rgb(var(--bg-canvas))] border border-[rgb(var(--border))]">
            <p className="text-[11px] text-[rgb(var(--text-muted))] flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[rgb(var(--accent))]" />
              <span>{STEPS[step].tip}</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-canvas))]/50">
          <div className="text-[11px] text-[rgb(var(--text-muted))]">
            {step + 1} / {total}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] hover:bg-[rgb(var(--bg-elevated))] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Wstecz
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium bg-[rgb(var(--accent))] text-black hover:bg-[rgb(var(--accent))]/90 transition-colors cursor-pointer"
            >
              {step < total - 1 ? (
                <>Dalej <ArrowRight className="w-3.5 h-3.5" /></>
              ) : (
                <>Gotowe! <Sparkles className="w-3.5 h-3.5" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
