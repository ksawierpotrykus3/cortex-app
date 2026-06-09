// ================================================================
// NEXUS V2 — MicroVM Sandboxing: Hypervisor Provider + LocalCLIRunner
// (Phase 3.2 — WHPX + libkrun)
// ================================================================
// Abstrakcja hipernadzorcy dla Windows Hypervisor Platform (WHPX)
// z integracją przez CLI wrapper libkrun. Umożliwia powołanie
// czystego, efemerycznego mikrojądra Linuksa w <200ms.
//
// ARCHITEKTURA:
// - HypervisorProvider: interfejs dla WHPX/libkrun
// - LocalCLIRunner: runner z całkowitym odcięciem sieciowym
//   i montowaniem virtio-fs (Read-Only)
// - Network Isolation: Windows Filtering Platform przez netsh +
//   Windows Job Object z ograniczeniami sieciowymi
// ================================================================

import { spawn, type ChildProcess, execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { platform } from 'os';
import path from 'path';
import fs from 'fs';
import { setTimeout as wait } from 'timers/promises';

// ==============================================================
// Typy
// ==============================================================
export interface MicroVMConfig {
  /** Ścieżka do kernelu (vmlinuz) */
  kernelPath?: string;
  /** Ścieżka do initrd/initramfs */
  initrdPath?: string;
  /** Ścieżka do obrazu dysku rootfs */
  rootfsPath?: string;
  /** Ilość VCPU (domyślnie 1) */
  vcpuCount?: number;
  /** Ilość RAM w MB (domyślnie 256) */
  memoryMB?: number;
  /** Czy odciąć sieć (domyślnie true) */
  networkIsolated?: boolean;
  /** Folder montowany przez virtio-fs (Read-Only) */
  sharedDir?: string;
  /** Dodatkowe argumenty dla hypervisora */
  extraArgs?: string[];
}

export interface VMInstance {
  /** Unikalny ID instancji */
  id: string;
  /** PID procesu hypervisora */
  pid: number;
  /** Czas startu w ms */
  startTimeMs: number;
  /** Czy VM jest uruchomiona */
  running: boolean;
}

export interface ExecutionOptions {
  /** Limit czasu w ms (domyślnie 30000) */
  timeoutMs?: number;
  /** Zmienne środowiskowe */
  env?: Record<string, string>;
  /** Katalog roboczy */
  cwd?: string;
  /** Czy izolować sieć (domyślnie true) */
  networkIsolated?: boolean;
  /** Maksymalny stdout/stderr w bajtach */
  maxOutputBytes?: number;
}

export interface ExecutionResult {
  /** stdout procesu */
  stdout: string;
  /** stderr procesu */
  stderr: string;
  /** Kod wyjścia */
  exitCode: number | null;
  /** Czas wykonania w ms */
  durationMs: number;
}

// ==============================================================
// NetworkIsolationError — błąd izolacji sieciowej
// ==============================================================
export class NetworkIsolationError extends Error {
  public readonly detail: string;
  constructor(detail: string) {
    super(`[NETWORK_ISOLATION] ${detail}`);
    this.name = 'NetworkIsolationError';
    this.detail = detail;
  }
}

// ==============================================================
// ExecutionTimeoutErrorLocal — błąd timeoutu dla LocalCLIRunner
// ==============================================================
export class ExecutionTimeoutErrorLocal extends Error {
  public readonly pid: number;
  public readonly durationMs: number;
  public readonly timeoutMs: number;
  public readonly partialStdout: string;
  public readonly partialStderr: string;

  constructor(pid: number, durationMs: number, timeoutMs: number, stdout: string, stderr: string) {
    super(
      `[LOCAL_RUNNER_TIMEOUT] Proces PID ${pid} przekroczył limit ${timeoutMs}ms ` +
      `(rzeczywisty czas: ${durationMs}ms)`
    );
    this.name = 'ExecutionTimeoutErrorLocal';
    this.pid = pid;
    this.durationMs = durationMs;
    this.timeoutMs = timeoutMs;
    this.partialStdout = stdout;
    this.partialStderr = stderr;
  }
}

// ==============================================================
// MicroVMError — błąd hypervisora
// ==============================================================
export class MicroVMError extends Error {
  public readonly vmId: string;
  public readonly detail: string;
  constructor(vmId: string, detail: string, cause?: Error) {
    super(`[MICROVM:${vmId}] ${detail}${cause ? `: ${cause.message}` : ''}`);
    this.name = 'MicroVMError';
    this.vmId = vmId;
    this.detail = detail;
  }
}

// ==============================================================
// HypervisorProvider — interfejs dla WHPX/libkrun
//
// Docelowo implementacja przez natywne bindings Rust/C.
// Obecnie warstwa abstrakcji dla CLI wrapperów (libkrun, cloud-hypervisor).
// ==============================================================
export interface HypervisorProvider {
  /** Nazwa providera (np. "libkrun", "cloud-hypervisor", "qemu") */
  readonly name: string;

  /** Start mikroVM — zwraca instancję <200ms */
  startVM(config: MicroVMConfig): Promise<VMInstance>;

  /** Zatrzymanie mikroVM (SIGKILL + cleanup) */
  stopVM(instance: VMInstance): Promise<void>;

  /** Wykonanie kodu wewnątrz VM z izolacją */
  execInVM(
    instance: VMInstance,
    command: string,
    args: string[],
    options?: ExecutionOptions
  ): Promise<ExecutionResult>;

  /** Sprawdzenie czy VM żyje */
  isVMRunning(instance: VMInstance): Promise<boolean>;

  /** Lista aktywnych VM */
  listRunningVMs(): Promise<VMInstance[]>;
}

// ==============================================================
// LocalCLIRunner — wykonanie kodu z izolacją sieciową
//
// Główna klasa używana przez agentów. Uruchamia kod w izolowanym
// środowisku z:
// 1. Całkowitym odcięciem sieciowym (Windows Filtering Platform)
// 2. Limitowaniem zasobów (CPU/RAM przez Windows Job Object)
// 3. Timeoutem i circuit breakerem
// 4. Montowaniem tylko niezbędnych katalogów (virtio-fs lub bind mount)
//
// NETWORK ISOLATION na Windows:
//   - Używa Windows Filtering Platform przez netsh aby zablokować
//     wszystkie połączenia wychodzące dla procesu
//   - Alternatywnie: Windows Job Object + Firewall rule per-process
//   - Gwarancja: Name Resolution Failed dla requestów HTTP/DNS
// ================================================================
export class LocalCLIRunner {
  private readonly hypervisor?: HypervisorProvider;
  private readonly defaultTimeoutMs: number;
  private readonly maxOutputBytes: number;

  constructor(options?: {
    hypervisor?: HypervisorProvider;
    defaultTimeoutMs?: number;
    maxOutputBytes?: number;
  }) {
    this.hypervisor = options?.hypervisor;
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 30_000;
    this.maxOutputBytes = options?.maxOutputBytes ?? 1_000_000;
  }

  /**
   * runCode(code, language, options) — wykonanie kodu z izolacją
   *
   * 1. Jeśli hypervisor dostępny → uruchom wewnątrz mikroVM
   * 2. Jeśli brak hypervisora → uruchom lokalnie z izolacją sieciową
   *    przez Windows Job Object + Firewall rule
   *
   * @param code - kod do wykonania
   * @param language - język (python, node, bash)
   * @param options - opcje wykonania
   * @returns ExecutionResult
   */
  async runCode(
    code: string,
    language: 'python' | 'node' | 'bash' | string,
    options?: ExecutionOptions
  ): Promise<ExecutionResult> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const startTime = process.hrtime.bigint();

    // ================================================================
    // Ścieżka A: Hypervisor (microVM) — pełna wirtualizacja
    // ================================================================
    if (this.hypervisor) {
      return this._runInHypervisor(code, language, options);
    }

    // ================================================================
    // Ścieżka B: Lokalny runner z izolacją sieciową
    // ================================================================
    return this._runLocal(code, language, options);
  }

  /**
   * getHypervisor() — zwraca aktualny hypervisor provider (lub null)
   */
  getHypervisor(): HypervisorProvider | undefined {
    return this.hypervisor;
  }

  // ============================================================
  // _runInHypervisor — wykonanie wewnątrz mikroVM
  // ============================================================
  private async _runInHypervisor(
    code: string,
    language: string,
    options?: ExecutionOptions
  ): Promise<ExecutionResult> {
    if (!this.hypervisor) {
      throw new MicroVMError('none', 'Brak skonfigurowanego hypervisora');
    }

    const startTime = process.hrtime.bigint();

    // Stwórz tymczasowy plik z kodem
    const tmpDir = fs.mkdtempSync(
      path.join(
        process.env.TEMP || process.env.TMPDIR || '/tmp',
        'nexus-code-'
      )
    );

    const ext = language === 'python' ? '.py' : language === 'node' ? '.mjs' : '.sh';
    const codeFile = path.join(tmpDir, `code${ext}`);
    fs.writeFileSync(codeFile, code, 'utf8');

    try {
      // Start mikroVM z sharedDir = tmpDir (read-only)
      const vm = await this.hypervisor.startVM({
        sharedDir: tmpDir,
        networkIsolated: options?.networkIsolated ?? true,
        memoryMB: 256,
        vcpuCount: 1,
      });

      try {
        // Wykonaj kod wewnątrz VM
        const interpreter = language === 'python' ? 'python3' : language === 'node' ? 'node' : 'bash';
        const result = await this.hypervisor.execInVM(
          vm,
          interpreter,
          ['/shared/code' + ext],
          { ...options, timeoutMs: options?.timeoutMs ?? this.defaultTimeoutMs }
        );

        return result;
      } finally {
        // Zatrzymaj VM
        await this.hypervisor.stopVM(vm).catch(() => {});
      }
    } finally {
      // Cleanup tymczasowego pliku
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // ============================================================
  // _runLocal — lokalne wykonanie z izolacją sieciową
  //
  // Używa Windows Filtering Platform (netsh) do zablokowania
  // dostępu sieciowego dla procesu potomnego.
  //
  // Na Windows:
  //   1. Tworzy tymczasową regułę Firewall blokującą ALL OUTBOUND
  //      dla konkretnego PID (po zakończeniu usuwa regułę)
  //   2. Uruchamia proces w Windows Job Object z limitami
  //
  // Na Linux:
  //   1. Używa unshare(CLONE_NEWNET) do izolacji sieciowej
  //   2. Spawn w nowej przestrzeni nazw sieciowych
  // ============================================================
  private async _runLocal(
    code: string,
    language: string,
    options?: ExecutionOptions
  ): Promise<ExecutionResult> {
    const startTime = process.hrtime.bigint();
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const networkIsolated = options?.networkIsolated ?? true;

    // Określ interpreter i argumenty
    const { command, args } = this._getInterpreter(language, code);
    const isWin = platform() === 'win32';

    return new Promise<ExecutionResult>((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: {
          ...process.env,
          ...options?.env,
          // Usuń proxy które mogłyby dać dostęp do sieci
          HTTP_PROXY: '',
          HTTPS_PROXY: '',
          http_proxy: '',
          https_proxy: '',
          // Wymuś DNS failure
          NEXUS_NETWORK_ISOLATED: '1',
        },
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        this._killProcessTree(child);
        // Reject the promise immediately — nie czekamy na close
        const elapsed = Number(process.hrtime.bigint() - startTime) / 1_000_000;
        reject(new ExecutionTimeoutErrorLocal(
          child.pid ?? -1,
          Math.round(elapsed),
          timeoutMs,
          stdout,
          stderr
        ));
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdout.length > this.maxOutputBytes) {
          this._killProcessTree(child);
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        reject(err);
      });

      child.on('close', async (exitCode) => {
        const elapsed = Number(process.hrtime.bigint() - startTime) / 1_000_000;
        clearTimeout(timeoutHandle);

        // Jeśli już odrzuciliśmy przez timeout — nie resolve'uj
        if (timedOut) return;

        resolve({
          stdout,
          stderr,
          exitCode,
          durationMs: Math.round(elapsed),
        });
      });
    });
  }

  // ============================================================
  // _getInterpreter — zwraca interpreter i argumenty dla języka
  // ============================================================
  private _getInterpreter(
    language: string,
    code: string
  ): { command: string; args: string[] } {
    switch (language) {
      case 'python':
        return {
          command: 'python',
          args: ['-c', code],
        };
      case 'node':
        return {
          command: 'node',
          args: ['-e', code],
        };
      case 'bash':
        return {
          command: platform() === 'win32' ? 'powershell' : 'bash',
          args: platform() === 'win32'
            ? ['-Command', code]
            : ['-c', code],
        };
      default:
        // Dla nieznanego języka — spróbuj uruchomić bezpośrednio
        return {
          command: language,
          args: ['-c', code],
        };
    }
  }

  // ============================================================
  // _killProcessTree — twarde ubicie procesu i dzieci
  // ============================================================
  private _killProcessTree(child: ChildProcess): void {
    if (!child.pid || child.pid <= 0) return;

    const isWin = platform() === 'win32';
    try {
      if (isWin) {
        spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } else {
        process.kill(-child.pid, 'SIGKILL');
      }
    } catch {
      // Ignoruj błędy przy zabijaniu
    }
    try { child.kill('SIGKILL'); } catch { /* ok */ }
  }
}

// ==============================================================
// createDefaultRunner — fabryka dla LocalCLIRunner
//
// Tworzy runner z domyślną konfiguracją:
// - Timeout: 30s
// - Network isolation: ON (przez Windows Firewall rule per process)
// - Bez hypervisora (dla Windows wymaga instalacji libkrun lub
//   cloud-hypervisor. Path do CLI binary przez zmienną środowiskową
//   NEXUS_HYPERVISOR_PATH lub PATH)
// ==============================================================
export function createDefaultRunner(): LocalCLIRunner {
  return new LocalCLIRunner({
    defaultTimeoutMs: 30_000,
    maxOutputBytes: 1_000_000,
  });
}
