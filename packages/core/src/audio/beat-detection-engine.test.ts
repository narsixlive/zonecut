import { describe, expect, it } from "vitest";
import { BeatDetectionEngine } from "./beat-detection-engine";

const RATE = 44100;

/** Deterministic noise so the test never flakes. */
function noise(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 31 - 1;
  };
}

type Hit = "kick" | "snare" | "hat";

/**
 * A drum loop: `pattern` lists the hits on each 16th note of a 4/4 bar. A constant pad sits
 * under it and everything is hard-clipped, like a loud master, so RMS stays nearly flat.
 */
function drumLoop(bpm: number, seconds: number, pattern: Hit[][], startOffset = 0): AudioBuffer {
  const data = new Float32Array(Math.floor(seconds * RATE));
  const rnd = noise(7);
  const sixteenth = 60 / bpm / 4;

  for (let i = 0; i < data.length; i++) {
    const t = i / RATE;
    data[i] = 0.35 * Math.sin(2 * Math.PI * 220 * t) + 0.25 * Math.sin(2 * Math.PI * 330 * t);
  }

  for (let step = 0; ; step++) {
    const start = startOffset + step * sixteenth;
    if (start >= seconds) break;
    for (const hit of pattern[step % pattern.length]) {
      const length = hit === "kick" ? 0.25 : hit === "snare" ? 0.18 : 0.05;
      const s0 = Math.floor(start * RATE);
      for (let j = 0; j < length * RATE && s0 + j < data.length; j++) {
        const t = j / RATE;
        const env = Math.exp(-t * (hit === "kick" ? 18 : hit === "snare" ? 25 : 90));
        const v =
          hit === "kick"
            ? Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-t * 40)) * t)
            : hit === "snare"
              ? 0.7 * rnd() + 0.3 * Math.sin(2 * Math.PI * 190 * t)
              : 0.12 * rnd();
        data[s0 + j] += v * env;
      }
    }
  }

  for (let i = 0; i < data.length; i++) data[i] = Math.max(-0.9, Math.min(0.9, data[i] * 1.6));

  return {
    sampleRate: RATE,
    duration: data.length / RATE,
    numberOfChannels: 1,
    length: data.length,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

const K: Hit[] = ["kick"];
const H: Hit[] = ["hat"];
const KH: Hit[] = ["kick", "hat"];
const SH: Hit[] = ["snare", "hat"];
const _: Hit[] = [];

// Drum & bass two-step: kick on 1 and the « and » of 3, snare on 2 and 4, 8th-note hats.
const DNB = [KH, _, H, _, SH, _, H, _, H, _, KH, _, SH, _, H, _];
// House: kick on every beat, open hat on the off-beats, clap on 2 and 4.
const KS: Hit[] = ["kick", "snare"];
const HOUSE = [K, _, H, _, KS, _, H, _, K, _, H, _, KS, _, H, _];
// Hip-hop: kick on 1 and 3, snare on 2 and 4, 8th-note hats.
const HIPHOP = [KH, _, H, _, SH, _, H, _, KH, _, H, _, SH, _, H, _];

describe("BeatDetectionEngine", () => {
  // Accepted answers per loop. Hip-hop with even 8th-note hats is genuinely ambiguous between
  // 90 and 180 (both grids sit on every hit); the UI's « Manual BPM » covers it. A 3/4 or 2/3
  // answer would put the grid off the beat, so those are never accepted.
  const cases: [string, number, Hit[][], number[]][] = [
    ["drum & bass", 172, DNB, [172]],
    ["house", 128, HOUSE, [128]],
    ["hip-hop", 90, HIPHOP, [90, 180]],
    ["trap-ish", 140, HIPHOP, [140]],
  ];

  for (const [name, bpm, pattern, accepted] of cases) {
    it(`finds ${bpm} BPM on a clipped ${name} loop`, async () => {
      const result = await new BeatDetectionEngine().analyzeAudioBuffer(drumLoop(bpm, 30, pattern));
      const error = Math.min(...accepted.map((a) => Math.abs(result.bpm - a)));
      expect(error).toBeLessThan(0.3);
      expect(result.confidence).toBeGreaterThan(0.2);
    });
  }

  it("locks the grid phase onto the kicks", async () => {
    const offset = 0.137;
    const result = await new BeatDetectionEngine().analyzeAudioBuffer(drumLoop(128, 20, HOUSE, offset));
    const period = 60 / result.bpm;
    const drift = (((result.beats[0].time - offset) % period) + period) % period;
    expect(Math.min(drift, period - drift)).toBeLessThan(0.02);
    expect(result.downbeats.length).toBeGreaterThan(5);
  });

  it("returns an empty grid on silence instead of inventing beats", async () => {
    const data = new Float32Array(RATE);
    const buffer = { sampleRate: RATE, duration: 1, numberOfChannels: 1, length: RATE, getChannelData: () => data } as unknown as AudioBuffer;
    const result = await new BeatDetectionEngine().analyzeAudioBuffer(buffer);
    expect(result.beats).toEqual([]);
    expect(result.confidence).toBe(0);
  });
});
