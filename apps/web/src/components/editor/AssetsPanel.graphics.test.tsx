import "../../test/install-local-storage-mock";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEngineStore } from "../../stores/engine-store";
import { createEmptyProject } from "../../stores/project/project-helpers";
import { useProjectStore } from "../../stores/project-store";
import { useTimelineStore } from "../../stores/timeline-store";
import { useUIStore } from "../../stores/ui-store";
import { AssetsPanel } from "./AssetsPanel";
// Upstream feature test: run it with the full (non-ZoneScene) scope so the hidden code stays covered.
vi.mock("../../zonescene/studio-scope", () => ({
  STUDIO_FULL: false,
  isStudioSectionHidden: () => false,
  STUDIO_ASSET_TABS: { has: () => true },
  STUDIO_RECORDING_ENABLED: true,
  STUDIO_CLOUD_AI_ENABLED: true,
  STUDIO_BACK_URL: "/",
  STUDIO_BACK_LABEL: "Back",
}));


describe("AssetsPanel graphics workflow", () => {
  beforeEach(() => {
    useEngineStore.getState().getGraphicsEngine()?.clearCache();
    useProjectStore.setState({
      hasOpenProject: true,
      project: createEmptyProject("Graphics workflow"),
    });
    useTimelineStore.setState({ playheadPosition: 2.25 });
    useUIStore.getState().clearSelection();
  });

  afterEach(() => {
    cleanup();
    useEngineStore.getState().getGraphicsEngine()?.clearCache();
    useUIStore.getState().clearSelection();
    useProjectStore.setState({
      hasOpenProject: false,
      project: createEmptyProject("Reset"),
    });
  });

  it("places a new shape at the playhead and opens it in the inspector", async () => {
    render(<AssetsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Graphics" }));

    expect(
      screen.getByRole("button", { name: "Import & Add Sticker" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rectangle" }));

    await waitFor(() => {
      const shapes =
        useEngineStore.getState().getGraphicsEngine()?.getAllShapeClips() ?? [];
      expect(shapes).toHaveLength(1);
      expect(shapes[0]).toMatchObject({
        shapeType: "rectangle",
        startTime: 2.25,
      });
      expect(useUIStore.getState().getSelectedClipIds()).toEqual([shapes[0]?.id]);
    });
  });
});
