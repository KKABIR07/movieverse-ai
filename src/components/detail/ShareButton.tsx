'use client';

import { Share2 } from 'lucide-react';
import { IconButton, type IconButtonSize } from '@/components/ui/IconButton';
import { toast } from '@/store/toastStore';

export interface ShareButtonProps {
  title: string;
  text?: string;
  /** Path or absolute URL; defaults to the current page. */
  url?: string;
  size?: IconButtonSize;
  className?: string;
}

/** Copy text to the clipboard with a legacy fallback. Resolves false when both fail. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Share a link: Web Share API where available, clipboard otherwise (with a toast). */
export async function shareLink({ title, text, url }: { title: string; text?: string; url: string }): Promise<void> {
  const absolute = new URL(url, window.location.href).toString();
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url: absolute });
      return;
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return; // user dismissed the sheet
    }
  }
  if (await copyText(absolute)) toast({ title: 'Link copied', description: title, tone: 'success' });
  else toast({ title: "Couldn't copy the link", description: absolute, tone: 'danger', duration: 8000 });
}

export function ShareButton({ title, text, url, size = 'md', className }: ShareButtonProps) {
  return (
    <IconButton
      label={`Share ${title}`}
      icon={<Share2 />}
      variant="secondary"
      size={size}
      className={className}
      onClick={() => void shareLink({ title, text, url: url ?? window.location.href })}
    />
  );
}
