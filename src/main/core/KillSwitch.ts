// ============================================================================
// NEXUS — KillSwitch (#9)
// Globalny emergency stop — zatrzymuje agentów, pipeline'y, workflowy
// ============================================================================

import { KillSwitchState, DEFAULT_KILLSWITCH } from '../../shared/types/schema';

type Stoppable = {
  id: string;
  label: string;
  stop: () => void;
};

export class KillSwitch {
  private state: KillSwitchState = { ...DEFAULT_KILLSWITCH };
  private stoppables: Map<string, Stoppable> = new Map();

  // ========================================================================
  // Rejestracja procesów które można zatrzymać
  // ========================================================================

  register(id: string, label: string, stopFn: () => void): void {
    this.stoppables.set(id, { id, label, stop: stopFn });
  }

  unregister(id: string): void {
    this.stoppables.delete(id);
  }

  // ========================================================================
  // Kill
  // ========================================================================

  activate(reason?: string): KillSwitchState {
    this.state = {
      active: true,
      reason: reason || 'Emergency stop requested',
      killedAt: new Date().toISOString(),
      activeAgents: 0,
      activePipelines: 0,
      activeWorkflows: 0,
    };

    // Count and stop everything
    let agents = 0, pipelines = 0, workflows = 0;
    for (const [id, svc] of this.stoppables) {
      try { svc.stop(); } catch { /* ignore individual stop failures */ }
      if (id.startsWith('agent:')) agents++;
      else if (id.startsWith('pipeline:')) pipelines++;
      else if (id.startsWith('workflow:')) workflows++;
    }

    this.state.activeAgents = agents;
    this.state.activePipelines = pipelines;
    this.state.activeWorkflows = workflows;

    console.log(`[KillSwitch] ACTIVATED: ${agents} agents, ${pipelines} pipelines, ${workflows} workflows stopped`);
    return { ...this.state };
  }

  deactivate(): KillSwitchState {
    this.state = { ...DEFAULT_KILLSWITCH };
    console.log('[KillSwitch] Deactivated');
    return { ...this.state };
  }

  getStatus(): KillSwitchState {
    // Count currently registered
    let agents = 0, pipelines = 0, workflows = 0;
    for (const id of this.stoppables.keys()) {
      if (id.startsWith('agent:')) agents++;
      else if (id.startsWith('pipeline:')) pipelines++;
      else if (id.startsWith('workflow:')) workflows++;
    }
    return {
      ...this.state,
      activeAgents: agents,
      activePipelines: pipelines,
      activeWorkflows: workflows,
    };
  }

  isActive(): boolean {
    return this.state.active;
  }
}
