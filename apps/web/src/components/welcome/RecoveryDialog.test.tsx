import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecoveryDialog } from "./RecoveryDialog";
import type { AutoSaveMetadata } from "../../services/auto-save";

describe("RecoveryDialog", () => {
  const mockOnRecover = vi.fn();
  const mockOnDismiss = vi.fn();

  const createSave = (overrides: Partial<AutoSaveMetadata> = {}): AutoSaveMetadata => ({
    id: "save-1",
    projectId: "project-1",
    projectName: "Test Project",
    timestamp: Date.now(),
    slot: 0,
    isRecovery: true,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog with most recent save", () => {
    const saves = [createSave({ projectName: "My Video" })];
    render(
      <RecoveryDialog saves={saves} onRecover={mockOnRecover} onDismiss={mockOnDismiss} />
    );

    expect(screen.getByText("Récupère ton travail")).toBeInTheDocument();
    expect(screen.getByText("On a trouvé un projet non enregistré")).toBeInTheDocument();
    expect(screen.getByText("My Video")).toBeInTheDocument();
  });

  it("calls onRecover when recover button is clicked", () => {
    const saves = [createSave({ id: "save-abc" })];
    render(
      <RecoveryDialog saves={saves} onRecover={mockOnRecover} onDismiss={mockOnDismiss} />
    );

    fireEvent.click(screen.getByText("Récupérer le projet"));
    expect(mockOnRecover).toHaveBeenCalledWith("save-abc");
  });

  it("calls onDismiss when Start Fresh is clicked", () => {
    const saves = [createSave()];
    render(
      <RecoveryDialog saves={saves} onRecover={mockOnRecover} onDismiss={mockOnDismiss} />
    );

    fireEvent.click(screen.getByText("Repartir à zéro"));
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it("calls onDismiss when close button is clicked", () => {
    const saves = [createSave()];
    render(
      <RecoveryDialog saves={saves} onRecover={mockOnRecover} onDismiss={mockOnDismiss} />
    );

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it("calls onDismiss when Escape key is pressed", () => {
    const saves = [createSave()];
    render(
      <RecoveryDialog saves={saves} onRecover={mockOnRecover} onDismiss={mockOnDismiss} />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it("shows older saves toggle when multiple saves exist", () => {
    const saves = [
      createSave({ id: "save-1", projectName: "Most Recent" }),
      createSave({ id: "save-2", projectName: "Older Save", timestamp: Date.now() - 3600000 }),
    ];
    render(
      <RecoveryDialog saves={saves} onRecover={mockOnRecover} onDismiss={mockOnDismiss} />
    );

    expect(screen.getByText("1 sauvegarde plus ancienne disponible")).toBeInTheDocument();
  });

  it("expands older saves when toggle is clicked", () => {
    const saves = [
      createSave({ id: "save-1", projectName: "Most Recent" }),
      createSave({ id: "save-2", projectName: "Older Save", timestamp: Date.now() - 3600000 }),
    ];
    render(
      <RecoveryDialog saves={saves} onRecover={mockOnRecover} onDismiss={mockOnDismiss} />
    );

    fireEvent.click(screen.getByText("1 sauvegarde plus ancienne disponible"));
    expect(screen.getByText("Older Save")).toBeInTheDocument();
  });

  it("allows recovering older save", () => {
    const saves = [
      createSave({ id: "save-1", projectName: "Most Recent" }),
      createSave({ id: "save-2", projectName: "Older Save", timestamp: Date.now() - 3600000 }),
    ];
    render(
      <RecoveryDialog saves={saves} onRecover={mockOnRecover} onDismiss={mockOnDismiss} />
    );

    fireEvent.click(screen.getByText("1 sauvegarde plus ancienne disponible"));
    fireEvent.click(screen.getByText("Older Save"));

    expect(mockOnRecover).toHaveBeenCalledWith("save-2");
  });

  it("displays relative time for recent saves", () => {
    const saves = [createSave({ timestamp: Date.now() - 30000 })];
    render(
      <RecoveryDialog saves={saves} onRecover={mockOnRecover} onDismiss={mockOnDismiss} />
    );

    expect(screen.getByText(/à l'instant/)).toBeInTheDocument();
  });

  it("displays minutes ago for older saves", () => {
    const saves = [createSave({ timestamp: Date.now() - 5 * 60 * 1000 })];
    render(
      <RecoveryDialog saves={saves} onRecover={mockOnRecover} onDismiss={mockOnDismiss} />
    );

    expect(screen.getByText(/il y a 5 minutes/)).toBeInTheDocument();
  });

  it("disables recover button while recovering", () => {
    const saves = [createSave()];
    render(
      <RecoveryDialog saves={saves} onRecover={mockOnRecover} onDismiss={mockOnDismiss} />
    );

    fireEvent.click(screen.getByText("Récupérer le projet"));
    expect(screen.getByText("Récupération...")).toBeInTheDocument();
  });
});
