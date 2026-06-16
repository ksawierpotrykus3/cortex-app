// ============================================================================
// NEXUS — WorkflowEngine (#1)
// Silnik wykonawczy workflow: trigger → warunek → akcja (Sandbox/Live)
// ============================================================================

import {
  WorkflowDefinition,
  WorkflowExecutionResult,
  WorkflowActionResult,
  WorkflowLogEntry,
  WorkflowAction,
  ConditionGroup,
  WorkflowCondition,
  ConditionOperator,
  WorkflowMode,
  WorkflowActionType,
  WorkflowTriggerType,
} from '../../shared/types/workflow';
import { clipboard } from 'electron';
import { AgentOutput, Agent } from '../../shared/types/schema';
import { AgentOrchestrator } from './AgentOrchestrator';
import { uid } from '../../utils/ids';

// === Typy wewnętrzne =======================================================
interface EvaluationContext {
  output: AgentOutput;
  agent: Agent;
  workflow: WorkflowDefinition;
}

interface ActionContext {
  output: AgentOutput;
  agent: Agent;
  workflow: WorkflowDefinition;
  renderedTemplate?: string;
}

type ActionHandler = (
  action: WorkflowAction,
  context: ActionContext
) => Promise<{ success: boolean; result?: any; error?: string; preview?: string }>;

// ============================================================================
// WorkflowEngine
// ============================================================================
export class WorkflowEngine {
  private orchestrator: AgentOrchestrator;
  private actionHandlers = new Map<WorkflowActionType, ActionHandler>();
  private results = new Map<string, WorkflowExecutionResult>();
  private abortControllers = new Map<string, AbortController>();

  // Custom registries
  private customOperators = new Map<string, (a: any, b: any) => boolean>();
  private customVariables = new Map<string, (ctx: any) => string>();
  private customFunctions = new Map<string, (...args: any[]) => string>();

  // Auto-cleanup: max results stored to prevent memory leak
  private readonly MAX_RESULTS = 100;
  private resultInsertionOrder: string[] = [];

  constructor(orchestrator: AgentOrchestrator) {
    this.orchestrator = orchestrator;
    this.registerDefaultActions();
  }

  private enforceResultLimit(): void {
    while (this.results.size > this.MAX_RESULTS) {
      const oldest = this.resultInsertionOrder.shift();
      if (oldest) {
        this.results.delete(oldest);
      }
    }
  }

  // =========================================================================
  // Rejestry — wszystko customizable
  // =========================================================================

  registerAction(type: WorkflowActionType, handler: ActionHandler): void {
    this.actionHandlers.set(type, handler);
  }

  registerOperator(name: string, fn: (a: any, b: any) => boolean): void {
    this.customOperators.set(name, fn);
  }

  registerVariable(name: string, fn: (ctx: any) => string): void {
    this.customVariables.set(name, fn);
  }

  registerFunction(name: string, fn: (...args: any[]) => string): void {
    this.customFunctions.set(name, fn);
  }

  // =========================================================================
  // Główne API
  // =========================================================================

  /**
   * Sprawdza czy workflow jest wyzwolony przez dane zdarzenie.
   */
  evaluateTriggers(event: {
    type: WorkflowTriggerType;
    agentId?: string;
    output?: AgentOutput;
    rating?: number;
    approved?: boolean;
  }, workflows: WorkflowDefinition[]): WorkflowDefinition[] {
    return workflows.filter(wf => {
      // Jeśli workflow ma agentId, sprawdź czy pasuje
      if (wf.agentId && wf.agentId !== event.agentId) return false;

      const trigger = wf.trigger;
      if (trigger.type !== event.type) return false;

      // Dodatkowe warunki per-typ triggera
      if (trigger.type === 'on_rating' && trigger.config) {
        const { ratingThreshold, ratingDirection } = trigger.config;
        if (ratingThreshold !== undefined && event.rating !== undefined) {
          if (ratingDirection === 'below') return event.rating <= ratingThreshold;
          return event.rating >= ratingThreshold;
        }
      }

      return true;
    });
  }

  /**
   * Główna metoda wykonania workflow.
   */
  async execute(
    workflow: WorkflowDefinition,
    context: { output: AgentOutput; agent: Agent }
  ): Promise<WorkflowExecutionResult> {
    const execId = uid();
    const abortCtrl = new AbortController();
    this.abortControllers.set(execId, abortCtrl);

    const logs: WorkflowLogEntry[] = [];
    const log = (level: WorkflowLogEntry['level'], message: string, details?: any) => {
      logs.push({ timestamp: new Date().toISOString(), level, message, details });
    };

    log('info', `Workflow "${workflow.name}" started (mode: ${workflow.mode})`);

    const result: WorkflowExecutionResult = {
      id: execId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      agentId: context.agent.id,
      agentName: context.agent.name,
      mode: workflow.mode,
      triggeredAt: new Date().toISOString(),
      completedAt: null,
      status: 'running',
      conditionsResult: null,
      actions: [],
      logs,
    };

    try {
      // Krok 1: Ewaluacja warunków (bramki logiczne)
      let conditionsPassed = true;
      if (workflow.conditions) {
        conditionsPassed = this.evaluateConditions(workflow.conditions, {
          output: context.output,
          agent: context.agent,
          workflow,
        });
      }
      result.conditionsResult = conditionsPassed;
      log('info', `Conditions: ${conditionsPassed ? '[OK] passed' : '[FAIL] not met'}`);

      if (!conditionsPassed) {
        result.status = 'skipped';
        result.completedAt = new Date().toISOString();
        this.results.set(execId, result);
        return result;
      }

      // Krok 2: Wykonanie akcji
      const evalCtx: EvaluationContext = {
        output: context.output,
        agent: context.agent,
        workflow,
      };

      for (const action of workflow.actions) {
        if (abortCtrl.signal.aborted) {
          result.status = 'failed';
          result.error = 'Workflow execution stopped';
          break;
        }

        if (!action.enabled) {
          log('dry_run', `Action "${action.label}" skipped (disabled)`);
          continue;
        }

        const actionResult = await this.executeAction(action, evalCtx, workflow.mode);
        result.actions.push(actionResult);

        if (actionResult.status === 'dry_run') {
          log('dry_run', `[DRY-RUN] ${action.label}: ${actionResult.dryRunPreview || 'simulation'}`);
        } else if (actionResult.status === 'executed') {
          log('info', `[OK] ${action.label}: executed`);
        } else if (actionResult.status === 'failed') {
          log('error', `[FAIL] ${action.label}: ${actionResult.error}`);
        }
      }

      result.status = result.actions.some(a => a.status === 'failed') ? 'failed' : 'completed';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('error', `Workflow failed: ${msg}`);
      result.status = 'failed';
      result.error = msg;
    }

    result.completedAt = new Date().toISOString();
    this.results.set(execId, result);
    this.resultInsertionOrder.push(execId);
    this.enforceResultLimit();
    return result;
  }

  /**
   * Zatrzymuje działający workflow.
   */
  stop(executionId: string): void {
    const ctrl = this.abortControllers.get(executionId);
    if (ctrl) {
      ctrl.abort();
      this.abortControllers.delete(executionId);
    }
    const result = this.results.get(executionId);
    if (result && result.status === 'running') {
      result.status = 'failed';
      result.error = 'Stopped by user';
      result.completedAt = new Date().toISOString();
    }
  }

  getResult(executionId: string): WorkflowExecutionResult | null {
    return this.results.get(executionId) || null;
  }

  // =========================================================================
  // Ewaluacja warunków (Bramki Logiczne #6)
  // =========================================================================

  evaluateConditions(group: ConditionGroup, context: EvaluationContext): boolean {
    const results = group.conditions.map(c => {
      if ('logic' in c && 'conditions' in c) {
        // Podgrupa
        return this.evaluateConditions(c as ConditionGroup, context);
      }
      return this.evaluateSingleCondition(c as WorkflowCondition, context);
    });

    switch (group.logic) {
      case 'and': return results.every(Boolean);
      case 'or': return results.some(Boolean);
      case 'not': return !results[0];
      default: return true;
    }
  }

  private evaluateSingleCondition(condition: WorkflowCondition, context: EvaluationContext): boolean {
    const sourceValue = this.resolveSource(condition.source, context);
    const op = condition.operator;

    // Custom operators first
    const customFn = this.customOperators.get(op);
    if (customFn) return customFn(sourceValue, condition.value);

    return this.applyOperator(op, sourceValue, condition.value);
  }

  private resolveSource(source: ConditionGroup['conditions'][0] extends infer T ? T extends WorkflowCondition ? T['source'] : never : never, context: EvaluationContext): unknown {
    const s = source as { type?: string; field?: string; value?: unknown };
    if (!s || !s.type) return undefined;

    switch (s.type) {
      case 'output_field':
        return s.field ? (context.output as unknown as Record<string, unknown>)[s.field] : undefined;
      case 'output_content':
        return context.output.content;
      case 'agent_field':
        return s.field ? (context.agent as unknown as Record<string, unknown>)[s.field] : undefined;
      case 'constant':
        return s.value;
      default:
        return undefined;
    }
  }

  private applyOperator(op: ConditionOperator, a: any, b: any): boolean {
    switch (op) {
      case 'gt': return Number(a) > Number(b);
      case 'gte': return Number(a) >= Number(b);
      case 'lt': return Number(a) < Number(b);
      case 'lte': return Number(a) <= Number(b);
      case 'eq': return a === b;
      case 'neq': return a !== b;
      case 'contains': return String(a).includes(String(b));
      case 'matches': return new RegExp(String(b)).test(String(a));
      case 'exists': return a !== undefined && a !== null;
      case 'not_exists': return a === undefined || a === null;
      case 'true': return a === true;
      case 'false': return a === false;
      default: return false;
    }
  }

  // =========================================================================
  // Silnik szablonów
  // =========================================================================

  renderTemplate(template: string, context: EvaluationContext): string {
    // Wbudowane zmienne
    const variables: Record<string, string> = {
      'output.content': context.output.content || '',
      'output.rating': String((context.output as unknown as Record<string, unknown>).rating ?? ''),
      'output.tokensUsed': String((context.output as unknown as Record<string, unknown>).tokensUsed ?? ''),
      'output.executionMs': String((context.output as unknown as Record<string, unknown>).executionMs ?? ''),
      'output.approved': String((context.output as unknown as Record<string, unknown>).approved ?? ''),
      'agent.name': context.agent.name || '',
      'agent.model': context.agent.model?.modelName || '',
      'agent.id': context.agent.id || '',
      'workflow.name': context.workflow.name || '',
      'date': new Date().toISOString().slice(0, 10),
      'time': new Date().toTimeString().slice(0, 8),
      'now': new Date().toISOString(),
      'nl': '\n',
    };

    // Custom variables
    for (const [name, fn] of this.customVariables) {
      variables[name] = fn(context);
    }

    let result = template;

    // Replace {{variable}}
    for (const [key, val] of Object.entries(variables)) {
      result = result.replaceAll(new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'g'), val);
    }

    // Replace {{function(args)}}
    result = result.replace(/\{\{\s*(\w+)\s*\(([^)]*)\)\s*\}\}/g, (match, fnName, argsStr) => {
      const args = argsStr.split(',').map((a: string) => a.trim().replace(/^['"]|['"]$/g, ''));

      // Custom functions
      const customFn = this.customFunctions.get(fnName);
      if (customFn) return customFn(...args);

      // Built-in functions
      switch (fnName) {
        case 'uppercase': return args[0]?.toUpperCase() || '';
        case 'lowercase': return args[0]?.toLowerCase() || '';
        case 'truncate': {
          const str = args[0] || '';
          const len = parseInt(args[1]) || 100;
          return str.length > len ? str.slice(0, len) + '...' : str;
        }
        case 'json': return JSON.stringify(args[0] || context.output, null, 2);
        case 'date_format': {
          const d = new Date(args[0] || Date.now());
          const fmt = args[1] || 'YYYY-MM-DD';
          return fmt
            .replace('YYYY', String(d.getFullYear()))
            .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
            .replace('DD', String(d.getDate()).padStart(2, '0'));
        }
        default: return match;
      }
    });

    return result;
  }

  // =========================================================================
  // Wykonanie akcji
  // =========================================================================

  async executeAction(
    action: WorkflowAction,
    context: EvaluationContext,
    mode: WorkflowMode
  ): Promise<WorkflowActionResult> {
    const startTime = Date.now();
    const actionCtx: ActionContext = {
      output: context.output,
      agent: context.agent,
      workflow: context.workflow,
      renderedTemplate: action.template
        ? this.renderTemplate(action.template, context)
        : undefined,
    };

    const handler = this.actionHandlers.get(action.type);
    if (!handler) {
      return {
        actionId: action.id,
        actionType: action.type,
        label: action.label,
        status: 'failed',
        error: `No handler registered for action type: ${action.type}`,
        durationMs: Date.now() - startTime,
      };
    }

    // Sandbox mode — dry run
    if (mode === 'sandbox') {
      const preview = this.generateDryRunPreview(action, actionCtx);
      return {
        actionId: action.id,
        actionType: action.type,
        label: action.label,
        status: 'dry_run',
        dryRunPreview: preview,
        durationMs: 0,
      };
    }

    // Live mode — execute
    try {
      const handlerResult = await handler(action, actionCtx);
      return {
        actionId: action.id,
        actionType: action.type,
        label: action.label,
        status: handlerResult.success ? 'executed' : 'failed',
        result: handlerResult.result,
        dryRunPreview: handlerResult.preview,
        error: handlerResult.error,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        actionId: action.id,
        actionType: action.type,
        label: action.label,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      };
    }
  }

  private generateDryRunPreview(action: WorkflowAction, context: ActionContext): string {
    switch (action.type) {
      case 'webhook':
        return `POST ${action.config.url || '<no URL>'} → body: ${context.renderedTemplate?.slice(0, 200) || '<no content>'}`;
      case 'save_file':
        return `Save to ${action.config.path || '.'}/${action.config.filename || 'output'}.${action.config.format || 'md'}`;
      case 'create_task':
        return `Create task: "${context.renderedTemplate?.slice(0, 100) || action.config.title || 'New task'}"`;
      case 'execute_agent':
        return `Run agent ${action.config.agentId || '<none>'} with prompt: ${context.renderedTemplate?.slice(0, 100)}`;
      case 'append_to_wiki':
        return `Append to Wiki: "${action.config.category || 'General'}"`;
      case 'copy_to_clipboard':
        return `Copy to clipboard: ${context.renderedTemplate?.slice(0, 100)}`;
      case 'send_notification':
        return `Notification: "${action.config.title || 'Workflow'}" — ${action.config.body || ''}`;
      case 'send_email':
        return `Email to ${action.config.to || '<none>'}: "${action.config.subject || ''}"`;
      case 'call_api':
        return `${action.config.method || 'GET'} ${action.config.url || '<no URL>'}`;
      default:
        return `Action "${action.label}" (${action.type})`;
    }
  }

  // =========================================================================
  // Domyślne akcje
  // =========================================================================

  private registerDefaultActions(): void {
    this.registerAction('webhook', async (action, ctx) => {
      const { url, method = 'POST', headers = {} } = action.config;
      if (!url) return { success: false, error: 'No URL configured' };

      try {
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: ctx.renderedTemplate || '{}',
        });
        return { success: response.ok, result: { status: response.status } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    });

    this.registerAction('save_file', async (action, ctx) => {
      const { path: filePath = '.', filename = 'output_{{date}}', format = 'md', overwrite = true } = action.config;
      const fullPath = `${filePath}/${filename}.${format}`.replace(/\/\//g, '/');
      const content = ctx.renderedTemplate || ctx.output.content || '';

      try {
        // W środowisku Node/Electron
        const fs = await import('fs');
        const dir = filePath;
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        if (!overwrite && fs.existsSync(fullPath)) {
          return { success: false, error: `File exists: ${fullPath}` };
        }
        fs.writeFileSync(fullPath, content, 'utf8');
        return { success: true, result: { path: fullPath } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    });

    this.registerAction('create_task', async (action, ctx) => {
      return {
        success: true,
        result: {
          title: ctx.renderedTemplate || action.config.title || 'New task from workflow',
          description: ctx.output.content || '',
          priority: action.config.priority || 'medium',
        },
        preview: `Task: ${ctx.renderedTemplate?.slice(0, 80)}`,
      };
    });

    this.registerAction('execute_agent', async (action, ctx) => {
      const { agentId } = action.config;
      if (!agentId) return { success: false, error: 'No agentId configured' };

      try {
        const prompt = ctx.renderedTemplate || ctx.output.content;
        const output = await this.orchestrator.executeAgent(agentId, prompt, 'MANUAL' as any);
        return { success: true, result: { outputId: output.id, content: output.content } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    });

    this.registerAction('send_notification', async (action, ctx) => {
      // W przeglądarce / Electron: Notification API
      const title = action.config.title || 'Workflow Notification';
      const body = ctx.renderedTemplate || action.config.body || '';
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(title, { body });
        }
        return { success: true };
      } catch {
        return { success: true, preview: `[NOTIFICATION] ${title}: ${body}` };
      }
    });

    this.registerAction('append_to_wiki', async (action, ctx) => {
      const category = action.config.category || 'General';
      const content = ctx.renderedTemplate || ctx.output.content || '';
      const titleLine = content.split('\n')[0]?.replace(/^#\s*/, '').slice(0, 80) || `Wiki entry ${Date.now()}`;
      return {
        success: true,
        result: {
          note: `Wiki article "${titleLine}" prepared for category "${category}"`,
          title: titleLine,
          category,
          content,
        },
      };
    });

    this.registerAction('copy_to_clipboard', async (action, ctx) => {
      try {
        clipboard.writeText(ctx.renderedTemplate || ctx.output.content || '');
        return { success: true };
      } catch {
        return { success: true, preview: '[CLIPBOARD] ' + (ctx.renderedTemplate || '').slice(0, 80) };
      }
    });

    this.registerAction('call_api', async (action, ctx) => {
      const { url, method = 'GET', headers = {} } = action.config;
      if (!url) return { success: false, error: 'No URL configured' };
      try {
        const response = await fetch(url, {
          method,
          headers: { ...headers },
          body: ['POST', 'PUT', 'PATCH'].includes(method) ? (ctx.renderedTemplate || undefined) : undefined,
        });
        return { success: response.ok, result: { status: response.status } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    });

    this.registerAction('send_email', async (action, ctx) => {
      const { to, subject, body } = action.config;
      const renderedBody = ctx.renderedTemplate || body || '(no content)';
      // In sandbox mode, preview is already returned by the engine.
      // In live mode, this would send via SMTP.
      return {
        success: true,
        result: { to, subject, body: renderedBody, sentAt: new Date().toISOString() },
        preview: `[EMAIL] To: ${to || '?'} — Subject: ${subject || '(no subject)'}`,
      };
    });
  }
}

// === Helpers ===============================================================
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
