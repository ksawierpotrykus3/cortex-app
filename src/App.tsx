/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { ChangeLog } from "./changelog";
import { NexusState, defaultState } from "./fs";
import { ExportModal } from "./components/ExportModal";
import { SettingsModal } from "./components/SettingsModal";
import { LogViewer } from "./components/LogViewer";
import { DraftZone } from "./components/DraftZone";
import { ViewMode, RightPanelState, ModalState, NexusNode, NexusLink, Task, WritingDraft, ManuscriptFolder, ManuscriptTab, ManuscriptMeta, FeedbackEntry, WikiArticle, Pipeline } from "./types";
import { uid } from "./utils/ids";
import { useFileSystemWatcher } from "./fs";

// Phase 1: Agents UI
import { AgentListPanel } from "./renderer/components/agents/AgentListPanel";
import { AgentConfigPanel } from "./renderer/components/agents/AgentConfigPanel";
import { ChangelogPanel } from "./renderer/components/changelog/ChangelogPanel";
import { PipelineEditor } from "./components/PipelineEditor";
import { WorkflowList } from "./components/WorkflowList";
import { WorkflowEditor } from "./components/WorkflowEditor";
import { DiffModal } from "./components/DiffModal";
import { CommandPalette } from "./components/CommandPalette";
import { useAgentStore } from "./renderer/store/agentStore";
import { useChangelogStore } from "./renderer/store/changelogStore";
import { useWorkflowStore } from "./renderer/store/workflowStore";
import { useDiffStore } from "./renderer/store/diffStore";
import { useCommandStore } from "./renderer/store/commandStore";
import { setGlobalActions } from "./renderer/store/commandStore";
import { registerAllCommands, GlobalActions } from "./commands";
import { ChangelogEntry, AgentStatus } from "./shared/types/schema";
import { WorkflowDefinition } from "./shared/types/workflow";
import { NexusBridge } from "./shared/types/ipc";
import { CustomCommandsManager } from "./components/CustomCommandsManager";
import { KillSwitchBanner } from "./components/KillSwitchBanner";
import { StatusBar } from "./components/StatusBar";
import { OnboardingOverlay } from "./components/OnboardingOverlay";
import { KeyDirPanel } from "./components/KeyDirPanel";
import { SemanticSearch } from "./components/SemanticSearch";
import { useKeydirStore, createKeydirHandler } from "./renderer/store/keydirStore";
import { registerDefaultKeybindings } from "./keydir";
import { EntitySnapshot } from "./utils/diffEngine";

declare global {
  interface Window {
    nexusBridge?: NexusBridge;
  }
}

export function App() {
  const [activeView, setActiveView] = useState<ViewMode>("nexus");
  const [rightPanel, setRightPanel] = useState<RightPanelState>("none");
  const [modal, setModal] = useState<ModalState>("none");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
  const [axioms, setAxioms] = useState<{id: string, text: string}[]>([]);
  const [geminiKey, setGeminiKey] = useState<string>("");
  const [fsConnected, setFsConnected] = useState(false);
  const [hasStoredFS, setHasStoredFS] = useState(false);
  
  const canvasRef = useRef<NexusCanvasHandle>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const changeLogRef = useRef<ChangeLog>(new ChangeLog());
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [wikiArticles, setWikiArticles] = useState<WikiArticle[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [runningPipelineId, setRunningPipelineId] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [lastFeedbackAction, setLastFeedbackAction] = useState('');
  const [feedbackSelectedAgentId, setFeedbackSelectedAgentId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Refs to keep latest state for callbacks (avoids stale closures in useEffects with [])
  const stateRef = useRef({ nodes, links, tasks, drafts, axioms, geminiKey, manuscriptFolders, manuscriptTabs, manuscriptMetas, selectedNodeId, selectedNodeIds, expandedProjects, draggedProject, feedback, wikiArticles, pipelines, workflows });
  stateRef.current = { nodes, links, tasks, drafts, axioms, geminiKey, manuscriptFolders, manuscriptTabs, manuscriptMetas, selectedNodeId, selectedNodeIds, expandedProjects, draggedProject, feedback, wikiArticles, pipelines, workflows };

  // Helper to build workspace state object (DRY)
  const buildWorkspaceState = useCallback(() => {
    const s = stateRef.current;
    return {
      nodes: s.nodes, links: s.links, tasks: s.tasks, drafts: s.drafts,
      axioms: s.axioms, geminiKey: s.geminiKey,
      manuscriptFolders: s.manuscriptFolders, manuscriptTabs: s.manuscriptTabs,
      manuscriptMetas: s.manuscriptMetas,
      changelog: changeLogRef.current?.toJSON(),
      feedback: s.feedback, wiki: s.wikiArticles,
      pipelines: s.pipelines, workflows: s.workflows,
      snapshots: useDiffStore.getState().snapshots,
      customCommands: useCommandStore.getState().customCommands,
      shortcutOverrides: useKeydirStore.getState().overrides,
    };
  }, []);

  // Diff modal state (from Zustand store)
  const diffModal = useDiffStore((s) => s.diffModal);
  const openDiff = useDiffStore((s) => s.openDiff);
  const closeDiff = useDiffStore((s) => s.closeDiff);
  const snapshotBeforeEdit = useDiffStore((s) => s.snapshotBeforeEdit);
  const getSnapshots = useDiffStore((s) => s.getSnapshots);

  // F6.2: Sync workspace entities to main process
  const workspaceSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (workspaceSyncTimerRef.current) clearTimeout(workspaceSyncTimerRef.current);
    workspaceSyncTimerRef.current = setTimeout(() => {
      const entities: any[] = [
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
      ];
      const bridge = (window as any).nexusBridge;
      if (bridge?.syncWorkspace) {
        bridge.syncWorkspace({ entities });
      }
    }, 2000); // Debounce 2s
    return () => {
      if (workspaceSyncTimerRef.current) clearTimeout(workspaceSyncTimerRef.current);
    };
  }, [nodes, tasks, drafts, wikiArticles]);

  // #12: Command Palette — globalny skrót Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        useCommandStore.getState().togglePalette();
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
        const b = window.nexusBridge as any;
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
    import('./fs').then(async ({ initFS, loadWorkspace, isConnected, hasStoredHandle }) => {
      await initFS();
      setFsConnected(isConnected());
      setHasStoredFS(await hasStoredHandle());
      
      let state = await loadWorkspace();
      const isEmpty = !state.nodes?.length && !state.links?.length;
      
      if (isEmpty) {
        // Auto-import was removed — contextIsolation: true blokuje require() w renderer
        // Import z plików workspace będzie dodany w Phase 3 przez StorageEngine IPC
      }
      
      setNodes(state.nodes || []);
      setLinks(state.links || []);
      setTasks(state.tasks || []);
      setDrafts(state.drafts || []);
      setManuscriptFolders(state.manuscriptFolders || []);
      setManuscriptTabs(state.manuscriptTabs || []);
      setManuscriptMetas(state.manuscriptMetas || []);
      setAxioms(state.axioms || []);
      setGeminiKey(state.geminiKey || "");
      setWikiArticles(state.wiki || []);
      setPipelines(state.pipelines || []);
      setWorkflows(state.workflows || []);
      useDiffStore.getState().setSnapshots(state.snapshots || []);
      useCommandStore.getState().setCustomCommands(state.customCommands || []);
      useKeydirStore.getState().setOverrides(state.shortcutOverrides || []);
      setIsLoaded(true);
    });
  }, []);

  useFileSystemWatcher((newState) => {
    setNodes(newState.nodes || []);
    setLinks(newState.links || []);
    setTasks(newState.tasks || []);
    setDrafts(newState.drafts || []);
    setManuscriptFolders(newState.manuscriptFolders || []);
    setManuscriptTabs(newState.manuscriptTabs || []);
    setManuscriptMetas(newState.manuscriptMetas || []);
    setAxioms(newState.axioms || []);
    setGeminiKey(newState.geminiKey || "");
    if (newState.changelog) changeLogRef.current = new (ChangeLog as any)(newState.changelog);
    if (newState.feedback) setFeedback(newState.feedback);
    if (newState.wiki) setWikiArticles(newState.wiki);
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
  }, [nodes, links, tasks, drafts, axioms, geminiKey, manuscriptFolders, manuscriptTabs, manuscriptMetas, feedback, wikiArticles, isLoaded]);

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
    });

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

  if (!isLoaded) return null;

  return (
    <div className="flex flex-col h-screen text-[rgb(var(--text-main))] overflow-hidden bg-[rgb(var(--background))]">
      <TopNavigation
        activeView={activeView}
        setActiveView={setActiveView}
        rightPanel={rightPanel}
        setRightPanel={setRightPanel}
        setModal={setModal}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />
      <KillSwitchBanner />

      <div className="flex flex-1 overflow-hidden relative">
        {(activeView === "nexus" && isSidebarOpen) && (
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
                onSaved={(mutation) => console.log('[NEXUS] Mutation saved:', mutation)}
                onValidationError={(errors) => console.warn('[NEXUS] Validation errors:', errors)}
              />
            </div>
          )}

          {/* Phase 1: Agents View — 3-kolumnowy layout */}
          {activeView === "agents" && (
            <AgentsView />
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

          {/* F6.12: Pipeline DAG */}
          {activeView === "pipeline" && (
            <PipelineEditor
              pipelines={pipelines}
              onSavePipeline={(pipeline) => {
                setPipelines((prev) => {
                  const idx = prev.findIndex((p) => p.id === pipeline.id);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = pipeline;
                    return next;
                  }
                  return [...prev, pipeline];
                });
                // Persist via IPC if bridge available
                const bridge = window.nexusBridge;
                if (bridge?.savePipeline) {
                  bridge.savePipeline({ pipeline });
                }
              }}
              onDeletePipeline={(id) => {
                setPipelines((prev) => prev.filter((p) => p.id !== id));
                const bridge = window.nexusBridge;
                if (bridge?.deletePipeline) {
                  bridge.deletePipeline({ id });
                }
              }}
              onExecutePipeline={async (id) => {
                setRunningPipelineId(id);
                try {
                  const bridge = window.nexusBridge;
                  if (bridge?.executePipeline) {
                    const result = await bridge.executePipeline({ id });
                    if (!result.success) {
                      console.error('[Pipeline] Execution failed:', result.error);
                    }
                  }
                } finally {
                  setRunningPipelineId(null);
                }
              }}
              runningPipelineId={runningPipelineId}
            />
          )}

          {/* #1: Workflows */}
          {activeView === "workflows" && (
            <div className="h-full flex">
              <div className="w-64 shrink-0">
                <WorkflowList
                  workflows={workflows}
                  selectedId={selectedWorkflowId}
                  onSelect={setSelectedWorkflowId}
                  onCreateNew={() => {
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
                  }}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <WorkflowEditor
                  workflows={workflows}
                  selectedWorkflowId={selectedWorkflowId}
                  onSelectWorkflow={setSelectedWorkflowId}
                  onSaveWorkflow={(workflow) => {
                    setWorkflows((prev) => {
                      const idx = prev.findIndex((w) => w.id === workflow.id);
                      if (idx >= 0) {
                        const next = [...prev];
                        next[idx] = workflow;
                        return next;
                      }
                      return [...prev, workflow];
                    });
                    const bridge = window.nexusBridge;
                    if (bridge?.saveWorkflow) {
                      bridge.saveWorkflow({ workflow });
                    }
                  }}
                  onDeleteWorkflow={(id) => {
                    setWorkflows((prev) => prev.filter((w) => w.id !== id));
                    if (selectedWorkflowId === id) setSelectedWorkflowId(null);
                    const bridge = window.nexusBridge;
                    if (bridge?.deleteWorkflow) {
                      bridge.deleteWorkflow({ id });
                    }
                  }}
                  onExecuteWorkflow={async (id) => {
                    try {
                      const bridge = window.nexusBridge;
                      if (bridge?.executeWorkflow) {
                        const result = await bridge.executeWorkflow({ id });
                        console.log('[Workflow] Result:', result);
                      }
                    } catch (err) {
                      console.error('[Workflow] Error:', err);
                    }
                  }}
                  onCreateNew={() => {
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
                  }}
                />
              </div>
            </div>
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
            axioms={axioms}
            setAxioms={setAxioms}
            allNodes={nodes}
            allLinks={links}
            onLinkDelete={(link) => setLinks(links.filter(l => !(l.source === link.source && l.target === link.target) && !(l.source === link.target && l.target === link.source)))}
            onMoveToProject={(nodeId, projectId) => setNodes(nodes.map(n => n.id === nodeId ? { ...n, projectId } : n))}
        />
      </div>

      <ExportModal state={modal} onClose={() => setModal("none")} nodes={nodes} links={links} axioms={axioms.map(a => a.text).join('\n')} scopeFromView={activeView} selectedNodeIds={selectedNodeIds} tasks={tasks} drafts={drafts} />
      <SettingsModal 
          state={modal} 
          onClose={() => setModal("none")} 
          geminiKey={geminiKey}
          setGeminiKey={setGeminiKey}
      />

      {/* Feedback button — #26 Universal Feedback z kontekstem */}
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
            // Save via IPC if bridge available
            const bridge = window.nexusBridge;
            if (bridge?.saveFeedback) {
              const newEntry: FeedbackEntry = {
                ...entry,
                id: uid(),
                timestamp: new Date().toISOString(),
              };
              const result = await bridge.saveFeedback({ feedback: newEntry });
              if (result.success) {
                setFeedback((prev) => [...prev, newEntry]);
                if (changeLogRef.current) {
                  changeLogRef.current.add("create", "node", newEntry.id, `Feedback: ${newEntry.title}`, undefined, "user");
                }
              }
              return result;
            }

            // Fallback: save locally only
            const fallbackEntry: FeedbackEntry = {
              ...entry,
              id: uid(),
              timestamp: new Date().toISOString(),
            };
            setFeedback((prev) => [...prev, fallbackEntry]);
            if (changeLogRef.current) {
              changeLogRef.current.add("create", "node", fallbackEntry.id, `Feedback: ${fallbackEntry.title}`, undefined, "user");
            }
            return { success: true };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
          }
        }}
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
    </div>
  );
}

// ===========================================================================
// Phase 1: Agents View — 3-kolumnowy layout (Lista | Konfiguracja | Changelog)
// ===========================================================================
function AgentsView() {
  const { agents, selectAgent } = useAgentStore();

  const handleExecuteAgent = async (agentId: string) => {
    const bridge = window.nexusBridge;
    if (!bridge) {
      console.warn('[AgentsView] No IPC bridge — cannot execute agent without main process');
      return;
    }

    // Add streaming entry
    const entry: ChangelogEntry = {
      id: `entry_${Date.now()}`,
      agentId,
      agentName: useAgentStore.getState().agents.find(a => a.id === agentId)?.name || 'Agent',
      isStreaming: true,
      streamedContent: '',
      createdAt: new Date().toISOString(),
    };
    useChangelogStore.getState().addEntry(entry);

    // Execute via IPC
    const result = await bridge.executeAgent({ id: agentId });
    if (!result.success) {
      useChangelogStore.getState().setEntryError(agentId, (result as any).error || 'Unknown error');
    }
  };

  const handleStopAgent = async (agentId: string) => {
    const bridge = window.nexusBridge;
    if (bridge) {
      await bridge.stopAgent({ id: agentId });
    }
    useAgentStore.getState().updateAgentStatus(agentId, AgentStatus.ACTIVE);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <AgentListPanel
        onExecuteAgent={handleExecuteAgent}
        onStopAgent={handleStopAgent}
      />
      <AgentConfigPanel onExecute={handleExecuteAgent} />
      <ChangelogPanel />
    </div>
  );
}
