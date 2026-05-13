import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProgressIndicator from "./ProgressIndicator";

describe("ProgressIndicator", () => {
  it("renders fetching phase text", () => {
    render(<ProgressIndicator phase="fetching" onCancel={() => {}} />);
    expect(screen.getByText("댓글을 모으고 있어요…")).toBeInTheDocument();
  });

  it("renders analyzing phase text", () => {
    render(<ProgressIndicator phase="analyzing" onCancel={() => {}} />);
    expect(screen.getByText("AI가 댓글을 분석하고 있어요…")).toBeInTheDocument();
  });

  it("renders estimate copy", () => {
    render(<ProgressIndicator phase="fetching" onCancel={() => {}} />);
    expect(screen.getByText("보통 20~30초 정도 걸립니다")).toBeInTheDocument();
  });

  it("calls onCancel when cancel button clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ProgressIndicator phase="analyzing" onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
