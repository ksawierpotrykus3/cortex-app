// ============================================================================
// NEXUS — WorkflowStore (#1)
// Zustand store dla workflowów — stan transientny (UI)
// ============================================================================

import { create } from 'zustand';
import { WorkflowDefinition, WorkflowExecutionResult, WorkflowMode, WorkflowTemplate } from '../../shared/types/workflow';

export interface WorkflowStoreState {
  workflows: WorkflowDefinition[];
  selectedId: string | null;
  results: Map<string, WorkflowExecutionResult>;
  loading: boolean;

  setWorkflows: (workflows: WorkflowDefinition[]) => void;
  addWorkflow: (workflow: WorkflowDefinition) => void;
  updateWorkflow: (workflow: WorkflowDefinition) => void;
  removeWorkflow: (id: string) => void;
  selectWorkflow: (id: string | null) => void;
  setResult: (result: WorkflowExecutionResult) => void;
  setLoading: (loading: boolean) => void;
}

export const useWorkflowStore = create<WorkflowStoreState>((set, get) => ({
  workflows: [],
  selectedId: null,
  results: new Map(),
  loading: false,

  setWorkflows: (workflows) => set({ workflows }),

  addWorkflow: (workflow) =>
    set((s) => ({ workflows: [...s.workflows, workflow] })),

  updateWorkflow: (workflow) =>
    set((s) => ({
      workflows: s.workflows.map((w) => (w.id === workflow.id ? workflow : w)),
    })),

  removeWorkflow: (id) =>
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  selectWorkflow: (id) => set({ selectedId: id }),

  setResult: (result) =>
    set((s) => {
      const m = new Map(s.results);
      m.set(result.id, result);
      return { results: m };
    }),

  setLoading: (loading) => set({ loading }),
}));

// ============================================================================
// Workflow Templates — 6 gotowców
// ============================================================================
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'tpl_wiki',
    name: 'Zapisz output do Wiki',
    description: 'Po zatwierdzeniu outputu tworzy nowy artykuł w Wiki',
    category: 'storage',
    icon: 'BookOpen',
    defaultConfig: {
      trigger: { type: 'on_approve' },
      mode: 'sandbox' as WorkflowMode,
      conditions: null,
      actions: [{
        id: 'act_1',
        type: 'append_to_wiki',
        label: 'Dodaj do Wiki',
        enabled: true,
        config: { category: 'auto', tags: ['agent-output'] },
        template: '# {{agent.name}} — {{date}}\n\n{{output.content}}',
      }],
    },
  },
  {
    id: 'tpl_notify',
    name: 'Wyślij powiadomienie',
    description: 'Po zakończeniu agenta pokazuje notyfikację desktop',
    category: 'communication',
    icon: 'Bell',
    defaultConfig: {
      trigger: { type: 'on_agent_complete' },
      mode: 'sandbox' as WorkflowMode,
      conditions: null,
      actions: [{
        id: 'act_1',
        type: 'send_notification',
        label: 'Powiadomienie',
        enabled: true,
        config: { title: 'Agent {{agent.name}} zakończył', body: 'Rating: {{output.rating}}/10', urgency: 'normal' },
      }],
    },
  },
  {
    id: 'tpl_task',
    name: 'Utwórz task z outputu',
    description: 'Po approve tworzy task w LabTodo',
    category: 'storage',
    icon: 'ClipboardList',
    defaultConfig: {
      trigger: { type: 'on_approve' },
      mode: 'sandbox' as WorkflowMode,
      conditions: null,
      actions: [{
        id: 'act_1',
        type: 'create_task',
        label: 'Nowy task',
        enabled: true,
        config: { title: 'Sprawdź: {{agent.name}} — {{date}}', priority: 'medium' },
        template: '## Output agenta {{agent.name}}\n\n{{output.content}}',
      }],
    },
  },
  {
    id: 'tpl_webhook',
    name: 'Wyślij raport na webhook',
    description: 'Po approve wysyła output na Discord/Slack',
    category: 'communication',
    icon: 'Webhook',
    defaultConfig: {
      trigger: { type: 'on_approve' },
      mode: 'sandbox' as WorkflowMode,
      conditions: {
        id: 'cg_1',
        logic: 'and',
        conditions: [
          {
            id: 'c_1',
            source: { type: 'output_field', field: 'rating' } as any,
            operator: 'gte',
            value: 6,
          },
        ],
      },
      actions: [{
        id: 'act_1',
        type: 'webhook',
        label: 'Wyślij do Discord',
        enabled: true,
        config: { url: '', method: 'POST', headers: {}, body: '{"content": "{{output.content}}"}' },
      }],
    },
  },
  {
    id: 'tpl_chain',
    name: 'Łańcuch agentów',
    description: 'Po approve uruchamia innego agenta z tym outputem',
    category: 'automation',
    icon: 'GitBranch',
    defaultConfig: {
      trigger: { type: 'on_approve' },
      mode: 'sandbox' as WorkflowMode,
      conditions: null,
      actions: [{
        id: 'act_1',
        type: 'execute_agent',
        label: 'Uruchom agenta',
        enabled: true,
        config: { agentId: '', promptTemplate: 'Przeanalizuj poniższy output:\n\n{{output.content}}' },
      }],
    },
  },
  {
    id: 'tpl_debug',
    name: 'Błąd → Debugger',
    description: 'Jeśli output zawiera "ERROR", uruchom agenta debuggera',
    category: 'automation',
    icon: 'Bug',
    defaultConfig: {
      trigger: { type: 'on_agent_complete' },
      mode: 'sandbox' as WorkflowMode,
      conditions: {
        id: 'cg_1',
        logic: 'and',
        conditions: [{
          id: 'c_1',
          source: { type: 'output_content' } as any,
          operator: 'contains',
          value: 'ERROR',
        }],
      },
      actions: [{
        id: 'act_1',
        type: 'execute_agent',
        label: 'Debugger',
        enabled: true,
        config: { agentId: '', promptTemplate: 'Debuguj poniższy błąd:\n\n{{output.content}}' },
      }],
    },
  },
];
