import * as fs from 'fs';
import * as path from 'path';

export type FailoverMode = 'strict' | 'interactive' | 'automatic';

export interface FailoverSettings {
  mode: FailoverMode;
  timeoutSeconds: number;
}

export interface ModelHealth {
  status: 'ONLINE' | 'OFFLINE';
  ping: number;
  consecutiveFailures: number;
}

export class AiHealthMonitor {
  private settingsPath: string;
  private settings: FailoverSettings = {
    mode: 'automatic',
    timeoutSeconds: 60,
  };

  public onStatusChange?: (modelName: string, status: 'ONLINE' | 'OFFLINE') => void;

  private modelStates: Map<string, ModelHealth> = new Map([
    ['deepseek-ai/deepseek-v4-pro', { status: 'ONLINE', ping: 0, consecutiveFailures: 0 }],
    ['deepseek-ai/deepseek-v4-flash', { status: 'ONLINE', ping: 0, consecutiveFailures: 0 }]
  ]);

  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private isChecking = false;

  constructor(dataDir: string) {
    this.settingsPath = path.join(dataDir, 'failover-settings.json');
  }

  async init(): Promise<void> {
    this.loadSettings();
    this.startMonitoring();
  }

  loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const raw = fs.readFileSync(this.settingsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (['strict', 'interactive', 'automatic'].includes(parsed.mode)) {
            this.settings.mode = parsed.mode;
          }
          if (typeof parsed.timeoutSeconds === 'number' && parsed.timeoutSeconds > 0) {
            this.settings.timeoutSeconds = parsed.timeoutSeconds;
          }
        }
        console.log('[AiHealthMonitor] Settings loaded:', this.settings);
      } else {
        this.saveSettings(this.settings);
      }
    } catch (err) {
      console.error('[AiHealthMonitor] Failed to load settings:', err);
    }
  }

  saveSettings(settings: Partial<FailoverSettings>): void {
    try {
      this.settings = { ...this.settings, ...settings };
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
      console.log('[AiHealthMonitor] Settings saved:', this.settings);
    } catch (err) {
      console.error('[AiHealthMonitor] Failed to save settings:', err);
    }
  }

  getSettings(): FailoverSettings {
    return { ...this.settings };
  }

  getStatus(): Record<string, { status: 'ONLINE' | 'OFFLINE'; ping: number }> {
    const result: Record<string, { status: 'ONLINE' | 'OFFLINE'; ping: number }> = {};
    for (const [model, state] of this.modelStates.entries()) {
      result[model] = {
        status: state.status,
        ping: state.ping,
      };
    }
    return result;
  }

  startMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    // Poll every 30 seconds
    this.checkInterval = setInterval(() => this.runChecks(), 30000);
    // Run initial checks asynchronously after startup
    setTimeout(() => this.runChecks(), 2000);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  recordFailure(modelName: string): void {
    const state = this.modelStates.get(modelName);
    if (!state) return;

    state.consecutiveFailures++;
    if (state.consecutiveFailures >= 2) {
      if (state.status !== 'OFFLINE') {
        state.status = 'OFFLINE';
        console.warn(`[AiHealthMonitor] Model ${modelName} went OFFLINE (consecutive failures: ${state.consecutiveFailures})`);
        if (this.onStatusChange) {
          this.onStatusChange(modelName, 'OFFLINE');
        }
      }
    }
  }

  recordSuccess(modelName: string, ping: number): void {
    const state = this.modelStates.get(modelName);
    if (!state) return;

    state.consecutiveFailures = 0;
    state.ping = ping;
    if (state.status !== 'ONLINE') {
      state.status = 'ONLINE';
      console.log(`[AiHealthMonitor] Model ${modelName} is back ONLINE (ping: ${ping}ms)`);
      if (this.onStatusChange) {
        this.onStatusChange(modelName, 'ONLINE');
      }
    }
  }

  private async runChecks(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      for (const model of this.modelStates.keys()) {
        await this.checkModelHealth(model);
      }
    } catch (err) {
      console.error('[AiHealthMonitor] Error running health checks:', err);
    } finally {
      this.isChecking = false;
    }
  }

  private async checkModelHealth(modelName: string): Promise<void> {
    const startTime = Date.now();
    try {
      // Send a minimal request to verify actual inference
      const response = await fetch('http://localhost:3456/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: '1' }],
          max_tokens: 1
        }),
        signal: AbortSignal.timeout(30000), // 30 seconds health check timeout (prevent false-offline on high latency)
      });

      if (response.ok) {
        const ping = Date.now() - startTime;
        this.recordSuccess(modelName, ping);
      } else {
        console.warn(`[AiHealthMonitor] Health check failed for ${modelName}: HTTP ${response.status}`);
        this.recordFailure(modelName);
      }
    } catch (err) {
      console.warn(`[AiHealthMonitor] Health check failed for ${modelName}:`, err instanceof Error ? err.message : String(err));
      this.recordFailure(modelName);
    }
  }
}
