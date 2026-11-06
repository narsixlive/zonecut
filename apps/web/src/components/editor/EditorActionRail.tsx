import React from "react";
import {
  ToolcraftIconButton as IconButton,
  ToolcraftTooltip as Tooltip,
} from "@openreel/ui";
import { Icon } from "@/icons/Icon";
import { House } from "@/icons/lucide-compat";
import { useProjectStore } from "../../stores/project-store";
import { useUIStore } from "../../stores/ui-store";
import { useRouter } from "../../hooks/use-router";

// ZoneScene studio rail (zonescene/studio-scope.ts): search/AI, keyframes, AI chat, project JSON,
// theme toggle (always dark) and the « more » menu (API keys, screen recorder, tours) are removed.
const RailButton: React.FC<{
  label: string;
  icon: string;
  onClick: () => void;
  active?: boolean;
}> = ({ label, icon, onClick, active = false }) => (
  <Tooltip content={label} placement="end">
    <IconButton
      label={label}
      icon={<Icon name={icon} size={16} ariaHidden />}
      size="sm"
      variant={active ? "secondary" : "ghost"}
      onClick={onClick}
    />
  </Tooltip>
);

export const EditorActionRail: React.FC = () => {
  const { undo, redo } = useProjectStore();
  const { openModal, panels, togglePanel, activeModal, toggleKeyframeEditor, keyframeEditorOpen } = useUIStore();
  const { navigate } = useRouter();

  return (
    <nav
      data-tour="toolbar"
      aria-label="Outils du studio"
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-bg-1 py-3"
    >
      <Tooltip content="Accueil du studio" placement="end">
        <IconButton
          label="Accueil du studio"
          icon={<House size={16} aria-hidden />}
          size="sm"
          variant="ghost"
          onClick={() => navigate("welcome")}
        />
      </Tooltip>

      <div className="my-1.5 h-px w-6 bg-border" />

      <RailButton
        label="Annuler"
        icon="arrow.uturn.backward"
        onClick={() => void undo()}
      />
      <RailButton
        label="Rétablir"
        icon="arrow.uturn.forward"
        onClick={() => void redo()}
      />

      <div className="my-1.5 h-px w-6 bg-border" />

      <RailButton
        label="Historique"
        icon="clock"
        onClick={() => openModal("history")}
        active={activeModal === "history"}
      />
      <RailButton
        label="Éditeur d'images clés"
        icon="diamond"
        onClick={toggleKeyframeEditor}
        active={keyframeEditorOpen}
      />
      <RailButton
        label="Mixeur audio"
        icon="music.note"
        onClick={() => togglePanel("audioMixer")}
        active={Boolean(panels.audioMixer?.visible)}
      />

      <div className="flex-1" />
    </nav>
  );
};
