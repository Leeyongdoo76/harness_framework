import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotableCommentsCard from "./NotableCommentsCard";

describe("NotableCommentsCard", () => {
  it("renders empty state when no items", () => {
    render(<NotableCommentsCard items={[]} />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "주목할 만한 댓글",
    );
    expect(
      screen.getByText("좋아요가 있는 주목할 댓글이 없습니다"),
    ).toBeInTheDocument();
  });

  it("renders author, likes count, and body", () => {
    render(
      <NotableCommentsCard
        items={[{ author: "홍길동", likes: 42, text: "편집 진짜 잘하시네요" }]}
      />,
    );
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("좋아요 42개")).toBeInTheDocument();
    expect(screen.getByText("편집 진짜 잘하시네요")).toBeInTheDocument();
  });

  it("uses 익명 fallback when author is empty", () => {
    render(
      <NotableCommentsCard
        items={[{ author: "", likes: 3, text: "잘 봤어요" }]}
      />,
    );
    expect(screen.getByText("익명")).toBeInTheDocument();
  });

  it("shows 더 보기 toggle for long comments", async () => {
    const user = userEvent.setup();
    const longText = "a".repeat(200);
    render(
      <NotableCommentsCard items={[{ author: "x", likes: 1, text: longText }]} />,
    );
    expect(screen.getByRole("button", { name: "더 보기" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "더 보기" }));
    expect(screen.getByRole("button", { name: "접기" })).toBeInTheDocument();
  });

  it("does not show toggle for short comments", () => {
    render(
      <NotableCommentsCard
        items={[{ author: "x", likes: 1, text: "짧은 댓글" }]}
      />,
    );
    expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
  });
});
