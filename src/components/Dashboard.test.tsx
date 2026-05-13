import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "./Dashboard";
import type { Report } from "@/types/report";
import type { VideoMeta } from "@/types/videoMeta";

const baseReport: Report = {
  summary: "시청자들이 편집 속도를 높이 평가했습니다.",
  detectedLanguage: "ko",
  sentiment: { positive: 80, neutral: 15, negative: 5 },
  strengths: [{ point: "편집이 빠르다", evidence: ["편집 깔끔"] }],
  improvements: [{ point: "오디오 레벨", evidence: ["볼륨 작음"] }],
  keywords: [{ term: "편집", count: 12, sentiment: "pos" }],
  notableComments: [{ author: "홍길동", likes: 42, text: "잘 봤어요" }],
};

const baseMeta: VideoMeta = {
  videoId: "dQw4w9WgXcQ",
  title: "테스트 영상 제목",
  channelTitle: "테스트 채널",
  thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  commentCount: 87,
};

describe("Dashboard", () => {
  it("renders video title, channel, and just-now timestamp with sample size", () => {
    render(
      <Dashboard
        videoId="dQw4w9WgXcQ"
        videoMeta={baseMeta}
        report={baseReport}
        commentCount={87}
        fromCache={false}
        onReanalyze={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: "테스트 영상 제목" })).toBeInTheDocument();
    expect(screen.getByText("테스트 채널")).toBeInTheDocument();
    expect(screen.getByText(/방금 분석 · 댓글 87개 기준/)).toBeInTheDocument();
  });

  it("falls back to [videoId] when meta is missing", () => {
    render(
      <Dashboard
        videoId="abc12345xyz"
        report={baseReport}
        commentCount={50}
        fromCache={false}
        onReanalyze={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: "[abc12345xyz]" })).toBeInTheDocument();
  });

  it("shows cached header when fromCache=true with cachedAt", () => {
    const cachedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();
    render(
      <Dashboard
        videoId="dQw4w9WgXcQ"
        videoMeta={baseMeta}
        report={baseReport}
        commentCount={87}
        fromCache={true}
        cachedAt={cachedAt}
        onReanalyze={() => {}}
      />,
    );
    expect(screen.getByText(/3일 전 분석 · 캐시된 결과 · 댓글 87개 기준/)).toBeInTheDocument();
  });

  it("shows low confidence warning when commentCount < 10", () => {
    render(
      <Dashboard
        videoId="dQw4w9WgXcQ"
        report={baseReport}
        commentCount={5}
        fromCache={false}
        onReanalyze={() => {}}
      />,
    );
    expect(
      screen.getByText("댓글 표본이 적어(5개) 분석 신뢰도가 낮을 수 있습니다"),
    ).toBeInTheDocument();
  });

  it("shows truncation notice when truncatedCount is set", () => {
    render(
      <Dashboard
        videoId="dQw4w9WgXcQ"
        report={baseReport}
        commentCount={100}
        fromCache={false}
        truncatedCount={50}
        onReanalyze={() => {}}
      />,
    );
    expect(
      screen.getByText("토큰 한도로 좋아요 상위 50개 댓글만 분석했습니다"),
    ).toBeInTheDocument();
  });

  it("renders all 6 cards", () => {
    render(
      <Dashboard
        videoId="dQw4w9WgXcQ"
        report={baseReport}
        commentCount={87}
        fromCache={false}
        onReanalyze={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "요약" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "감정 분포" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "잘하고 있는 점" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "개선할 점" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "자주 등장한 키워드" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "주목할 만한 댓글" })).toBeInTheDocument();
  });

  it("renders disclaimer", () => {
    render(
      <Dashboard
        videoId="dQw4w9WgXcQ"
        report={baseReport}
        commentCount={87}
        fromCache={false}
        onReanalyze={() => {}}
      />,
    );
    expect(
      screen.getByText(
        "AI가 자동으로 분석한 결과입니다. 100% 정확하지 않을 수 있으며 참고용으로 활용해주세요.",
      ),
    ).toBeInTheDocument();
  });

  it("opens external video link with proper rel attributes", () => {
    render(
      <Dashboard
        videoId="dQw4w9WgXcQ"
        videoMeta={baseMeta}
        report={baseReport}
        commentCount={87}
        fromCache={false}
        onReanalyze={() => {}}
      />,
    );
    const link = screen.getByRole("link", { name: "영상 열기" });
    expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("calls onReanalyze when reanalyze button clicked", async () => {
    const user = userEvent.setup();
    const onReanalyze = vi.fn();
    render(
      <Dashboard
        videoId="dQw4w9WgXcQ"
        report={baseReport}
        commentCount={87}
        fromCache={false}
        onReanalyze={onReanalyze}
      />,
    );
    await user.click(screen.getByRole("button", { name: "재분석" }));
    expect(onReanalyze).toHaveBeenCalledTimes(1);
  });

  it("shows detected language label", () => {
    render(
      <Dashboard
        videoId="dQw4w9WgXcQ"
        report={baseReport}
        commentCount={87}
        fromCache={false}
        onReanalyze={() => {}}
      />,
    );
    expect(screen.getByText("감지된 언어")).toBeInTheDocument();
    expect(screen.getByText("ko")).toBeInTheDocument();
  });
});
