import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, act } from "@testing-library/react";
import OfflineBanner from "./OfflineBanner";

describe("OfflineBanner", () => {
  let originalDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      "onLine",
    );
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
  });

  afterEach(() => {
    if (originalDescriptor !== undefined) {
      Object.defineProperty(window.navigator, "onLine", originalDescriptor);
    }
  });

  it("renders nothing when online", () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders OfflineError userMessage when offline", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    render(<OfflineBanner />);
    expect(screen.getByText(/오프라인입니다/)).toBeInTheDocument();
  });

  it("appears on offline event and disappears on online event", () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status")).toHaveTextContent(/오프라인입니다/);

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(container.firstChild).toBeNull();
  });
});
