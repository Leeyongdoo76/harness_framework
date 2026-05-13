import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import SentimentChart from "./SentimentChart";

describe("SentimentChart", () => {
  it("renders aria-label with sentiment breakdown", () => {
    render(
      <SentimentChart sentiment={{ positive: 78, neutral: 15, negative: 7 }} />,
    );
    expect(
      screen.getByRole("img", { name: /감정 분포: 긍정 78%, 중립 15%, 부정 7%/ }),
    ).toBeInTheDocument();
  });

  it("provides sr-only text alternative with all three slices", () => {
    const { container } = render(
      <SentimentChart sentiment={{ positive: 78, neutral: 15, negative: 7 }} />,
    );
    const srOnly = container.querySelector("ul.sr-only");
    expect(srOnly).not.toBeNull();
    if (srOnly === null) return;
    const items = within(srOnly as HTMLElement).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("긍정 78%");
    expect(items[1]).toHaveTextContent("중립 15%");
    expect(items[2]).toHaveTextContent("부정 7%");
  });

  it("center label shows dominant sentiment (positive max)", () => {
    render(
      <SentimentChart sentiment={{ positive: 78, neutral: 15, negative: 7 }} />,
    );
    expect(screen.getByText("78%")).toBeInTheDocument();
    expect(screen.getAllByText("긍정").length).toBeGreaterThan(0);
  });

  it("center label shows negative when negative dominates", () => {
    render(
      <SentimentChart sentiment={{ positive: 10, neutral: 25, negative: 65 }} />,
    );
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("rounds sentiment percentages", () => {
    render(
      <SentimentChart sentiment={{ positive: 49.6, neutral: 25.2, negative: 25.2 }} />,
    );
    expect(
      screen.getByRole("img", { name: /긍정 50%, 중립 25%, 부정 25%/ }),
    ).toBeInTheDocument();
  });
});
