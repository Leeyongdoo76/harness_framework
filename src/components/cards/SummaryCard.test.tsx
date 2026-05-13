import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SummaryCard from "./SummaryCard";

describe("SummaryCard", () => {
  it("renders the card title and summary text", () => {
    render(<SummaryCard summary="시청자들이 편집 속도와 기획을 칭찬했습니다." />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("요약");
    expect(
      screen.getByText("시청자들이 편집 속도와 기획을 칭찬했습니다."),
    ).toBeInTheDocument();
  });
});
