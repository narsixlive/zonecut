import React, { useState, useCallback, useEffect } from "react";
import { ToolcraftButton as Button } from "@openreel/ui";
import { ToolcraftCard as Card } from "@openreel/ui";
import { ToolcraftClickableCard as ClickableCard } from "@openreel/ui";
import { ToolcraftText as Text } from "@openreel/ui";
import { PropertySlider } from "./shell/PropertySlider";
import { MockToggle } from "./shell/InspectorControls";
import {
  Smartphone,
  Monitor,
  Square,
  Loader2,
  Play,
  CheckCircle,
} from "@/icons/lucide-compat";
import {
  getAutoReframeEngine,
  initializeAutoReframeEngine,
  type ReframeSettings,
  type AspectRatioPreset,
  type PlatformPreset,
  type ReframeResult,
  ASPECT_RATIO_PRESETS,
  PLATFORM_PRESETS,
  DEFAULT_REFRAME_SETTINGS,
} from "@openreel/core";
import { toast } from "../../../stores/notification-store";
import { useProjectStore } from "../../../stores/project-store";

interface AutoReframeSectionProps {
  clipId: string;
  onReframeComplete?: (result: ReframeResult) => void;
}

const PLATFORM_ICONS: Record<PlatformPreset, React.ElementType> = {
  youtube: Monitor,
  tiktok: Smartphone,
  "instagram-reels": Smartphone,
  "instagram-feed": Square,
  "instagram-stories": Smartphone,
  "youtube-shorts": Smartphone,
  facebook: Monitor,
  twitter: Monitor,
  linkedin: Monitor,
};

export const AutoReframeSection: React.FC<AutoReframeSectionProps> = ({
  clipId,
  onReframeComplete,
}) => {
  const updateProjectDimensions = useProjectStore(
    (state) => state.updateSettings,
  );
  const [reframeSettings, setReframeSettings] = useState<ReframeSettings>(
    DEFAULT_REFRAME_SETTINGS,
  );
  const [isInitializing, setIsInitializing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [selectedPlatform, setSelectedPlatform] =
    useState<PlatformPreset | null>("tiktok");

  useEffect(() => {
    const engine = getAutoReframeEngine();
    if (engine) {
      setIsInitialized(engine.isInitialized());
    }
  }, [clipId]);

  const handleInitialize = useCallback(async () => {
    setIsInitializing(true);
    try {
      const engine = initializeAutoReframeEngine();
      await engine.initialize((prog, msg) => {
        setProgress(prog);
        setProgressMessage(msg);
      });
      setIsInitialized(true);
    } catch (error) {
      console.error("Échec de l’initialisation du recadrage auto :", error);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const updateLocalSettings = useCallback(
    (updates: Partial<ReframeSettings>) => {
      setReframeSettings((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  const handleSelectPlatform = useCallback(
    (platform: PlatformPreset) => {
      setSelectedPlatform(platform);
      const config = PLATFORM_PRESETS[platform];
      const aspectRatio = Object.entries(ASPECT_RATIO_PRESETS).find(
        ([, v]) => Math.abs(v.ratio - config.ratio) < 0.01,
      );
      if (aspectRatio) {
        updateLocalSettings({
          targetAspectRatio: aspectRatio[0] as AspectRatioPreset,
        });
      }
    },
    [updateLocalSettings],
  );

  const handleSelectAspectRatio = useCallback(
    (ratio: AspectRatioPreset) => {
      setSelectedPlatform(null);
      updateLocalSettings({ targetAspectRatio: ratio });
    },
    [updateLocalSettings],
  );

  const handleAnalyze = useCallback(async () => {
    setIsProcessing(true);
    setProgress(0);
    setProgressMessage("Initialisation...");

    try {
      if (!isInitialized) {
        setProgressMessage("Chargement du moteur IA...");
        setProgress(10);
        await handleInitialize();
      }

      const engine = getAutoReframeEngine();
      if (!engine) {
        throw new Error("Moteur indisponible");
      }

      setProgressMessage("Configuration du recadrage...");
      setProgress(30);

      await new Promise((resolve) => setTimeout(resolve, 300));

      setProgressMessage("Application du recadrage intelligent...");
      setProgress(60);

      const targetConfig =
        ASPECT_RATIO_PRESETS[reframeSettings.targetAspectRatio];

      await new Promise((resolve) => setTimeout(resolve, 300));

      setProgressMessage("Mise à jour des réglages du projet...");
      setProgress(80);

      await updateProjectDimensions({
        width: targetConfig.width,
        height: targetConfig.height,
      });

      setProgressMessage("Finalisation...");
      setProgress(90);

      await new Promise((resolve) => setTimeout(resolve, 200));

      setProgress(100);
      setProgressMessage("Terminé !");
      setIsApplied(true);

      const result: ReframeResult = {
        keyframes: [],
        outputWidth: targetConfig.width,
        outputHeight: targetConfig.height,
        success: true,
        message: `Configured for ${targetConfig.name} (${targetConfig.width}x${targetConfig.height})`,
      };

      onReframeComplete?.(result);

      const platformName = selectedPlatform
        ? PLATFORM_PRESETS[selectedPlatform].name
        : reframeSettings.targetAspectRatio;
      toast.success(
        "Recadrage auto appliqué",
        `Projet redimensionné en ${platformName} (${targetConfig.width}x${targetConfig.height})`,
      );
    } catch (error) {
      console.error("Échec du recadrage auto :", error);
      toast.error(
        "Échec du recadrage auto",
        error instanceof Error ? error.message : "Erreur inconnue",
      );
      setIsApplied(false);
    } finally {
      setIsProcessing(false);
    }
  }, [
    isInitialized,
    handleInitialize,
    reframeSettings,
    selectedPlatform,
    onReframeComplete,
    updateProjectDimensions,
  ]);

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div>
          <Text type="supporting" color="secondary" className="mb-2 block text-[10px]">
            Préréglages plateforme
          </Text>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(PLATFORM_PRESETS) as PlatformPreset[]).map(
                (platform) => {
                  const PlatformIcon = PLATFORM_ICONS[platform];
                  return (
                    <ClickableCard
                      key={platform}
                      label={`${PLATFORM_PRESETS[platform].name} platform preset`}
                      onClick={() => handleSelectPlatform(platform)}
                      className={`flex items-center gap-1 p-2 rounded text-[9px] transition-colors ${
                        selectedPlatform === platform
                          ? "bg-primary/20 border border-primary text-fg"
                          : "bg-bg-1 hover:bg-background-primary border border-transparent text-fg-2"
                      }`}
                    >
                      <PlatformIcon size={14} />
                      <Text type="supporting" className="truncate text-[9px]">
                        {PLATFORM_PRESETS[platform].name}
                      </Text>
                    </ClickableCard>
                  );
                },
            )}
          </div>
        </div>

        <div>
          <Text type="supporting" color="secondary" className="mb-2 block text-[10px]">
            Format d’image
          </Text>
          <div className="grid grid-cols-3 gap-1">
            {(Object.keys(ASPECT_RATIO_PRESETS) as AspectRatioPreset[])
              .filter((r) => r !== "custom")
              .map((ratio) => (
                <ClickableCard
                  key={ratio}
                  label={`${ratio} aspect ratio`}
                  onClick={() => handleSelectAspectRatio(ratio)}
                  className={`p-2 rounded text-[9px] transition-colors ${
                    reframeSettings.targetAspectRatio === ratio &&
                    !selectedPlatform
                      ? "bg-primary/20 border border-primary text-fg"
                      : "bg-bg-1 hover:bg-background-primary border border-transparent text-fg-2"
                  }`}
                >
                  {ratio}
                </ClickableCard>
              ))}
          </div>
        </div>

        <PropertySlider
          label="Vitesse de suivi"
          min={0}
          max={100}
          step={1}
          value={reframeSettings.trackingSpeed * 100}
          onChange={(value: number) =>
            updateLocalSettings({
              trackingSpeed: value / 100,
            })
          }
          formatValue={(value) => `${Math.round(value)}%`}
        />

        <PropertySlider
          label="Lissage"
          min={0}
          max={100}
          step={1}
          value={reframeSettings.smoothing * 100}
          onChange={(value: number) => updateLocalSettings({ smoothing: value / 100 })}
          formatValue={(value) => `${Math.round(value)}%`}
        />

        <PropertySlider
          label="Biais central"
          min={0}
          max={100}
          step={1}
          value={reframeSettings.centerBias * 100}
          onChange={(value: number) =>
            updateLocalSettings({
              centerBias: value / 100,
            })
          }
          formatValue={(value) => `${Math.round(value)}%`}
        />

        <div className="flex items-center justify-between">
          <Text type="supporting" color="secondary" className="text-[10px]">
            Suivre le sujet
          </Text>
          <MockToggle
            ariaLabel="Suivre le sujet"
            checked={reframeSettings.followSubject}
            onChange={() =>
              updateLocalSettings({
                followSubject: !reframeSettings.followSubject,
              })
            }
          />
        </div>

        {isProcessing && (
          <Card variant="muted" padding={2} className="space-y-1">
            <div className="flex items-center justify-between">
              <Text type="supporting" color="secondary" className="text-[9px]">
                {progressMessage}
              </Text>
              <Text type="supporting" color="secondary" className="text-[9px]">
                {progress}%
              </Text>
            </div>
            <div className="h-1 bg-bg-1 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </Card>
        )}

        <Button
          label={
            isInitializing || isProcessing
              ? isInitializing
                ? "Initialisation..."
                : "Analyse..."
              : isApplied
                ? "Appliqué - Clique pour réanalyser"
                : "Analyser et recadrer"
          }
          icon={
            isInitializing || isProcessing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isApplied ? (
              <CheckCircle size={14} />
            ) : (
              <Play size={14} />
            )
          }
          variant="primary"
          size="sm"
          onClick={handleAnalyze}
          isDisabled={isInitializing || isProcessing}
          className="w-full justify-center"
        />

        <Text type="supporting" color="secondary" className="text-center text-[9px]">
          Sortie :{" "}
          {ASPECT_RATIO_PRESETS[reframeSettings.targetAspectRatio].width} x{" "}
          {ASPECT_RATIO_PRESETS[reframeSettings.targetAspectRatio].height}
        </Text>
      </div>
    </div>
  );
};

export default AutoReframeSection;
