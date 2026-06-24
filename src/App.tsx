/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { LeftSidebar } from "./components/LeftSidebar";
import { TopNavigation } from "./components/TopNavigation";
import { NexusCanvas, NexusCanvasHandle } from "./components/NexusCanvas";
import { LabTodo } from "./components/LabTodo";
import { LabWriting } from "./components/LabWriting";
import { Sandbox } from "./components/Sandbox";
import { RawFragmentsView } from "./components/RawFragmentsView";
import { RightPanel } from "./components/RightPanel";
import { ChangesPanel } from "./components/ChangesPanel";
import { WikiPanel } from "./components/WikiPanel";
import { GitPanel } from "./components/GitPanel";
import { FeedbackModal } from "./components/FeedbackModal";
import { FeedbackPanel } from "./components/FeedbackPanel";
import { FloatingAgentPanel } from "./components/FloatingAgentPanel";
import { ChangeLog } from "./changelog";
import { NexusState } from "./fs";
import { ExportModal } from "./components/ExportModal";
import { SettingsModal } from "./components/SettingsModal";
import { LogViewer } from "./components/LogViewer";
import { DraftZone } from "./components/DraftZone";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ViewMode, RightPanelState, ModalState, NexusNode, NexusLink, Task, WritingDraft, ManuscriptFolder, ManuscriptTab, ManuscriptMeta, FeedbackEntry, WikiArticle } from "./types";
import { uid } from "./utils/ids";
import { useFileSystemWatcher } from "./fs";

// Phase 1: Agents UI (stores & support, views moved to workflow-studio)
import { DiffModal } from "./components/DiffModal";
import { CommandPalette } from "./components/CommandPalette";
import { useAgentStore } from "./renderer/store/agentStore";
import { useChangelogStore } from "./renderer/store/changelogStore";
import { useWorkflowStore } from "./renderer/store/workflowStore";
import { useDiffStore } from "./renderer/store/diffStore";
import { useCommandStore } from "./renderer/store/commandStore";
import { setGlobalActions } from "./renderer/store/commandStore";
import { registerAllCommands, GlobalActions } from "./commands";
import { ChangelogEntry, Pipeline } from "./shared/types/schema";
import { WorkflowDefinition } from "./shared/types/workflow";
import { NexusBridge } from "./shared/types/ipc";
import { CustomCommandsManager } from "./components/CustomCommandsManager";
import { KillSwitchBanner } from "./components/KillSwitchBanner";
import { StatusBar } from "./components/StatusBar";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { OnboardingOverlay } from "./components/OnboardingOverlay";
import { KeyDirPanel } from "./components/KeyDirPanel";
import { SemanticSearch } from "./components/SemanticSearch";
import { TagSuggestDialog } from "./components/TagSuggestDialog";
import { useKeydirStore, createKeydirHandler } from "./renderer/store/keydirStore";
import { registerDefaultKeybindings } from "./keydir";
import { EntitySnapshot } from "./utils/diffEngine";
import { SplashScreen } from "./components/SplashScreen";

// Workflow Studio 2.0 (usunięto)

// Mermaid Plan
import { MermaidPlanPanel, MermaidDraft, parseMermaidToSVG } from "./components/MermaidPlanPanel";
// AtMention
import { MentionableItem } from "./components/AtMentionAutocomplete";

export function App() {
  const [initError, setInitError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeView, setActiveView] = useState<ViewMode>("nexus");
  const [rightPanel, setRightPanel] = useState<RightPanelState>("none");
  const [modal, setModal] = useState<ModalState>("none");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // DatabaseExplorer always

  const [nodes, setNodes] = useState<NexusNode[]>([]);
  const [links, setLinks] = useState<NexusLink[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [drafts, setDrafts] = useState<WritingDraft[]>([]);
  const [manuscriptFolders, setManuscriptFolders] = useState<ManuscriptFolder[]>([]);
  const [manuscriptTabs, setManuscriptTabs] = useState<ManuscriptTab[]>([]);
  const [manuscriptMetas, setManuscriptMetas] = useState<ManuscriptMeta[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [draggedProject, setDraggedProject] = useState<string | null>(null);
  const [geminiKey, setGeminiKey] = useState<string>("");
  const [fsConnected, setFsConnected] = useState(false);
  const [hasStoredFS, setHasStoredFS] = useState(false);
  
  const canvasRef = useRef<NexusCanvasHandle>(null);
  const changeLogRef = useRef<ChangeLog>(new ChangeLog());
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [wikiArticles, setWikiArticles] = useState<WikiArticle[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [runningPipelineId, setRunningPipelineId] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  // Workflow Studio 2.0 (usunięto)

  // Mermaid Plan
  const [mermaidDrafts, setMermaidDrafts] = useState<MermaidDraft[]>([]);
  const [mermaidSystemPrompt, setMermaidSystemPrompt] = useState<string | null>(null);

  // Shared workflow creation logic
  const handleCreateWorkflow = useCallback(() => {
    const now = new Date().toISOString();
    const newWf: WorkflowDefinition = {
      id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: 'Nowy workflow',
      description: '',
      mode: 'sandbox',
      trigger: { type: 'on_approve' },
      conditions: null,
      actions: [],
      createdAt: now,
      updatedAt: now,
      runCount: 0,
      lastRunAt: null,
    };
    setWorkflows((prev) => [...prev, newWf]);
    setSelectedWorkflowId(newWf.id);
  }, []);
  const [lastFeedbackAction, setLastFeedbackAction] = useState('');
  const [feedbackSelectedAgentId, setFeedbackSelectedAgentId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);

  // 🔁 Mentionable items dla @ wstrzykiwania w czatach
  const mentionableItems = useMemo(() => {
    const items: MentionableItem[] = [];
    // Wiki
    wikiArticles.forEach(a => items.push({
      id: a.id, type: 'wiki', label: a.title,
      subtitle: a.category, content: a.content?.slice(0, 2000),
    }));
    // Agenci
    useAgentStore.getState().agents.forEach(a => items.push({
      id: a.id, type: 'agent', label: a.name,
      subtitle: a.model.modelName, content: '',
    }));
    // Notatki
    nodes.forEach(n => items.push({
      id: n.id, type: 'note', label: n.title || 'Bez tytułu',
      subtitle: n.projectId, content: n.content,
    }));
    // Taski
    tasks.forEach(t => items.push({
      id: t.id, type: 'task', label: t.title,
      subtitle: t.status,
    }));
    return items;
  }, [wikiArticles, nodes, tasks]);
  const [tagFilter, setTagFilter] = useState('');

  // Refs to keep latest state for callbacks (avoids stale closures in useEffects with [])
  const stateRef = useRef({ nodes, links, tasks, drafts, geminiKey, manuscriptFolders, manuscriptTabs, manuscriptMetas, selectedNodeId, selectedNodeIds, expandedProjects, draggedProject, feedback, wikiArticles, pipelines, workflows, mermaidDrafts });
  stateRef.current = { nodes, links, tasks, drafts, geminiKey, manuscriptFolders, manuscriptTabs, manuscriptMetas, selectedNodeId, selectedNodeIds, expandedProjects, draggedProject, feedback, wikiArticles, pipelines, workflows, mermaidDrafts };

  // Helper to build workspace state object (DRY)
  const buildWorkspaceState = useCallback(() => {
    const s = stateRef.current;
    return {
      nodes: s.nodes, links: s.links, tasks: s.tasks, drafts: s.drafts,
      geminiKey: s.geminiKey,
      manuscriptFolders: s.manuscriptFolders, manuscriptTabs: s.manuscriptTabs,
      manuscriptMetas: s.manuscriptMetas,
      changelog: changeLogRef.current?.toJSON(),
      feedback: s.feedback, wiki: s.wikiArticles,
      pipelines: s.pipelines, workflows: s.workflows,
      snapshots: useDiffStore.getState().snapshots,
      customCommands: useCommandStore.getState().customCommands,
      shortcutOverrides: useKeydirStore.getState().overrides,
      mermaidDrafts: s.mermaidDrafts,
    };
  }, []);

  // Diff modal state (from Zustand store)
  const diffModal = useDiffStore((s) => s.diffModal);
  const openDiff = useDiffStore((s) => s.openDiff);
  const closeDiff = useDiffStore((s) => s.closeDiff);
  const snapshotBeforeEdit = useDiffStore((s) => s.snapshotBeforeEdit);
  const getSnapshots = useDiffStore((s) => s.getSnapshots);

  // F6.2: Sync workspace entities to main process
  const workspaceEntities = useMemo(() => [
    ...nodes.map(n => ({
      id: n.id, type: 'node' as const, title: n.title, content: n.content,
      projectId: n.projectId, updatedAt: new Date().toISOString(),
    })),
    ...tasks.map(t => ({
      id: t.id, type: 'task' as const, title: t.title, content: t.description || '',
      status: t.status, updatedAt: t.updatedAt || new Date().toISOString(),
    })),
    ...drafts.map(d => ({
      id: d.id, type: 'draft' as const, title: d.content.slice(0, 80), content: d.content,
      folderId: d.folderId, updatedAt: d.updatedAt || new Date().toISOString(),
    })),
    ...wikiArticles.map(w => ({
      id: w.id, type: 'wiki' as const, title: w.title, content: w.content || '',
      updatedAt: new Date().toISOString(),
    })),
  ], [nodes, tasks, drafts, wikiArticles]);

  const workspaceSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (workspaceSyncTimerRef.current) clearTimeout(workspaceSyncTimerRef.current);
    workspaceSyncTimerRef.current = setTimeout(() => {
      const bridge = window.nexusBridge;
      if (bridge?.syncWorkspace) {
        bridge.syncWorkspace({ entities: workspaceEntities });
      }
    }, 2000);
    return () => {
      if (workspaceSyncTimerRef.current) clearTimeout(workspaceSyncTimerRef.current);
    };
  }, [workspaceEntities]);

  // #12: Command Palette — globalny skrót Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        useCommandStore.getState().togglePalette();
      }
      // ? → skróty klawiszowe (tylko poza inputami)
      if (e.key === '?' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // #12: Rejestracja komend
  useEffect(() => {
    const navigate = (mode: ViewMode) => setActiveView(mode);
    const callbacks: GlobalActions = {
      setViewMode: setActiveView,
      onSave: () => {
        import('./store').then(({ saveWorkspace }) => {
          saveWorkspace(buildWorkspaceState());
        });
      },
      onExport: () => setModal('export'),
      onClearOutputs: () => {
        const b = window.nexusBridge;
        if (b?.clearOutputs) {
          b.clearOutputs({ agentId: '' });
        }
      },
      onManageCommands: () => {
        useCommandStore.getState().openManage();
      },
      onKillSwitch: () => {
        const b = window.nexusBridge as unknown as NexusBridge;
        b?.activateKillSwitch?.({ reason: 'Kill Switch from Command Palette' });
      },
    };
    registerAllCommands(navigate, callbacks);

    // Set global actions bridge for custom commands
    setGlobalActions({
      setActiveView,
      runWorkflow: (id: string) => {
        useWorkflowStore.getState().selectWorkflow?.(id);
      },
    });
  }, []);

  // #8: KeyDir — rejestracja domyślnych skrótów
  useEffect(() => {
    const navigate = (mode: any) => setActiveView(mode);
    registerDefaultKeybindings(navigate, {
      newNote: () => {
        const newNode = { id: uid(), title: 'Nowa notatka', content: '', x: Math.random() * 400, y: Math.random() * 300, projectId: undefined, updatedAt: new Date().toISOString() };
        setNodes(prev => [...prev, newNode]);
        setActiveView('nexus');
        setSelectedNodeId(newNode.id);
        setRightPanel('properties');
      },
      newTask: () => {
        setActiveView('lab-todo');
        setTasks(prev => [...prev, { id: uid(), title: 'Nowy task', description: '', status: 'Unresolved' as const, priority: 'Medium' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tags: [] }]);
      },
      newDraft: () => {
        setActiveView('lab-writing');
        setDrafts(prev => [...prev, { id: uid(), content: '', words: 0, folderId: 'root', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
      },
      save: () => {
        import('./store').then(({ saveWorkspace }) => {
          saveWorkspace(buildWorkspaceState());
        });
      },
      export: () => setModal('export'),
      delete: () => {
        if (activeView === 'nexus' && selectedNodeId) {
          handleNodeDelete(selectedNodeId);
        }
      },
      find: () => {
        useCommandStore.getState().openPalette();
      },
      escape: () => {
        if (selectedNodeId) {
          setSelectedNodeId(null);
          setRightPanel('none');
        }
      },
      goBack: () => {
        setSelectedNodeId(null);
      },
      openPalette: () => useCommandStore.getState().openPalette(),
      openKeydir: () => useKeydirStore.getState().togglePanel(),
      toggleSidebar: () => setIsSidebarOpen(prev => !prev),
    });
  }, []);

  // #8: KeyDir — globalny listener
  useEffect(() => {
    const handler = createKeydirHandler(() => activeView);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeView]);

  useEffect(() => {
    let cancelled = false;
    import('./fs').then(async ({ initFS, loadWorkspace, isConnected, hasStoredHandle }) => {
      try {
        await initFS();
        if (cancelled) return;
        setFsConnected(isConnected());
        setHasStoredFS(await hasStoredHandle());

        let state = await loadWorkspace();
        if (cancelled) return;
        
        setNodes(state.nodes || []);
        setLinks(state.links || []);
        setTasks(state.tasks || []);
        setDrafts(state.drafts || []);
        setManuscriptFolders(state.manuscriptFolders || []);
        setManuscriptTabs(state.manuscriptTabs || []);
        setManuscriptMetas(state.manuscriptMetas || []);
        setGeminiKey(state.geminiKey || "");
        setWikiArticles(state.wiki || []);
        setPipelines(state.pipelines || []);
        setWorkflows(state.workflows || []);
        useDiffStore.getState().setSnapshots(state.snapshots || []);
        useCommandStore.getState().setCustomCommands(state.customCommands || []);
        useKeydirStore.getState().setOverrides(state.shortcutOverrides || []);
        if (state.mermaidDrafts) setMermaidDrafts(state.mermaidDrafts);
        setIsLoaded(true);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setInitError(msg);
        }
      }
    }).catch((err) => {
      if (!cancelled) {
        const msg = err instanceof Error ? err.message : String(err);
        setInitError(`Failed to load workspace module: ${msg}`);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useFileSystemWatcher((newState) => {
    setNodes(newState.nodes || []);
    setLinks(newState.links || []);
    setTasks(newState.tasks || []);
    setDrafts(newState.drafts || []);
    setManuscriptFolders(newState.manuscriptFolders || []);
    setManuscriptTabs(newState.manuscriptTabs || []);
    setManuscriptMetas(newState.manuscriptMetas || []);
    setGeminiKey(newState.geminiKey || "");
    if (newState.changelog) changeLogRef.current = new ChangeLog(newState.changelog);
    if (newState.feedback) setFeedback(newState.feedback);
    if (newState.wiki) setWikiArticles(newState.wiki);
    if (newState.mermaidDrafts) setMermaidDrafts(newState.mermaidDrafts);
  });

  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
          import('./store').then(({ saveWorkspace }) => {
              saveWorkspace(buildWorkspaceState());
          });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    nodes, links, tasks, drafts, geminiKey,
    manuscriptFolders, manuscriptTabs, manuscriptMetas,
    feedback, wikiArticles, isLoaded,
    mermaidDrafts,
  ]);

  const setLabMode = (mode: "todo" | "writing") => {
    setActiveView(`lab-${mode}` as ViewMode);
  };

  const handleNodeSelect = (id: string | null) => {
    setSelectedNodeId(id);
    if (id) {
        setSelectedNodeIds([id]);
        setRightPanel("properties");
    } else {
        setSelectedNodeIds([]);
        setRightPanel("none");
    }
  };

  const handleNodesSelect = (ids: string[]) => {
      setSelectedNodeIds(ids);
      if (ids.length === 1) {
          setSelectedNodeId(ids[0]);
          setRightPanel("properties");
      } else {
          setSelectedNodeId(null);
          setRightPanel("none");
      }
  };

  // Helper: przywraca snapshot — zapisuje snapshot obecnej zawartości, potem podmienia
  const handleRevertSnapshot = useCallback((snapshot: EntitySnapshot) => {
    // Zrób snapshot obecnej wersji zanim cofniesz
    useDiffStore.getState().snapshotBeforeEdit(
      snapshot.entityId,
      snapshot.entityType,
      diffModal.currentContent,
      diffModal.title,
    );

    if (snapshot.entityType === 'node') {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === snapshot.entityId ? { ...n, content: snapshot.content } : n,
        ),
      );
    } else if (snapshot.entityType === 'task') {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === snapshot.entityId ? { ...t, description: snapshot.content } : t,
        ),
      );
    } else if (snapshot.entityType === 'manuscript') {
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === snapshot.entityId ? { ...d, content: snapshot.content } : d,
        ),
      );
    } else if (snapshot.entityType === 'wiki') {
      setWikiArticles((prev) =>
        prev.map((a) =>
          a.id === snapshot.entityId ? { ...a, content: snapshot.content } : a,
        ),
      );
    }

    closeDiff();
  }, [diffModal, closeDiff]);

  const handleNodeDelete = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (node) {
      // Snapshot before deleting node
      snapshotBeforeEdit(id, 'node', node.content, node.title);
      changeLogRef.current?.add("delete", "node", id, `Usunięto notatkę: ${node.title}`);
    }
    setNodes(nodes.filter(n => n.id !== id));
    setLinks(links.filter(l => l.source !== id && l.target !== id));
    setSelectedNodeId(null);
    setRightPanel("none");
  };

  const handleRenameProject = (oldName: string, newName: string) => {
    if (!newName.trim()) return;
    setNodes(nodes.map(n => (n.projectId === oldName || (!n.projectId && oldName === 'Uncategorized')) ? { ...n, projectId: newName } : n));
    setExpandedProjects(prev => {
        const next = { ...prev };
        next[newName] = next[oldName];
        delete next[oldName];
        return next;
    });
  };

  const handleDeleteProject = (name: string) => {
    const nodesToDelete = nodes.filter(n => (n.projectId === name || (!n.projectId && name === 'Uncategorized'))).map(n => n.id);
    setNodes(nodes.filter(n => !(n.projectId === name || (!n.projectId && name === 'Uncategorized'))));
    setLinks(links.filter(l => !nodesToDelete.includes(l.source) && !nodesToDelete.includes(l.target)));
    if (selectedNodeId && nodesToDelete.includes(selectedNodeId)) {
        setSelectedNodeId(null);
        setRightPanel("none");
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // Onboarding: show on first run
  useEffect(() => {
    const done = localStorage.getItem('nexus_onboarding_done');
    if (!done) {
      // Small delay to let UI render first
      const timer = setTimeout(() => setShowOnboarding(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Track last user action for feedback context
  useEffect(() => {
    if (selectedNodeId) {
      const node = nodes.find(n => n.id === selectedNodeId);
      if (node) setLastFeedbackAction(`Przeglądanie notatki: ${node.title}`);
    } else {
      setLastFeedbackAction(`Widok: ${activeView}`);
    }
  }, [activeView, selectedNodeId, selectedNode]);

  // Sync selected agent from zustand store for feedback context
  useEffect(() => {
    const unsub = useAgentStore.subscribe((state) => {
      setFeedbackSelectedAgentId(state.selectedAgentId);
    });
    setFeedbackSelectedAgentId(useAgentStore.getState().selectedAgentId);
    return unsub;
  }, []);

  // =========================================================================
  // Phase 1: Agents IPC hooks
  // =========================================================================
  useEffect(() => {
    const bridge = window.nexusBridge;
    if (!bridge) return;

    // Load agents from main process on mount
    bridge.getAgents().then(agents => {
      if (agents?.length > 0) {
        useAgentStore.getState().setAgents(agents);
      }
    }).catch(err => console.warn('[App] Failed to load agents:', err));

    // Listen for agent output — finalizuje streaming entry zamiast tworzyć nowy
    const cleanupOutput = bridge.onAgentOutput((output) => {
      useChangelogStore.getState().completeEntry(output.agentId, output);
    });

    // Listen for streaming tokens
    const cleanupStream = bridge.onAgentStream((data) => {
      useChangelogStore.getState().updateStream(data.agentId, data.token);
    });

    // Listen for status changes
    const cleanupStatus = bridge.onAgentStatus((data) => {
      useAgentStore.getState().updateAgentStatus(data.agentId, data.status);
    });

    return () => {
      cleanupOutput();
      cleanupStream();
      cleanupStatus();
    };
  }, []);

  if (!isLoaded) {
    return (
      <SplashScreen
        error={initError}
        onRetry={initError ? () => {
          setInitError(null);
          // Re-trigger the init effect by toggling a key or similar mechanism.
          // For simplicity, reload the page.
          window.location.reload();
        } : undefined}
      />
    );
  }

  return (
    <ErrorBoundary>
    <div className="flex flex-col h-screen text-[rgb(var(--text-main))] overflow-hidden bg-[rgb(var(--background))]">
      <TopNavigation
        activeView={activeView}
        setActiveView={setActiveView}
        rightPanel={rightPanel}
        setRightPanel={setRightPanel}
        setModal={setModal}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        onOpenTagDialog={() => setShowTagDialog(true)}
      />
      <KillSwitchBanner />

      <div className="flex flex-1 overflow-hidden relative">
        {activeView === "nexus" && isSidebarOpen && (
          <LeftSidebar 
            nodes={nodes} 
            selectedNodeId={selectedNodeId} 
            onSelectNode={(id) => {
               handleNodeSelect(id);
               // Teleport to single node
               canvasRef.current?.centerOnNode(id);
            }}
            onSelectProject={(pid) => {
               const pNodes = nodes.filter(n => (n.projectId === pid || (!n.projectId && pid === 'Uncategorized')));
               handleNodesSelect(pNodes.map(n => n.id));
               canvasRef.current?.panToProject(pid);
            }}
            onProjectDragStart={(pid) => setDraggedProject(pid)}
            onProjectCenter={(pid) => {
               canvasRef.current?.panToProject(pid);
            }}
            expandedProjects={expandedProjects}
            toggleProject={(pid) => setExpandedProjects(prev => ({ ...prev, [pid]: !prev[pid] }))}
            onRenameProject={handleRenameProject}
            onDeleteProject={handleDeleteProject}
            onCreateProject={() => {
                const count = nodes.filter(n => n.projectId?.startsWith('New Project')).length;
                const newProjName = count === 0 ? 'New Project' : `New Project ${count + 1}`;
                const newId = uid();
                setNodes([...nodes, {
                    id: newId,
                    title: 'New Node',
                    content: '',
                    x: 0,
                    y: 0,
                    accent: 'none',
                    projectId: newProjName
                }]);
                changeLogRef.current?.add("create", "node", newId, `Utworzono projekt: ${newProjName}`);
                setExpandedProjects(prev => ({ ...prev, [newProjName]: true }));
            }}
            onCreateNode={(projectId) => {
                const newId = uid();
                setNodes([...nodes, {
                    id: newId,
                    title: 'New Node',
                    content: '',
                    x: 0,
                    y: 0,
                    accent: 'none',
                    projectId: projectId
                }]);
                changeLogRef.current?.add("create", "node", newId, `Utworzono notatkę w projekcie: ${projectId || 'Uncategorized'}`);
                setExpandedProjects(prev => ({ ...prev, [projectId]: true }));
                setSelectedNodeId(newId);
            }}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {activeView === "nexus" && (
              <NexusCanvas 
                  ref={canvasRef}
                  nodes={nodes}
                  setNodes={setNodes}
                  links={links}
                  setLinks={setLinks}
                  selectedNodeId={selectedNodeId}
                  setSelectedNodeId={handleNodeSelect}
                  selectedNodeIds={selectedNodeIds}
                  setSelectedNodeIds={handleNodesSelect}
                  expandedProjects={expandedProjects}
                  draggedProject={draggedProject}
                  onDraggedProjectRelease={() => setDraggedProject(null)}
              />
          )}

          {activeView === "lab-todo" && <LabTodo setLabView={setLabMode} tasks={tasks} setTasks={setTasks} />}
          {activeView === "lab-writing" && (
            <LabWriting
              setLabView={setLabMode}
              drafts={drafts}
              setDrafts={setDrafts}
              manuscriptFolders={manuscriptFolders}
              setManuscriptFolders={setManuscriptFolders}
              manuscriptTabs={manuscriptTabs}
              setManuscriptTabs={setManuscriptTabs}
              manuscriptMetas={manuscriptMetas}
              setManuscriptMetas={setManuscriptMetas}
            />
          )}
          {activeView === "sandbox" && <Sandbox />}
          {activeView === "raw-fragments" && (
            <RawFragmentsView 
                nodes={nodes} 
                onNodeSelect={(id) => {
                   handleNodeSelect(id);
                   setActiveView("nexus");
                }} 
                onNodesDelete={(ids) => {
                    setNodes(nodes.filter(n => !ids.includes(n.id)));
                    setLinks(links.filter(l => !ids.includes(l.source) && !ids.includes(l.target)));
                }}
                onNodesMove={(ids, projectId) => {
                    setNodes(nodes.map(n => ids.includes(n.id) ? { ...n, projectId } : n));
                }}
                availableProjects={Array.from(new Set(nodes.map(n => n.projectId).filter(Boolean))) as string[]}
            />
          )}
          {activeView === "logs" && (
            <LogViewer height={window.innerHeight - 56} pageSize={50} />
          )}
          {activeView === "draft" && (
            <div className="flex items-start justify-center pt-8 h-full overflow-y-auto">
              <DraftZone
                onSaved={(mutation) => { /* console.debug('[NEXUS] Mutation saved:', mutation); */ }}
                onValidationError={(errors) => { /* console.warn('[NEXUS] Validation errors:', errors); */ }}
              />
            </div>
          )}

          {/* Phase 1: Agents View */}
          {activeView === "agents" && (
            <div className="flex items-center justify-center h-full text-[rgb(var(--text-muted))]">
              <div className="text-center">
                <div className="text-4xl mb-3 opacity-30">🤖</div>
                <p className="text-sm">Agenci AI (W przebudowie)</p>
              </div>
            </div>
          )}

          {/* F4: Tablica Zmian */}
          {activeView === "changes" && (
            <ChangesPanel
              changelog={changeLogRef.current?.getAll() || []}
              onNavigateToEntity={(entityType, entityId) => {
                if (entityType === "node") {
                  setSelectedNodeId(entityId);
                  setActiveView("nexus");
                }
              }}
              onShowDiff={(entityType, entityId) => {
                // Find current content for the entity
                const entity = entityType === 'node' ? nodes.find(n => n.id === entityId) :
                  entityType === 'task' ? tasks.find(t => t.id === entityId) :
                  entityType === 'draft' || entityType === 'manuscript' ? drafts.find(d => d.id === entityId) :
                  null;
                if (entity) {
                  const title = 'title' in entity ? (entity as any).title || 'draft' : entityType;
                  const content = 'content' in entity ? (entity as any).content || '' :
                    'description' in entity ? (entity as any).description || '' : '';
                  openDiff({
                    entityId, entityType: entityType === 'draft' ? 'manuscript' : entityType as any,
                    title, currentContent: content,
                  });
                }
              }}
            />
          )}

          {/* F6.4: Wiki / Baza Wiedzy */}
          {activeView === "wiki" && (
            <WikiPanel
              articles={wikiArticles}
              onSave={(article) => {
                setWikiArticles((prev) => {
                  const idx = prev.findIndex((a) => a.id === article.id);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = article;
                    return next;
                  }
                  return [...prev, article];
                });
                changeLogRef.current?.add("update", "node", article.id, `Zapisano artykuł Wiki: ${article.title}`);
              }}
              onDelete={(id) => {
                // Snapshot before deleting wiki article
                const article = wikiArticles.find((a) => a.id === id);
                if (article) {
                  snapshotBeforeEdit(id, 'wiki', article.content, article.title);
                }
                setWikiArticles((prev) => prev.filter((a) => a.id !== id));
                changeLogRef.current?.add("delete", "node", id, "Usunięto artykuł Wiki");
              }}
            />
          )}

          {/* #23: Git Integration */}
          {activeView === "git" && (
            <GitPanel />
          )}

          {/* #26: Feedback Panel */}
          {activeView === "feedback" && (
            <FeedbackPanel
              feedback={feedback}
              onDelete={(id) => {
                setFeedback((prev) => prev.filter((e) => e.id !== id));
                if (changeLogRef.current) {
                  changeLogRef.current.add("delete", "node", id, "Usunięto feedback");
                }
              }}
              onStatusChange={(id, status) => {
                setFeedback((prev) =>
                  prev.map((e) => (e.id === id ? { ...e, status } : e))
                );
              }}
            />
          )}

          {/* F6.12: Pipeline DAG + #1: Workflows — zastąpione przez Workflow Studio */}

          {/* Mermaid Plan — Środowisko Planowania */}
          {activeView === "mermaid-plan" && (
            <MermaidPlanPanel
              drafts={mermaidDrafts}
              onSaveDraft={(draft) => {
                setMermaidDrafts(prev => {
                  const idx = prev.findIndex(d => d.id === draft.id);
                  return idx >= 0 ? prev.map(d => d.id === draft.id ? draft : d) : [...prev, draft];
                });
              }}
              onDeleteDraft={(id) => setMermaidDrafts(prev => prev.filter(d => d.id !== id))}
              onGenerateMermaid={async (draft, customPrompt) => {
                const bridge = window.nexusBridge as any;
                if (!bridge?.executeAgent) return draft.mermaidCode;
                try {
                  // Try to use searchQuery or similar to generate Mermaid via AI
                  const prompt = customPrompt
                    ? `${customPrompt}\n\nWygeneruj diagram Mermaid na temat: ${draft.description || draft.title}`
                    : `Wygeneruj diagram Mermaid na temat: ${draft.description || draft.title}`;
                  const results = await bridge.searchQuery({ query: prompt, entities: [] });
                  // Extract mermaid code from response
                  const text = Array.isArray(results) ? results.map((r: any) => r.snippet || '').join('\n') : String(results);
                  const match = text.match(/```mermaid\s*\n([\s\S]*?)```/);
                  return match ? match[1].trim() : text.trim().split('\n').filter(Boolean).join('\n');
                } catch {
                  return draft.mermaidCode;
                }
              }}

              onPromoteToWiki={(draft) => {
                setWikiArticles(prev => [...prev, {
                  id: `wiki_mermaid_${draft.id}`,
                  title: draft.title,
                  content: `# ${draft.title}\n\n${draft.description}\n\n\`\`\`mermaid\n${draft.mermaidCode}\n\`\`\``,
                  tags: ['mermaid', 'diagram'],
                  category: 'planning',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }]);
              }}
              mermaidSystemPrompt={mermaidSystemPrompt || undefined}
              onSaveMermaidPrompt={setMermaidSystemPrompt}
            />
          )}
        </div>

        {/* Right Panel Overlay */}
        <RightPanel 
            state={rightPanel} 
            onClose={() => setRightPanel("none")} 
            selectedNode={selectedNode}
            onNodeDelete={handleNodeDelete}
            onNodeUpdate={(id, updates) => {
              // Snapshot before editing node content
              if (updates.content !== undefined) {
                const node = nodes.find(n => n.id === id);
                if (node && node.content !== updates.content) {
                  snapshotBeforeEdit(id, 'node', node.content, node.title);
                }
              }
              setNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
            }}
            allNodes={nodes}
            allLinks={links}
            onLinkDelete={(link) => setLinks(links.filter(l => !(l.source === link.source && l.target === link.target) && !(l.source === link.target && l.target === link.source)))}
            onMoveToProject={(nodeId, projectId) => setNodes(nodes.map(n => n.id === nodeId ? { ...n, projectId } : n))}
        />
      </div>

      <ExportModal state={modal} onClose={() => setModal("none")} nodes={nodes} links={links} axioms="" scopeFromView={activeView} selectedNodeIds={selectedNodeIds} tasks={tasks} drafts={drafts} />
      <SettingsModal 
          state={modal} 
          onClose={() => setModal("none")} 
          geminiKey={geminiKey}
          setGeminiKey={setGeminiKey}
      />

      {/* #26: Feedback button — z kontekstem */}
      <FeedbackModal
        viewMode={activeView}
        selectedAgentId={feedbackSelectedAgentId}
        selectedNodeId={selectedNodeId}
        selectedTaskId={null}
        selectedManuscriptId={null}
        projectId={selectedNode?.projectId || null}
        lastAction={lastFeedbackAction}
        nodes={nodes.map(n => ({ id: n.id, title: n.title }))}
        tasks={tasks.map(t => ({ id: t.id, title: t.title }))}
        manuscripts={drafts.map(d => ({ id: d.id, title: d.content.slice(0, 80) }))}
        onSave={async (entry) => {
          try {
            const bridge = window.nexusBridge;
            const newEntry = {
              context: '',
              ...entry,
              id: uid(),
              timestamp: new Date().toISOString(),
            } as FeedbackEntry;
            if (bridge?.saveFeedback) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (bridge as any).saveFeedback({ feedback: newEntry });
            }
            setFeedback((prev) => [...prev, newEntry]);
            // Dodaj feedback jako notatke na mapie mysli (widoczna w nexus + dokumenty)
            const fbTitle = entry.title?.trim() || (entry.feedbackType === 'idea' ? 'Pomysl' : 'Problem');
            const newNode: NexusNode = {
              id: uid(),
              title: `[${entry.feedbackType === 'idea' ? 'Pomysl' : 'Problem'}] ${fbTitle}`,
              content: entry.context || '',
              x: Math.random() * 400,
              y: Math.random() * 300,
              tags: [entry.feedbackType === 'idea' ? 'pomysl' : 'problem'],
              projectId: selectedNode?.projectId,
            };
            setNodes((prev) => [...prev, newNode]);
            if (changeLogRef.current) {
              changeLogRef.current.add("create", "node", newEntry.id, `Feedback: ${newEntry.title}`, undefined, "user");
            }
            return { success: true };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
          }
        }}
      />

      {/* Floating Agent Panel */}
      <FloatingAgentPanel
        viewMode={activeView}
        selectedNodeId={selectedNodeId}
        selectedAgentId={feedbackSelectedAgentId}
        selectedTaskId={null}
        selectedManuscriptId={null}
        projectId={selectedNode?.projectId || null}
        lastAction={lastFeedbackAction}
        onSendToAgent={async (agentId, message) => {
          // Use the IPC bridge to send a raw chat to any AI model
          const bridge = window.nexusBridge;
          if (bridge?.searchQuery) {
            try {
              const results = await bridge.searchQuery({
                query: message,
                entities: [],
              });
              if (results && results.length > 0) {
                return results.map(r => r.snippet).join('\n\n');
              }
              return 'Brak odpowiedzi od modelu.';
            } catch (err) {
              return `Błąd: ${err instanceof Error ? err.message : String(err)}`;
            }
          }
          return 'Most IPC nie jest dostępny. Skonfiguruj klucz API w ustawieniach.';
        }}
        mentionableItems={mentionableItems}
      />

      {/* #5: Diff Viewer Modal */}
      <DiffModal
        open={diffModal.open}
        onClose={closeDiff}
        title={diffModal.title}
        currentContent={diffModal.currentContent}
        snapshots={getSnapshots(diffModal.entityId)}
        onRevert={handleRevertSnapshot}
      />

      {/* #12: Command Palette */}
      <CommandPalette />
      <CustomCommandsManager />
      <KeyDirPanel />
      <SemanticSearch
        entities={[
          ...nodes.map(n => ({ id: n.id, type: 'node' as const, title: n.title, content: n.content, updatedAt: new Date().toISOString() })),
          ...tasks.map(t => ({ id: t.id, type: 'task' as const, title: t.title, content: t.description || '', updatedAt: t.updatedAt || new Date().toISOString() })),
          ...drafts.map(d => ({ id: d.id, type: 'draft' as const, title: d.content.slice(0, 80), content: d.content, updatedAt: d.updatedAt || new Date().toISOString() })),
          ...wikiArticles.map(w => ({ id: w.id, type: 'wiki' as const, title: w.title, content: w.content || '', updatedAt: new Date().toISOString() })),
        ]}
        onNavigate={(result) => {
          setActiveView(result.viewMode as any);
          // Select the entity in the target view
          if (result.entityType === 'node') {
            setSelectedNodeId(result.entityId);
            setRightPanel('properties');
          }
        }}
      />
      <StatusBar
        activeView={activeView}
        nodeCount={nodes.length}
        taskCount={tasks.length}
        fsConnected={fsConnected}
      />
      <OnboardingOverlay
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={() => localStorage.setItem('nexus_onboarding_done', 'true')}
      />
      <TagSuggestDialog
        nodes={nodes}
        onApplyTags={(nodeIds, tags) => {
          setNodes(prev => prev.map(n => nodeIds.includes(n.id) ? { ...n, tags: [...new Set([...(n.tags || []), ...tags])] } : n));
          setShowTagDialog(false);
        }}
        open={showTagDialog}
        onClose={() => setShowTagDialog(false)}
      />
      <KeyboardShortcuts
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
    </ErrorBoundary>
  );
}


