import { t } from "@/lib/copy";
import type { VideoMeta } from "@/types/videoMeta";

type Props =
  | { kind: "loading" }
  | { kind: "ready"; meta: VideoMeta; onAnalyze: () => void; disabled?: boolean }
  | {
      kind: "fallback";
      videoId: string;
      errorMessage: string;
      onAnalyze: () => void;
      disabled?: boolean;
    };

const CARD_BASE =
  "rounded-lg bg-[#141414] border border-neutral-800 p-6 max-w-5xl mx-auto";

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center rounded-lg bg-white text-black hover:bg-neutral-200 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";

function LoadingSkeleton(): JSX.Element {
  return (
    <section
      aria-busy="true"
      aria-label={t("meta.previewTitle")}
      className={CARD_BASE}
    >
      <div className="flex gap-4">
        <div className="w-40 h-24 rounded bg-neutral-800" aria-hidden="true" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-neutral-800" aria-hidden="true" />
          <div className="h-3 w-1/3 rounded bg-neutral-800" aria-hidden="true" />
          <div className="h-3 w-1/4 rounded bg-neutral-800" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

function Ready({
  meta,
  onAnalyze,
  disabled,
}: {
  meta: VideoMeta;
  onAnalyze: () => void;
  disabled: boolean;
}): JSX.Element {
  const commentCount = meta.commentCount ?? 0;
  return (
    <section aria-label={t("meta.previewTitle")} className={CARD_BASE}>
      <div className="flex flex-col sm:flex-row gap-4">
        <img
          src={meta.thumbnailUrl}
          alt={meta.title}
          className="w-full sm:w-40 h-auto rounded object-cover"
        />
        <div className="flex-1 space-y-1">
          <h2 className="text-lg font-medium text-white">{meta.title}</h2>
          <p className="text-sm text-neutral-300">
            <span className="text-neutral-500">{t("meta.channelLabel")}</span>{" "}
            {meta.channelTitle}
          </p>
          <p className="text-sm text-neutral-300">
            <span className="text-neutral-500">{t("meta.commentCountLabel")}</span>{" "}
            {t("meta.commentCountFormat", { count: commentCount })}
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={disabled}
          className={PRIMARY_BUTTON}
        >
          {t("url.submit")}
        </button>
      </div>
    </section>
  );
}

function Fallback({
  videoId,
  errorMessage,
  onAnalyze,
  disabled,
}: {
  videoId: string;
  errorMessage: string;
  onAnalyze: () => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <section aria-label={t("meta.previewTitle")} className={CARD_BASE}>
      <div className="flex flex-col sm:flex-row gap-4">
        <div
          className="w-full sm:w-40 h-24 rounded bg-neutral-800"
          aria-hidden="true"
        />
        <div className="flex-1 space-y-1">
          <h2 className="text-lg font-medium text-white">[{videoId}]</h2>
          <p className="text-sm text-neutral-400">{errorMessage}</p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={disabled}
          className={PRIMARY_BUTTON}
        >
          {t("url.submit")}
        </button>
      </div>
    </section>
  );
}

export default function VideoMetaPreview(props: Props): JSX.Element {
  if (props.kind === "loading") return <LoadingSkeleton />;
  if (props.kind === "ready") {
    return (
      <Ready
        meta={props.meta}
        onAnalyze={props.onAnalyze}
        disabled={props.disabled === true}
      />
    );
  }
  return (
    <Fallback
      videoId={props.videoId}
      errorMessage={props.errorMessage}
      onAnalyze={props.onAnalyze}
      disabled={props.disabled === true}
    />
  );
}
