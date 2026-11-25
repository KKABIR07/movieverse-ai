export default function Loading() {
  return (
    <div
      aria-busy="true"
      className="grid h-[calc(100dvh-var(--header-h)-var(--tabbar-h))] place-items-center px-gutter md:h-[calc(100dvh-var(--header-h))]"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="skeleton aspect-[9/16] h-[min(70dvh,640px)] max-w-[calc(100vw-32px)] rounded-hero" />
        <p role="status" className="text-caption text-fg-muted">
          Loading shorts…
        </p>
      </div>
    </div>
  );
}
