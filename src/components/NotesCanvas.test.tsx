import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { NotesCanvas } from './NotesCanvas';
import type { ProjektyNode, ProjektyEdge } from '../types';
import type { NexusBridge } from '../shared/types/ipc';

describe('NotesCanvas - Selection, Tab Linking, and Edge Management', () => {
  let mockNodes: ProjektyNode[];
  let mockEdges: ProjektyEdge[];
  let mockBridge: Partial<NexusBridge>;

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockNodes = [
      {
        id: 'node-1',
        project_id: 'default',
        title: '',
        content: 'Pierwsza notatka',
        x: 100,
        y: 100,
        width: 280,
        height: 140,
      },
      {
        id: 'node-2',
        project_id: 'default',
        title: '',
        content: 'Druga notatka',
        x: 500,
        y: 100,
        width: 280,
        height: 140,
      },
    ];
    mockEdges = [];

    mockBridge = {
      projGetProjects: vi.fn().mockResolvedValue([{ id: 'default', name: 'Notatki' }]),
      projSaveProject: vi.fn().mockResolvedValue({ success: true }),
      projGetNodes: vi.fn().mockImplementation(() => Promise.resolve([...mockNodes])),
      projGetEdges: vi.fn().mockImplementation(() => Promise.resolve([...mockEdges])),
      projSaveNode: vi.fn().mockResolvedValue({ success: true }),
      projDeleteNode: vi.fn().mockResolvedValue({ success: true }),
      projSaveEdge: vi.fn().mockResolvedValue({ success: true }),
      projDeleteEdge: vi.fn().mockResolvedValue({ success: true }),
    };

    window.nexusBridge = mockBridge as any;
  });

  it('renders loaded notes properly', async () => {
    render(<NotesCanvas />);
    expect(await screen.findByText('Pierwsza notatka')).toBeDefined();
    expect(await screen.findByText('Druga notatka')).toBeDefined();
  });

  it('selects a note on card click and highlights it', async () => {
    render(<NotesCanvas />);
    const card1 = await screen.findByTestId('note-card-node-1');
    expect(card1.getAttribute('data-selected')).toBe('false');

    fireEvent.mouseDown(card1, { clientX: 110, clientY: 110 });
    fireEvent.mouseUp(window);

    expect(card1.getAttribute('data-selected')).toBe('true');
  });

  it('starts linking mode with selected note as source when Tab is pressed', async () => {
    render(<NotesCanvas />);
    const card1 = await screen.findByTestId('note-card-node-1');

    // Select node 1
    fireEvent.mouseDown(card1, { clientX: 110, clientY: 110 });
    fireEvent.mouseUp(window);
    expect(card1.getAttribute('data-selected')).toBe('true');

    // Press Tab
    fireEvent.keyDown(window, { key: 'Tab' });

    expect(card1.getAttribute('data-linking-source')).toBe('true');
    expect(await screen.findByText(/Kliknij notatkę docelową, aby połączyć/i)).toBeDefined();
  });

  it('creates edge when second note is clicked in linking mode and exits linking mode', async () => {
    render(<NotesCanvas />);
    const card1 = await screen.findByTestId('note-card-node-1');
    const card2 = await screen.findByTestId('note-card-node-2');

    // Select node 1 and press Tab
    fireEvent.mouseDown(card1, { clientX: 110, clientY: 110 });
    fireEvent.mouseUp(window);

    fireEvent.keyDown(window, { key: 'Tab' });

    expect(card1.getAttribute('data-linking-source')).toBe('true');

    // Click node 2 to complete link
    fireEvent.click(card2);

    expect(mockBridge.projSaveEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        edge: expect.objectContaining({
          source_node_id: 'node-1',
          target_node_id: 'node-2',
        }),
      }),
    );

    // Linking mode should now be closed
    expect(card1.getAttribute('data-linking-source')).toBe('false');
    expect(screen.queryByText(/Kliknij notatkę docelową/i)).toBeNull();
    // Target note should now be selected
    expect(card2.getAttribute('data-selected')).toBe('true');
  });

  it('commits text and immediately enters linking mode when Tab is pressed in textarea', async () => {
    render(<NotesCanvas />);
    const card1 = await screen.findByTestId('note-card-node-1');

    // Double click to edit
    fireEvent.doubleClick(card1);
    const textarea = await screen.findByPlaceholderText(/Wpisz treść…/i);
    expect(textarea).toBeDefined();

    // Type text and press Tab
    fireEvent.change(textarea, { target: { value: 'Zaktualizowana notatka' } });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Tab' });
    });

    expect(mockBridge.projSaveNode).toHaveBeenCalledWith(
      expect.objectContaining({
        node: expect.objectContaining({
          id: 'node-1',
          content: 'Zaktualizowana notatka',
        }),
      }),
    );

    // Linking mode must be active with node-1 as source
    expect(card1.getAttribute('data-linking-source')).toBe('true');
    expect(await screen.findByText(/Kliknij notatkę docelową/i)).toBeDefined();
  });

  it('cancels linking mode when Escape is pressed', async () => {
    render(<NotesCanvas />);
    const card1 = await screen.findByTestId('note-card-node-1');

    // Select node 1 and press Tab
    fireEvent.mouseDown(card1, { clientX: 110, clientY: 110 });
    fireEvent.mouseUp(window);

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(card1.getAttribute('data-linking-source')).toBe('true');

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(card1.getAttribute('data-linking-source')).toBe('false');
    expect(screen.queryByText(/Kliknij notatkę docelową/i)).toBeNull();
  });

  it('cancels linking mode when Tab is pressed again', async () => {
    render(<NotesCanvas />);
    const card1 = await screen.findByTestId('note-card-node-1');

    // Select node 1 and press Tab
    fireEvent.mouseDown(card1, { clientX: 110, clientY: 110 });
    fireEvent.mouseUp(window);

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(card1.getAttribute('data-linking-source')).toBe('true');

    // Press Tab again
    fireEvent.keyDown(window, { key: 'Tab' });

    expect(card1.getAttribute('data-linking-source')).toBe('false');
    expect(screen.queryByText(/Kliknij notatkę docelową/i)).toBeNull();
  });

  it('clears selection when clicking canvas background', async () => {
    render(<NotesCanvas />);
    const card1 = await screen.findByTestId('note-card-node-1');

    fireEvent.mouseDown(card1, { clientX: 110, clientY: 110 });
    fireEvent.mouseUp(window);
    expect(card1.getAttribute('data-selected')).toBe('true');

    const canvasBg = screen.getByTestId('canvas-container');
    fireEvent.mouseDown(canvasBg, { target: canvasBg, clientX: 10, clientY: 10 });

    expect(card1.getAttribute('data-selected')).toBe('false');
  });

  it('deletes selected note when Delete key is pressed', async () => {
    render(<NotesCanvas />);
    const card1 = await screen.findByTestId('note-card-node-1');

    fireEvent.mouseDown(card1, { clientX: 110, clientY: 110 });
    fireEvent.mouseUp(window);
    expect(card1.getAttribute('data-selected')).toBe('true');

    fireEvent.keyDown(window, { key: 'Delete' });

    expect(mockBridge.projDeleteNode).toHaveBeenCalledWith({ id: 'node-1' });
    expect(screen.queryByTestId('note-card-node-1')).toBeNull();
  });

  it('does not duplicate edge if already linked', async () => {
    mockEdges = [
      {
        id: 'edge-1',
        project_id: 'default',
        source_node_id: 'node-1',
        target_node_id: 'node-2',
      },
    ];

    render(<NotesCanvas />);
    const card1 = await screen.findByTestId('note-card-node-1');
    const card2 = await screen.findByTestId('note-card-node-2');

    // Select node 1 and press Tab
    fireEvent.mouseDown(card1, { clientX: 110, clientY: 110 });
    fireEvent.mouseUp(window);
    fireEvent.keyDown(window, { key: 'Tab' });

    // Click node 2 (already connected)
    fireEvent.click(card2);

    expect(mockBridge.projSaveEdge).not.toHaveBeenCalled();
  });

  it('starts editing when Enter key is pressed on a selected note', async () => {
    render(<NotesCanvas />);
    const card1 = await screen.findByTestId('note-card-node-1');

    fireEvent.mouseDown(card1, { clientX: 110, clientY: 110 });
    fireEvent.mouseUp(window);
    expect(card1.getAttribute('data-selected')).toBe('true');

    fireEvent.keyDown(window, { key: 'Enter' });

    const textarea = await screen.findByPlaceholderText(/Wpisz treść…/i);
    expect(textarea).toBeDefined();
  });

  it('creates a new note on canvas double-click and enters edit mode', async () => {
    render(<NotesCanvas />);
    const canvas = screen.getByTestId('canvas-container');

    fireEvent.doubleClick(canvas, { clientX: 300, clientY: 300 });

    expect(mockBridge.projSaveNode).toHaveBeenCalled();
    const textarea = await screen.findByPlaceholderText(/Wpisz treść…/i);
    expect(textarea).toBeDefined();
  });
});
