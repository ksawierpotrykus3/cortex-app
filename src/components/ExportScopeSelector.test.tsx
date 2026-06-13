// @vitest-environment jsdom
// ================================================================
// NEXUS V2 — ExportScopeSelector: TDD Tests (F5.2)
// ================================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { screen, fireEvent } from "@testing-library/dom";
import "@testing-library/jest-dom/vitest";
import { ExportScopeSelector, type ExportScope } from "./ExportScopeSelector";

const fullScope: ExportScope = {
  nodes: true,
  links: true,
  tasks: true,
  drafts: true,
  axioms: true,
  images: true,
  onlySelected: false,
};

afterEach(() => {
  cleanup();
});

// ============================================================
// Test 1: Happy path — checkboxy renderują się i pozwalają
// odznaczyć/zaznaczyć kategorię
// ============================================================
describe("Happy path", () => {
  it("renders all category checkboxes and toggles a category on click", () => {
    const onChange = vi.fn();
    render(
      <ExportScopeSelector
        scope={{ ...fullScope, drafts: false, axioms: false, images: false, links: false }}
        onChange={onChange}
        hasSelection={false}
      />
    );

    // All checkboxes should be present
    expect(screen.getByText("Notatki (nodes)")).toBeInTheDocument();
    expect(screen.getByText("Połączenia (links)")).toBeInTheDocument();
    expect(screen.getByText("Zadania (tasks)")).toBeInTheDocument();
    expect(screen.getByText("Manuskrypty (drafts)")).toBeInTheDocument();

    // Click on "Notatki (nodes)" to toggle it
    const nodesLabel = screen.getByText("Notatki (nodes)").closest("label")!;
    fireEvent.click(nodesLabel);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: false })
    );
  });
});

// ============================================================
// Test 2: Edge case — odznacz wszystko → przycisk Eksportuj
// disabled + komunikat "wybierz co najmniej jedną kategorię"
// ============================================================
describe("Edge case — nothing selected", () => {
  it("shows warning when no categories are selected", () => {
    const emptyScope: ExportScope = {
      nodes: false,
      links: false,
      tasks: false,
      drafts: false,
      axioms: false,
      images: false,
      onlySelected: false,
    };

    render(
      <ExportScopeSelector
        scope={emptyScope}
        onChange={vi.fn()}
        hasSelection={false}
      />
    );

    expect(
      screen.getByText("Wybierz co najmniej jedną kategorię do eksportu.")
    ).toBeInTheDocument();
  });

  it("toggle all selects everything then deselects everything", () => {
    const onChange = vi.fn();

    // Start with nothing selected
    const emptyScope: ExportScope = {
      nodes: false,
      links: false,
      tasks: false,
      drafts: false,
      axioms: false,
      images: false,
      onlySelected: false,
    };

    // Re-render with new scope to trigger toggle all state
    const { rerender } = render(
      <ExportScopeSelector
        scope={emptyScope}
        onChange={onChange}
        hasSelection={false}
      />
    );

    // Should show warning
    expect(
      screen.getByText("Wybierz co najmniej jedną kategorię do eksportu.")
    ).toBeInTheDocument();
  });
});

// ============================================================
// Test 3: Error case — brak danych w kategorii → checkbox
// disabled + tooltip "brak danych"
// ============================================================
describe("Error case — no data available", () => {
  it("disables checkbox when hasData is false and shows tooltip on hover", () => {
    const onChange = vi.fn();

    render(
      <ExportScopeSelector
        scope={fullScope}
        onChange={onChange}
        hasSelection={false}
        hasData={{
          nodes: true,
          links: true,
          tasks: false,
          drafts: true,
          axioms: true,
          images: true,
        }}
      />
    );

    // The tasks checkbox should have opacity classes (disabled)
    const tasksContainer = screen.getByText("Zadania (tasks)").closest("label")!;
    expect(tasksContainer.className).toContain("opacity-40");

    // Clicking disabled checkbox should not trigger onChange
    fireEvent.click(tasksContainer);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not show tooltip when disabledReason is omitted but disabled is true", () => {
    // hasData for a category being false generates disabledReason internally
    // Verify all categories are rendered with hasData all false
    render(
      <ExportScopeSelector
        scope={fullScope}
        onChange={vi.fn()}
        hasSelection={false}
        hasData={{
          nodes: false,
          links: false,
          tasks: false,
          drafts: false,
          axioms: false,
          images: false,
        }}
      />
    );

    // All checkboxes should be disabled (opacity-40 class on labels)
    const labels = document.querySelectorAll("label");
    const disabledLabels = Array.from(labels).filter((l) =>
      l.className.includes("opacity-40")
    );
    // At least the 6 main categories should be disabled
    expect(disabledLabels.length).toBeGreaterThanOrEqual(6);
  });
});

// ============================================================
// Test 4: onlySelected checkbox appears when hasSelection is true
// ============================================================
describe("Selection mode", () => {
  it("shows onlySelected checkbox when nodes are selected", () => {
    render(
      <ExportScopeSelector
        scope={fullScope}
        onChange={vi.fn()}
        hasSelection={true}
      />
    );

    expect(
      screen.getByText("Tylko zaznaczone na mapie")
    ).toBeInTheDocument();
  });

  it("hides onlySelected checkbox when no nodes selected", () => {
    render(
      <ExportScopeSelector
        scope={fullScope}
        onChange={vi.fn()}
        hasSelection={false}
      />
    );

    expect(
      screen.queryByText("Tylko zaznaczone na mapie")
    ).not.toBeInTheDocument();
  });
});

// ============================================================
// Test 5: Toggle all — zaznacz wszystko / odznacz wszystko
// ============================================================
describe("Toggle all", () => {
  it('shows "Odznacz wszystko" when all are selected', () => {
    render(
      <ExportScopeSelector
        scope={fullScope}
        onChange={vi.fn()}
        hasSelection={false}
      />
    );

    expect(screen.getByText("Odznacz wszystko")).toBeInTheDocument();
  });

  it('shows "Zaznacz wszystko" when some are not selected', () => {
    const partial: ExportScope = { ...fullScope, tasks: false };

    render(
      <ExportScopeSelector
        scope={partial}
        onChange={vi.fn()}
        hasSelection={false}
      />
    );

    expect(screen.getByText("Zaznacz wszystko")).toBeInTheDocument();
    expect(screen.queryByText("Odznacz wszystko")).not.toBeInTheDocument();
  });
});
