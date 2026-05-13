import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "./Footer";

describe("Footer", () => {
  it("renders disclaimer / privacy / source", () => {
    render(<Footer />);
    expect(
      screen.getByText("이 도구는 YouTube와 Anthropic의 공식 제품이 아닙니다."),
    ).toBeInTheDocument();
    expect(screen.getByText(/이 브라우저를 떠나/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /소스 코드/ })).toBeInTheDocument();
  });

  it("external link has rel='noopener noreferrer' and target='_blank'", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: /소스 코드/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
