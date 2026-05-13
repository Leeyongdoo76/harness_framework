import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRef, useEffect } from "react";
import type { RefObject } from "react";
import { useFocusTrap } from "./focusTrap";

function setupTrapContainer(html: string): {
  container: HTMLElement;
  ref: RefObject<HTMLElement | null>;
} {
  const container = document.createElement("div");
  container.tabIndex = -1;
  container.innerHTML = html;
  document.body.appendChild(container);
  const ref = { current: container } as RefObject<HTMLElement | null>;
  return { container, ref };
}

function pressKey(key: string, opts: { shift?: boolean } = {}): void {
  const event = new KeyboardEvent("keydown", {
    key,
    shiftKey: opts.shift === true,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
}

function renderTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  options?: { onEscape?: () => void; allowEscape?: boolean },
): ReturnType<typeof renderHook<void, { active: boolean }>> {
  return renderHook(({ active: a }) => useFocusTrap(ref, a, options), {
    initialProps: { active },
  });
}

describe("useFocusTrap", () => {
  let trigger: HTMLButtonElement;

  beforeEach(() => {
    trigger = document.createElement("button");
    trigger.textContent = "open";
    document.body.appendChild(trigger);
    trigger.focus();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("focuses first focusable when activated", () => {
    const { container, ref } = setupTrapContainer(
      `<button id="a">A</button><button id="b">B</button>`,
    );
    renderTrap(ref, true);
    expect(document.activeElement?.id).toBe("a");
    container.remove();
  });

  it("returns focus to previously focused element on unmount", () => {
    const { ref } = setupTrapContainer(`<button id="a">A</button>`);
    const view = renderTrap(ref, true);
    expect(document.activeElement?.id).toBe("a");
    view.unmount();
    expect(document.activeElement).toBe(trigger);
  });

  it("Tab on last element wraps to first", () => {
    const { ref } = setupTrapContainer(
      `<button id="a">A</button><button id="b">B</button>`,
    );
    renderTrap(ref, true);
    const b = document.getElementById("b");
    b?.focus();
    pressKey("Tab");
    expect(document.activeElement?.id).toBe("a");
  });

  it("Shift+Tab on first element wraps to last", () => {
    const { ref } = setupTrapContainer(
      `<button id="a">A</button><button id="b">B</button>`,
    );
    renderTrap(ref, true);
    const a = document.getElementById("a");
    a?.focus();
    pressKey("Tab", { shift: true });
    expect(document.activeElement?.id).toBe("b");
  });

  it("Escape calls onEscape by default", () => {
    const onEscape = vi.fn();
    const { ref } = setupTrapContainer(`<button id="a">A</button>`);
    renderTrap(ref, true, { onEscape });
    pressKey("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("Escape does not call onEscape when allowEscape: false", () => {
    const onEscape = vi.fn();
    const { ref } = setupTrapContainer(`<button id="a">A</button>`);
    renderTrap(ref, true, { onEscape, allowEscape: false });
    pressKey("Escape");
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("does nothing when inactive", () => {
    const { ref } = setupTrapContainer(`<button id="a">A</button>`);
    renderTrap(ref, false);
    // trigger should retain focus
    expect(document.activeElement).toBe(trigger);
  });

  it("skips disabled buttons when picking focusable", () => {
    const { ref } = setupTrapContainer(
      `<button id="a" disabled>A</button><button id="b">B</button>`,
    );
    renderTrap(ref, true);
    expect(document.activeElement?.id).toBe("b");
  });

  it("works with a ref obtained inside a component (useRef path)", () => {
    document.body.innerHTML = `
      <div id="container" tabindex="-1">
        <button id="a">A</button><button id="b">B</button>
      </div>
    `;
    const container = document.getElementById("container") as HTMLElement;

    function Trap(): null {
      const ref = useRef<HTMLElement | null>(null);
      useEffect(() => {
        ref.current = container;
      }, []);
      // simulate parent setting ref before effect: just feed container directly
      ref.current = container;
      useFocusTrap(ref, true);
      return null;
    }

    const view = renderHook(() => Trap());
    expect(document.activeElement?.id).toBe("a");
    pressKey("Tab", { shift: true });
    expect(document.activeElement?.id).toBe("b");
    view.unmount();
  });

  it("toggling active=true → false restores focus", () => {
    const { ref } = setupTrapContainer(`<button id="a">A</button>`);
    const view = renderTrap(ref, true);
    expect(document.activeElement?.id).toBe("a");
    act(() => {
      view.rerender({ active: false });
    });
    expect(document.activeElement).toBe(trigger);
  });
});
