import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AriaLive from "./AriaLive";

describe("AriaLive", () => {
  it("renders both polite and alert regions even when messages absent", () => {
    render(<AriaLive />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("polite region carries politeMessage", () => {
    render(<AriaLive politeMessage="분석 완료" />);
    const polite = screen.getByRole("status");
    expect(polite).toHaveAttribute("aria-live", "polite");
    expect(polite).toHaveTextContent("분석 완료");
  });

  it("alert region carries assertiveMessage", () => {
    render(<AriaLive assertiveMessage="에러 발생" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("에러 발생");
  });

  it("updates when props change", () => {
    const { rerender } = render(<AriaLive politeMessage="first" />);
    expect(screen.getByRole("status")).toHaveTextContent("first");
    rerender(<AriaLive politeMessage="second" />);
    expect(screen.getByRole("status")).toHaveTextContent("second");
  });

  it("regions are visually hidden via sr-only class", () => {
    render(<AriaLive politeMessage="x" assertiveMessage="y" />);
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    expect(screen.getByRole("alert")).toHaveClass("sr-only");
  });
});
