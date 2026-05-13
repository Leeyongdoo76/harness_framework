import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBanner from "./ErrorBanner";
import { YouTubeAuthError, NetworkError } from "@/types/errors";

describe("ErrorBanner", () => {
  it("renders error.userMessage inside role=alert", () => {
    render(
      <ErrorBanner
        error={new YouTubeAuthError("401")}
        actions={[]}
        onAction={() => {}}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "YouTube API 키가 올바르지 않습니다. 설정에서 다시 입력해주세요.",
    );
  });

  it("renders provided action buttons with copy table labels", () => {
    render(
      <ErrorBanner
        error={new NetworkError("network")}
        actions={["retry", "editUrl", "openSettings", "refreshPage"]}
        onAction={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "URL 수정" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "설정 열기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새로고침" })).toBeInTheDocument();
  });

  it("invokes onAction with the clicked action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <ErrorBanner
        error={new YouTubeAuthError("401")}
        actions={["retry", "openSettings"]}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onAction).toHaveBeenCalledWith("retry");
    await user.click(screen.getByRole("button", { name: "설정 열기" }));
    expect(onAction).toHaveBeenCalledWith("openSettings");
  });

  it("renders no buttons when actions is empty", () => {
    render(
      <ErrorBanner
        error={new YouTubeAuthError("401")}
        actions={[]}
        onAction={() => {}}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
