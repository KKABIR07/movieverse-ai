'use client';

import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, type Toast } from '@/store/toastStore';
import { cn } from './cn';

export { toast, useToastStore, type ToastInput, type ToastTone } from '@/store/toastStore';

const toneIcon = {
  neutral: <Info aria-hidden className="size-5 text-fg-muted" />,
  success: <CheckCircle2 aria-hidden className="size-5 text-success" />,
  danger: <AlertCircle aria-hidden className="size-5 text-danger" />,
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    if (!t.duration) return;
    const timer = setTimeout(() => dismiss(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, dismiss]);

  return (
    <li
      role={t.tone === 'danger' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-card border border-line bg-surface-2 px-4 py-3 shadow-pop animate-rise-in"
    >
      {toneIcon[t.tone]}
      <div className="min-w-0 flex-1">
        <p className="text-caption font-semibold text-fg">{t.title}</p>
        {t.description && <p className="text-caption text-fg-muted mt-0.5">{t.description}</p>}
      </div>
      {t.action && (
        <button
          type="button"
          onClick={() => {
            t.action?.onClick();
            dismiss(t.id);
          }}
          className="shrink-0 h-8 rounded-chip px-2 text-caption font-semibold text-accent hover:bg-surface-3"
        >
          {t.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(t.id)}
        className="shrink-0 -mr-1 grid size-8 place-items-center rounded-chip text-fg-muted hover:text-fg hover:bg-surface-3"
      >
        <X aria-hidden className="size-4" />
      </button>
    </li>
  );
}

/**
 * Mounted once by <Providers>. Fire toasts with `toast({ title, tone })` from anywhere.
 * Sits above the mobile tab bar.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[250] flex justify-center px-4',
        'bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+12px)] md:bottom-6 md:justify-end md:px-6',
      )}
    >
      <ol className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </ol>
    </div>
  );
}
