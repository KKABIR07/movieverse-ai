'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { Button, type ButtonSize } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/components/ui/cn';
import { formatDate } from '@/lib/format';

export interface VideoRef {
  key: string;
  name: string;
  type?: string;
  published_at?: string;
}

const thumb = (key: string) => `https://i.ytimg.com/vi/${encodeURIComponent(key)}/hqdefault.jpg`;

/**
 * Privacy-friendly YouTube player: the iframe (youtube-nocookie) only exists while the dialog
 * is open, i.e. after the user clicked. Nothing from YouTube loads before that.
 */
export function VideoDialog({ video, onClose }: { video: VideoRef | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!video}
      onClose={onClose}
      title={video?.name ?? 'Video'}
      size="xl"
      bodyClassName="p-0"
      footer={
        video ? (
          <a
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.key)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-caption text-fg-muted hover:text-fg"
          >
            Watch on YouTube <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null
      }
    >
      {video && (
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.key)}?autoplay=1&rel=0&playsinline=1`}
            title={video.name}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      )}
    </Dialog>
  );
}

/** Primary "Trailer" CTA. Renders nothing when there is no trailer. */
export function TrailerButton({ video, size = 'lg', className }: { video: VideoRef | null; size?: ButtonSize; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!video) return null;
  return (
    <>
      <Button size={size} leadingIcon={<Play className="fill-current" />} onClick={() => setOpen(true)} className={className}>
        Trailer
      </Button>
      <VideoDialog video={open ? video : null} onClose={() => setOpen(false)} />
    </>
  );
}

/** Thumbnail grid; clicking one opens the player. Thumbnails come from i.ytimg.com (image only, no script). */
export function VideoGrid({ videos, className }: { videos: VideoRef[]; className?: string }) {
  const [playing, setPlaying] = useState<VideoRef | null>(null);
  if (!videos.length) return null;
  return (
    <>
      <ul className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}>
        {videos.map((v) => (
          <li key={v.key}>
            <button
              type="button"
              onClick={() => setPlaying(v)}
              className="group block w-full rounded-card text-left outline-offset-4"
              aria-label={`Play ${v.name}`}
            >
              <span className="relative block aspect-video overflow-hidden rounded-card bg-surface-2 ring-1 ring-line">
                <Image src={thumb(v.key)} alt="" fill unoptimized sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 92vw" className="object-cover transition-transform duration-320 ease-projector group-hover:scale-[1.03]" />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span aria-hidden className="absolute left-3 bottom-3 grid size-11 place-items-center rounded-full bg-accent text-on-accent shadow-card">
                  <Play className="size-5 translate-x-px fill-current" />
                </span>
              </span>
              <span className="mt-2 block line-clamp-2 text-caption font-medium text-fg">{v.name}</span>
              <span className="block text-micro text-fg-muted">
                {[v.type, v.published_at ? formatDate(v.published_at) : null].filter(Boolean).join(' · ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <VideoDialog video={playing} onClose={() => setPlaying(null)} />
    </>
  );
}
