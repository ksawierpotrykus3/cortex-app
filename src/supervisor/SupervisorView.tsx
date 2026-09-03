// ============================================================================
// CORTEX — AI Supervisor & Centrala Automatyzacji (Automation Hub)
// Architektura: 100% Vesper Dark (#101010 / #262626 / #FFC799)
// Zero-Mock, Dynamiczny odczyt stanu z data/pipelines/
// ============================================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Lancuch, Krok, DecyzjaPayload } from './types';

interface SupervisorViewProps {
  onBackToNotes?: () => void;
}

type HubFilter = 'all' | 'wait' | 'running' | 'cron';
type HubViewType = 'grid' | 'table';
type DetailTab = 'decyzja' | 'tabela' | 'reasoning' | 'prompt' | 'pliki' | 'logi';

const POLLING_INTERVAL_MS = 1200;
const TOAST_DURATION_MS = 4000;

function isCronPipeline(pipe: Lancuch): boolean {
  return pipe.wyzwalacz_typ === 'cron' || (pipe.wyzwalacz || '').toLowerCase().includes('harmonogram');
}

export function SupervisorView({ onBackToNotes }: SupervisorViewProps) {
  const [pipelines, setPipelines] = useState<Lancuch[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'hub' | 'detail'>('hub');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Stan widoku Hubu
  const [hubFilter, setHubFilter] = useState<HubFilter>('all');
  const [hubViewType, setHubViewType] = useState<HubViewType>('grid');
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  // Stan widoku Szczegółowego (Master-Detail)
  const [selectedStepIdx, setSelectedStepIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<DetailTab>('decyzja');
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Pobieranie łańcuchów z dysku ---
  const loadPipelinesFromDisk = useCallback(async (isInitial = false) => {
    if (!window.nexusBridge?.supervisorGetPipelines) {
      setLoading(false);
      return;
    }

    try {
      const list = await window.nexusBridge.supervisorGetPipelines();
      setPipelines(list);
      setLoadError(null);

      if (isInitial && list.length > 0) {
        const first = list[0];
        setActivePipelineId(first.id);
        const waitIdx = first.kroki.findIndex(k => k.status === 'czeka_na_ciebie');
        const targetIdx = waitIdx >= 0 ? waitIdx : 0;
        setSelectedStepIdx(targetIdx);
        setDefaultTabForStep(first.kroki[targetIdx]);
      }
    } catch (err) {
      console.error('[SupervisorView] Błąd odczytu data/pipelines:', err);
      setLoadError('Nie udało się odczytać stanu z data/pipelines/.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // Cykliczny podgląd na żywo z dysku
  useEffect(() => {
    loadPipelinesFromDisk(true);
    const interval = setInterval(() => {
      loadPipelinesFromDisk(false);
    }, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadPipelinesFromDisk]);

  // Sprzątanie timera toasta przy odmontowaniu
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const activePipeline = pipelines.find(p => p.id === activePipelineId) || pipelines[0] || null;

  // Walidacja selectedStepIdx po każdej zmianie danych
  const safeStepIdx = activePipeline
    ? Math.max(0, Math.min(selectedStepIdx, activePipeline.kroki.length - 1))
    : 0;

  const setDefaultTabForStep = (step?: Krok) => {
    if (!step) return;
    if (step.decyzja || step.wymaga_akceptacji) {
      setActiveTab('decyzja');
    } else if (step.tabela && step.tabela.length > 0) {
      setActiveTab('tabela');
    } else if (step.reasoning) {
      setActiveTab('reasoning');
    } else if (step.wejscie || step.promptUser || step.promptSystem) {
      setActiveTab('prompt');
    } else if (step.pliki && step.pliki.length > 0) {
      setActiveTab('pliki');
    } else if (step.logi && step.logi.length > 0) {
      setActiveTab('logi');
    } else {
      setActiveTab('decyzja');
    }
  };

  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, TOAST_DURATION_MS);
  };

  // --- Obsługa decyzji użytkownika ---
  const handleDecision = async (action: 'approve' | 'modify' | 'reject', comment?: string) => {
    if (!activePipelineId || !window.nexusBridge?.supervisorSaveDecision) return;
    const currentStep = activePipeline?.kroki[safeStepIdx];
    if (!currentStep) return;

    setSubmitting(true);
    try {
      const payload: DecyzjaPayload = {
        pipelineId: activePipelineId,
        stepId: currentStep.id,
        decision: action,
        feedback: comment || feedbackText.trim() || undefined,
      };

      const result = await window.nexusBridge.supervisorSaveDecision(payload);

      if (!result?.success) {
        showToast('✕ Nie udało się zapisać decyzji', 'Sprawdź uprawnienia katalogu data/pipelines/.');
        return;
      }

      if (action === 'approve') {
        showToast('✓ Decyzja zatwierdzona (Zapisano do decyzja.json)', 'AI odczytało potwierdzenie i kontynuuje proces.');
      } else if (action === 'modify') {
        showToast('✎ Żądanie modyfikacji przekazane', `Komentarz został przekazany do modelu.`);
      } else {
        showToast('✕ Odrzucono operację', 'Proces został zatrzymany.');
      }

      setFeedbackText('');
      setShowFeedbackInput(false);
      await loadPipelinesFromDisk(false);
    } catch (err) {
      console.error('[SupervisorView] Błąd zapisu decyzji:', err);
      showToast('✕ Błąd zapisu decyzji', 'Nie udało się połączyć z warstwą dysku.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Uruchomienie łańcucha (uniwersalny silnik) ---
  const handleRunChain = async () => {
    if (!activePipeline) return;
    const runFn = window.nexusBridge?.supervisorRun || window.nexusBridge?.supervisorRunChain;
    if (!runFn) return;

    setSubmitting(true);
    try {
      const zlecenieDane = activePipeline.opis
        ? { title: activePipeline.opis, description: activePipeline.opis }
        : undefined;

      const result = await runFn({
        pipelineId: activePipeline.id,
        zlecenieDane,
      });

      if (result?.success) {
        showToast('▶ Uruchomiono łańcuch', 'Silnik wystartował. Śledź postęp na żywo.');
      } else {
        showToast('✕ Błąd uruchomienia', result?.error || 'Nieznany błąd silnika.');
      }

      await loadPipelinesFromDisk(false);
    } catch (err) {
      console.error('[SupervisorView] Błąd uruchomienia łańcucha:', err);
      showToast('✕ Błąd uruchomienia', 'Nie udało się uruchomić silnika.');
    } finally {
      setSubmitting(false);
    }
  };

  // Przejście do szczegółów danego potoku
  const openPipelineDetail = (pipelineId: string) => {
    setActivePipelineId(pipelineId);
    const target = pipelines.find(p => p.id === pipelineId);
    if (target) {
      const waitIdx = target.kroki.findIndex(k => k.status === 'czeka_na_ciebie');
      const targetIdx = waitIdx >= 0 ? waitIdx : 0;
      setSelectedStepIdx(targetIdx);
      setDefaultTabForStep(target.kroki[targetIdx]);
    }
    setViewMode('detail');
  };

  // Obliczenia do kokpitu w Hubie
  const totalPipelines = pipelines.length;
  const waitingCount = pipelines.filter(p => p.kroki.some(k => k.status === 'czeka_na_ciebie')).length;
  const runningCount = pipelines.filter(p => p.status_ogolny === 'w_toku' || p.kroki.some(k => k.status === 'w_toku')).length;
  const cronCount = pipelines.filter(isCronPipeline).length;

  const filteredPipelines = pipelines.filter(p => {
    if (hubFilter === 'all') return true;
    if (hubFilter === 'wait') return p.kroki.some(k => k.status === 'czeka_na_ciebie');
    if (hubFilter === 'running') return p.kroki.some(k => k.status === 'w_toku');
    if (hubFilter === 'cron') return isCronPipeline(p);
    return true;
  });

  return (
    <div className="min-h-screen bg-[#101010] text-[#f5f5f5] font-sans antialiased flex flex-col selection:bg-[#FFC799]/20 selection:text-[#FFC799]">
      
      {/* GÓRNY PASEK GŁÓWNY (HEADER) */}
      <header className="sticky top-0 z-40 bg-[#141414]/95 backdrop-blur-md border-b border-[#262626] px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FFC799] shadow-[0_0_10px_rgba(255,199,153,0.4)]" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">CORTEX</span>
              <span className="text-[#444] text-xs">/</span>
              <span className="text-xs font-semibold text-[#FFC799] tracking-wider uppercase">
                {viewMode === 'hub' ? 'Centrala Automatyzacji' : 'AI Supervisor'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {viewMode === 'detail' ? (
              <>
                <button
                  onClick={() => setViewMode('hub')}
                  className="text-xs px-3 py-1.5 rounded-xl bg-[#1c1c1c] hover:bg-[#242424] text-[#eee] hover:text-white border border-[#2e2e2e] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>←</span>
                  <span>Wróć do Centrali</span>
                </button>

                {pipelines.length > 1 && (
                  <select
                    value={activePipelineId || ''}
                    onChange={e => openPipelineDetail(e.target.value)}
                    className="bg-[#181818] hover:bg-[#202020] text-[#dddddd] text-xs font-medium px-3 py-1.5 rounded-xl border border-[#262626] outline-none cursor-pointer transition-colors"
                  >
                    {pipelines.map(p => (
                      <option key={p.id} value={p.id} className="bg-[#141414] text-white">
                        {p.nazwa}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() => setIsAutoMode(prev => !prev)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isAutoMode
                      ? 'border-[#4ade80]/40 bg-[#4ade80]/10 text-[#4ade80] font-medium'
                      : 'border-[#262626] bg-[#181818] text-[#ccc] hover:text-white'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isAutoMode ? 'bg-[#4ade80]' : 'bg-[#FFC799]'}`} />
                  <span>{isAutoMode ? 'Tryb: Auto' : 'Tryb: Ręczny (Bramki)'}</span>
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center bg-[#101010] p-1 rounded-xl border border-[#262626] gap-1 text-xs">
                  <button
                    onClick={() => setHubViewType('grid')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      hubViewType === 'grid'
                        ? 'bg-[#202020] text-white border border-[#333]'
                        : 'text-[#888] hover:text-[#ccc]'
                    }`}
                  >
                    Karty Kafelkowe
                  </button>
                  <button
                    onClick={() => setHubViewType('table')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      hubViewType === 'table'
                        ? 'bg-[#202020] text-white border border-[#333]'
                        : 'text-[#888] hover:text-[#ccc]'
                    }`}
                  >
                    Tabela Operacyjna
                  </button>
                </div>

                <button
                  onClick={() => setIsConnectModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#FFC799] text-[#101010] font-bold text-xs hover:bg-[#ffa866] transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <span>+</span>
                  <span>Podepnij nową automatyzację</span>
                </button>
              </>
            )}

            {onBackToNotes && (
              <button
                onClick={onBackToNotes}
                className="text-xs px-3 py-1.5 rounded-xl bg-[#202020] hover:bg-[#282828] text-white font-medium border border-[#333] transition-colors cursor-pointer"
              >
                ← Notatki
              </button>
            )}
          </div>

        </div>
      </header>

      {/* GŁÓWNA PRZESTRZEŃ (HUB LUB MASTER-DETAIL) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {loading ? (
          <div className="py-24 text-center text-[#777] text-sm font-mono">
            Odczytuję stan z katalogu data/pipelines/...
          </div>
        ) : loadError ? (
          <div className="py-20 px-8 text-center rounded-2xl border border-[#ef4444]/30 bg-[#141414] space-y-4 max-w-lg mx-auto mt-12">
            <div className="w-10 h-10 mx-auto rounded-full bg-[#ef4444]/10 border border-[#ef4444]/40 flex items-center justify-center text-[#ef4444] text-sm font-mono">
              !
            </div>
            <h2 className="text-base font-semibold text-white">Błąd odczytu stanu</h2>
            <p className="text-xs text-[#888] leading-relaxed">{loadError}</p>
          </div>
        ) : pipelines.length === 0 ? (
          /* Stan pusty */
          <div className="py-20 px-8 text-center rounded-2xl border border-[#262626] bg-[#141414] space-y-4 max-w-lg mx-auto mt-12">
            <div className="w-10 h-10 mx-auto rounded-full bg-[#181818] border border-[#333] flex items-center justify-center text-[#FFC799] text-sm font-mono">
              0
            </div>
            <h2 className="text-base font-semibold text-white">Brak aktywnych potoków na dysku</h2>
            <p className="text-xs text-[#888] leading-relaxed">
              Katalog <code className="text-[#FFC799] font-mono bg-black/50 px-1.5 py-0.5 rounded border border-[#262626]">data/pipelines/</code> jest pusty.
            </p>
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-[#FFC799] text-[#101010] font-bold text-xs hover:bg-[#ffa866] cursor-pointer"
            >
              Zobacz jak podpiąć pierwszy proces
            </button>
          </div>
        ) : viewMode === 'hub' ? (
          /* WIDOK 1: CENTRALA AUTOMATYZACJI (AUTOMATION HUB) */
          <div className="space-y-6">
            
            {/* KOKPIT METRYK */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4">
                <div className="flex items-center justify-between text-[#888] text-xs font-mono">
                  <span>WSZYSTKIE ŁAŃCUCHY</span>
                  <span className="w-2 h-2 rounded-full bg-[#4ade80]" />
                </div>
                <div className="text-2xl font-bold text-white mt-2 tracking-tight">
                  {totalPipelines} <span className="text-xs font-normal text-[#888]">podpiętych</span>
                </div>
                <div className="text-[11px] text-[#666] mt-1">Zsynchronizowane z data/pipelines/</div>
              </div>

              <div className={`bg-[#141414] border rounded-2xl p-4 ${waitingCount > 0 ? 'border-[#FFC799]/50 shadow-[0_0_15px_rgba(255,199,153,0.08)]' : 'border-[#262626]'}`}>
                <div className="flex items-center justify-between text-[#FFC799] text-xs font-mono">
                  <span>CZEKA NA TWOJĄ ZGODĘ</span>
                  <span className="w-2 h-2 rounded-full bg-[#FFC799] animate-pulse" />
                </div>
                <div className="text-2xl font-bold text-white mt-2 tracking-tight">
                  {waitingCount} <span className="text-xs font-normal text-[#FFC799]">bramki decyzyjne</span>
                </div>
                <div className="text-[11px] text-[#888] mt-1">Wymaga akcji użytkownika</div>
              </div>

              <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4">
                <div className="flex items-center justify-between text-[#888] text-xs font-mono">
                  <span>W TOKU (AKTYWNE)</span>
                  <span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
                </div>
                <div className="text-2xl font-bold text-white mt-2 tracking-tight">
                  {runningCount} <span className="text-xs font-normal text-[#888]">pracuje</span>
                </div>
                <div className="text-[11px] text-[#666] mt-1">Wykonywane w tle przez Playwright / AI</div>
              </div>

              <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4">
                <div className="flex items-center justify-between text-[#888] text-xs font-mono">
                  <span>HARMONOGRAMY (CRON)</span>
                  <span className="text-[10px] text-[#4ade80] font-mono">AKTYWNE</span>
                </div>
                <div className="text-2xl font-bold text-white mt-2 tracking-tight">
                  {cronCount} <span className="text-xs font-normal text-[#888]">zaplanowane</span>
                </div>
                <div className="text-[11px] text-[#666] mt-1">Cykliczne wyzwalacze czasowe</div>
              </div>
            </div>

            {/* FILTRY I LISTA */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#141414] border border-[#262626] rounded-2xl p-3 px-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#777] font-mono">Filtruj:</span>
                <button
                  onClick={() => setHubFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    hubFilter === 'all'
                      ? 'bg-[#202020] text-white border border-[#333]'
                      : 'text-[#888] hover:text-[#ccc]'
                  }`}
                >
                  Wszystkie ({pipelines.length})
                </button>
                <button
                  onClick={() => setHubFilter('wait')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    hubFilter === 'wait'
                      ? 'bg-[#202020] text-white border border-[#333]'
                      : 'text-[#888] hover:text-[#ccc]'
                  }`}
                >
                  Wymaga decyzji ({waitingCount})
                </button>
                <button
                  onClick={() => setHubFilter('running')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    hubFilter === 'running'
                      ? 'bg-[#202020] text-white border border-[#333]'
                      : 'text-[#888] hover:text-[#ccc]'
                  }`}
                >
                  W toku ({runningCount})
                </button>
                <button
                  onClick={() => setHubFilter('cron')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    hubFilter === 'cron'
                      ? 'bg-[#202020] text-white border border-[#333]'
                      : 'text-[#888] hover:text-[#ccc]'
                  }`}
                >
                  Harmonogramy ({cronCount})
                </button>
              </div>

              <div className="text-xs text-[#666] font-mono">
                Ścieżka: <code className="text-[#FFC799] bg-[#101010] px-2 py-0.5 rounded border border-[#262626]">data/pipelines/</code>
              </div>
            </div>

            {/* KAFELKI KROKÓW (GRID VIEW) */}
            {hubViewType === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPipelines.map(pipe => {
                  const isWaiting = pipe.kroki.some(k => k.status === 'czeka_na_ciebie');
                  const isRunning = pipe.kroki.some(k => k.status === 'w_toku');
                  const doneCount = pipe.kroki.filter(k => k.status === 'zrobione').length;

                  let dotColor = '#4ade80';
                  let statusText = 'Zakończono pomyślnie';
                  let badgeClass = 'bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/30';

                  if (isWaiting) {
                    dotColor = '#FFC799';
                    statusText = 'Czeka na Twoją decyzję';
                    badgeClass = 'bg-[#FFC799]/15 text-[#FFC799] border-[#FFC799]/30';
                  } else if (isRunning) {
                    dotColor = '#60a5fa';
                    statusText = 'W toku';
                    badgeClass = 'bg-[#60a5fa]/10 text-[#60a5fa] border-[#60a5fa]/30';
                  } else if (isCronPipeline(pipe)) {
                    dotColor = '#888888';
                    statusText = 'Harmonogram (Cron)';
                    badgeClass = 'bg-[#1c1c1c] text-[#888] border-[#2e2e2e]';
                  }

                  return (
                    <div
                      key={pipe.id}
                      className={`bg-[#141414] border rounded-2xl p-5 flex flex-col justify-between hover:border-[#383838] transition-all ${
                        isWaiting ? 'border-[#FFC799]/50 shadow-[0_0_20px_rgba(255,199,153,0.06)]' : 'border-[#262626]'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#262626]">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                              <h3 className="text-sm font-bold text-white tracking-tight">{pipe.nazwa}</h3>
                            </div>
                            <div className="text-[11px] text-[#777] font-mono mt-1">
                              {pipe.silnik || 'Silnik zewnętrzny'}
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badgeClass}`}>
                            {statusText}
                          </span>
                        </div>

                        {pipe.opis && (
                          <p className="text-xs text-[#888] mt-3 leading-relaxed line-clamp-2">
                            {pipe.opis}
                          </p>
                        )}

                        <div className="mt-4 pt-3 border-t border-[#1c1c1c] space-y-1.5 text-[11px] text-[#666] font-mono">
                          <div className="flex justify-between">
                            <span>Wyzwalacz:</span>
                            <span className="text-[#aaa]">{pipe.wyzwalacz || 'Na żądanie'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Ostatni start:</span>
                            <span className="text-[#aaa]">{pipe.ostatni_start || 'Przed chwilą'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Postęp kroków:</span>
                            <span className="text-[#FFC799] font-medium">{doneCount} / {pipe.kroki.length}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-[#262626] flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#555]">{pipe.id}</span>
                        <button
                          onClick={() => openPipelineDetail(pipe.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-xs text-[#eee] hover:text-white border border-[#333] transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Podgląd na żywo</span>
                          <span className="text-[#FFC799]">→</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABELA OPERACYJNA (TABLE VIEW) */
              <div className="border border-[#262626] rounded-2xl overflow-hidden bg-[#141414]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#181818] border-b border-[#262626] text-[#777] font-mono text-[11px]">
                    <tr>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Nazwa Automatyzacji</th>
                      <th className="p-3.5">Silnik</th>
                      <th className="p-3.5">Wyzwalacz</th>
                      <th className="p-3.5">Postęp</th>
                      <th className="p-3.5 text-right">Akcja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c1c1c] text-[#ccc]">
                    {filteredPipelines.map(pipe => {
                      const isWaiting = pipe.kroki.some(k => k.status === 'czeka_na_ciebie');
                      const isRunning = pipe.kroki.some(k => k.status === 'w_toku');
                      const doneCount = pipe.kroki.filter(k => k.status === 'zrobione').length;

                      return (
                        <tr key={pipe.id} className="hover:bg-[#181818] transition-colors">
                          <td className="p-3.5">
                            {isWaiting ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#FFC799] bg-[#FFC799]/15 px-2 py-0.5 rounded border border-[#FFC799]/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#FFC799]" /> CZEKA
                              </span>
                            ) : isRunning ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#60a5fa] bg-[#60a5fa]/10 px-2 py-0.5 rounded border border-[#60a5fa]/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa]" /> W TOKU
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#4ade80] bg-[#4ade80]/10 px-2 py-0.5 rounded border border-[#4ade80]/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" /> OK
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 font-medium text-white">
                            {pipe.nazwa}
                            <div className="text-[10px] text-[#666] font-mono">{pipe.id}</div>
                          </td>
                          <td className="p-3.5 text-[#aaa] font-mono text-[11px]">{pipe.silnik || '—'}</td>
                          <td className="p-3.5 text-[#888]">{pipe.wyzwalacz || 'Na żądanie'}</td>
                          <td className="p-3.5 font-mono text-[#FFC799]">{doneCount} / {pipe.kroki.length}</td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => openPipelineDetail(pipe.id)}
                              className="px-2.5 py-1 rounded bg-[#202020] text-xs text-[#ccc] hover:text-white border border-[#333] cursor-pointer"
                            >
                              Otwórz →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        ) : activePipeline ? (
          /* WIDOK 2: UJEDNOLICONY INSPEKTOR MASTER-DETAIL DLA WYBRANEGO POTOKU */
          <div>
            {/* Nagłówek wybranego potoku */}
            <div className="mb-6 flex items-start justify-between border-b border-[#262626] pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-white tracking-tight">{activePipeline.nazwa}</h1>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1c1c1c] text-[#888] border border-[#2e2e2e]">
                    data/pipelines/{activePipeline.id}.json
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#FFC799]/10 text-[#FFC799] border border-[#FFC799]/30">
                    KROK {safeStepIdx + 1} Z {activePipeline.kroki.length}
                  </span>
                  <button
                    onClick={handleRunChain}
                    disabled={submitting}
                    className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                      submitting
                        ? 'border-[#262626] bg-[#181818] text-[#555] cursor-not-allowed'
                        : 'border-[#FFC799]/50 bg-[#FFC799]/10 text-[#FFC799] hover:bg-[#FFC799]/20'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFC799]" />
                    <span>{submitting ? 'Uruchamianie…' : 'Uruchom łańcuch'}</span>
                  </button>
                </div>
                {activePipeline.opis && (
                  <p className="text-xs text-[#888] mt-1.5 max-w-3xl leading-relaxed">
                    {activePipeline.opis}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-[#666] font-mono">
                  Wyzwalacz: {activePipeline.wyzwalacz || 'Na żądanie'}
                </div>
                <div className="text-[11px] text-[#4ade80] font-mono mt-0.5">● Połączenie z dyskiem aktywne</div>
              </div>
            </div>

            {/* Podział 2-kolumnowy */}
            <div className="grid grid-cols-12 gap-6 min-h-[620px]">
              
              {/* Lewa kolumna: Oś Kroków (Timeline) */}
              <div className="col-span-4 bg-[#141414] border border-[#262626] rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[#262626] mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#777]">Oś wykonania</span>
                    <span className="text-[11px] text-[#555] font-mono">{activePipeline.kroki.length} kroki</span>
                  </div>

                  <div className="space-y-2">
                    {activePipeline.kroki.map((step, idx) => {
                      const isSelected = selectedStepIdx === idx;
                      const isWaiting = step.status === 'czeka_na_ciebie';
                      const isDone = step.status === 'zrobione';

                      let borderStyle = isSelected
                        ? 'border-[#FFC799]/60 bg-[#1c1c1c] shadow-sm'
                        : 'border-[#262626] bg-[#101010] hover:bg-[#181818] hover:border-[#333]';

                      let dotColor = isDone ? '#4ade80' : isWaiting ? '#FFC799' : '#525252';

                      return (
                        <div
                          key={step.id ?? idx}
                          onClick={() => {
                            setSelectedStepIdx(idx);
                            setFeedbackText('');
                            setShowFeedbackInput(false);
                            setDefaultTabForStep(step);
                          }}
                          className={`p-3 rounded-xl border transition-all duration-150 cursor-pointer ${borderStyle}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isWaiting ? 'animate-pulse' : ''}`}
                                style={{ backgroundColor: dotColor }}
                              />
                              <div>
                                <div className="text-xs font-semibold text-white tracking-tight">
                                  {step.nazwa}
                                </div>
                                <div className="text-[11px] text-[#777] font-mono mt-0.5">
                                  {step.narzedzie || step.typ.toUpperCase()}
                                </div>
                              </div>
                            </div>
                            {step.czas_trwania_s !== undefined && (
                              <span className="text-[10px] font-mono text-[#555]">{step.czas_trwania_s}s</span>
                            )}
                          </div>
                          {step.opis && (
                            <p className="text-[11px] text-[#888] mt-2 line-clamp-2 leading-relaxed">
                              {step.opis}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Podsumowanie stanu na dole listy */}
                <div className="pt-3 border-t border-[#262626] text-[11px] text-[#666] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />{' '}
                    {activePipeline.kroki.filter(k => k.status === 'zrobione').length} zrobione
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFC799]" />{' '}
                    {activePipeline.kroki.filter(k => k.status === 'czeka_na_ciebie').length} czeka
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#525252]" />{' '}
                    {activePipeline.kroki.filter(k => k.status === 'w_kolejce').length} w kolejce
                  </span>
                </div>
              </div>

              {/* Prawa kolumna: Szczegółowy Inspektor Bloków KROKU */}
              {activePipeline.kroki[safeStepIdx] && (() => {
                const currentStep = activePipeline.kroki[safeStepIdx];
                const hasDecision = Boolean(currentStep.decyzja || currentStep.wymaga_akceptacji);
                const hasTable = Boolean(currentStep.tabela && currentStep.tabela.length > 0);
                const hasReasoning = Boolean(currentStep.reasoning);
                const hasPrompt = Boolean(currentStep.wejscie || currentStep.promptUser || currentStep.promptSystem);
                const hasFiles = Boolean(currentStep.pliki && currentStep.pliki.length > 0);
                const hasLogs = Boolean(currentStep.logi && currentStep.logi.length > 0);

                return (
                  <div className="col-span-8 bg-[#141414] border border-[#262626] rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                      {/* Nagłówek wybranego kroku */}
                      <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1c1c1c] text-[#FFC799] border border-[#2e2e2e]">
                              Krok {safeStepIdx + 1} · {currentStep.typ.toUpperCase()}
                            </span>
                            <h2 className="text-base font-bold text-white tracking-tight">{currentStep.nazwa}</h2>
                          </div>
                          {currentStep.opis && (
                            <p className="text-xs text-[#888] mt-1">{currentStep.opis}</p>
                          )}
                        </div>

                        {currentStep.status === 'zrobione' ? (
                          <div className="text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1.5 bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/30">
                            <span className="w-2 h-2 rounded-full bg-[#4ade80]" /> Zakończony pomyślnie
                          </div>
                        ) : currentStep.status === 'czeka_na_ciebie' ? (
                          <div className="text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1.5 bg-[#FFC799]/15 text-[#FFC799] border border-[#FFC799]/30">
                            <span className="w-2 h-2 rounded-full bg-[#FFC799] animate-pulse" /> Czeka na Twoją decyzję
                          </div>
                        ) : (
                          <div className="text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1.5 bg-[#1c1c1c] text-[#777] border border-[#2e2e2e]">
                            <span className="w-2 h-2 rounded-full bg-[#525252]" /> W kolejce
                          </div>
                        )}
                      </div>

                      {/* Zakładki inspektora */}
                      <div className="flex items-center gap-2 mt-4 border-b border-[#262626] pb-2 text-xs">
                        {hasDecision && (
                          <button
                            onClick={() => setActiveTab('decyzja')}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                              activeTab === 'decyzja'
                                ? 'text-[#FFC799] bg-[#FFC799]/10 border border-[#FFC799]/30'
                                : 'text-[#888] hover:text-[#ccc] hover:bg-[#1c1c1c]'
                            }`}
                          >
                            <span>Bramka Decyzji</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FFC799]" />
                          </button>
                        )}

                        {hasTable && (
                          <button
                            onClick={() => setActiveTab('tabela')}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                              activeTab === 'tabela'
                                ? 'text-[#FFC799] bg-[#FFC799]/10 border border-[#FFC799]/30'
                                : 'text-[#888] hover:text-[#ccc] hover:bg-[#1c1c1c]'
                            }`}
                          >
                            Tabela Wyników ({currentStep.tabela?.length || 0})
                          </button>
                        )}

                        {hasReasoning && (
                          <button
                            onClick={() => setActiveTab('reasoning')}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                              activeTab === 'reasoning'
                                ? 'text-[#FFC799] bg-[#FFC799]/10 border border-[#FFC799]/30'
                                : 'text-[#888] hover:text-[#ccc] hover:bg-[#1c1c1c]'
                            }`}
                          >
                            Myśli Modelu (DeepSeek)
                          </button>
                        )}

                        {hasPrompt && (
                          <button
                            onClick={() => setActiveTab('prompt')}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                              activeTab === 'prompt'
                                ? 'text-[#FFC799] bg-[#FFC799]/10 border border-[#FFC799]/30'
                                : 'text-[#888] hover:text-[#ccc] hover:bg-[#1c1c1c]'
                            }`}
                          >
                            Prompt Wejściowy
                          </button>
                        )}

                        {hasFiles && (
                          <button
                            onClick={() => setActiveTab('pliki')}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                              activeTab === 'pliki'
                                ? 'text-[#FFC799] bg-[#FFC799]/10 border border-[#FFC799]/30'
                                : 'text-[#888] hover:text-[#ccc] hover:bg-[#1c1c1c]'
                            }`}
                          >
                            Artefakty ({currentStep.pliki?.length || 0})
                          </button>
                        )}

                        {hasLogs && (
                          <button
                            onClick={() => setActiveTab('logi')}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                              activeTab === 'logi'
                                ? 'text-[#FFC799] bg-[#FFC799]/10 border border-[#FFC799]/30'
                                : 'text-[#888] hover:text-[#ccc] hover:bg-[#1c1c1c]'
                            }`}
                          >
                            Logi ({currentStep.logi?.length || 0})
                          </button>
                        )}
                      </div>

                      {/* Treść wybranej zakładki */}
                      <div className="py-4 min-h-[360px]">
                        {activeTab === 'decyzja' && hasDecision && (
                          <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-[#181818] border border-[#FFC799]/30">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 rounded-full bg-[#FFC799] animate-pulse" />
                                <span className="text-xs font-bold text-[#FFC799] uppercase tracking-wider">
                                  Bramka Bezpieczeństwa (Cortex Safety Gate)
                                </span>
                              </div>
                              <p className="text-sm text-white font-medium mb-4">
                                {currentStep.decyzja?.pytanie || 'Czy zatwierdzasz wynik tego etapu i zezwalasz na kontynuację?'}
                              </p>

                              <div className="flex flex-wrap gap-3">
                                {(currentStep.decyzja?.opcje?.length
                                  ? currentStep.decyzja.opcje
                                  : [
                                      { akcja: 'approve', etykieta: '✓ Zatwierdź i kontynuuj', styl: 'primary' },
                                      { akcja: 'modify', etykieta: '✎ Popraw wytyczne (Komentarz)', styl: 'secondary' },
                                      { akcja: 'reject', etykieta: '✕ Odrzuć i zakończ', styl: 'danger' },
                                    ] as const
                                ).map(opcja => {
                                  const akcja = opcja.akcja;
                                  if (akcja === 'modify') {
                                    return (
                                      <button
                                        key="modify"
                                        onClick={() => setShowFeedbackInput(prev => !prev)}
                                        disabled={submitting}
                                        className="px-4 py-2 rounded-xl bg-[#202020] text-[#eee] font-medium text-xs border border-[#333] hover:bg-[#282828] hover:text-white transition-all cursor-pointer"
                                      >
                                        {opcja.etykieta || '✎ Popraw wytyczne (Komentarz)'}
                                      </button>
                                    );
                                  }
                                  const isApprove = akcja === 'approve';
                                  const isReject = akcja === 'reject';
                                  return (
                                    <button
                                      key={akcja}
                                      onClick={() => handleDecision(akcja)}
                                      disabled={submitting}
                                      className={`px-4 py-2 rounded-xl font-medium text-xs transition-all cursor-pointer disabled:opacity-50 ${
                                        isApprove
                                          ? 'bg-[#FFC799] text-[#101010] font-bold hover:bg-[#ffa866] shadow-md'
                                          : isReject
                                            ? 'bg-[#1c1c1c] text-[#ef4444] border border-[#ef4444]/30 hover:bg-[#ef4444]/10'
                                            : 'bg-[#202020] text-[#eee] border border-[#333] hover:bg-[#282828] hover:text-white'
                                      }`}
                                    >
                                      {opcja.etykieta || (isApprove ? '✓ Zatwierdź i kontynuuj' : '✕ Odrzuć i zakończ')}
                                    </button>
                                  );
                                })}
                              </div>

                              {showFeedbackInput && (
                                <div className="mt-4 pt-3 border-t border-[#262626] space-y-2">
                                  <textarea
                                    value={feedbackText}
                                    onChange={e => setFeedbackText(e.target.value)}
                                    placeholder="Napisz co model/skrypt ma zmienić lub poprawić..."
                                    rows={2}
                                    className="w-full bg-[#101010] border border-[#333] rounded-xl p-2.5 text-xs text-white placeholder-[#666] outline-none focus:border-[#FFC799]"
                                  />
                                  <button
                                    onClick={() => handleDecision('modify')}
                                    disabled={submitting || !feedbackText.trim()}
                                    className="px-3.5 py-1.5 rounded-lg bg-[#FFC799] text-[#101010] font-bold text-xs hover:bg-[#ffa866] cursor-pointer disabled:opacity-50"
                                  >
                                    Wyślij korektę do AI
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="p-3 rounded-xl bg-[#101010] border border-[#262626] text-xs space-y-1">
                              <div className="text-[#777] font-mono text-[11px]">Protokół zapisu:</div>
                              <div className="text-[#bbb] font-mono">
                                Decyzja zapisywana do: <span className="text-[#FFC799]">data/pipelines/{activePipeline.id}/decyzja.json</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {activeTab === 'tabela' && hasTable && currentStep.tabela && (
                          <div className="border border-[#262626] rounded-xl overflow-hidden bg-[#101010]">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-[#181818] border-b border-[#262626] text-[#777] font-mono text-[11px]">
                                <tr>
                                  {Object.keys(currentStep.tabela[0] || {}).map(col => (
                                    <th key={col} className="p-3">{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#1c1c1c] text-[#ccc]">
                                {currentStep.tabela.map((row, rIdx) => (
                                  <tr key={rIdx} className="hover:bg-[#141414]">
                                    {Object.values(row).map((val, cIdx) => (
                                      <td key={cIdx} className="p-3 text-white font-mono">
                                        {String(val)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {activeTab === 'reasoning' && hasReasoning && (
                          <div className="p-4 rounded-xl bg-[#101010] border border-[#262626] font-sans text-xs text-[#ddd] leading-relaxed whitespace-pre-wrap">
                            <div className="flex items-center gap-2 mb-2 text-[#777] font-mono text-[11px]">
                              <span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
                              <span>STRUMIEŃ WNIOSKOWANIA (DeepSeek Reasoning):</span>
                            </div>
                            {currentStep.reasoning}
                          </div>
                        )}

                        {activeTab === 'prompt' && hasPrompt && (
                          <div className="p-4 rounded-xl bg-[#101010] border border-[#262626] font-mono text-xs text-[#FFC799] leading-relaxed whitespace-pre-wrap">
                            <div className="text-[#777] mb-2">// Wejście przekazane do narzędzia / modelu:</div>
                            {currentStep.wejscie || currentStep.promptUser || currentStep.promptSystem}
                          </div>
                        )}

                        {activeTab === 'pliki' && hasFiles && (
                          <div className="space-y-3">
                            <div className="text-xs text-[#777] font-mono">Wygenerowane pliki i artefakty:</div>
                            <div className="grid grid-cols-2 gap-3">
                              {currentStep.pliki?.map((f, fIdx) => (
                                <div key={fIdx} className="p-3 rounded-xl bg-[#101010] border border-[#262626] flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#FFC799]">📄</span>
                                    <span className="font-mono text-white">{f.nazwa}</span>
                                  </div>
                                  <span className="text-[10px] text-[#555] font-mono">DYSK</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeTab === 'logi' && hasLogs && (
                          <div className="p-4 rounded-xl bg-[#0d0d0d] border border-[#262626] font-mono text-xs text-[#a3a3a3] leading-relaxed space-y-1 max-h-72 overflow-y-auto custom-scroll">
                            {currentStep.logi?.map((l, lIdx) => (
                              <div key={lIdx}>{l}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        ) : null}
      </main>

      {/* MODAL: INSTRUKCJA PODPINANIA AUTOMATYZACJI */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#333] rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#262626] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFC799]" />
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Podepnij dowolny proces do Cortexa</h3>
                  <p className="text-xs text-[#888] mt-0.5">Jeden folder, jeden plik stanu. Cortex zrobi resztę.</p>
                </div>
              </div>
              <button
                onClick={() => setIsConnectModalOpen(false)}
                className="text-[#888] hover:text-white text-lg font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626]">
                <div className="font-bold text-white mb-1 flex items-center gap-2">
                  <span className="text-[#FFC799] font-mono">KROK 1:</span> Twój skrypt wykonuje pracę
                </div>
                <p className="text-[#aaa] leading-relaxed">
                  Dowolny kod: Python, Playwright, scraper, generator faktur czy prompt do DeepSeek.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626]">
                <div className="font-bold text-white mb-1 flex items-center gap-2">
                  <span className="text-[#FFC799] font-mono">KROK 2:</span> Zapisuj stan do pliku
                </div>
                <p className="text-[#aaa] leading-relaxed">
                  Utwórz podfolder w <code className="text-[#FFC799] font-mono">data/pipelines/moj_bot/</code> i zapisuj w nim plik <code className="text-white font-mono bg-black px-1.5 py-0.5 rounded">stan.json</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626]">
                <div className="font-bold text-white mb-1 flex items-center gap-2">
                  <span className="text-[#FFC799] font-mono">KROK 3:</span> Cortex natychmiast go wyświetli
                </div>
                <p className="text-[#aaa] leading-relaxed">
                  Automatycznie pojawi się nowy kafelek w Centrali, a po kliknięciu zobaczysz ujednolicony podgląd kroków i bramki decyzyjne.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#262626]">
              <div className="text-[11px] text-[#666] font-mono">
                Cortex nie ingeruje w kod skryptu — jest tylko wizualizatorem.
              </div>
              <button
                onClick={() => setIsConnectModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#FFC799] text-[#101010] font-bold text-xs hover:bg-[#ffa866] cursor-pointer"
              >
                Rozumiem, zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST POWIADOMIENIA */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#181818] border border-[#FFC799]/40 rounded-xl p-4 shadow-2xl max-w-sm flex items-start gap-3 transition-all animate-bounce">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFC799] mt-1 flex-shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-white">{toastMessage.title}</h4>
            <p className="text-[11px] text-[#aaa] mt-0.5">{toastMessage.desc}</p>
          </div>
        </div>
      )}

    </div>
  );
}
