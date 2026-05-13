import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("renders commentsDisabled title and body", () => {
    render(<EmptyState reason="commentsDisabled" />);
    expect(
      screen.getByRole("heading", { name: "댓글이 비활성화된 영상입니다" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "이 영상은 댓글이 꺼져 있어 분석할 수 없습니다. 다른 영상으로 시도해보세요.",
      ),
    ).toBeInTheDocument();
  });

  it("renders noComments title and body", () => {
    render(<EmptyState reason="noComments" />);
    expect(
      screen.getByRole("heading", { name: "분석할 댓글이 없습니다" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "이 영상에는 아직 댓글이 없습니다. 댓글이 쌓인 후 다시 시도해주세요.",
      ),
    ).toBeInTheDocument();
  });
});
