import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SupervisorView } from './SupervisorView';
import type { Lancuch, DecyzjaPayload } from './types';
import type { NexusBridge } from '../shared/types/ipc';

const mockPipelines: Lancuch[] = [
  {
    id: 'test_pipeline',
    nazwa: 'Test Lead Hunter',
    opis: 'Opis potoku testowego',
    silnik: 'Playwright + DeepSeek',
    wyzwalacz: 'Ręcznie',
    status_ogolny: 'w_toku',
    kroki: [
      {
        id: 1,
        nazwa: 'Krok 1: Inicjalizacja',
        typ: 'kod',
        status: 'zrobione',
        narzedzie: 'Playwright',
        opis: 'Przeglądarka uruchomiona',
        czas_trwania_s: 0.5,
        logi: ['[00:00.100] Start sesji']
      },
      {
        id: 2,
        nazwa: 'Krok 2: Bramka Decyzyjna',
        typ: 'ai',
        status: 'czeka_na_ciebie',
        narzedzie: 'DeepSeek-V3',
        opis: 'Czeka na zatwierdzenie',
        decyzja: {
          pytanie: 'Czy zatwierdzasz operację?',
          opcje: [
            { akcja: 'approve', etykieta: '✓ Zatwierdź' },
            { akcja: 'modify', etykieta: '✎ Popraw' },
            { akcja: 'reject', etykieta: '✕ Odrzuć' },
          ]
        },
        tabela: [
          { ID: '1', Nazwa: 'Pozycja A', Kwota: '1000 PLN' }
        ]
      }
    ]
  },
  {
    id: 'cron_pipeline',
    nazwa: 'Raport tygodniowy',
    silnik: 'Python + SMTP',
    wyzwalacz: 'Harmonogram (cron)',
    status_ogolny: 'zakonczono',
    kroki: [
      {
        id: 1,
        nazwa: 'Generuj raport',
        typ: 'kod',
        status: 'zrobione',
        czas_trwania_s: 2,
        logi: ['ok']
      }
    ]
  }
];

function mockBridge(overrides: Partial<NexusBridge> = {}): NexusBridge {
  const bridge: NexusBridge = {
    winMinimize: vi.fn().mockResolvedValue(undefined),
    winMaximize: vi.fn().mockResolvedValue(true),
    winClose: vi.fn().mockResolvedValue(undefined),
    winIsMaximized: vi.fn().mockResolvedValue(false),
    projSaveProject: vi.fn(),
    projGetProjects: vi.fn(),
    projGetProject: vi.fn(),
    projDeleteProject: vi.fn(),
    projSaveNode: vi.fn(),
    projGetNodes: vi.fn(),
    projDeleteNode: vi.fn(),
    projSaveEdge: vi.fn(),
    projGetEdges: vi.fn(),
    projDeleteEdge: vi.fn(),
    projSaveAnnotation: vi.fn(),
    projGetAnnotations: vi.fn(),
    projDeleteAnnotation: vi.fn(),
    supervisorGetPipelines: vi.fn().mockResolvedValue(mockPipelines),
    supervisorGetPipeline: vi.fn(),
    supervisorSavePipeline: vi.fn(),
    supervisorSaveDecision: vi.fn().mockResolvedValue({ success: true }),
    supervisorRun: vi.fn().mockResolvedValue({ success: true }),
    supervisorRunChain: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
  return bridge;
}

describe('SupervisorView & Automation Hub Component', () => {
  beforeEach(() => {
    window.nexusBridge = mockBridge();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders Automation Hub with metrics and pipeline cards', async () => {
    render(<SupervisorView />);

    expect(await screen.findByText('Centrala Automatyzacji')).toBeTruthy();
    expect(await screen.findByText('Test Lead Hunter')).toBeTruthy();
    expect(await screen.findByText('Playwright + DeepSeek')).toBeTruthy();
  });

  it('navigates from Hub to Detail view and displays Master-Detail inspector', async () => {
    render(<SupervisorView />);

    const openBtn = (await screen.findAllByText('Podgląd na żywo'))[0];
    fireEvent.click(openBtn);

    expect(await screen.findByText('Wróć do Centrali')).toBeTruthy();
    expect((await screen.findAllByText('Krok 2: Bramka Decyzyjna')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Bramka Bezpieczeństwa (Cortex Safety Gate)')).toBeTruthy();
    expect(await screen.findByText('Czy zatwierdzasz operację?')).toBeTruthy();

    const backBtn = await screen.findByText('Wróć do Centrali');
    fireEvent.click(backBtn);

    expect((await screen.findAllByText(/Centrala Automatyzacji/i)).length).toBeGreaterThan(0);
  });

  it('shows a distinct error state when loading fails', async () => {
    window.nexusBridge = mockBridge({
      supervisorGetPipelines: vi.fn().mockRejectedValue(new Error('disk failure')),
    });

    render(<SupervisorView />);

    expect(await screen.findByText('Błąd odczytu stanu')).toBeTruthy();
  });

  it('shows empty state when there are no pipelines', async () => {
    window.nexusBridge = mockBridge({
      supervisorGetPipelines: vi.fn().mockResolvedValue([]),
    });

    render(<SupervisorView />);

    expect(await screen.findByText('Brak aktywnych potoków na dysku')).toBeTruthy();
  });

  it('filters pipelines by cron', async () => {
    render(<SupervisorView />);

    // Otwórz widok i poczekaj na dane
    expect((await screen.findAllByText('Test Lead Hunter')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Raport tygodniowy')).toBeTruthy();

    const cronFilter = screen.getByText('Harmonogramy (1)');
    fireEvent.click(cronFilter);

    await waitFor(() => {
      expect(screen.queryByText('Test Lead Hunter')).toBeNull();
      expect(screen.getByText('Raport tygodniowy')).toBeTruthy();
    });
  });

  it('handles approve decision and shows success toast', async () => {
    const saveDecision = vi.fn().mockResolvedValue({ success: true });
    window.nexusBridge = mockBridge({ supervisorSaveDecision: saveDecision });

    render(<SupervisorView />);

    const openBtn = (await screen.findAllByText('Podgląd na żywo'))[0];
    fireEvent.click(openBtn);

    const approveBtn = await screen.findByText('✓ Zatwierdź');
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(saveDecision).toHaveBeenCalledTimes(1);
    });
    const payload: DecyzjaPayload = saveDecision.mock.calls[0][0];
    expect(payload.decision).toBe('approve');
    expect(payload.pipelineId).toBe('test_pipeline');

    expect(await screen.findByText(/Decyzja zatwierdzona/)).toBeTruthy();
  });

  it('does not show success toast when saveDecision returns { success: false }', async () => {
    const saveDecision = vi.fn().mockResolvedValue({ success: false });
    window.nexusBridge = mockBridge({ supervisorSaveDecision: saveDecision });

    render(<SupervisorView />);

    const openBtn = (await screen.findAllByText('Podgląd na żywo'))[0];
    fireEvent.click(openBtn);

    const approveBtn = await screen.findByText('✓ Zatwierdź');
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(saveDecision).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText(/Nie udało się zapisać decyzji/)).toBeTruthy();
    expect(screen.queryByText(/Decyzja zatwierdzona/)).toBeNull();
  });

  it('sends comment on modify decision', async () => {
    const saveDecision = vi.fn().mockResolvedValue({ success: true });
    window.nexusBridge = mockBridge({ supervisorSaveDecision: saveDecision });

    render(<SupervisorView />);

    const openBtn = (await screen.findAllByText('Podgląd na żywo'))[0];
    fireEvent.click(openBtn);

    const modifyBtn = await screen.findByText('✎ Popraw');
    fireEvent.click(modifyBtn);

    const textarea = await screen.findByPlaceholderText(/Napisz co model/);
    fireEvent.change(textarea, { target: { value: 'Zmień treść oferty' } });

    const sendBtn = await screen.findByText('Wyślij korektę do AI');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(saveDecision).toHaveBeenCalledTimes(1);
    });
    const payload: DecyzjaPayload = saveDecision.mock.calls[0][0];
    expect(payload.decision).toBe('modify');
    expect(payload.feedback).toBe('Zmień treść oferty');
  });
});