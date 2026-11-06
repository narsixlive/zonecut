import "../../test/install-local-storage-mock";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EditorActionRail } from "./EditorActionRail";

describe("EditorActionRail (ZoneScene studio scope)", () => {
  afterEach(() => cleanup());

  it("keeps home, undo/redo, history and the audio mixer, and nothing else", () => {
    render(<EditorActionRail />);

    const labels = screen.getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(labels).toEqual(["Accueil du studio", "Annuler", "Rétablir", "Historique", "Éditeur d'images clés", "Mixeur audio"]);
  });
});
