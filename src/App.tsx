/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { LeftSidebar } from "./components/LeftSidebar";
import { TopNavigation } from "./components/TopNavigation";
import { NexusCanvas } from "./components/NexusCanvas";
import { LabTodo } from "./components/LabTodo";
import { LabWriting } from "./components/LabWriting";
import { Sandbox } from "./components/Sandbox";
import { RawFragmentsView } from "./components/RawFragmentsView";
import { RightPanel } from "./components/RightPanel";
import { ExportModal } from "./components/ExportModal";
import { SettingsModal } from "./components/SettingsModal";
import { ViewMode, RightPanelState, ModalState, NexusNode, NexusLink, Task, WritingDraft, ManuscriptFolder, ManuscriptTab, ManuscriptMeta } from "./types";
import { uid } from "./utils/ids";
import { useFileSystemWatcher } from "./fs";

export default function App() {
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
  
  const [isLoaded, setIsLoaded] = useState(false);

  const centerProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    import('./fs').then(async ({ initFS, loadWorkspace, isConnected, hasStoredHandle }) => {
      await initFS();
      setFsConnected(isConnected());
      setHasStoredFS(await hasStoredHandle());
      
      let state = await loadWorkspace();
      const isEmpty = !state.nodes?.length && !state.links?.length;
      
      if (isEmpty) {
        try {
          const anyWindow = window as any;
          if (anyWindow.require) {
            const fs = anyWindow.require('fs');
            const path = anyWindow.require('path');
            const os = anyWindow.require('os');
            const docsPath = path.join(os.homedir(), 'Documents', 'nexus', 'nexus.workspace.json');
            if (fs.existsSync(docsPath)) {
              const content = fs.readFileSync(docsPath, 'utf8');
              const parsed = JSON.parse(content);
              const { set } = await import('idb-keyval');
              await set('nexus_state', parsed);
              state = parsed;
            }
          }
        } catch (e) {
          console.log('Auto-import failed:', e);
        }
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
  });

  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
          import('./store').then(({ saveWorkspace }) => {
              saveWorkspace({ nodes, links, tasks, drafts, axioms, geminiKey, manuscriptFolders, manuscriptTabs, manuscriptMetas });
          });
          (window as any).__nexusState = { nodes, links, tasks, drafts, axioms, geminiKey, manuscriptFolders, manuscriptTabs, manuscriptMetas };
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [nodes, links, tasks, drafts, axioms, geminiKey, manuscriptFolders, manuscriptTabs, manuscriptMetas, isLoaded]);

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

  const handleNodeDelete = (id: string) => {
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

  const handleProjectCenter = useCallback((projectId: string) => {
    centerProjectIdRef.current = projectId;
  }, []);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

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

      <div className="flex flex-1 overflow-hidden relative">
        {(activeView === "nexus" && isSidebarOpen) && (
          <LeftSidebar 
            nodes={nodes} 
            selectedNodeId={selectedNodeId} 
            onSelectNode={handleNodeSelect} 
            onSelectProject={(pid) => {
               const pNodes = nodes.filter(n => (n.projectId === pid || (!n.projectId && pid === 'Uncategorized')));
               handleNodesSelect(pNodes.map(n => n.id));
            }}
            onProjectDragStart={(pid) => setDraggedProject(pid)}
            onProjectCenter={handleProjectCenter}
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
                setExpandedProjects(prev => ({ ...prev, [projectId]: true }));
                setSelectedNodeId(newId);
            }}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {activeView === "nexus" && (
              <NexusCanvas 
                  ref={centerProjectIdRef}
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
                  centerProjectId={centerProjectIdRef.current}
                  onProjectCenter={handleProjectCenter}
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
        </div>

        {/* Right Panel Overlay */}
        <RightPanel 
            state={rightPanel} 
            onClose={() => setRightPanel("none")} 
            selectedNode={selectedNode}
            onNodeDelete={handleNodeDelete}
            onNodeUpdate={(id, updates) => setNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n))}
            axioms={axioms}
            setAxioms={setAxioms}
            allNodes={nodes}
            allLinks={links}
            onLinkDelete={(link) => setLinks(links.filter(l => !(l.source === link.source && l.target === link.target) && !(l.source === link.target && l.target === link.source)))}
            onMoveToProject={(nodeId, projectId) => setNodes(nodes.map(n => n.id === nodeId ? { ...n, projectId } : n))}
        />
      </div>

      <ExportModal state={modal} onClose={() => setModal("none")} nodes={nodes} links={links} axioms={axioms.map(a => a.content).join('\n')} />
      <SettingsModal 
          state={modal} 
          onClose={() => setModal("none")} 
          geminiKey={geminiKey}
          setGeminiKey={setGeminiKey}
      />
    </div>
  );
}
