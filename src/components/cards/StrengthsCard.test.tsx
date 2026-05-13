import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StrengthsCard from "./StrengthsCard";

describe("StrengthsCard", () => {
  it("renders empty state when no strengths", () => {
    render(<StrengthsCard strengths={[]} />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("잘하고 있는 점");
    expect(
      screen.getByText("뚜렷한 강점 패턴이 발견되지 않았습니다"),
    ).toBeInTheDocument();
  });

  it("renders point and first evidence by default", () => {
    render(
      <StrengthsCard
        strengths={[
          {
            point: "편집 속도가 빠르다",
            evidence: ["편집 깔끔해요", "리듬감 좋네요", "지루할 틈이 없다"],
          },
        ]}
      />,
    );
    expect(screen.getByText("편집 속도가 빠르다")).toBeInTheDocument();
    expect(screen.getByText("편집 깔끔해요")).toBeInTheDocument();
    expect(screen.queryByText("리듬감 좋네요")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "더 보기" })).toBeInTheDocument();
  });

  it("expands additional evidence on 더 보기 click", async () => {
    const user = userEvent.setup();
    render(
      <StrengthsCard
        strengths={[
          {
            point: "편집 속도가 빠르다",
            evidence: ["편집 깔끔해요", "리듬감 좋네요"],
          },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "더 보기" }));
    expect(screen.getByText("리듬감 좋네요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "접기" })).toBeInTheDocument();
  });

  it("hides 더 보기 button when only one evidence", () => {
    render(
      <StrengthsCard
        strengths={[{ point: "기획이 좋다", evidence: ["기획 굿"] }]}
      />,
    );
    expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
  });

  it("does not render evidence section when evidence is empty", () => {
    render(
      <StrengthsCard
        strengths={[{ point: "음향이 좋다", evidence: [] }]}
      />,
    );
    expect(screen.getByText("음향이 좋다")).toBeInTheDocument();
    expect(screen.queryByText("근거 댓글")).not.toBeInTheDocument();
  });
});
