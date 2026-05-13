type Props = {
  politeMessage?: string;
  assertiveMessage?: string;
};

export default function AriaLive({
  politeMessage,
  assertiveMessage,
}: Props): JSX.Element {
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {politeMessage ?? ""}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveMessage ?? ""}
      </div>
    </>
  );
}
