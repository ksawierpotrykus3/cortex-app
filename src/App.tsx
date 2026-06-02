/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
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
import { ViewMode, RightPanelState, ModalState, NexusNode, NexusLink, Task, WritingDraft } from "./types";

export default function App() {
  const [activeView, setActiveView] = useState<ViewMode>("nexus");
  const [rightPanel, setRightPanel] = useState<RightPanelState>("none");
  const [modal, setModal] = useState<ModalState>("none");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [nodes, setNodes] = useState<NexusNode[]>([]);
  const [links, setLinks] = useState<NexusLink[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [drafts, setDrafts] = useState<WritingDraft[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [draggedProject, setDraggedProject] = useState<string | null>(null);
  const [axioms, setAxioms] = useState<{id: string, text: string}[]>([]);
  const [geminiKey, setGeminiKey] = useState<string>("");
  const [fsConnected, setFsConnected] = useState(false);
  
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    import('./fs').then(async ({ initFS, loadWorkspace, isConnected }) => {
      await initFS();
      setFsConnected(isConnected());
      const state = await loadWorkspace();
      setNodes(state.nodes || []);
      setLinks(state.links || []);
      setTasks(state.tasks || []);
      setDrafts(state.drafts || []);
      setAxioms(state.axioms || []);
      setGeminiKey(state.geminiKey || "");
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
          import('./store').then(({ saveWorkspace }) => {
              saveWorkspace({ nodes, links, tasks, drafts, axioms, geminiKey });
          });
          (window as any).__nexusState = { nodes, links, tasks, drafts, axioms, geminiKey };
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [nodes, links, tasks, drafts, axioms, geminiKey, isLoaded]);

  const setLabMode = (mode: "todo" | "writing") => {
    setActiveView(`lab-${mode}` as ViewMode);
  };

  const handleNodeSelect = (id: string | null) => {
    setSelectedNodeId(id);
    if (id) {
        setSelectedNodeIds(prev => prev.includes(id) ? prev : [id]);
        setRightPanel("properties");
    } else {
        setSelectedNodeIds([]);
    }
  };

  const handleNodesSelect = (ids: string[]) => {
      setSelectedNodeIds(ids);
      if (ids.length > 0) {
          setSelectedNodeId(ids[ids.length - 1]);
          setRightPanel("properties");
      } else {
          setSelectedNodeId(null);
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
        fsConnected={fsConnected}
        onConnectFS={async () => {
             const { connectToLocalFolder } = await import('./fs');
             const ok = await connectToLocalFolder();
             if (ok) {
                 setFsConnected(true);
                 // Reload from new folder
                 const { loadWorkspace } = await import('./fs');
                 const state = await loadWorkspace();
                 setNodes(state.nodes || []);
                 setLinks(state.links || []);
                 setTasks(state.tasks || []);
                 setDrafts(state.drafts || []);
                 setAxioms(state.axioms || []);
                 setGeminiKey(state.geminiKey || "");
             }
        }}
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
            expandedProjects={expandedProjects}
            toggleProject={(pid) => setExpandedProjects(prev => ({ ...prev, [pid]: !prev[pid] }))}
            onRenameProject={handleRenameProject}
            onDeleteProject={handleDeleteProject}
            onCreateProject={() => {
                const count = nodes.filter(n => n.projectId?.startsWith('New Project')).length;
                const newProjName = count === 0 ? 'New Project' : `New Project ${count + 1}`;
                const newId = Math.random().toString(36).substring(2, 9);
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
                const newId = Math.random().toString(36).substring(2, 9);
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
            <LabWriting setLabView={setLabMode} drafts={drafts} setDrafts={setDrafts} />
          )}
          {activeView === "sandbox" && <Sandbox />}
          {activeView === "raw-fragments" && (
            <RawFragmentsView 
                nodes={nodes} 
                onNodeSelect={(id) => {
                   handleNodeSelect(id);
                   setActiveView("nexus");
                }} 
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
        />
      </div>

      <ExportModal state={modal} onClose={() => setModal("none")} />
      <SettingsModal 
          state={modal} 
          onClose={() => setModal("none")} 
          geminiKey={geminiKey}
          setGeminiKey={setGeminiKey}
      />
    </div>
  );
}
