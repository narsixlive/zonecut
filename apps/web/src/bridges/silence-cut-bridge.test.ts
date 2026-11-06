import { describe, expect, it, vi } from "vitest";

type FakeClip = { id: string; trackId: string; startTime: number; duration: number };

// Minimal store: split and ripple-delete act on the clip's own track, like the real actions.
const tracks: { id: string; clips: FakeClip[] }[] = [];
let nextId = 0;
const store = {
  get project() {
    return { timeline: { tracks } };
  },
  actionHistory: { beginGroup: vi.fn(), endGroup: vi.fn() },
  getClip: (id: string) => tracks.flatMap((t) => t.clips).find((c) => c.id === id),
  splitClip: async (id: string, at: number) => {
    const track = tracks.find((t) => t.clips.some((c) => c.id === id))!;
    const clip = track.clips.find((c) => c.id === id)!;
    const right = { ...clip, id: `split-${nextId++}`, startTime: clip.startTime + at, duration: clip.duration - at };
    clip.duration = at;
    track.clips.push(right);
    track.clips.sort((a, b) => a.startTime - b.startTime);
    return { success: true };
  },
  rippleDeleteClip: async (id: string) => {
    const track = tracks.find((t) => t.clips.some((c) => c.id === id))!;
    const clip = track.clips.find((c) => c.id === id)!;
    track.clips = track.clips.filter((c) => c.id !== id);
    for (const c of track.clips) if (c.startTime > clip.startTime) c.startTime -= clip.duration;
    return { success: true };
  },
};

vi.mock("@openreel/core", () => ({ getAudioEngine: vi.fn() }));
vi.mock("../stores/project-store", () => ({ useProjectStore: { getState: () => store } }));

const { getSilenceCutBridge } = await import("./silence-cut-bridge");

describe("SilenceCutBridge.cutSilence", () => {
  it("cuts only the selected clip's track on a multitrack timeline", async () => {
    tracks.splice(0, tracks.length,
      { id: "video", clips: [{ id: "v", trackId: "video", startTime: 0, duration: 20 }] },
      { id: "voice", clips: [{ id: "a", trackId: "voice", startTime: 0, duration: 20 }] },
    );

    const result = await getSilenceCutBridge().cutSilence("a", [
      { start: 3, end: 4 },
      { start: 10, end: 12 },
    ] as never);

    expect(result.success).toBe(true);
    expect(tracks[0].clips).toEqual([{ id: "v", trackId: "video", startTime: 0, duration: 20 }]);
    const voice = tracks[1].clips;
    expect(voice.reduce((sum, c) => sum + c.duration, 0)).toBe(17);
    expect(voice.map((c) => [c.startTime, c.duration])).toEqual([[0, 3], [3, 6], [9, 8]]);
  });
});
