import React, { useState, useEffect } from 'react';
import { FileText, MessageSquare, Network, Plus, Trash2, Save, Send, ArrowRight, ArrowLeft, RefreshCw, Layers, Settings, Check, X, ShieldAlert } from 'lucide-react';
import { ExperimentalProject, ExperimentalChatMessage, ExperimentalNode, ExperimentalEdge, ExperimentalAIConfig } from '../types';

interface DiffProposal {
  type: 'MAP' | 'SPEC';
  title: string;
  items: Array<{
    action: '+ DODAJE' | '- USUWA' | '~ MODYFIKUJE';
    entity: string;
    details: string;
    payload?: any;
  }>;
}

export function ExperimentalWorkspace() {
  const [projects, setProjects] = useState<ExperimentalProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectsLoaded, setProjectsLoaded] = useState<boolean>(false);
  const [initialProjectName, setInitialProjectName] = useState<string>('');

  // Active Project Data
  const [specContent, setSpecContent] = useState<string>('');
  const [messages, setMessages] = useState<ExperimentalChatMessage[]>([]);
  const [nodes, setNodes] = useState<ExperimentalNode[]>([]);
  const [edges, setEdges] = useState<ExperimentalEdge[]>([]);

  // AI & Prompts Config
  const [selectedModel, setSelectedModel] = useState<'DeepSeek V4 Flash' | 'DeepSeek V4 Pro'>('DeepSeek V4 Flash');
  const [showAiSettingsModal, setShowAiSettingsModal] = useState<boolean>(false);
  const [chatSystemPrompt, setChatSystemPrompt] = useState<string>('Jesteś rygorystycznym architektem AI weryfikującym spójność mapy i pliku SPEC.');
  const [specAnalyzerSystemPrompt, setSpecAnalyzerSystemPrompt] = useState<string>('Analizuj ostatnie 10 wiadomości czatu i wyciągnij kluczowe założenia architektoniczne.');
  const [mapPlannerSystemPrompt, setMapPlannerSystemPrompt] = useState<string>('Zastosuj monolog Chain of Thought, sprawdź konflikty i zaproponuj operacje na węzłach mapy.');

  // SPEC Buffer Counter [Bufor SPEC: X/10]
  const [specBufferCount, setSpecBufferCount] = useState<number>(0);

  // Map Selection (Shift+click)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Chat input
  const [chatInput, setChatInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>('');

  // Diff Modal Proposals
  const [diffProposal, setDiffProposal] = useState<DiffProposal | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      if (window.nexusBridge?.expGetProjects) {
        const list = await window.nexusBridge.expGetProjects();
        setProjects(list);
        if (list.length > 0 && !activeProjectId) {
          selectProject(list[0].id, list);
        }
      }
    } catch (e) {
      console.error('Failed to load experimental projects:', e);
    } finally {
      setProjectsLoaded(true);
    }
  };

  const parseAiConfig = (configRaw: any): ExperimentalAIConfig => {
    if (typeof configRaw === 'string') {
      try {
        return JSON.parse(configRaw);
      } catch {
        return {};
      }
    }
    return configRaw || {};
  };

  const selectProject = async (id: string, projectList = projects) => {
    setActiveProjectId(id);
    setSelectedIds([]);
    const proj = projectList.find(p => p.id === id);
    if (proj) {
      setSpecContent(proj.spec_content || '');
      const cfg = parseAiConfig(proj.ai_config);
      if (cfg.selectedModel === 'DeepSeek V4 Pro' || cfg.selectedModel === 'DeepSeek V4 Flash') {
        setSelectedModel(cfg.selectedModel);
      } else {
        setSelectedModel('DeepSeek V4 Flash');
      }
      if (cfg.chatSystemPrompt) setChatSystemPrompt(cfg.chatSystemPrompt);
      if (cfg.specAnalyzerSystemPrompt) setSpecAnalyzerSystemPrompt(cfg.specAnalyzerSystemPrompt);
      if (cfg.mapPlannerSystemPrompt) setMapPlannerSystemPrompt(cfg.mapPlannerSystemPrompt);
    }

    try {
      if (window.nexusBridge?.expGetChatMessages) {
        const msgs = await window.nexusBridge.expGetChatMessages({ projectId: id });
        setMessages(msgs);
      }
      if (window.nexusBridge?.expGetNodes) {
        const nds = await window.nexusBridge.expGetNodes({ projectId: id });
        setNodes(nds);
      }
      if (window.nexusBridge?.expGetEdges) {
        const eds = await window.nexusBridge.expGetEdges({ projectId: id });
        setEdges(eds);
      }
    } catch (e) {
      console.error('Failed to load project details:', e);
    }
  };

  const createInitialProject = async () => {
    if (!initialProjectName.trim()) return;
    await createNewProjectWithName(initialProjectName.trim());
    setInitialProjectName('');
  };

  const createNewProject = async () => {
    await createNewProjectWithName(`Nowy Projekt ${projects.length + 1}`);
  };

  const createNewProjectWithName = async (name: string) => {
    const id = `exp_${Date.now()}`;
    const defaultAiConfig: ExperimentalAIConfig = {
      selectedModel: 'DeepSeek V4 Flash',
      chatSystemPrompt,
      specAnalyzerSystemPrompt,
      mapPlannerSystemPrompt
    };

    const newProj: ExperimentalProject = {
      id,
      name,
      spec_content: '# Nowa Specyfikacja Architektoniczna\n\nOpisz założenia projektu i wymagania spójności bazy danych...',
      ai_config: defaultAiConfig,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (window.nexusBridge?.expSaveProject) {
      await window.nexusBridge.expSaveProject({ project: newProj });
      let list: ExperimentalProject[] = [newProj];
      if (window.nexusBridge?.expGetProjects) {
        list = await window.nexusBridge.expGetProjects();
      }
      setProjects(list.length > 0 ? list : [newProj]);
      setProjectsLoaded(true);
      await selectProject(id, list.length > 0 ? list : [newProj]);
    } else {
      const list = [...projects, newProj];
      setProjects(list);
      setProjectsLoaded(true);
      await selectProject(id, list);
    }
  };

  const saveSpec = async () => {
    if (!activeProjectId) return;
    const current = projects.find(p => p.id === activeProjectId);
    if (!current) return;

    const updated: ExperimentalProject = {
      ...current,
      spec_content: specContent,
      updated_at: new Date().toISOString()
    };

    if (window.nexusBridge?.expSaveProject) {
      await window.nexusBridge.expSaveProject({ project: updated });
      setSaveStatus('Zapisano SPEC');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };

  const handleModelChange = async (newModel: 'DeepSeek V4 Flash' | 'DeepSeek V4 Pro') => {
    setSelectedModel(newModel);
    if (!activeProjectId) return;
    const current = projects.find(p => p.id === activeProjectId);
    if (!current) return;

    const currentConfig = parseAiConfig(current.ai_config);
    const updatedConfig: ExperimentalAIConfig = {
      ...currentConfig,
      selectedModel: newModel
    };

    const updatedProj: ExperimentalProject = {
      ...current,
      ai_config: updatedConfig,
      updated_at: new Date().toISOString()
    };

    if (window.nexusBridge?.expSaveProject) {
      await window.nexusBridge.expSaveProject({ project: updatedProj });
      setProjects(prev => prev.map(p => p.id === activeProjectId ? updatedProj : p));
    }
  };

  const saveAiSettings = async () => {
    if (!activeProjectId) return;
    const current = projects.find(p => p.id === activeProjectId);
    if (!current) return;

    const updatedConfig: ExperimentalAIConfig = {
      selectedModel,
      chatSystemPrompt,
      specAnalyzerSystemPrompt,
      mapPlannerSystemPrompt
    };

    const updatedProj: ExperimentalProject = {
      ...current,
      ai_config: updatedConfig,
      updated_at: new Date().toISOString()
    };

    if (window.nexusBridge?.expSaveProject) {
      await window.nexusBridge.expSaveProject({ project: updatedProj });
      setProjects(prev => prev.map(p => p.id === activeProjectId ? updatedProj : p));
      setShowAiSettingsModal(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || !activeProjectId) return;
    const contentToSend = chatInput.trim();
    setChatInput('');

    const userMsg: ExperimentalChatMessage = {
      id: `msg_${Date.now()}`,
      project_id: activeProjectId,
      role: 'user',
      content: contentToSend,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    if (window.nexusBridge?.expSaveChatMessage) {
      await window.nexusBridge.expSaveChatMessage({ message: userMsg });
    }

    // Increment SPEC buffer counter
    const newCount = specBufferCount + 1;
    setSpecBufferCount(newCount);

    setTimeout(async () => {
      const aiMsg: ExperimentalChatMessage = {
        id: `msg_${Date.now() + 1}`,
        project_id: activeProjectId,
        role: 'ai',
        content: `[Model: ${selectedModel}] Przeanalizowałem zapytanie: "${contentToSend}". Weryfikuję spójność architektury zgodnie z zasadą pesymizmu. Jeśli chcesz zaktualizować mapę lub specyfikację, użyj przycisków w panelu.`,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMsg]);
      setLoading(false);
      if (window.nexusBridge?.expSaveChatMessage) {
        await window.nexusBridge.expSaveChatMessage({ message: aiMsg });
      }

      if (newCount >= 10) {
        triggerSpecAnalysis();
      }
    }, 800);
  };

  const triggerSpecAnalysis = () => {
    if (!activeProjectId) return;
    const proposal: DiffProposal = {
      type: 'SPEC',
      title: 'Zaproponowane aktualizacje do pliku SPEC (AI #2 Analizator)',
      items: [
        {
          action: '+ DODAJE',
          entity: 'Sekcja Wymagań Spójności',
          details: 'Wymuszenie transakcyjności better-sqlite3 oraz weryfikacja pragma table_info po każdej zmianie schematu.'
        },
        {
          action: '+ DODAJE',
          entity: 'Zasada Pesymizmu AI',
          details: 'Wszystkie operacje wygenerowane przez czat lub planera mapy wymagają zatwierdzenia w oknie Diff.'
        }
      ]
    };
    setDiffProposal(proposal);
  };

  const triggerMapPlanner = () => {
    if (!activeProjectId) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const proposal: DiffProposal = {
        type: 'MAP',
        title: 'Planer Mapy AI #3 (Chain of Thought & Weryfikacja Konfliktów)',
        items: [
          {
            action: '+ DODAJE',
            entity: 'Węzeł: Walidator Relacji SQLite',
            details: 'Sprawdza spójność kluczy obcych ON DELETE CASCADE/SET NULL przed zapisem w bazach roboczych.',
            payload: {
              title: 'Walidator Relacji SQLite',
              content: 'Weryfikuje transakcje w StorageEngine i integralność tabel eksperymentalnych.'
            }
          },
          {
            action: '+ DODAJE',
            entity: 'Węzeł: Mechanizm Diff & Changelog',
            details: 'Buforuje propozycje AI i zapisuje zmiany do experimental_changelog wyłącznie po akceptacji użytkownika.',
            payload: {
              title: 'Mechanizm Diff & Changelog',
              content: 'Skryptowy zapis historii zmian gwarantujący deterministyczną spójność.'
            }
          }
        ]
      };
      setDiffProposal(proposal);
    }, 900);
  };

  const acceptDiffProposal = async () => {
    if (!diffProposal || !activeProjectId) return;

    if (diffProposal.type === 'SPEC') {
      const addedText = diffProposal.items.map(i => `* **${i.entity}**: ${i.details}`).join('\n');
      setSpecContent(prev => prev + `\n\n### Automatyczna Analiza Bufora SPEC:\n${addedText}`);
      setSpecBufferCount(0);
      await saveSpec();
    } else if (diffProposal.type === 'MAP') {
      for (const item of diffProposal.items) {
        if (item.action === '+ DODAJE' && item.payload) {
          const newNode: ExperimentalNode = {
            id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            project_id: activeProjectId,
            title: item.payload.title,
            content: item.payload.content,
            x: Math.floor(Math.random() * 250) + 40,
            y: Math.floor(Math.random() * 250) + 40,
            width: 240,
            height: 120
          };
          setNodes(prev => [...prev, newNode]);
          if (window.nexusBridge?.expSaveNode) {
            await window.nexusBridge.expSaveNode({ node: newNode });
          }
        }
      }
    }

    setDiffProposal(null);
  };

  const handleNodeClick = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
      setSelectedIds(prev => (prev.length === 1 && prev[0] === id) ? [] : [id]);
    }
  };

  const appendSelectedToChat = () => {
    const selectedNodes = nodes.filter(n => selectedIds.includes(n.id));
    if (selectedNodes.length === 0) return;
    const summary = selectedNodes.map(n => `[Węzeł: ${n.title}] - ${n.content}`).join('\n');
    setChatInput(prev => prev ? `${prev}\n\nKontekst wybranych węzłów:\n${summary}` : `Analizuj wybrane węzły:\n${summary}`);
  };

  const extractToSpec = (content: string) => {
    setSpecContent(prev => prev + `\n\n### Wyciągnięty wniosek z czatu:\n${content}`);
  };

  const extractToCanvas = async (content: string) => {
    if (!activeProjectId) return;
    const newNode: ExperimentalNode = {
      id: `node_${Date.now()}`,
      project_id: activeProjectId,
      title: 'Węzeł z Czat AI',
      content: content.slice(0, 110) + '...',
      x: Math.floor(Math.random() * 200) + 50,
      y: Math.floor(Math.random() * 200) + 50,
      width: 240,
      height: 120
    };
    setNodes(prev => [...prev, newNode]);
    if (window.nexusBridge?.expSaveNode) {
      await window.nexusBridge.expSaveNode({ node: newNode });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[rgb(var(--background))] text-[rgb(var(--text-main))] overflow-hidden relative">
      
      {/* 1. Obowiązkowy Modal Inicjalizacyjny gdy projects.length === 0 */}
      {projectsLoaded && projects.length === 0 && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--accent))]/60 rounded-2xl p-6 max-w-md w-full shadow-[0_0_50px_rgba(45,212,191,0.25)] flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <h2 className="text-lg font-bold text-[rgb(var(--text-main))] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[rgb(var(--accent))]" /> Wymagana Inicjalizacja Projektu
            </h2>
            <p className="text-xs text-[rgb(var(--text-muted))] leading-relaxed">
              Brak projektów w bazie SQLite. Zgodnie z rygorystycznymi założeniami Trybu Eksperymentalnego, aby kontynuować pracę, podaj nazwę pierwszego projektu roboczego.
            </p>
            <input
              type="text"
              placeholder="Wpisz nazwę projektu (np. System Billingowy Useme)..."
              value={initialProjectName}
              onChange={e => setInitialProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createInitialProject()}
              className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[rgb(var(--accent))] transition-colors shadow-inner"
              autoFocus
            />
            <button
              onClick={createInitialProject}
              disabled={!initialProjectName.trim()}
              className="w-full py-2.5 bg-[rgb(var(--accent))] text-black font-bold rounded-xl text-sm hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" /> Utwórz Pierwszy Projekt
            </button>
          </div>
        </div>
      )}

      {/* Diff Modal Preview */}
      {diffProposal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-[rgb(var(--border))] pb-3">
              <h3 className="text-sm font-bold text-[rgb(var(--text-main))] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[rgb(var(--accent))]" /> {diffProposal.title}
              </h3>
              <button onClick={() => setDiffProposal(null)} className="text-[rgb(var(--text-muted))] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto space-y-2.5 max-h-[50vh] pr-1 font-mono text-xs">
              {diffProposal.items.map((item, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--background))] flex flex-col gap-1">
                  <div className="flex items-center gap-2 font-bold">
                    <span className={item.action === '+ DODAJE' ? 'text-emerald-400' : 'text-red-400'}>{item.action}</span>
                    <span className="text-[rgb(var(--text-main))]">{item.entity}</span>
                  </div>
                  <p className="text-[11px] text-[rgb(var(--text-muted))] font-sans">{item.details}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-[rgb(var(--border))]">
              <button
                onClick={() => setDiffProposal(null)}
                className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] text-xs font-medium hover:bg-white/5 transition-colors cursor-pointer"
              >
                Odrzuć
              </button>
              <button
                onClick={acceptDiffProposal}
                className="px-5 py-2 rounded-xl bg-[rgb(var(--accent))] text-black text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Zatwierdź Zmiany
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal [Ustawienia AI] */}
      {showAiSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[rgb(var(--border))] pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Settings className="w-4 h-4 text-[rgb(var(--accent))]" /> Ustawienia AI Projektu ({projects.find(p => p.id === activeProjectId)?.name})
              </h3>
              <button onClick={() => setShowAiSettingsModal(false)} className="text-[rgb(var(--text-muted))] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[rgb(var(--text-muted))] mb-1">Domyślny Model Czatu:</label>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value as 'DeepSeek V4 Flash' | 'DeepSeek V4 Pro')}
                  className="w-full bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg p-2 text-xs text-[rgb(var(--text-main))]"
                >
                  <option value="DeepSeek V4 Flash">DeepSeek V4 Flash</option>
                  <option value="DeepSeek V4 Pro">DeepSeek V4 Pro</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[rgb(var(--text-muted))] mb-1">AI #1 Czat AI (System Prompt):</label>
                <textarea
                  value={chatSystemPrompt}
                  onChange={e => setChatSystemPrompt(e.target.value)}
                  className="w-full bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg p-2.5 h-16 resize-none font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[rgb(var(--text-muted))] mb-1">AI #2 Analizator SPEC (System Prompt):</label>
                <textarea
                  value={specAnalyzerSystemPrompt}
                  onChange={e => setSpecAnalyzerSystemPrompt(e.target.value)}
                  className="w-full bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg p-2.5 h-16 resize-none font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[rgb(var(--text-muted))] mb-1">AI #3 Planer Mapy (System Prompt):</label>
                <textarea
                  value={mapPlannerSystemPrompt}
                  onChange={e => setMapPlannerSystemPrompt(e.target.value)}
                  className="w-full bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg p-2.5 h-16 resize-none font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[rgb(var(--border))]">
              <button
                onClick={() => setShowAiSettingsModal(false)}
                className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] text-xs font-medium hover:bg-white/5 transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button
                onClick={saveAiSettings}
                className="px-5 py-2 rounded-xl bg-[rgb(var(--accent))] text-black text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-md"
              >
                Zapisz Ustawienia AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Project Selector Bar */}
      <div className="h-12 border-b border-[rgb(var(--border))] bg-[rgb(var(--panel))] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 overflow-x-auto">
          <span className="text-[12px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[rgb(var(--accent))]" /> Projekty:
          </span>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => selectProject(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                activeProjectId === p.id
                  ? 'bg-[rgb(var(--accent))]/15 border-[rgb(var(--accent))] text-[rgb(var(--accent))] shadow-sm'
                  : 'bg-[rgb(var(--background))] border-[rgb(var(--border))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))]'
              }`}
            >
              {p.name}
            </button>
          ))}
          <button
            onClick={createNewProject}
            className="p-1.5 rounded-lg bg-[rgb(var(--accent))] text-black font-semibold text-xs hover:opacity-90 flex items-center gap-1 cursor-pointer transition-transform active:scale-95 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Nowy
          </button>
        </div>

        {activeProjectId && (
          <div className="flex items-center gap-2">
            {saveStatus && <span className="text-xs text-[rgb(var(--accent))] font-medium animate-pulse">{saveStatus}</span>}
            <button
              onClick={() => setShowAiSettingsModal(true)}
              className="px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--background))] text-xs font-medium hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" /> Ustawienia AI
            </button>
            <button
              onClick={saveSpec}
              className="px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--background))] text-xs font-medium hover:bg-[rgb(var(--accent))]/10 hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Zapisz specyfikację
            </button>
          </div>
        )}
      </div>

      {/* 3-Column Layout (30% / 40% / 30%) */}
      <div className="flex-1 grid grid-cols-10 h-[calc(100%-3rem)] overflow-hidden divide-x divide-[rgb(var(--border))]">
        
        {/* Left Column (30% -> col-span-3): Specyfikacja Projektu & Licznik Bufora */}
        <div className="col-span-3 flex flex-col h-full bg-[rgb(var(--panel))]/40">
          <div className="h-10 px-4 border-b border-[rgb(var(--border))] flex items-center justify-between shrink-0 bg-[rgb(var(--panel))]">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-[rgb(var(--text-main))]">
              <FileText className="w-3.5 h-3.5 text-[rgb(var(--accent))]" /> Specyfikacja Architektoniczna
            </span>
            
            {/* Licznik bufora Analizatora SPEC */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="px-1.5 py-0.5 rounded bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))] font-mono font-bold">
                Bufor SPEC: {specBufferCount}/10
              </span>
              <button
                onClick={() => setSpecBufferCount(0)}
                className="px-1.5 py-0.5 rounded border border-[rgb(var(--border))] bg-[rgb(var(--background))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer"
                title="Resetuj bufor wiadomości"
              >
                Resetuj
              </button>
              <button
                onClick={triggerSpecAnalysis}
                className="px-1.5 py-0.5 rounded bg-[rgb(var(--accent))] text-black font-semibold hover:opacity-90 transition-all cursor-pointer flex items-center gap-1"
                title="Wywołaj analizę SPEC teraz"
              >
                Analizuj teraz
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            <textarea
              value={specContent}
              onChange={e => setSpecContent(e.target.value)}
              placeholder="Wprowadź specyfikację w formacie Markdown..."
              className="w-full flex-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-xl p-3 text-sm font-mono text-[rgb(var(--text-main))] resize-none focus:outline-none focus:border-[rgb(var(--accent))] focus:ring-1 focus:ring-[rgb(var(--accent))] transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Center Column (40% -> col-span-4): Strumień Czat/Prompty & Selektor Modeli */}
        <div className="col-span-4 flex flex-col h-full bg-[rgb(var(--background))]">
          <div className="h-10 px-4 border-b border-[rgb(var(--border))] flex items-center justify-between shrink-0 bg-[rgb(var(--panel))]">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-[rgb(var(--text-main))]">
              <MessageSquare className="w-3.5 h-3.5 text-[rgb(var(--accent))]" /> Strumień Czat / Prompty
            </span>

            {/* Selektor modeli i przycisk Planera Mapy */}
            <div className="flex items-center gap-2">
              <select
                value={selectedModel}
                onChange={e => handleModelChange(e.target.value as 'DeepSeek V4 Flash' | 'DeepSeek V4 Pro')}
                className="bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded px-2 py-1 text-xs font-semibold text-[rgb(var(--accent))] focus:outline-none cursor-pointer"
              >
                <option value="DeepSeek V4 Flash">DeepSeek V4 Flash</option>
                <option value="DeepSeek V4 Pro">DeepSeek V4 Pro</option>
              </select>

              <button
                onClick={triggerMapPlanner}
                disabled={loading || messages.length === 0}
                className="px-2.5 py-1 rounded bg-[rgb(var(--accent))]/15 border border-[rgb(var(--accent))] text-[rgb(var(--accent))] font-semibold text-xs hover:bg-[rgb(var(--accent))] hover:text-black transition-all cursor-pointer flex items-center gap-1 disabled:opacity-40"
              >
                <Network className="w-3.5 h-3.5" /> Aktualizuj mapę z czatu
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[rgb(var(--text-muted))]">
                <MessageSquare className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-xs">Rozpocznij dyskusję architektoniczną z AI.</p>
              </div>
            ) : (
              messages.map(m => (
                <div
                  key={m.id}
                  className={`p-3 rounded-xl border text-sm flex flex-col gap-2 transition-all ${
                    m.role === 'user'
                      ? 'bg-[rgb(var(--panel))] border-[rgb(var(--border))] ml-8'
                      : 'bg-[rgb(var(--accent))]/5 border-[rgb(var(--accent))]/30 mr-8 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold opacity-70">
                    <span>{m.role === 'user' ? 'Użytkownik' : 'Asystent Architekt'}</span>
                    <span>{new Date(m.created_at || Date.now()).toLocaleTimeString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed text-xs">{m.content}</p>
                  {m.role === 'ai' && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-[rgb(var(--border))]/40">
                      <button
                        onClick={() => extractToSpec(m.content)}
                        className="text-[11px] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--accent))] flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded hover:bg-[rgb(var(--accent))]/10 transition-colors"
                        title="Dodaj do specyfikacji po lewej"
                      >
                        <ArrowLeft className="w-3 h-3" /> do Spec
                      </button>
                      <button
                        onClick={() => extractToCanvas(m.content)}
                        className="text-[11px] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--accent))] flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded hover:bg-[rgb(var(--accent))]/10 transition-colors"
                        title="Dodaj do mapy po prawej"
                      >
                        do Mapy <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="p-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))]/50 text-xs text-[rgb(var(--text-muted))] animate-pulse flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[rgb(var(--accent))]" /> AI weryfikuje spójność...
              </div>
            )}
          </div>

          <div className="p-3 border-t border-[rgb(var(--border))] bg-[rgb(var(--panel))] flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Napisz prompt architektoniczny..."
              className="flex-1 bg-[rgb(var(--background))] border border-[rgb(var(--border))] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[rgb(var(--accent))] transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={!chatInput.trim() || loading}
              className="px-4 py-2 bg-[rgb(var(--accent))] text-black font-semibold rounded-lg text-xs hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Wyślij
            </button>
          </div>
        </div>

        {/* Right Column (30% -> col-span-3): Wizualna Mapa Architektury & Zaznaczanie Shiftem */}
        <div className="col-span-3 flex flex-col h-full bg-[rgb(var(--panel))]/40 relative">
          <div className="h-10 px-4 border-b border-[rgb(var(--border))] flex items-center justify-between shrink-0 bg-[rgb(var(--panel))]">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-[rgb(var(--text-main))]">
              <Network className="w-3.5 h-3.5 text-[rgb(var(--accent))]" /> Wizualna Mapa Architektury
            </span>
            <span className="text-[10px] text-[rgb(var(--text-muted))]">Shift+klik zaznacza wiele</span>
          </div>
          
          <div className="flex-1 p-4 overflow-auto relative bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] bg-[size:16px_16px]">
            
            {/* Pasek Wyboru Zaznaczonych Nodów */}
            {selectedIds.length > 0 && (
              <div className="sticky top-0 z-20 mb-3 p-2.5 rounded-xl border border-[rgb(var(--accent))] bg-[rgb(var(--panel))] shadow-lg flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2">
                <span className="font-bold text-[rgb(var(--accent))]">
                  Wybrano: {selectedIds.length} nody
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={appendSelectedToChat}
                    className="px-2.5 py-1 rounded bg-[rgb(var(--accent))] text-black font-bold hover:opacity-90 transition-all cursor-pointer text-[11px]"
                  >
                    Dołącz do czatu
                  </button>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="px-2 py-1 rounded border border-[rgb(var(--border))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-main))] transition-colors cursor-pointer text-[11px]"
                  >
                    Odznacz
                  </button>
                </div>
              </div>
            )}

            {nodes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[rgb(var(--text-muted))]">
                <Network className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-xs">Brak węzłów na mapie. Kliknij "do Mapy" lub "Aktualizuj mapę z czatu".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {nodes.map(node => {
                  const isSelected = selectedIds.includes(node.id);
                  return (
                    <div
                      key={node.id}
                      onClick={e => handleNodeClick(node.id, e)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer select-none relative group ${
                        isSelected
                          ? 'border-[rgb(var(--accent))] ring-2 ring-[rgb(var(--accent))]/50 bg-[rgb(var(--accent))]/10 shadow-md'
                          : 'border-[rgb(var(--border))] bg-[rgb(var(--background))] hover:border-[rgb(var(--text-muted))] shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 border-b border-[rgb(var(--border))]/40 pb-1">
                        <span className={`text-xs font-bold ${isSelected ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-main))]'}`}>
                          {node.title}
                        </span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setNodes(prev => prev.filter(n => n.id !== node.id));
                            setSelectedIds(prev => prev.filter(id => id !== node.id));
                            if (window.nexusBridge?.expDeleteNode) window.nexusBridge.expDeleteNode({ id: node.id });
                          }}
                          className="text-[rgb(var(--text-muted))] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[11px] text-[rgb(var(--text-muted))] leading-normal">{node.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
