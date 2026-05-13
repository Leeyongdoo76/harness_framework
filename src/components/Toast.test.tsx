import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import Toast from "./Toast";

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when messageKey is null", () => {
    const { container } = render(<Toast messageKey={null} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders message text from copy table", () => {
    render(<Toast messageKey="toast.copied" onDismiss={() => {}} />);
    expect(screen.getByText("복사되었습니다")).toBeInTheDocument();
  });

  it("calls onDismiss after 4 seconds", () => {
    const onDismiss = vi.fn();
    render(<Toast messageKey="toast.copied" onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not call onDismiss before 4 seconds elapsed", () => {
    const onDismiss = vi.fn();
    render(<Toast messageKey="toast.copied" onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("uses aria-live polite", () => {
    render(<Toast messageKey="toast.copied" onDismiss={() => {}} />);
    const node = screen.getByRole("status");
    expect(node).toHaveAttribute("aria-live", "polite");
  });

  it("clears timer when messageKey transitions to null", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <Toast messageKey="toast.copied" onDismiss={onDismiss} />,
    );
    rerender(<Toast messageKey={null} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
