'use client';

import { useId, useMemo, useState } from 'react';
import { Copy, Share2 } from 'lucide-react';
import type { WatchlistItem } from '@/types/tmdb';
import { encodeShare, SHARE_MAX_ITEMS } from '@/lib/sync/shareLink';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { copyText } from '@/components/detail/ShareButton';
import { toast } from '@/store/toastStore';

/**
 * Build a share link for the watchlist. The list travels inside the link (unicode-safe base64url,
 * validated on open); nothing is uploaded and the link never contains account data.
 */
export function ShareListDialog({ open, onClose, items }: { open: boolean; onClose: () => void; items: readonly WatchlistItem[] }) {
  const [name, setName] = useState('My watchlist');
  const nameId = useId();
  const linkId = useId();

  const share = useMemo(() => {
    if (!open || typeof window === 'undefined') return null;
    try {
      const { code, truncated } = encodeShare(items, name);
      return { url: `${window.location.origin}/watchlist/share?d=${code}`, truncated };
    } catch {
      return null;
    }
  }, [open, items, name]);

  const copy = async () => {
    if (!share) return;
    if (await copyText(share.url)) toast({ title: 'Link copied', description: `${Math.min(items.length, SHARE_MAX_ITEMS)} titles`, tone: 'success' });
    else toast({ title: "Couldn't copy the link", description: 'Select the link and copy it manually.', tone: 'danger' });
  };

  const nativeShare = async () => {
    if (!share || typeof navigator.share !== 'function') return;
    try {
      await navigator.share({ title: name || 'Watchlist', url: share.url });
    } catch {
      /* dismissed */
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Share your watchlist"
      description="Anyone with the link can see these titles. Your name and account are not included."
      size="md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <Button variant="secondary" leadingIcon={<Share2 />} onClick={nativeShare} disabled={!share}>
              Share…
            </Button>
          )}
          <Button leadingIcon={<Copy />} onClick={copy} disabled={!share}>
            Copy link
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor={nameId} className="mb-1.5 block text-caption font-medium text-fg">
            List name
          </label>
          <input
            id={nameId}
            data-autofocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className="h-11 w-full rounded-control border border-line bg-surface-1 px-4 text-body text-fg hover:border-line-strong focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor={linkId} className="mb-1.5 block text-caption font-medium text-fg">
            Link
          </label>
          <input
            id={linkId}
            readOnly
            value={share?.url ?? 'Could not create a link.'}
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 w-full truncate rounded-control border border-line bg-surface-2 px-4 font-mono text-caption text-fg-secondary"
          />
        </div>
        {share?.truncated && (
          <p role="status" className="text-caption text-fg-secondary">
            Links hold up to {SHARE_MAX_ITEMS} titles, so only your {SHARE_MAX_ITEMS} most recently added are included.
          </p>
        )}
      </div>
    </Dialog>
  );
}
