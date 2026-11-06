import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileBlocker, supportsBrowserEditing } from "./MobileBlocker";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("studio device gate", () => {
  it("sends phones to a computer (mobile never tested for ZoneScene)", () => {
    vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(); });
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("iPhone Mobile Safari");
    expect(render(<MobileBlocker />).getByRole("alert")).toHaveTextContent("Le studio s'utilise sur ordinateur");
  });
  it("lets a capable desktop browser through", () => {
    vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(); });
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0");
    expect(supportsBrowserEditing()).toBe(true);
    expect(render(<MobileBlocker />).queryByRole("alert")).toBeNull();
  });
  it("explains an actual missing canvas API", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const view = render(<MobileBlocker />);
    expect(supportsBrowserEditing()).toBe(false);
    expect(view.getByRole("alert")).toHaveTextContent("Votre navigateur doit être mis à jour");
  });
});
