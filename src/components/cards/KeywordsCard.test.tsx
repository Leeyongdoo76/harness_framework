import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import KeywordsCard from "./KeywordsCard";

describe("KeywordsCard", () => {
  it("renders empty state when no keywords", () => {
    render(<KeywordsCard keywords={[]} />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("자주 등장한 키워드");
    expect(
      screen.getByText("반복되는 키워드가 충분하지 않습니다"),
    ).toBeInTheDocument();
  });

  it("renders each keyword with sentiment label, term, count via aria-label", () => {
    render(
      <KeywordsCard
        keywords={[
          { term: "편집", count: 12, sentiment: "pos" },
          { term: "음향", count: 5, sentiment: "neg" },
          { term: "썸네일", count: 3, sentiment: "neu" },
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: "긍정 키워드 편집, 12건" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "부정 키워드 음향, 5건" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "중립 키워드 썸네일, 3건" })).toBeInTheDocument();
  });

  it("applies sentiment-specific color classes", () => {
    const { container } = render(
      <KeywordsCard
        keywords={[
          { term: "편집", count: 12, sentiment: "pos" },
          { term: "음향", count: 5, sentiment: "neg" },
        ]}
      />,
    );
    const pos = container.querySelector('[aria-label="긍정 키워드 편집, 12건"]');
    const neg = container.querySelector('[aria-label="부정 키워드 음향, 5건"]');
    expect(pos?.className).toContain("text-[#22c55e]");
    expect(neg?.className).toContain("text-[#ef4444]");
  });

  it("renders visible term text and count number alongside color", () => {
    render(
      <KeywordsCard
        keywords={[{ term: "편집", count: 12, sentiment: "pos" }]}
      />,
    );
    expect(screen.getByText("편집")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});
