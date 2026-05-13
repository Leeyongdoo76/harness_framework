import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "@/lib/copy";

const ISSUE_URL = "https://github.com";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // BYOK 프라이버시: 외부 전송 금지 (ADR-030). 로컬 로그만.
    console.error("ErrorBoundary caught:", error, info);
  }

  private readonly handleRefresh = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div
        role="alert"
        className="max-w-5xl mx-auto px-6 py-10 space-y-4"
      >
        <h1 className="text-4xl font-semibold text-white">{t("boundary.title")}</h1>
        <p className="text-sm text-neutral-300 leading-relaxed">{t("boundary.body")}</p>
        <button
          type="button"
          onClick={this.handleRefresh}
          className="inline-flex items-center justify-center min-h-[44px] rounded-lg bg-white text-black hover:bg-neutral-200 px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
        >
          {t("boundary.refresh")}
        </button>
        <p className="text-xs text-neutral-500">
          {t("boundary.reportSecondary")}{" "}
          <a
            href={ISSUE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded"
          >
            <span aria-hidden="true">↗</span>
          </a>
        </p>
      </div>
    );
  }
}
