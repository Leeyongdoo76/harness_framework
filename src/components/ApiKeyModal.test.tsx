import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApiKeyModal from "./ApiKeyModal";

describe("ApiKeyModal", () => {
  describe("structure", () => {
    it("renders title and intro from copy table", () => {
      render(
        <ApiKeyModal
          mode="first"
          onSave={() => {}}
          onClearAll={() => {}}
        />,
      );
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        "API 키를 입력해주세요",
      );
    });

    it("inputs have autocomplete=off", () => {
      render(
        <ApiKeyModal
          mode="first"
          onSave={() => {}}
          onClearAll={() => {}}
        />,
      );
      const yt = screen.getByLabelText("YouTube Data API 키");
      const anth = screen.getByLabelText("Anthropic API 키");
      expect(yt).toHaveAttribute("autocomplete", "off");
      expect(anth).toHaveAttribute("autocomplete", "off");
    });

    it("inputs default to password type", () => {
      render(
        <ApiKeyModal
          mode="first"
          onSave={() => {}}
          onClearAll={() => {}}
        />,
      );
      const yt = screen.getByLabelText("YouTube Data API 키");
      expect(yt).toHaveAttribute("type", "password");
    });

    it("show toggle changes input type", async () => {
      const user = userEvent.setup();
      render(
        <ApiKeyModal
          mode="first"
          onSave={() => {}}
          onClearAll={() => {}}
        />,
      );
      const toggles = screen.getAllByRole("button", { name: "보기" });
      await user.click(toggles[0] as HTMLButtonElement);
      const yt = screen.getByLabelText("YouTube Data API 키");
      expect(yt).toHaveAttribute("type", "text");
    });
  });

  describe("save", () => {
    it("save button is disabled when keys are empty", () => {
      render(
        <ApiKeyModal
          mode="first"
          onSave={() => {}}
          onClearAll={() => {}}
        />,
      );
      expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    });

    it("save button is disabled when only whitespace", async () => {
      const user = userEvent.setup();
      render(
        <ApiKeyModal
          mode="first"
          onSave={() => {}}
          onClearAll={() => {}}
        />,
      );
      await user.type(screen.getByLabelText("YouTube Data API 키"), "   ");
      await user.type(screen.getByLabelText("Anthropic API 키"), "   ");
      expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    });

    it("calls onSave with trimmed keys", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(
        <ApiKeyModal
          mode="first"
          onSave={onSave}
          onClearAll={() => {}}
        />,
      );
      await user.type(screen.getByLabelText("YouTube Data API 키"), "  AIzaABC  ");
      await user.type(screen.getByLabelText("Anthropic API 키"), "  sk-ant-XYZ  ");
      await user.click(screen.getByRole("button", { name: "저장" }));
      expect(onSave).toHaveBeenCalledWith({
        youtube: "AIzaABC",
        anthropic: "sk-ant-XYZ",
      });
    });
  });

  describe("guide toggle", () => {
    it("shows external links with rel=noopener noreferrer when opened", async () => {
      const user = userEvent.setup();
      render(
        <ApiKeyModal
          mode="first"
          onSave={() => {}}
          onClearAll={() => {}}
        />,
      );
      await user.click(screen.getByRole("button", { name: "API 키는 어떻게 받나요?" }));
      const ytLink = screen.getByRole("link", { name: /Google Cloud Console 열기/ });
      const anthLink = screen.getByRole("link", { name: /Anthropic Console 열기/ });
      expect(ytLink).toHaveAttribute("target", "_blank");
      expect(ytLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(anthLink).toHaveAttribute("target", "_blank");
      expect(anthLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("mode=first", () => {
    it("ESC does not close in first mode", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <ApiKeyModal
          mode="first"
          onSave={() => {}}
          onClose={onClose}
          onClearAll={() => {}}
        />,
      );
      await user.keyboard("{Escape}");
      expect(onClose).not.toHaveBeenCalled();
    });

    it("backdrop click does not close in first mode", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <ApiKeyModal
          mode="first"
          onSave={() => {}}
          onClose={onClose}
          onClearAll={() => {}}
        />,
      );
      const dialog = screen.getByRole("dialog");
      const backdrop = dialog.parentElement;
      if (backdrop === null) throw new Error("backdrop not found");
      await user.click(backdrop);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("mode=edit", () => {
    it("ESC calls onClose", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <ApiKeyModal
          mode="edit"
          onSave={() => {}}
          onClose={onClose}
          onClearAll={() => {}}
        />,
      );
      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalled();
    });

    it("shows masked current keys", () => {
      render(
        <ApiKeyModal
          mode="edit"
          currentKeys={{ youtube: "AIzaSyABCDEFG123456", anthropic: "sk-ant-XYZ12345abcd" }}
          onSave={() => {}}
          onClose={() => {}}
          onClearAll={() => {}}
        />,
      );
      expect(screen.getByText("••••••••3456")).toBeInTheDocument();
      expect(screen.getByText("••••••••abcd")).toBeInTheDocument();
    });
  });

  describe("clear all", () => {
    it("delete all button opens confirm dialog and onClearAll runs on confirm", async () => {
      const user = userEvent.setup();
      const onClearAll = vi.fn();
      render(
        <ApiKeyModal
          mode="edit"
          onSave={() => {}}
          onClose={() => {}}
          onClearAll={onClearAll}
        />,
      );
      await user.click(screen.getByRole("button", { name: "모든 데이터 삭제" }));
      expect(
        screen.getByRole("heading", { name: "모든 데이터를 삭제할까요?" }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "삭제" }));
      expect(onClearAll).toHaveBeenCalledTimes(1);
    });

    it("cancel in confirm dialog keeps onClearAll un-called", async () => {
      const user = userEvent.setup();
      const onClearAll = vi.fn();
      render(
        <ApiKeyModal
          mode="edit"
          onSave={() => {}}
          onClose={() => {}}
          onClearAll={onClearAll}
        />,
      );
      await user.click(screen.getByRole("button", { name: "모든 데이터 삭제" }));
      await user.click(screen.getByRole("button", { name: "취소" }));
      expect(onClearAll).not.toHaveBeenCalled();
    });
  });
});
