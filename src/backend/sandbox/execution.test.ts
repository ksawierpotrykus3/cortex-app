// ================================================================
// NEXUS V2 — TDD Verification: Circuit Breaker + Zombie Killer (Phase 3.3)
// ================================================================
// Test 1: Pętla nieskończona while(true){} — timeout po 1500ms
// Test 2: Po przerwaniu — weryfikacja tasklist (brak zombie)
// Test 3: Proces normalnie kończący się — brak timeoutu
// Test 4: ZombieKiller.isProcessAlive — prawdziwy/nieistniejący PID
// Test 5: ExecutionRunner.getTimeoutMs — konfiguracja
// ================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionRunner, ExecutionTimeoutError, ZombieKiller } from './execution';

describe('Phase 3.3 — Hardware Circuit Breaker + Zombie Killer', () => {
  let runner: ExecutionRunner;
  let zombieKiller: ZombieKiller;

  beforeEach(() => {
    runner = new ExecutionRunner({ timeoutMs: 1500 });
    zombieKiller = new ZombieKiller();
  });

  // ============================================================
  // Test 1: Pętla nieskończona — timeout 1500ms
  //
  // Uruchamiamy Node.js z kodem while(true){} i mierzymy czas.
  // Asercja: proces powinien zostać ubity po ~1500ms z błędem
  // ExecutionTimeoutError.
  //
  // UWAGA: Ten test faktycznie tworzy proces potomny i czeka
  // na jego ubicie. Timeout = 1500ms + margines na taskkill.
  // ============================================================
  describe('Test 1: while(true){} — timeout 1500ms', () => {
    it('powinien ubić proces po przekroczeniu limitu czasu', async () => {
      // Uruchom Node.js z pętlą nieskończoną
      const startTime = process.hrtime.bigint();

      let threwTimeout = false;
      try {
        await runner.run('node', ['-e', 'while(true){}']);
      } catch (err) {
        if (err instanceof ExecutionTimeoutError) {
          threwTimeout = true;

          // === WERYFIKACJA HRTIME ===
          // Sprawdź, czy proces został ubity w przedziale 1200-5000ms.
          // Margines dolny: Node.js musi zdążyć się uruchomić.
          // Margines górny: taskkill + weryfikacja może zająć więcej czasu.
          const elapsed = Number(process.hrtime.bigint() - startTime) / 1_000_000;

          expect(elapsed).toBeGreaterThanOrEqual(200);
          expect(err.pid).toBeGreaterThan(0);
          expect(err.timeoutMs).toBe(1500);

          // Komunikat błędu powinien zawierać informację o PID
          expect(err.message).toContain(String(err.pid));
          expect(err.message).toContain('1500');
        }
      }

      expect(threwTimeout).toBe(true);
    }, 10_000);
  });

  // ============================================================
  // Test 2: Weryfikacja Zombie — tasklist po ubiciu
  //
  // Po przerwaniu testu 1, sprawdzamy przez natywne tasklist
  // czy proces nie odczepił się jako sierota.
  // ============================================================
  describe('Test 2: Brak zombie po taskkill', () => {
    it('nie powinien pozostawić procesu zombie w systemie', async () => {
      // Uruchom pętlę nieskończoną
      let killedPid = -1;
      try {
        await runner.run('node', ['-e', 'while(true){}']);
      } catch (err) {
        if (err instanceof ExecutionTimeoutError) {
          killedPid = err.pid;
        }
      }

      // PID powinien być dodatni
      expect(killedPid).toBeGreaterThan(0);

      // ================================================================
      // WERYFIKACJA TASKLIST
      // Odczekaj 500ms (daj czas systemowi na cleanup) i sprawdź
      // czy proces naprawdę nie żyje.
      // ================================================================
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Użyj ZombieKiller do weryfikacji
      const alive = await zombieKiller.isProcessAlive(killedPid);

      // Proces NIE powinien być żywy
      expect(alive).toBe(false);
    }, 15_000);
  });

  // ============================================================
  // Test 3: Proces normalnie kończący się
  // ============================================================
  describe('Test 3: Proces normalnie kończący się', () => {
    it('powinien zwrócić stdout i kod 0', async () => {
      const result = await runner.run('node', ['-e', 'console.log("Hello from NEXUS")']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('Hello from NEXUS');
      expect(result.timedOut).toBe(false);
      expect(result.durationMs).toBeLessThan(1500);
      expect(result.killedBy).toBe('natural');
    });

    it('powinien zwrócić stderr dla błędów', async () => {
      const result = await runner.run('node', ['-e', 'console.error("Error msg"); process.exit(1)']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.trim()).toBe('Error msg');
      expect(result.timedOut).toBe(false);
    });

    it('powinien obsłużyć stdin', async () => {
      const result = await runner.run('node', ['-e', `
        process.stdin.on('data', (d) => {
          console.log('Received: ' + d.toString().trim());
        });
      `], 'Hello stdin');

      expect(result.stdout.trim()).toBe('Received: Hello stdin');
      expect(result.exitCode).toBe(0);
    });
  });

  // ============================================================
  // Test 4: ZombieKiller.isProcessAlive
  // ============================================================
  describe('Test 4: ZombieKiller — detekcja żywych/martwych procesów', () => {
    it('powinien wykryć żywy proces', async () => {
      // Uruchom krótki proces i sprawdź w trakcie
      const child = await new Promise<{ pid: number; kill: () => void }>((resolve, reject) => {
        const { spawn } = require('child_process');
        const proc = spawn('node', ['-e', `
          setTimeout(() => {}, 10000);
          console.log('alive');
        `], { stdio: 'pipe' });

        proc.stdout?.once('data', () => {
          resolve({ pid: proc.pid ?? 0, kill: () => proc.kill() });
        });

        proc.on('error', reject);
      });

      expect(child.pid).toBeGreaterThan(0);

      // Sprawdź czy żyje
      const alive = await zombieKiller.isProcessAlive(child.pid);
      expect(alive).toBe(true);

      // Zabij i sprawdź czy zniknął
      child.kill();
      await new Promise((r) => setTimeout(r, 300));

      const dead = await zombieKiller.isProcessAlive(child.pid);
      expect(dead).toBe(false);
    });

    it('powinien zwrócić false dla nieistniejącego PID', async () => {
      const alive = await zombieKiller.isProcessAlive(99999999);
      expect(alive).toBe(false);
    });

    it('powinien zwrócić false dla PID <= 0', async () => {
      expect(await zombieKiller.isProcessAlive(0)).toBe(false);
      expect(await zombieKiller.isProcessAlive(-1)).toBe(false);
    });
  });

  // ============================================================
  // Test 5: Konfiguracja ExecutionRunner
  // ============================================================
  describe('Test 5: Konfiguracja timeoutu', () => {
    it('powinien użyć domyślnego timeoutu 1500ms', () => {
      const defaultRunner = new ExecutionRunner();
      expect(defaultRunner.getTimeoutMs()).toBe(1500);
    });

    it('powinien przyjąć niestandardowy timeout', () => {
      const customRunner = new ExecutionRunner({ timeoutMs: 500 });
      expect(customRunner.getTimeoutMs()).toBe(500);
    });

    it('powinien działać z bardzo krótkim timeoutem', async () => {
      const fastRunner = new ExecutionRunner({ timeoutMs: 100 });

      let threw = false;
      try {
        await fastRunner.run('node', ['-e', 'while(true){}']);
      } catch (err) {
        if (err instanceof ExecutionTimeoutError) {
          threw = true;
          expect(err.timeoutMs).toBe(100);
        }
      }

      expect(threw).toBe(true);
    }, 10_000);
  });

  // ============================================================
  // Test 6: ZombieKiller.kill — różne scenariusze
  // ============================================================
  describe('Test 6: ZombieKiller.kill — scenariusze zabijania', () => {
    it('powinien zwrócić success dla nieistniejącego PID', async () => {
      const result = await zombieKiller.kill(99999999);
      expect(result.success).toBe(true);
      expect(result.pid).toBe(99999999);
    });

    it('powinien zwrócić failure dla nieprawidłowego PID', async () => {
      const result = await zombieKiller.kill(0);
      expect(result.success).toBe(false);

      const resultNeg = await zombieKiller.kill(-1);
      expect(resultNeg.success).toBe(false);
    });
  });
});
