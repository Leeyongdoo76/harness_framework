import { t } from "@/lib/copy";

type Props = { reason: "commentsDisabled" | "noComments" };

export default function EmptyState({ reason }: Props): JSX.Element {
  const title =
    reason === "commentsDisabled"
      ? t("empty.commentsDisabledTitle")
      : t("empty.noCommentsTitle");
  const body =
    reason === "commentsDisabled"
      ? t("empty.commentsDisabledBody")
      : t("empty.noCommentsBody");

  return (
    <section className="max-w-5xl mx-auto px-6 py-10 text-center space-y-2">
      <h2 className="text-lg font-medium text-white">{title}</h2>
      <p className="text-sm text-neutral-400">{body}</p>
    </section>
  );
}
