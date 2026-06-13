// @vitest-environment jsdom
// ================================================================
// NEXUS V2 — ExportModal: Integration Tests (F5.2)
// ================================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { screen, fireEvent } from "@testing-library/dom";
import "@testing-library/jest-dom/vitest";
import { ExportModal } from "./ExportModal";
import * as exportEngine from "../exportEngine";

vi.mock("../exportEngine", () => ({
  generateAIExport: vi.fn(() => JSON.stringify({ mock: true }, null, 2)),
  downloadFile: vi.fn(),
  generateExportFilename: vi.fn((label: string) => `${label}_2026-06-12.json`),
  getExportPreset: vi.fn((view?: string) => ({
    label: view || "nexus",
    scope: { nodes: true, links: true, tasks: false, drafts: false, axioms: true, images: true, onlySelected: false },
  })),
  sanitizeFilename: vi.fn((s: string) => s.toLowerCase().replace(/[^a-z0-9_-]/g, "_")),
}));

const defaultProps = {
  state: "export" as const,
  onClose: vi.fn(),
  nodes: [{ id: "n1", title: "Node 1", content: "Content 1", x: 0, y: 0 }],
  links: [{ source: "n1", target: "n2" }],
  axioms: "axiom 1\naxiom 2",
  scopeFromView: undefined,
  selectedNodeIds: undefined,
  tasks: undefined,
  drafts: undefined,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ============================================================
// Test 1: Przycisk Eksportuj disabled gdy nic nie zaznaczone
// ============================================================
describe("Export button disabled state", () => {
  it("disables export button when no categories are selected", () => {
    vi.mocked(exportEngine.getExportPreset).mockImplementation(() => ({
      label: "nexus",
      scope: { nodes: false, links: false, tasks: false, drafts: false, axioms: false, images: false, onlySelected: false },
    }));

    render(<ExportModal {...defaultProps} />);

    const exportBtn = screen.getByText("Eksportuj");
    expect(exportBtn).toBeDisabled();
    expect(exportBtn.className).toContain("opacity-50");
  });

  it("enables export button when at least one category is selected", () => {
    vi.mocked(exportEngine.getExportPreset).mockImplementation(() => ({
      label: "nexus",
      scope: { nodes: true, links: true, tasks: false, drafts: false, axioms: true, images: true, onlySelected: false },
    }));

    render(<ExportModal {...defaultProps} />);

    const exportBtn = screen.getByText("Eksportuj");
    expect(exportBtn).not.toBeDisabled();
  });
});

// ============================================================
// Test 2: hasData poprawnie przekazywane do ExportScopeSelector
// ============================================================
describe("hasData prop generation", () => {
  it("marks categories as disabled when no data available", () => {
    render(
      <ExportModal
        {...defaultProps}
        nodes={[]}
        links={[]}
        axioms=""
        tasks={[]}
        drafts={[]}
      />
    );

    const nodesLabel = screen.getByText("Notatki (nodes)").closest("label")!;
    expect(nodesLabel.className).toContain("opacity-40");
  });

  it("keeps categories enabled when data is present", () => {
    render(<ExportModal {...defaultProps} />);

    const nodesLabel = screen.getByText("Notatki (nodes)").closest("label")!;
    expect(nodesLabel.className).not.toContain("opacity-40");
  });
});

// ============================================================
// Test 3: Ręczna edycja nazwy pliku nie jest nadpisywana (P2 fix)
// ============================================================
describe("Filename manual edit preservation (P2 fix)", () => {
  it("does not overwrite manually edited filename on scope change", () => {
    const { rerender } = render(
      <ExportModal
        {...defaultProps}
        scopeFromView={"nexus" as any}
      />
    );

    const input = screen.getByPlaceholderText("nazwa_pliku.json") as HTMLInputElement;
    expect(input.value).toBe("nexus_2026-06-12.json");

    // User edits the filename
    fireEvent.change(input, { target: { value: "my_custom_name.json" } });
    expect(input.value).toBe("my_custom_name.json");

    // Scope changes (e.g. user switches view)
    rerender(
      <ExportModal
        {...defaultProps}
        scopeFromView={"lab-todo" as any}
      />
    );

    // Filename should NOT be overwritten
    expect(input.value).toBe("my_custom_name.json");
  });
});
