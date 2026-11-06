/**
 * Master-bus safety limiter for export (ZoneScene studio, 2026-11-05).
 *
 * The export summed tracks with no ceiling: a loud master + a phone take decoded to +1.7 dBFS
 * (+2.0 dBTP) in the MP4, which clips on playback and on the platform re-encode. This limiter
 * only acts above the ceiling, so a mix that already fits is untouched.
 *
 * Sample-peak, linked channels, 5 ms lookahead (sliding-window min of the required gain),
 * instant attack, exponential release. The gain never exceeds the gain the current sample
 * needs, so no output sample can pass the ceiling. State carries across `process()` calls
 * (the export renders audio in chunks); lookahead does not cross a chunk boundary, so a peak
 * right at the start of a chunk gets a hard gain step instead of a 5 ms ramp.
 * Ceiling -4 dBFS sample peak (= reelmaker's `alimiter limit=0.63` on dense masters): measured on
 * MASTER_DUAL_v4 + phone take, -2 dBFS → +0.1 dBTP after AAC 192k, -3 → +0.1, -4 → -1.2 dBTP,
 * -11.8 LUFS (still above IG's -14 normalisation, so no audible loss there).
 * ponytail: sample-peak, not 4× oversampled true-peak, so the ceiling carries the AAC overshoot
 * margin. Oversample the detector if a real export still lands above -1 dBTP.
 */
export class PeakLimiter {
  private gain = 1;
  private readonly ceiling: number;
  private readonly release: number;
  private readonly lookahead: number;

  constructor(sampleRate: number, ceilingDb = -4, releaseSeconds = 0.1, lookaheadSeconds = 0.005) {
    this.ceiling = 10 ** (ceilingDb / 20);
    this.release = 1 - Math.exp(-1 / (releaseSeconds * sampleRate));
    this.lookahead = Math.max(1, Math.round(lookaheadSeconds * sampleRate));
  }

  /** Limits the channels in place. All channels must have the same length. */
  process(channels: Float32Array[]): void {
    const length = channels[0]?.length ?? 0;
    if (length === 0) return;

    const required = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let peak = 0;
      for (const channel of channels) peak = Math.max(peak, Math.abs(channel[i]));
      required[i] = peak > this.ceiling ? this.ceiling / peak : 1;
    }

    // Monotonic deque of indices: required[] increasing from head to tail → head is the window min.
    const deque = new Int32Array(length);
    let head = 0;
    let tail = 0;
    let next = 0;
    let gain = this.gain;
    for (let i = 0; i < length; i++) {
      const end = Math.min(length - 1, i + this.lookahead);
      for (; next <= end; next++) {
        while (tail > head && required[deque[tail - 1]] >= required[next]) tail--;
        deque[tail++] = next;
      }
      while (deque[head] < i) head++;
      const target = required[deque[head]];
      gain = target < gain ? target : gain + (target - gain) * this.release;
      if (gain !== 1) for (const channel of channels) channel[i] *= gain;
    }
    this.gain = gain;
  }
}
