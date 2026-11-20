import "../../test/install-local-storage-mock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { useUIStore } from "../../stores/ui-store";
import { WelcomeScreen } from "./WelcomeScreen";

describe("WelcomeScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useUIStore.setState({ skipWelcomeScreen: false });
    window.location.hash = "";
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders the French landscape (16:9) format option and a back link to ZoneScene", () => {
    render(<WelcomeScreen />);

    expect(screen.getByText("Paysage")).toBeDefined();
    expect(screen.getByText("1920 × 1080")).toBeDefined();

    const backLink = screen.getByRole("link", { name: /Retour/ });
    expect(backLink.getAttribute("href")).toBe("/socials");
  });
});
