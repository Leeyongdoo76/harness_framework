import { useEffect, useRef } from "react";
import { t } from "@/lib/copy";
import { toRelativeKorean } from "@/lib/relativeTime";
import type { Report } from "@/types/report";
import type { VideoMeta } from "@/types/videoMeta";
import SummaryCard from "./cards/SummaryCard";
import SentimentChart from "./cards/SentimentChart";
import StrengthsCard from "./cards/StrengthsCard";
import ImprovementsCard from "./cards/ImprovementsCard";
import KeywordsCard from "./cards/KeywordsCard";
import NotableCommentsCard from "./cards/NotableCommentsCard";

type Props = {
  videoId: string;
  videoMeta?: VideoMeta;
  report: Report;
  commentCount: number;
  fromCache: boolean;
  cachedAt?: string;
  truncatedCount?: number;
  onReanalyze: () => void;
};

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center rounded-lg bg-white text-black hover:bg-neutral-200 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";

function Header({
  videoId,
  videoMeta,
  report,
  commentCount,
  fromCache,
  cachedAt,
  onReanalyze,
}: Pick<
  Props,
  "videoId" | "videoMeta" | "report" | "commentCount" | "fromCache" | "cachedAt" | "onReanalyze"
>): JSX.Element {
  const title = videoMeta?.title ?? `[${videoId}]`;
  const channel = videoMeta?.channelTitle;
  const timestamp =
    fromCache && cachedAt !== undefined
      ? t("result.headerCached", {
          relativeTime: toRelativeKorean(cachedAt),
          count: commentCount,
        })
      : t("result.headerJustNow", { count: commentCount });
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return (
    <header className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div className="flex flex-col sm:flex-row gap-4 flex-1 min-w-0">
        {videoMeta !== undefined && (
          <img
            src={videoMeta.thumbnailUrl}
            alt={videoMeta.title}
            className="w-full sm:w-40 h-auto rounded object-cover"
          />
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <h2 className="text-lg font-medium text-white break-words">{title}</h2>
          {channel !== undefined && (
            <p className="text-sm text-neutral-400">{channel}</p>
          )}
          <p className="text-xs text-neutral-500">
            <span>{timestamp}</span>
            <span className="mx-1">·</span>
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded"
            >
              {t("result.openVideo")}
            </a>
          </p>
          <p className="text-xs text-neutral-500">
            <span>{t("result.languageLabel")}</span>{" "}
            <span className="text-neutral-300">{report.detectedLanguage}</span>
          </p>
        </div>
      </div>
      <button type="button" onClick={onReanalyze} className={PRIMARY_BUTTON}>
        {t("header.reanalyze")}
      </button>
    </header>
  );
}

export default function Dashboard(props: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const showLowConfidence = props.commentCount < 10;
  const showTruncation = props.truncatedCount !== undefined;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="max-w-5xl mx-auto px-6 py-6 space-y-6 focus-visible:outline-none"
      aria-label={t("status.analysisComplete")}
    >
      <Header
        videoId={props.videoId}
        report={props.report}
        commentCount={props.commentCount}
        fromCache={props.fromCache}
        onReanalyze={props.onReanalyze}
        {...(props.videoMeta !== undefined ? { videoMeta: props.videoMeta } : {})}
        {...(props.cachedAt !== undefined ? { cachedAt: props.cachedAt } : {})}
      />

      {(showLowConfidence || showTruncation) && (
        <div className="space-y-2">
          {showLowConfidence && (
            <p
              className="rounded-lg bg-[#f59e0b]/15 text-[#f59e0b] text-xs px-4 py-2"
              role="status"
            >
              {t("result.lowConfidence", { count: props.commentCount })}
            </p>
          )}
          {showTruncation && (
            <p
              className="rounded-lg bg-[#f59e0b]/15 text-[#f59e0b] text-xs px-4 py-2"
              role="status"
            >
              {t("result.truncatedNotice", { count: 50 })}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SummaryCard summary={props.report.summary} />
        <SentimentChart sentiment={props.report.sentiment} />
        <StrengthsCard strengths={props.report.strengths} />
        <ImprovementsCard improvements={props.report.improvements} />
        <KeywordsCard keywords={props.report.keywords} />
        <NotableCommentsCard items={props.report.notableComments} />
      </div>

      <p className="text-xs text-neutral-500">{t("result.disclaimer")}</p>
    </div>
  );
}
