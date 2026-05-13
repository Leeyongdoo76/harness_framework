import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VideoMetaPreview from "./VideoMetaPreview";
import type { VideoMeta } from "@/types/videoMeta";

const META: VideoMeta = {
  videoId: "dQw4w9WgXcQ",
  title: "예시 영상 제목",
  channelTitle: "예시 채널",
  thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  commentCount: 87,
};

describe("VideoMetaPreview", () => {
  describe("loading", () => {
    it("renders aria-busy skeleton", () => {
      render(<VideoMetaPreview kind="loading" />);
      const section = screen.getByLabelText("분석할 영상");
      expect(section).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("ready", () => {
    it("renders title/channel/comment count", () => {
      render(
        <VideoMetaPreview kind="ready" meta={META} onAnalyze={() => {}} />,
      );
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("예시 영상 제목");
      expect(screen.getByText("예시 채널")).toBeInTheDocument();
      expect(screen.getByText("87개")).toBeInTheDocument();
    });

    it("renders thumbnail with title as alt", () => {
      render(
        <VideoMetaPreview kind="ready" meta={META} onAnalyze={() => {}} />,
      );
      const img = screen.getByRole("img", { name: "예시 영상 제목" });
      expect(img).toHaveAttribute("src", META.thumbnailUrl);
    });

    it("calls onAnalyze when analyze button clicked", async () => {
      const user = userEvent.setup();
      const onAnalyze = vi.fn();
      render(
        <VideoMetaPreview kind="ready" meta={META} onAnalyze={onAnalyze} />,
      );
      await user.click(screen.getByRole("button", { name: "분석 시작" }));
      expect(onAnalyze).toHaveBeenCalledTimes(1);
    });

    it("disables button when disabled prop is true", () => {
      render(
        <VideoMetaPreview kind="ready" meta={META} onAnalyze={() => {}} disabled />,
      );
      expect(screen.getByRole("button", { name: "분석 시작" })).toBeDisabled();
    });

    it("shows 0개 when commentCount is undefined", () => {
      const noCount: VideoMeta = { ...META, commentCount: undefined };
      render(
        <VideoMetaPreview kind="ready" meta={noCount} onAnalyze={() => {}} />,
      );
      expect(screen.getByText("0개")).toBeInTheDocument();
    });
  });

  describe("fallback", () => {
    it("renders [videoId] as title and error message", () => {
      render(
        <VideoMetaPreview
          kind="fallback"
          videoId="dQw4w9WgXcQ"
          errorMessage="영상 정보를 불러올 수 없습니다. 그래도 분석을 진행할 수 있습니다."
          onAnalyze={() => {}}
        />,
      );
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("[dQw4w9WgXcQ]");
      expect(
        screen.getByText("영상 정보를 불러올 수 없습니다. 그래도 분석을 진행할 수 있습니다."),
      ).toBeInTheDocument();
    });

    it("analyze button stays active by default in fallback", () => {
      render(
        <VideoMetaPreview
          kind="fallback"
          videoId="dQw4w9WgXcQ"
          errorMessage="x"
          onAnalyze={() => {}}
        />,
      );
      expect(screen.getByRole("button", { name: "분석 시작" })).toBeEnabled();
    });

    it("calls onAnalyze on fallback button click", async () => {
      const user = userEvent.setup();
      const onAnalyze = vi.fn();
      render(
        <VideoMetaPreview
          kind="fallback"
          videoId="dQw4w9WgXcQ"
          errorMessage="x"
          onAnalyze={onAnalyze}
        />,
      );
      await user.click(screen.getByRole("button", { name: "분석 시작" }));
      expect(onAnalyze).toHaveBeenCalledTimes(1);
    });
  });
});
