'use client';

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from './cn';
import { useHydrated } from '@/lib/hooks/useHydrated';

const FOCUSABLE =
  'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getClientRects().length > 0,
  );
}

// Reference-counted body scroll lock so stacked dialogs behave.
let lockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';
function lockScroll() {
  if (lockCount++ > 0) return;
  const body = document.body;
  savedOverflow = body.style.overflow;
  savedPaddingRight = body.style.paddingRight;
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  body.style.overflow = 'hidden';
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
}
function unlockScroll() {
  if (--lockCount > 0) return;
  lockCount = 0;
  document.body.style.overflow = savedOverflow;
  document.body.style.paddingRight = savedPaddingRight;
}

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Accessible title (required). Visually hidden with `hideTitle`. */
  title: ReactNode;
  hideTitle?: boolean;
  description?: ReactNode;
  children?: ReactNode;
  /** Footer row (buttons). */
  footer?: ReactNode;
  size?: DialogSize;
  /** 'center' (default) or 'top' (command palette style). On phones 'sheet' docks to the bottom. */
  placement?: 'center' | 'top' | 'sheet';
  /** Element to focus on open. Default: an element with data-autofocus, else the first focusable in the body. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Show the built-in close button (default true). */
  showClose?: boolean;
  /** Close when the backdrop is clicked (default true). */
  closeOnBackdrop?: boolean;
  className?: string;
  /** Classes for the scrollable body (replaces the default 'px-5 pb-5' padding). */
  bodyClassName?: string;
}

const sizes: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Accessible modal: role="dialog", aria-modal, labelled by its title, focus trap,
 * focus returns to the opener, Esc closes, body scroll locked, rendered in a portal.
 * @example
 * <Dialog open={open} onClose={() => setOpen(false)} title="Sign in" footer={<Button>Continue</Button>}>
 *   …form…
 * </Dialog>
 */
export function Dialog({
  open,
  onClose,
  title,
  hideTitle,
  description,
  children,
  footer,
  size = 'md',
  placement = 'center',
  initialFocusRef,
  showClose = true,
  closeOnBackdrop = true,
  className,
  bodyClassName,
}: DialogProps) {
  const hydrated = useHydrated();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || !hydrated) return;
    const opener = document.activeElement as HTMLElement | null;
    lockScroll();

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const body = panel.querySelector<HTMLElement>('[data-dialog-body]');
      const target =
        initialFocusRef?.current ??
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        (body && focusables(body)[0]) ??
        focusables(panel)[0] ??
        panel;
      target.focus({ preventScroll: true });
    });

    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables(panel);
      if (!items.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      unlockScroll();
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, hydrated, initialFocusRef]);

  if (!open || !hydrated) return null;

  const placementWrap =
    placement === 'top'
      ? 'items-start pt-[max(16px,10vh)]'
      : placement === 'sheet'
        ? 'items-end sm:items-center'
        : 'items-center';

  return createPortal(
    <div className={cn('fixed inset-0 z-[200] flex justify-center px-4 py-4', placementWrap)}>
      <div
        aria-hidden
        className="absolute inset-0 bg-ground/80 backdrop-blur-sm animate-fade-in"
        onClick={closeOnBackdrop ? () => onCloseRef.current() : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex w-full flex-col max-h-[calc(100dvh-32px)] overflow-hidden',
          'bg-surface-1 border border-line rounded-panel shadow-pop animate-rise-in outline-none',
          placement === 'sheet' && 'max-sm:rounded-b-none max-sm:-mb-4 max-sm:pb-[env(safe-area-inset-bottom)]',
          sizes[size],
          className,
        )}
      >
        {hideTitle ? (
          <>
            <div className="sr-only">
              <h2 id={titleId}>{title}</h2>
              {description && <p id={descId}>{description}</p>}
            </div>
            {showClose && (
              <IconButton
                label="Close dialog"
                icon={<X />}
                size="sm"
                onClick={() => onCloseRef.current()}
                className="absolute right-3 top-3 z-10"
              />
            )}
          </>
        ) : (
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-h3 text-fg">
                {title}
              </h2>
              {description && (
                <p id={descId} className="text-caption text-fg-muted mt-1">
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <IconButton
                label="Close dialog"
                icon={<X />}
                size="sm"
                onClick={() => onCloseRef.current()}
                className="-mr-2 -mt-1"
              />
            )}
          </div>
        )}
        <div data-dialog-body className={cn('min-h-0 flex-1 overflow-y-auto', bodyClassName ?? 'px-5 pb-5')}>
          {children}
        </div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
