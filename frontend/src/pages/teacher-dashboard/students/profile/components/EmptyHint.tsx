// The "nothing here yet" line inside a section. Says what will appear and
// when, so an empty card reads as "not started", not as broken.
function EmptyHint({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border-strong px-4 py-5 text-center text-sm text-ink-secondary">
      {children}
    </p>
  );
}

export default EmptyHint;
