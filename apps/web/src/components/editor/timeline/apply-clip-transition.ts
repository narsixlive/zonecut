import type { TransitionType } from "@openreel/core";
import { getTransitionBridge } from "../../../bridges/transition-bridge";
import { useProjectStore } from "../../../stores/project-store";
import { toast } from "../../../stores/notification-store";

/**
 * Applies a transition on one edge of a clip: with the neighbouring clip on the same track when
 * there is one, otherwise as an intro (left) / outro (right) on the clip alone.
 * Shared by the timeline drop (Transitions tab → clip) and the clip context menu.
 */
export function applyClipTransition(
  clipId: string,
  transitionType: TransitionType,
  edge: "left" | "right",
  transitionParams?: Record<string, unknown>,
): void {
  const projectState = useProjectStore.getState();
  const owningTrack = projectState.project.timeline.tracks.find((t) =>
    t.clips.some((c) => c.id === clipId),
  );
  if (!owningTrack) return;
  const sortedClips = [...owningTrack.clips].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    return a.id.localeCompare(b.id);
  });
  const idx = sortedClips.findIndex((c) => c.id === clipId);
  const previousClip = idx > 0 ? sortedClips[idx - 1] : undefined;
  const nextClip = idx < sortedClips.length - 1 ? sortedClips[idx + 1] : undefined;
  const clipA = edge === "left" ? previousClip : sortedClips[idx];
  const clipB = edge === "left" ? sortedClips[idx] : nextClip;

  const bridge = getTransitionBridge();
  if (!bridge.isInitialized()) {
    toast.error("Moteur de transitions pas prêt", "Réessaie dans un instant.");
    return;
  }
  const params = { ...bridge.getDefaultParams(transitionType), ...transitionParams };
  const result =
    clipA && clipB
      ? bridge.createTransition(clipA, clipB, transitionType, 1.0, params)
      : bridge.createClipEdgeTransition(
          sortedClips[idx],
          edge === "left" ? "in" : "out",
          transitionType,
          1.0,
          params,
        );
  if (result.success && result.transitionId) {
    const transition = bridge.getTransition(result.transitionId);
    if (transition) {
      projectState.addClipTransition(transition);
      toast.success(
        transition.edge === "in"
          ? "Transition d’entrée appliquée"
          : transition.edge === "out"
            ? "Transition de sortie appliquée"
            : "Transition appliquée",
        `${transitionType} • ${transition.duration.toFixed(1)} s`,
      );
      return;
    }
  }
  toast.error("La transition a échoué", result.error || "Impossible de créer la transition");
}
