import { t } from "./copy";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

export function toRelativeKorean(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return t("relTime.justNow");
  const diffMs = now.getTime() - then;
  const seconds = Math.max(0, Math.floor(diffMs / 1000));

  if (seconds < MINUTE) return t("relTime.justNow");
  if (seconds < HOUR) return t("relTime.minutesAgo", { n: Math.floor(seconds / MINUTE) });
  if (seconds < DAY) return t("relTime.hoursAgo", { n: Math.floor(seconds / HOUR) });
  if (seconds < WEEK) return t("relTime.daysAgo", { n: Math.floor(seconds / DAY) });
  if (seconds < MONTH) return t("relTime.weeksAgo", { n: Math.floor(seconds / WEEK) });
  return t("relTime.over30Days");
}
