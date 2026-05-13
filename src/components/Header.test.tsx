import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "./Header";

describe("Header", () => {
  it("renders title h1", () => {
    render(<Header onOpenSettings={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "YouTube 댓글 분석",
    );
  });

  it("calls onOpenSettings when settings button clicked", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    render(<Header onOpenSettings={onOpenSettings} />);
    await user.click(screen.getByRole("button", { name: "설정" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("settings button has aria-label", () => {
    render(<Header onOpenSettings={() => {}} />);
    expect(screen.getByRole("button", { name: "설정" })).toBeInTheDocument();
  });
});
