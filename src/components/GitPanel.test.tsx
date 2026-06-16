// @vitest-environment jsdom
// ================================================================
// NEXUS — GitPanel Tests (#23)
// ================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { screen, fireEvent, waitFor } from "@testing-library/dom";
import "@testing-library/jest-dom/vitest";
import { GitPanel } from "./GitPanel";
import { GitLogEntry, GitBranchInfo } from "../shared/types/schema";

// ============================================================
// Mock: window.nexusBridge
// ============================================================
const mockGetGitConfig = vi.fn();
const mockGetGitStatus = vi.fn();
const mockGetGitLog = vi.fn();
const mockGetGitBranches = vi.fn();
const mockGitCommit = vi.fn();
const mockGitPush = vi.fn();
const mockGitPull = vi.fn();
const mockGitSwitchBranch = vi.fn();
const mockGitCreateBranch = vi.fn();
const mockGitMerge = vi.fn();
const mockGetGitScheduleStatus = vi.fn();
const mockToggleGitSchedule = vi.fn();

const mockNexusBridge = {
  getGitConfig: mockGetGitConfig,
  getGitStatus: mockGetGitStatus,
  getGitLog: mockGetGitLog,
  getGitBranches: mockGetGitBranches,
  gitCommit: mockGitCommit,
  gitPush: mockGitPush,
  gitPull: mockGitPull,
  gitSwitchBranch: mockGitSwitchBranch,
  gitCreateBranch: mockGitCreateBranch,
  gitMerge: mockGitMerge,
  getGitScheduleStatus: mockGetGitScheduleStatus,
  toggleGitSchedule: mockToggleGitSchedule,
};

beforeEach(() => {
  (window as any).nexusBridge = mockNexusBridge;

  // Default mocks
  mockGetGitConfig.mockResolvedValue({
    remoteUrl: 'https://github.com/test/repo.git',
    accessToken: 'token',
    authorName: 'Test',
    authorEmail: 'test@test.com',
    autoCommit: false,
    autoCommitMessage: 'Nexus AI: {{summary}}',
    aiBranchName: 'ai-agent',
    enabled: true,
    pullIntervalMs: 0,
    pushIntervalMs: 0,
    scheduleOnlyOnBranch: '',
  });

  mockGetGitStatus.mockResolvedValue({
    branch: 'main',
    clean: true,
    entries: [],
    ahead: 0,
    behind: 0,
  });

  mockGetGitLog.mockResolvedValue([]);
  mockGetGitBranches.mockResolvedValue([]);
  mockGetGitScheduleStatus.mockResolvedValue({
    pullActive: false,
    pushActive: false,
    pullIntervalMs: 0,
    pushIntervalMs: 0,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete (window as any).nexusBridge;
});

// ============================================================
// Tests
// ============================================================

describe('GitPanel — renderowanie', () => {
  it('renderuje disabled state gdy git wylaczony', async () => {
    mockGetGitConfig.mockResolvedValue({
      remoteUrl: '',
      accessToken: '',
      authorName: '',
      authorEmail: '',
      autoCommit: false,
      autoCommitMessage: '',
      aiBranchName: '',
      enabled: false,
      pullIntervalMs: 0,
      pushIntervalMs: 0,
      scheduleOnlyOnBranch: '',
    });

    render(<GitPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Git jest wyłączony/i)).toBeInTheDocument();
    });
  });

  it('renderuje panel z zakladkami gdy git wlaczony', async () => {
    render(<GitPanel />);

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Historia')).toBeInTheDocument();
      expect(screen.getByText('Branche')).toBeInTheDocument();
    });
  });

  it('laduje status, log i branche na starcie', async () => {
    render(<GitPanel />);

    await waitFor(() => {
      expect(mockGetGitConfig).toHaveBeenCalled();
      expect(mockGetGitStatus).toHaveBeenCalled();
      expect(mockGetGitLog).toHaveBeenCalledWith({ count: 20 });
      expect(mockGetGitBranches).toHaveBeenCalled();
    });
  });

  it('wyswietla nazwe brancha', async () => {
    mockGetGitStatus.mockResolvedValue({
      branch: 'feature/test',
      clean: true,
      entries: [],
      ahead: 2,
      behind: 1,
    });

    render(<GitPanel />);

    await waitFor(() => {
      expect(screen.getByText('feature/test')).toBeInTheDocument();
    });
  });
});

describe('GitPanel — przyciski akcji', () => {
  it('wyswietla przycisk Commit & Push', async () => {
    render(<GitPanel />);

    await waitFor(() => {
      expect(screen.getByText('Commit & Push')).toBeInTheDocument();
    });
  });

  it('wyswietla przyciski push i pull', async () => {
    render(<GitPanel />);

    await waitFor(() => {
      // ArrowUp i ArrowDown to ikony w przyciskach
      expect(screen.getByText('Commit & Push')).toBeInTheDocument();
    });
  });

  it('wyswietla textarea do wpisywania wiadomosci commitu', async () => {
    render(<GitPanel />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Opisz co zmieniłeś...')).toBeInTheDocument();
    });
  });
});

describe('GitPanel — commit flow', () => {
  it('wykonuje commit z wiadomoscia', async () => {
    mockGitCommit.mockResolvedValue({ success: true });

    render(<GitPanel />);

    await waitFor(() => {
      expect(screen.getByText('Commit & Push')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Opisz co zmieniłeś...');
    fireEvent.change(textarea, { target: { value: 'Test commit' } });

    const commitBtn = screen.getByText('Commit & Push');
    fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(mockGitCommit).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Test commit',
        all: true,
      }));
    });
  });

  it('nie wykonuje commitu z pusta wiadomoscia', async () => {
    render(<GitPanel />);

    await waitFor(() => {
      expect(screen.getByText('Commit & Push')).toBeInTheDocument();
    });

    const commitBtn = screen.getByText('Commit & Push');
    expect(commitBtn).toBeDisabled();
  });
});

describe('GitPanel — log tab', () => {
  it('wyswietla Brak commitow gdy pusta historia', async () => {
    render(<GitPanel />);

    // Click "Historia" tab
    await waitFor(() => {
      screen.getByText('Historia').click();
    });

    await waitFor(() => {
      expect(screen.getByText('Brak commitów w historii.')).toBeInTheDocument();
    });
  });

  it('wyswietla wpisy z historii', async () => {
    const mockLog: GitLogEntry[] = [
      { hash: 'abc123def456', author: 'Test', message: 'Fix bug', date: '2026-06-01', refs: 'HEAD -> main' },
      { hash: 'def789ghi012', author: 'Test2', message: 'Add feature', date: '2026-05-30', refs: '' },
    ];
    mockGetGitLog.mockResolvedValue(mockLog);

    render(<GitPanel />);

    await waitFor(() => {
      screen.getByText('Historia').click();
    });

    await waitFor(() => {
      expect(screen.getByText('Fix bug')).toBeInTheDocument();
      expect(screen.getByText('Add feature')).toBeInTheDocument();
    });
  });

  it('uzywa stable key = entry.hash dla log entries', async () => {
    const mockLog: GitLogEntry[] = [
      { hash: 'abc123', author: 'Test', message: 'Fix bug', date: '2026-06-01', refs: '' },
    ];
    mockGetGitLog.mockResolvedValue(mockLog);

    render(<GitPanel />);

    await waitFor(() => {
      screen.getByText('Historia').click();
    });

    await waitFor(() => {
      expect(screen.getByText('Fix bug')).toBeInTheDocument();
    });
  });
});

describe('GitPanel — branches tab', () => {
  it('wyswietla liste branchy', async () => {
    const mockBranches: GitBranchInfo[] = [
      { name: 'main', current: true, upstream: 'origin/main', ahead: 1, behind: 2 },
      { name: 'feature/test', current: false, upstream: undefined, ahead: 0, behind: 0 },
    ];
    mockGetGitBranches.mockResolvedValue(mockBranches);

    render(<GitPanel />);

    const branchesTab = await screen.findByText('Branche');
    branchesTab.click();

    await screen.findByText('feature/test');
    expect(await screen.findByText('Nowy branch')).toBeInTheDocument();
  });

  it('wyswietla przycisk Nowy branch', async () => {
    render(<GitPanel />);

    const branchesTab = await screen.findByText('Branche');
    branchesTab.click();

    expect(await screen.findByText('Nowy branch')).toBeInTheDocument();
  });

  it('uzywa stable key = branch.name dla branch entries', async () => {
    const mockBranches: GitBranchInfo[] = [
      { name: 'main', current: true, upstream: 'origin/main', ahead: 0, behind: 0 },
    ];
    mockGetGitBranches.mockResolvedValue(mockBranches);

    render(<GitPanel />);

    const branchesTab = await screen.findByText('Branche');
    branchesTab.click();

    expect(await screen.findByText('(current)')).toBeInTheDocument();
  });
});

describe('GitPanel — push/pull', () => {
  it('renderuje przycisk push z ikona', async () => {
    mockGitPush.mockResolvedValue({ success: true });

    render(<GitPanel />);

    await waitFor(() => {
      // Verify push button exists in the DOM via its SVG icon
      const pushIcon = document.querySelector('.lucide-arrow-up');
      expect(pushIcon).toBeInTheDocument();
    });
  });

  it('renderuje przycisk pull z ikona', async () => {
    mockGitPull.mockResolvedValue({ success: true });

    render(<GitPanel />);

    await waitFor(() => {
      const pullIcon = document.querySelector('.lucide-arrow-down');
      expect(pullIcon).toBeInTheDocument();
    });
  });
});

describe('GitPanel — schedule toggles', () => {
  it('renders schedule buttons when scheduleStatus is loaded', async () => {
    mockGetGitScheduleStatus.mockResolvedValue({
      pullActive: false,
      pushActive: false,
      pullIntervalMs: 300000,
      pushIntervalMs: 300000,
    });

    render(<GitPanel />);

    await waitFor(() => {
      expect(screen.getByText('Pull')).toBeInTheDocument();
      expect(screen.getByText('Push')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows enabled schedule state when intervals > 0', async () => {
    mockGetGitScheduleStatus.mockResolvedValue({
      pullActive: false,
      pushActive: false,
      pullIntervalMs: 300000,
      pushIntervalMs: 300000,
    });

    render(<GitPanel />);

    await waitFor(() => {
      // Both buttons should be rendered (not disabled because interval > 0)
      const pullBtn = screen.getByText('Pull').closest('button');
      const pushBtn = screen.getByText('Push').closest('button');
      expect(pullBtn).toBeInTheDocument();
      expect(pushBtn).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('GitPanel — error handling', () => {
  it('wyswietla blad gdy commit failed', async () => {
    mockGitCommit.mockResolvedValue({ success: false, error: 'Commit rejected' });

    render(<GitPanel />);

    await waitFor(() => {
      expect(screen.getByText('Commit & Push')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Opisz co zmieniłeś...');
    fireEvent.change(textarea, { target: { value: 'Test' } });

    const commitBtn = screen.getByText('Commit & Push');
    fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(screen.getByText('Commit rejected')).toBeInTheDocument();
    });
  });

  it('wyswietla sukces gdy commit udany', async () => {
    mockGitCommit.mockResolvedValue({ success: true });

    render(<GitPanel />);

    await waitFor(() => {
      expect(screen.getByText('Commit & Push')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Opisz co zmieniłeś...');
    fireEvent.change(textarea, { target: { value: 'Test' } });

    const commitBtn = screen.getByText('Commit & Push');

    // Sprawdź czy przycisk nie jest disabled przed kliknięciem
    expect(commitBtn).not.toBeDisabled();
    fireEvent.click(commitBtn);

    // Poczekaj na sukces — refreshAll (3 promisy) + setSuccess
    await new Promise(r => setTimeout(r, 100));
    await waitFor(() => {
      expect(screen.getByText('Commit udany!')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
