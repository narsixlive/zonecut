import { FFT } from "./fft";

export interface Beat {
  readonly time: number;
  readonly strength: number;
  readonly index: number;
}

export interface BeatAnalysisResult {
  readonly bpm: number;
  readonly confidence: number;
  readonly beats: Beat[];
  readonly duration: number;
  readonly downbeats: number[];
}

export interface BeatDetectionConfig {
  readonly minBpm: number;
  readonly maxBpm: number;
  /** Kept for API compatibility; the comb-filter tempo search does not use it. */
  readonly sensitivity: number;
  /** FFT size of the spectral-flux onset envelope. */
  readonly windowSize: number;
  /** Hop between analysis frames, in samples at ANALYSIS_RATE. */
  readonly hopSize: number;
}

export const DEFAULT_BEAT_DETECTION_CONFIG: BeatDetectionConfig = {
  minBpm: 60,
  maxBpm: 200,
  sensitivity: 0.5,
  windowSize: 1024,
  hopSize: 256,
};

/** Audio is mixed to mono and resampled to this rate before analysis. */
const ANALYSIS_RATE = 22050;
/** Spectral flux ignores bins above this frequency (cymbal hiss adds noise, not timing). */
const MAX_FLUX_HZ = 8000;
const MIN_BAND_HZ = 30;
const FLUX_BANDS = 40;
/** Coarse tempo candidates refined at 0.02 BPM before picking the best. */
const COARSE_SEEDS = 5;
/**
 * Double the tempo when the doubled grid keeps this share of the grid's mean onset strength,
 * i.e. the in-between points reach ~50 % of the beats (0.75 = (1 + 0.5) / 2).
 * Measured on 13 of the owner's masters: right doublings 0.76–0.98, but hip-hop with strong
 * 8ths also reaches 0.77–0.83 (Cercle Noir 86.2 → 172.4), so the ratio cannot separate them.
 * ponytail: octave errors stay possible; the UI needs a « ×2 / ÷2 » control next to the BPM.
 */
const DOUBLE_TEMPO_RATIO = 0.75;
/** Never double into this range: none of the owner's tracks sits above 180 (Alien 99 → 198). */
const MAX_DOUBLED_BPM = 180;

/**
 * Tempo + beat grid detection that holds on dense, mastered music.
 *
 * Onsets: half-wave-rectified log-spectral flux (an attack is energy appearing in some bands,
 * which a compressed master still shows even when its RMS is flat).
 * Tempo: comb filter over the onset envelope. Each (bpm, phase) grid is scored by
 * envelope-on-the-beat minus envelope-half-a-beat-later. The contrast term is what rejects
 * half and double tempo: at half tempo the « off » points land on real beats (snares), at
 * double tempo the « on » points include weak off-beats.
 * Same method as Content Creator's reelmaker (librosa onset_strength + comb filter),
 * extended with a coarse-to-fine search because the tempo range is unknown here.
 */
export class BeatDetectionEngine {
  private config: BeatDetectionConfig;
  private audioContext: AudioContext | OfflineAudioContext | null = null;

  constructor(config: Partial<BeatDetectionConfig> = {}) {
    this.config = { ...DEFAULT_BEAT_DETECTION_CONFIG, ...config };
  }

  async analyzeAudioBuffer(
    audioBuffer: AudioBuffer,
  ): Promise<BeatAnalysisResult> {
    const duration = audioBuffer.duration;
    const samples = mixToAnalysisRate(audioBuffer);
    const envelope = onsetEnvelope(
      samples,
      this.config.windowSize,
      this.config.hopSize,
    );
    const fps = ANALYSIS_RATE / this.config.hopSize;

    if (envelope.length < fps * 2) {
      return { bpm: 120, confidence: 0, beats: [], duration, downbeats: [] };
    }

    const { bpm, phaseFrames, confidence } = this.findTempo(envelope, fps);
    // Frame t covers samples [t·hop, t·hop + window); an attack shows up in the flux once it
    // reaches the middle of the Hann window, so frame times run half a window early.
    const latency = this.config.windowSize / 2 / ANALYSIS_RATE;
    const beats = buildBeats(envelope, fps, bpm, phaseFrames, duration, latency);
    const downbeats = pickDownbeats(beats);

    return { bpm, confidence, beats, duration, downbeats };
  }

  async analyzeFromBlob(blob: Blob): Promise<BeatAnalysisResult> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    return this.analyzeAudioBuffer(audioBuffer);
  }

  async analyzeFromUrl(url: string): Promise<BeatAnalysisResult> {
    const response = await fetch(url);
    const blob = await response.blob();
    return this.analyzeFromBlob(blob);
  }

  private findTempo(
    envelope: Float32Array,
    fps: number,
  ): { bpm: number; phaseFrames: number; confidence: number } {
    const { minBpm, maxBpm } = this.config;

    const grid = (bpm: number) => ({ bpm, ...combScore(envelope, (60 / bpm) * fps) });
    const refine = (bpm: number) => {
      let best = grid(bpm);
      for (let b = Math.max(minBpm, bpm - 0.5); b <= Math.min(maxBpm, bpm + 0.5); b += 0.02) {
        const r = grid(b);
        if (r.mean > best.mean) best = r;
      }
      return best;
    };

    // A 0.5 BPM coarse step can land beside a sharp peak, so refine the few best coarse
    // candidates instead of trusting the single best one.
    const coarse: { bpm: number; mean: number }[] = [];
    for (let bpm = minBpm; bpm <= maxBpm + 1e-9; bpm += 0.5) coarse.push(grid(bpm));
    coarse.sort((a, b) => b.mean - a.mean);
    const seeds: number[] = [];
    for (const c of coarse) {
      if (seeds.every((s) => Math.abs(s - c.bpm) > 2)) seeds.push(c.bpm);
      if (seeds.length === COARSE_SEEDS) break;
    }

    // On-beat mean favours slow grids that land only on the strongest beats, so this finds an
    // integer multiple of the beat period…
    let best = seeds.map(refine).reduce((a, b) => (b.mean > a.mean ? b : a));

    // …then double while the in-between points are about as loud as the grid points: those are
    // real beats (snares, four-on-the-floor kicks), not off-beat hats.
    while (best.bpm * 2 <= Math.min(maxBpm, MAX_DOUBLED_BPM)) {
      const doubled = refine(best.bpm * 2);
      if (doubled.mean < DOUBLE_TEMPO_RATIO * best.mean) break;
      best = doubled;
    }

    const overall = mean(envelope);
    const confidence =
      best.mean > 0 ? Math.min(1, Math.max(0, (best.mean - overall) / best.mean)) : 0;
    return {
      bpm: Math.round(best.bpm * 100) / 100,
      phaseFrames: best.phaseFrames,
      confidence,
    };
  }

  generateBeatMarkersAtInterval(
    bpm: number,
    duration: number,
    startTime: number = 0,
    beatsPerBar: number = 4,
  ): Beat[] {
    const beatInterval = 60 / bpm;
    const beats: Beat[] = [];
    let beatIndex = 0;

    for (let time = startTime; time < duration; time += beatInterval) {
      const isDownbeat = beatIndex % beatsPerBar === 0;
      beats.push({
        time,
        strength: isDownbeat ? 1 : 0.7,
        index: beatIndex,
      });
      beatIndex++;
    }

    return beats;
  }

  snapTimeToNearestBeat(
    time: number,
    beats: Beat[],
    snapThreshold: number = 0.1,
  ): number {
    if (beats.length === 0) return time;

    let nearest = beats[0];
    let minDist = Math.abs(beats[0].time - time);

    for (const beat of beats) {
      const dist = Math.abs(beat.time - time);
      if (dist < minDist) {
        minDist = dist;
        nearest = beat;
      }
    }

    return minDist <= snapThreshold ? nearest.time : time;
  }

  getBeatsInRange(beats: Beat[], startTime: number, endTime: number): Beat[] {
    return beats.filter((b) => b.time >= startTime && b.time <= endTime);
  }

  dispose(): void {
    if (this.audioContext && this.audioContext instanceof AudioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

/** Mono mix of every channel, linearly resampled to ANALYSIS_RATE. */
function mixToAnalysisRate(buffer: AudioBuffer): Float32Array {
  const channels = Math.max(1, buffer.numberOfChannels || 1);
  const source = buffer.getChannelData(0);
  const mono = new Float32Array(source.length);
  for (let c = 0; c < channels; c++) {
    const data = c === 0 ? source : buffer.getChannelData(c);
    for (let i = 0; i < mono.length; i++) mono[i] += data[i] / channels;
  }

  const ratio = buffer.sampleRate / ANALYSIS_RATE;
  if (Math.abs(ratio - 1) < 1e-6) return mono;

  // ponytail: linear resampling without a low-pass; aliasing only blurs high bands, which the
  // flux caps at MAX_FLUX_HZ anyway. Use OfflineAudioContext resampling if accuracy ever suffers.
  const out = new Float32Array(Math.floor(mono.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio;
    const j = Math.floor(x);
    const f = x - j;
    out[i] = mono[j] * (1 - f) + (mono[j + 1] ?? mono[j]) * f;
  }
  return out;
}

/**
 * Half-wave-rectified log spectral flux over log-spaced bands, one value per hop, normalised
 * to max 1. Bands (≈ mel scale) give a kick, which lives in a few low bins, as much weight as a
 * clap or hat spread over hundreds of high bins.
 */
function onsetEnvelope(
  samples: Float32Array,
  windowSize: number,
  hopSize: number,
): Float32Array {
  const frames = Math.max(0, Math.floor((samples.length - windowSize) / hopSize) + 1);
  const envelope = new Float32Array(frames);
  if (frames === 0) return envelope;

  const fft = new FFT(windowSize);
  const bandOfBin = logBands(windowSize);
  const bands = Math.max(...bandOfBin) + 1;
  const binsPerBand = new Float32Array(bands);
  for (const b of bandOfBin) if (b >= 0) binsPerBand[b]++;

  const window = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / windowSize);
  }

  const frame = new Float32Array(windowSize);
  let previous = new Float32Array(bands);
  let current = new Float32Array(bands);

  for (let t = 0; t < frames; t++) {
    const start = t * hopSize;
    for (let i = 0; i < windowSize; i++) frame[i] = samples[start + i] * window[i];
    const { real, imag } = fft.forward(frame);

    current.fill(0);
    for (let k = 0; k < bandOfBin.length; k++) {
      const b = bandOfBin[k];
      if (b >= 0) current[b] += Math.hypot(real[k], imag[k]);
    }
    let flux = 0;
    for (let b = 0; b < bands; b++) {
      current[b] = Math.log1p(1000 * (current[b] / binsPerBand[b]));
      if (t > 0) flux += Math.max(0, current[b] - previous[b]);
    }
    envelope[t] = flux;
    [previous, current] = [current, previous];
  }

  let max = 0;
  for (const v of envelope) max = Math.max(max, v);
  if (max > 0) for (let i = 0; i < frames; i++) envelope[i] /= max;
  return envelope;
}

/** FFT bin → log-spaced band index (MIN_BAND_HZ..MAX_FLUX_HZ), -1 outside. */
function logBands(windowSize: number): Int16Array {
  const bins = windowSize / 2;
  const map = new Int16Array(bins).fill(-1);
  const lo = Math.log(MIN_BAND_HZ);
  const span = Math.log(MAX_FLUX_HZ) - lo;
  let last = -1;
  let next = 0;
  for (let k = 1; k < bins; k++) {
    const hz = (k * ANALYSIS_RATE) / windowSize;
    if (hz < MIN_BAND_HZ || hz > MAX_FLUX_HZ) continue;
    const ideal = Math.floor(((Math.log(hz) - lo) / span) * FLUX_BANDS);
    // Low bands narrower than one bin collapse: each such bin gets its own band, numbered densely.
    if (ideal !== last) {
      last = ideal;
      map[k] = next++;
    } else {
      map[k] = next - 1;
    }
  }
  return map;
}

function mean(values: Float32Array): number {
  let sum = 0;
  for (const v of values) sum += v;
  return values.length > 0 ? sum / values.length : 0;
}

/** Best phase of a beat grid with the given period, scored by the mean envelope on the grid. */
function combScore(
  envelope: Float32Array,
  periodFrames: number,
): { phaseFrames: number; mean: number } {
  let best = { phaseFrames: 0, mean: -Infinity };
  const n = envelope.length;

  for (let phase = 0; phase < periodFrames; phase++) {
    let sum = 0;
    let count = 0;
    for (let x = phase; x < n - 0.5; x += periodFrames) {
      sum += envelope[Math.round(x)];
      count++;
    }
    if (count > 0 && sum / count > best.mean) best = { phaseFrames: phase, mean: sum / count };
  }
  return best;
}

function buildBeats(
  envelope: Float32Array,
  fps: number,
  bpm: number,
  phaseFrames: number,
  duration: number,
  latency: number,
): Beat[] {
  const period = 60 / bpm;
  const firstFrameTime = phaseFrames / fps;
  const raw: number[] = [];
  for (let time = firstFrameTime; time + latency < duration; time += period) {
    const f = Math.round(time * fps);
    let peak = 0;
    for (let d = -2; d <= 2; d++) peak = Math.max(peak, envelope[f + d] ?? 0);
    raw.push(peak);
  }
  const firstTime = firstFrameTime + latency;

  // Strength relative to the loud beats (95th percentile), so a quiet intro reads as weak.
  const sorted = [...raw].sort((a, b) => a - b);
  const reference = sorted[Math.floor(sorted.length * 0.95)] || 1;

  return raw.map((peak, index) => ({
    time: firstTime + index * period,
    strength: Math.min(1, peak / reference),
    index,
  }));
}

/** Bar starts: the one of four beat phases whose beats carry the most onset energy. */
function pickDownbeats(beats: Beat[]): number[] {
  if (beats.length === 0) return [];
  let bestPhase = 0;
  let bestMean = -1;
  for (let p = 0; p < 4; p++) {
    let sum = 0;
    let count = 0;
    for (let i = p; i < beats.length; i += 4) {
      sum += beats[i].strength;
      count++;
    }
    if (count > 0 && sum / count > bestMean) {
      bestMean = sum / count;
      bestPhase = p;
    }
  }
  const downbeats: number[] = [];
  for (let i = bestPhase; i < beats.length; i += 4) downbeats.push(beats[i].time);
  return downbeats;
}

let beatDetectionEngineInstance: BeatDetectionEngine | null = null;

export function getBeatDetectionEngine(): BeatDetectionEngine {
  if (!beatDetectionEngineInstance) {
    beatDetectionEngineInstance = new BeatDetectionEngine();
  }
  return beatDetectionEngineInstance;
}

export function disposeBeatDetectionEngine(): void {
  if (beatDetectionEngineInstance) {
    beatDetectionEngineInstance.dispose();
    beatDetectionEngineInstance = null;
  }
}
