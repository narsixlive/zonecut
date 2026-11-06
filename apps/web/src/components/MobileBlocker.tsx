import { useEffect, useState } from "react";
import { ToolcraftText as Text } from "@openreel/ui";

export function supportsBrowserEditing(): boolean {
  try {
    return typeof Blob !== "undefined" && typeof File !== "undefined" &&
      typeof URL.createObjectURL === "function" &&
      Boolean(document.createElement("canvas").getContext("2d"));
  } catch {
    return false;
  }
}

/** Phones and tablets: never tested for ZoneScene (owner, 2026-11-04) and the caption model
 * (~300 MB) plus video can exceed a mobile tab's memory. */
export function isPhoneOrTablet(): boolean {
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || iPadOS;
}

/** Desktop only: gate phones/tablets and browsers missing the required APIs. */
export function MobileBlocker() {
  const [reason, setReason] = useState<"phone" | "browser" | null>(null);
  useEffect(() => {
    setReason(isPhoneOrTablet() ? "phone" : supportsBrowserEditing() ? null : "browser");
  }, []);
  if (!reason) return null;
  return (
    <div role="alert" className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <Text type="body" weight="bold" display="block">
          {reason === "phone" ? "Le studio s'utilise sur ordinateur" : "Votre navigateur doit être mis à jour"}
        </Text>
        <Text type="supporting" display="block">
          {reason === "phone"
            ? "Ouvrez cette page sur un ordinateur, avec Chrome ou Edge."
            : "Le studio a besoin d'un navigateur récent. Ouvrez cette page avec Chrome ou Edge à jour."}
        </Text>
      </div>
    </div>
  );
}
