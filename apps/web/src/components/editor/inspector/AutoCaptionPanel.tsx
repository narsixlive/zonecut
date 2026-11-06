import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SUBTITLE_STYLE_PRESETS,
  splitCaptionIntoSingleLineCues,
  type TranscriptionSegment,
} from "@openreel/core";
import {
  ToolcraftButton as Button,
  ToolcraftCard as Card,
  ToolcraftSelectControl as Selector,
  ToolcraftText as Text,
} from "@openreel/ui";
import {
  AlertCircle,
  Check,
  Download,
  Languages,
  Loader2,
  Sparkles,
} from "@/icons/lucide-compat";
import { useProjectStore } from "../../../stores/project-store";
import { useUIStore } from "../../../stores/ui-store";
import { loadAudioBuffer } from "../../../utils/load-audio-buffer";
import { audioBufferToWhisperSamples } from "../../../utils/whisper-audio";
import {
  DEFAULT_WHISPER_MODEL,
  WHISPER_MODELS,
  WHISPER_MODELS_BASE_URL,
  type WhisperModelKey,
} from "../../../workers/whisper-models";

const CAPTION_STYLE_PRESETS = ["default", "modern", "bold", "cinematic", "minimal"] as const;
const CAPTION_STYLE_LABELS: Record<(typeof CAPTION_STYLE_PRESETS)[number], string> = {
  default: "Classique",
  modern: "Moderne",
  bold: "Gras",
  cinematic: "Cinéma",
  minimal: "Minimal",
};
const WHISPER_LANGUAGES = [
  { code: "en", name: "Anglais" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Allemand" },
  { code: "es", name: "Espagnol" },
  { code: "it", name: "Italien" },
  { code: "pt", name: "Portugais" },
  { code: "hi", name: "Hindi" },
  { code: "ja", name: "Japonais" },
  { code: "ko", name: "Coréen" },
  { code: "zh", name: "Chinois" },
  { code: "ru", name: "Russe" },
  { code: "tr", name: "Turc" },
  { code: "pl", name: "Polonais" },
  { code: "vi", name: "Vietnamien" },
] as const;

interface AutoCaptionPanelProps {
  clipId?: string;
  maxWordsPerLine?: number;
}

interface WorkerChunk {
  text: string;
  timestamp: [number | null, number | null];
}

type WorkerState = "idle" | "loading" | "ready";

export const AutoCaptionPanel: React.FC<AutoCaptionPanelProps> = ({
  clipId,
  maxWordsPerLine = 5,
}) => {
  const getClip = useProjectStore((state) => state.getClip);
  const getMediaItem = useProjectStore((state) => state.getMediaItem);
  const addSubtitle = useProjectStore((state) => state.addSubtitle);
  const workerRef = useRef<Worker | null>(null);
  const [workerState, setWorkerState] = useState<WorkerState>("idle");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("fr");
  const [selectedStyle, setSelectedStyle] = useState<string>("default");
  const [selectedModel] = useState<WhisperModelKey>(
    DEFAULT_WHISPER_MODEL,
  );
  const [modelBackends, setModelBackends] = useState<
    Partial<Record<WhisperModelKey, "webgpu" | "wasm">>
  >({});
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedItems = useUIStore((state) => state.selectedItems);
  const resolvedClipId =
    clipId ?? selectedItems.find((item) => item.type === "clip")?.id ?? "";
  const clip = getClip(resolvedClipId);
  const mediaItem = clip ? getMediaItem(clip.mediaId) : undefined;
  const canTranscribe = Boolean(
    clip && mediaItem && (mediaItem.type === "video" || mediaItem.type === "audio"),
  );

  useEffect(() => {
    const worker = new Worker(
      new URL("../../../workers/whisper-worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const runWorker = useCallback(
    (
      type: "load" | "transcribe",
      audio?: Float32Array,
    ): Promise<{ text?: string; chunks?: WorkerChunk[] }> => {
      const worker = workerRef.current;
      if (!worker) return Promise.reject(new Error("Le module sous-titres n’est pas prêt."));
      const requestId = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const handleMessage = (event: MessageEvent<Record<string, unknown>>) => {
          if (event.data.requestId !== requestId) return;
          const messageType = event.data.type;
          if (messageType === "model-progress") {
            setWorkerState("loading");
            const rawProgress = Number(event.data.progress ?? 0);
            const ratio = rawProgress > 1 ? rawProgress / 100 : rawProgress;
            setProgress(ratio);
            setProgressMessage(`Téléchargement du module… ${Math.round(ratio * 100)} %`);
          } else if (messageType === "transcription-progress") {
            setWorkerState("ready");
            setProgress(Number(event.data.progress ?? 0));
            setProgressMessage("Transcription du clip sur votre ordinateur…");
          } else if (messageType === "ready") {
            worker.removeEventListener("message", handleMessage);
            setWorkerState("ready");
            const backend = event.data.backend;
            if (backend === "webgpu" || backend === "wasm") {
              setModelBackends((current) => ({
                ...current,
                [selectedModel]: backend,
              }));
            }
            setProgress(1);
            setProgressMessage("Module sous-titres prêt");
            resolve({});
          } else if (messageType === "result") {
            worker.removeEventListener("message", handleMessage);
            setWorkerState("ready");
            const backend = event.data.backend;
            if (backend === "webgpu" || backend === "wasm") {
              setModelBackends((current) => ({
                ...current,
                [selectedModel]: backend,
              }));
            }
            setProgress(1);
            resolve({
              text: String(event.data.text ?? ""),
              chunks: (event.data.chunks ?? []) as WorkerChunk[],
            });
          } else if (messageType === "error") {
            worker.removeEventListener("message", handleMessage);
            reject(new Error(String(event.data.message ?? "La transcription a échoué.")));
          }
        };
        worker.addEventListener("message", handleMessage);
        if (audio) {
          worker.postMessage(
            {
              requestId,
              type,
              audio,
              language: selectedLanguage,
              model: selectedModel,
            },
            [audio.buffer],
          );
        } else {
          worker.postMessage({
            requestId,
            type,
            language: selectedLanguage,
            model: selectedModel,
          });
        }
      });
    },
    [selectedLanguage, selectedModel],
  );

  const handlePrepareModel = useCallback(async () => {
    setError(null);
    setWorkerState("loading");
    setProgress(0);
    setProgressMessage("Préparation du module sous-titres…");
    try {
      await runWorker("load");
    } catch (reason) {
      setWorkerState("idle");
      setError(reason instanceof Error ? reason.message : "Le téléchargement du module a échoué.");
    }
  }, [runWorker]);

  // Already downloaded in an earlier session (transformers.js Cache API) → load it from the
  // cache without asking again; the explicit button stays the consent step for the first download.
  useEffect(() => {
    if (workerState !== "idle" || typeof caches === "undefined") return;
    // Full URL, not just the model id: a copy cached from another host would mean a new 300 MB download.
    const weights = new URL(`${WHISPER_MODELS[selectedModel].id}/onnx/`, new URL(WHISPER_MODELS_BASE_URL, location.href)).href;
    caches
      .open("transformers-cache")
      .then((cache) => cache.keys())
      .then((requests) => {
        if (requests.some((request) => request.url.startsWith(weights))) void handlePrepareModel();
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per model, not on every state change
  }, [selectedModel]);

  const handleTranscribe = useCallback(async () => {
    if (!clip || !mediaItem) return;
    setError(null);
    setSegments([]);
    setIsTranscribing(true);
    setProgress(0);
    setProgressMessage("Extraction du son du clip…");

    let audioContext: AudioContext | null = null;
    try {
      const sourceBlob =
        mediaItem.blob ??
        (mediaItem.fileHandle ? await mediaItem.fileHandle.getFile() : null);
      if (!sourceBlob) {
        throw new Error("Reconnectez le média source avant de créer les sous-titres.");
      }
      audioContext = new AudioContext();
      const audioBuffer = await loadAudioBuffer(audioContext, sourceBlob, {
        audioTrackIndex: clip.audioTrackIndex,
        onProgress: (next) => {
          setProgress(next.progress * 0.18);
          setProgressMessage(next.message);
        },
      });
      if (!audioBuffer) throw new Error("Impossible de lire le son de ce clip.");

      const sourceStart = Math.max(0, clip.inPoint ?? 0);
      const sourceEnd = Math.min(
        audioBuffer.duration,
        clip.outPoint > sourceStart
          ? clip.outPoint
          : sourceStart + clip.duration * Math.max(clip.speed ?? 1, 0.01),
      );
      const samples = audioBufferToWhisperSamples(audioBuffer, sourceStart, sourceEnd);
      setProgress(0.2);
      setProgressMessage(
        "Transcription en cours…",
      );
      const result = await runWorker("transcribe", samples);
      const sourceDuration = Math.max(0.1, sourceEnd - sourceStart);
      const playbackSpeed = Math.max(clip.speed ?? 1, 0.01);
      const clipEndTime = clip.startTime + clip.duration;
      const nextSegments: TranscriptionSegment[] = (result.chunks ?? [])
        .map((chunk) => {
          const start = Math.max(0, chunk.timestamp?.[0] ?? 0);
          const end = Math.min(
            sourceDuration,
            chunk.timestamp?.[1] ?? Math.min(sourceDuration, start + 3),
          );
          return {
            text: chunk.text.trim(),
            startTime: Math.min(clipEndTime, clip.startTime + start / playbackSpeed),
            endTime: Math.min(
              clipEndTime,
              clip.startTime + Math.max(start + 0.1, end) / playbackSpeed,
            ),
            confidence: 1,
          };
        })
        .filter(
          (segment) =>
            segment.text.length > 0 && segment.endTime > segment.startTime,
        );
      if (nextSegments.length === 0 && result.text?.trim()) {
        nextSegments.push({
          text: result.text.trim(),
          startTime: clip.startTime,
          endTime: clipEndTime,
          confidence: 1,
        });
      }
      if (nextSegments.length === 0) {
        throw new Error("Aucune parole détectée dans ce clip.");
      }
      setSegments(nextSegments);
      setProgressMessage("Sous-titres prêts à ajouter");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La transcription a échoué.");
    } finally {
      await audioContext?.close().catch(() => undefined);
      setIsTranscribing(false);
    }
  }, [clip, mediaItem, runWorker, selectedModel, workerState]);

  const handleAddToTimeline = useCallback(async () => {
    if (!clip || segments.length === 0) return;
    const style = SUBTITLE_STYLE_PRESETS[selectedStyle] ?? SUBTITLE_STYLE_PRESETS.default;
    let addedCount = 0;
    for (const segment of segments) {
      const cues = splitCaptionIntoSingleLineCues(
        segment.text,
        segment.startTime,
        segment.endTime,
        maxWordsPerLine,
      );
      for (const cue of cues) {
        await addSubtitle(
          {
            id: `whisper-${crypto.randomUUID()}`,
            text: cue.text,
            startTime: cue.startTime,
            endTime: cue.endTime,
            style,
          },
          {
            captionSource: "whisper",
            captionSourceClipId: clip.id,
            captionMaxWordsPerLine: maxWordsPerLine,
            captionWhisperModel: selectedModel,
          },
        );
        addedCount += 1;
      }
    }
    setSegments([]);
    setProgressMessage(`${addedCount} sous-titres ajoutés`);
  }, [addSubtitle, clip, maxWordsPerLine, segments, selectedModel, selectedStyle]);

  const modelStatus = useMemo(() => {
    const model = WHISPER_MODELS[selectedModel];
    if (workerState === "ready") {
      const backend = modelBackends[selectedModel];
      return backend ? "Prêt · sur votre ordinateur" : "Prêt";
    }
    if (workerState === "loading") return progressMessage || "Téléchargement du module…";
    return `${model.downloadSize} · ${model.description}`;
  }, [modelBackends, progressMessage, selectedModel, workerState]);

  return (
    <div className="w-full min-w-0 space-y-3">
      <Card variant="muted" padding={3} className="space-y-2 border border-primary/30 bg-primary/5">
        <div className="flex items-start gap-2">
          {workerState === "ready" ? (
            <Check size={15} className="mt-0.5 text-primary" aria-hidden />
          ) : (
            <Download size={15} className="mt-0.5 text-primary" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <Text type="supporting" weight="bold" className="block text-[11px] text-fg">
              {WHISPER_MODELS[selectedModel].shortLabel}
            </Text>
            <Text type="supporting" color="secondary" className="block text-[9px]">
              {modelStatus}
            </Text>
          </div>
        </div>
        {workerState === "loading" && (
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-2">
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${Math.max(3, Math.min(100, progress * 100))}%` }}
            />
          </div>
        )}
        {workerState === "idle" && (
          <Button
            label={`Télécharger le module sous-titres (${WHISPER_MODELS[selectedModel].downloadSize})`}
            icon={<Download size={13} aria-hidden />}
            variant="secondary"
            size="sm"
            onClick={handlePrepareModel}
            className="w-full justify-center"
          />
        )}
        <Text type="supporting" color="secondary" className="block text-[9px] leading-relaxed">
          Téléchargé une seule fois, puis gardé dans ce navigateur. Vos vidéos et votre son ne quittent jamais votre ordinateur.
        </Text>
      </Card>

      <Card variant="muted" padding={3} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Languages size={14} className="text-fg-2" aria-hidden />
            <Text type="supporting" color="secondary" className="text-[10px]">Langue</Text>
          </div>
          <Selector
            label="Langue des sous-titres"
            isLabelHidden
            size="sm"
            width={132}
            value={selectedLanguage}
            onChange={setSelectedLanguage}
            isDisabled={isTranscribing}
            options={WHISPER_LANGUAGES.map((language) => ({
              label: language.name,
              value: language.code,
            }))}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Text type="supporting" color="secondary" className="text-[10px]">Style</Text>
          <Selector
            label="Style des sous-titres"
            isLabelHidden
            size="sm"
            width={132}
            value={selectedStyle}
            onChange={setSelectedStyle}
            isDisabled={isTranscribing}
            options={CAPTION_STYLE_PRESETS.map((preset) => ({
              label: CAPTION_STYLE_LABELS[preset],
              value: preset,
            }))}
          />
        </div>
      </Card>

      {error && (
        <Card variant="muted" padding={2} className="flex items-start gap-2 border border-red-500/30 bg-red-500/10">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" aria-hidden />
          <Text type="supporting" className="text-[10px] text-red-400">{error}</Text>
        </Card>
      )}

      {isTranscribing && (
        <Card variant="muted" padding={3} className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-primary" aria-hidden />
          <Text type="supporting" color="secondary" className="text-[10px]">
            {progressMessage}
          </Text>
        </Card>
      )}

      {segments.length > 0 && (
        <div className="space-y-2">
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {segments.map((segment, index) => (
              <Card key={`${segment.startTime}-${index}`} variant="muted" padding={2} className="text-[10px]">
                <span className="font-mono text-fg-muted">{segment.startTime.toFixed(1)}s</span>
                <span className="ml-2 text-fg">{segment.text}</span>
              </Card>
            ))}
          </div>
          <Button
            label={`Ajouter ${segments.length} sous-titres modifiables`}
            variant="primary"
            size="sm"
            onClick={handleAddToTimeline}
            className="w-full justify-center"
          />
        </div>
      )}

      <Button
        label={isTranscribing ? "Transcription…" : "Créer les sous-titres du clip"}
        icon={
          isTranscribing ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <Sparkles size={14} aria-hidden />
          )
        }
        variant="primary"
        size="md"
        onClick={handleTranscribe}
        isDisabled={!canTranscribe || isTranscribing || workerState !== "ready"}
        className="w-full justify-center"
      />
      {!canTranscribe && (
        <Text type="supporting" color="secondary" className="block text-center text-[9px]">
          Sélectionnez d'abord un clip vidéo ou audio.
        </Text>
      )}
    </div>
  );
};

export default AutoCaptionPanel;
