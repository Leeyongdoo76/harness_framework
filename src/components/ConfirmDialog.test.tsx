import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDialog from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  function setup(overrides?: { variant?: "default" | "danger" }) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="삭제할까요?"
        body="되돌릴 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        onConfirm={onConfirm}
        onCancel={onCancel}
        variant={overrides?.variant ?? "default"}
      />,
    );
    return { onConfirm, onCancel };
  }

  it("renders title, body, and buttons", () => {
    setup();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("삭제할까요?");
    expect(screen.getByText("되돌릴 수 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
  });

  it("calls onConfirm when confirm clicked", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();
    await user.click(screen.getByRole("button", { name: "삭제" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel clicked", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel on ESC", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel when backdrop clicked", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement;
    if (backdrop === null) throw new Error("backdrop not found");
    await user.click(backdrop);
    expect(onCancel).toHaveBeenCalled();
  });

  it("danger variant applies red background to confirm button", () => {
    setup({ variant: "danger" });
    const confirmBtn = screen.getByRole("button", { name: "삭제" });
    expect(confirmBtn.className).toContain("ef4444");
  });
});
