import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/services/youtube", () => ({
  fetchVideoMeta: vi.fn(),
  fetchTopComments: vi.fn(),
}));
vi.mock("@/services/claude", () => ({
  analyzeComments: vi.fn(),
}));

import App from "./App";
import { fetchVideoMeta, fetchTopComments } from "@/services/youtube";
import { analyzeComments } from "@/services/claude";
import {
  __resetForTests as __resetKeysForTests,
  saveKeys,
} from "@/lib/keys";
import { __resetForTests as __resetStoreForTests } from "@/lib/storage";
import type { VideoMeta } from "@/types/videoMeta";
import type { Comment } from "@/types/youtube";
import type { Report } from "@/types/report";

const VID = "dQw4w9WgXcQ";
const URL_VALUE = `https://www.youtube.com/watch?v=${VID}`;

const META: VideoMeta = {
  videoId: VID,
  title: "테스트 영상",
  channelTitle: "테스트 채널",
  thumbnailUrl: "https://i.ytimg.com/vi/x/default.jpg",
  commentCount: 42,
};

const COMMENTS: Comment[] = [
  { id: "c1", text: "great video!", likeCount: 10, author: "user1" },
  { id: "c2", text: "thank you", likeCount: 5, author: "user2" },
];

const REPORT: Report = {
  summary: "전반적으로 긍정적인 반응이 많습니다.",
  detectedLanguage: "ko",
  sentiment: { positive: 70, neutral: 20, negative: 10 },
  strengths: [],
  improvements: [],
  keywords: [],
  notableComments: [],
};

const fetchVideoMetaMock = fetchVideoMeta as unknown as ReturnType<typeof vi.fn>;
const fetchTopCommentsMock = fetchTopComments as unknown as ReturnType<
  typeof vi.fn
>;
const analyzeCommentsMock = analyzeComments as unknown as ReturnType<
  typeof vi.fn
>;

function resetAll(): void {
  localStorage.clear();
  __resetStoreForTests();
  __resetKeysForTests();
  fetchVideoMetaMock.mockReset();
  fetchTopCommentsMock.mockReset();
  analyzeCommentsMock.mockReset();
  window.history.replaceState(null, "", "/");
}

describe("App integration", () => {
  beforeEach(() => {
    resetAll();
  });

  afterEach(() => {
    resetAll();
    vi.restoreAllMocks();
  });

  it("1) shows API key modal when no keys are present", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { level: 2, name: "API 키를 입력해주세요" }),
    ).toBeInTheDocument();
  });

  it("2) saves keys, closes modal, and enters idle URL input view", async () => {
    const user = userEvent.setup();
    render(<App />);
    const yt = screen.getByLabelText("YouTube Data API 키");
    const anth = screen.getByLabelText("Anthropic API 키");
    await user.type(yt, "AIzaTESTYTKEY");
    await user.type(anth, "sk-ant-TESTANTH");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { level: 2, name: "API 키를 입력해주세요" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("YouTube 영상 URL")).toBeInTheDocument();
  });

  it("3) typing a URL and blur triggers meta fetch and shows VideoMetaPreview", async () => {
    saveKeys({ youtube: "AIzaTESTYTKEY", anthropic: "sk-ant-TESTANTH" });
    fetchVideoMetaMock.mockResolvedValueOnce(META);
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText("YouTube 영상 URL");
    await user.type(input, URL_VALUE);
    await user.tab(); // blur

    await waitFor(() => {
      expect(fetchVideoMetaMock).toHaveBeenCalledWith(
        VID,
        "AIzaTESTYTKEY",
        expect.any(AbortSignal),
      );
    });
    await waitFor(() => {
      expect(screen.getByText("테스트 영상")).toBeInTheDocument();
    });
    expect(screen.getByText("테스트 채널")).toBeInTheDocument();
  });

  it("4) clicking 분석 시작 runs fetch + analyze and shows Dashboard with cards", async () => {
    saveKeys({ youtube: "AIzaTESTYTKEY", anthropic: "sk-ant-TESTANTH" });
    fetchVideoMetaMock.mockResolvedValueOnce(META);
    fetchTopCommentsMock.mockResolvedValueOnce(COMMENTS);
    analyzeCommentsMock.mockResolvedValueOnce(REPORT);

    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText("YouTube 영상 URL");
    await user.type(input, URL_VALUE);
    await user.tab();
    await waitFor(() => {
      expect(screen.getByText("테스트 영상")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "분석 시작" }));

    await waitFor(() => {
      expect(analyzeCommentsMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText("요약")).toBeInTheDocument();
    });
    expect(screen.getByText("감정 분포")).toBeInTheDocument();
    expect(screen.getByText("잘하고 있는 점")).toBeInTheDocument();
    expect(screen.getByText("개선할 점")).toBeInTheDocument();
    expect(screen.getByText("자주 등장한 키워드")).toBeInTheDocument();
    expect(screen.getByText("주목할 만한 댓글")).toBeInTheDocument();
    // hash should reflect the analyzed videoId.
    expect(window.location.hash).toBe(`#v=${VID}`);
  });

  it("5) cancel during analysis aborts and returns to idle", async () => {
    saveKeys({ youtube: "AIzaTESTYTKEY", anthropic: "sk-ant-TESTANTH" });
    fetchVideoMetaMock.mockResolvedValueOnce(META);
    let aborted = false;
    fetchTopCommentsMock.mockImplementationOnce(
      (_id: string, _key: string, signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            aborted = true;
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );

    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("YouTube 영상 URL"), URL_VALUE);
    await user.tab();
    await waitFor(() => {
      expect(screen.getByText("테스트 영상")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "분석 시작" }));

    await waitFor(() => {
      expect(
        screen.getByText("댓글을 모으고 있어요…"),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => {
      expect(aborted).toBe(true);
    });
    await waitFor(() => {
      expect(
        screen.queryByText("댓글을 모으고 있어요…"),
      ).not.toBeInTheDocument();
    });
  });

  it("6) offline event aborts in-flight meta fetch and shows offline error", async () => {
    saveKeys({ youtube: "AIzaTESTYTKEY", anthropic: "sk-ant-TESTANTH" });
    let metaSignal: AbortSignal | undefined;
    fetchVideoMetaMock.mockImplementationOnce(
      (_id: string, _key: string, signal?: AbortSignal) => {
        metaSignal = signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      },
    );

    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("YouTube 영상 URL"), URL_VALUE);
    await user.tab();

    await waitFor(() => {
      expect(fetchVideoMetaMock).toHaveBeenCalled();
    });

    // Simulate offline.
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    await waitFor(() => {
      expect(metaSignal?.aborted).toBe(true);
    });
    await waitFor(() => {
      // ErrorBanner (role=alert) shows OfflineError.userMessage in addition to
      // OfflineBanner and AriaLive — assert the alert specifically.
      const alerts = screen.getAllByRole("alert");
      const hasOfflineAlert = alerts.some((el) =>
        el.textContent?.includes(
          "오프라인입니다. 네트워크 연결을 확인해주세요.",
        ),
      );
      expect(hasOfflineAlert).toBe(true);
    });

    // restore
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
  });

  it("7) reanalyze after result calls fetch/analyze again bypassing cache", async () => {
    saveKeys({ youtube: "AIzaTESTYTKEY", anthropic: "sk-ant-TESTANTH" });
    fetchVideoMetaMock.mockResolvedValue(META);
    fetchTopCommentsMock.mockResolvedValue(COMMENTS);
    analyzeCommentsMock.mockResolvedValue(REPORT);

    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("YouTube 영상 URL"), URL_VALUE);
    await user.tab();
    await waitFor(() => {
      expect(screen.getByText("테스트 영상")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "분석 시작" }));
    await waitFor(() => {
      expect(screen.getByText("요약")).toBeInTheDocument();
    });
    expect(analyzeCommentsMock).toHaveBeenCalledTimes(1);
    expect(fetchTopCommentsMock).toHaveBeenCalledTimes(1);

    // The "재분석" button lives in the Dashboard header.
    const reanalyzeButtons = screen.getAllByRole("button", { name: "재분석" });
    await user.click(reanalyzeButtons[0] as HTMLElement);

    await waitFor(() => {
      expect(fetchTopCommentsMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(analyzeCommentsMock).toHaveBeenCalledTimes(2);
    });
  });
});
