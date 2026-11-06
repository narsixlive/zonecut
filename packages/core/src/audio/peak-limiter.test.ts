import { describe, expect, it } from "vitest";
import { PeakLimiter } from "./peak-limiter";

const SR = 48000;
const ceiling = 10 ** (-4 / 20);
const peakOf = (channels: Float32Array[]) =>
  Math.max(...channels.map((c) => c.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));

function sine(amplitude: number, seconds: number, freq = 440): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / SR);
  return out;
}

describe("PeakLimiter", () => {
  it("leaves a mix under the ceiling untouched", () => {
    const left = sine(0.5, 0.5);
    const copy = left.slice();
    new PeakLimiter(SR).process([left]);
    expect(left).toEqual(copy);
  });

  it("keeps every sample under the ceiling, across chunks, on both channels", () => {
    const limiter = new PeakLimiter(SR);
    for (let chunk = 0; chunk < 3; chunk++) {
      const left = sine(1.6, 0.3);
      const right = sine(0.4, 0.3, 97);
      right[100] = -1.9; // isolated spike on one channel only
      limiter.process([left, right]);
      expect(peakOf([left, right])).toBeLessThanOrEqual(ceiling + 1e-6);
    }
  });

  it("ducks before a transient (lookahead) and recovers after it (release)", () => {
    const signal = sine(0.3, 1);
    const hit = SR / 2;
    for (let i = hit; i < hit + 480; i++) signal[i] = 1.5 * Math.sign(signal[i] || 1);
    const before = signal[hit - 100];
    new PeakLimiter(SR).process([signal]);
    expect(Math.abs(signal[hit - 100])).toBeLessThan(Math.abs(before)); // gain dropped ahead of the hit
    const tailRatio = Math.abs(signal[SR - 10]) / Math.abs(sine(0.3, 1)[SR - 10]);
    expect(tailRatio).toBeGreaterThan(0.95); // back to unity ~0.5 s later
  });
});
