'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Play, SquarePlay, ExternalLink } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface YTVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

interface PlayerState {
  videoId: string;
  isShort: boolean;
  title: string;
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────
async function fetchYT(q: string, n: number, type: 'shorts' | 'videos'): Promise<YTVideo[]> {
  try {
    const res = await fetch(
      `/api/youtube/shorts?${new URLSearchParams({ q, n: String(n), type })}`,
    );
    if (!res.ok) return [];
    const { items } = (await res.json()) as { items?: YTVideo[]; error?: string };
    // Deduplicate by videoId (YouTube search can return duplicates)
    const seen = new Set<string>();
    return (items ?? []).filter((v) => {
      if (seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    });
  } catch {
    return [];
  }
}

// ─── Inline player modal ──────────────────────────────────────────────────────
function VideoModal({ player, onClose }: { player: PlayerState; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.9)]"
        style={
          player.isShort
            ? { width: 'min(380px, 90vw)', aspectRatio: '9/16' }
            : { width: 'min(820px, 95vw)', aspectRatio: '16/9' }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          src={`https://www.youtube.com/embed/${player.videoId}?autoplay=1&rel=0&controls=1&modestbranding=1`}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
          title={player.title}
        />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 bg-black/70 backdrop-blur-sm rounded-full text-white hover:bg-black/90 transition-colors z-10"
        >
          <X size={16} />
        </button>

        {/* Open on YouTube */}
        <a
          href={`https://www.youtube.com/watch?v=${player.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/70 backdrop-blur-sm rounded-full text-white text-xs hover:bg-red-600/80 transition-colors z-10"
        >
          <ExternalLink size={12} />
          YouTube
        </a>
      </div>

      {/* Title below modal */}
      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/60 text-center max-w-xs truncate px-4">
        {player.title}
      </p>
    </div>
  );
}

// ─── Short card (portrait 9:16) ───────────────────────────────────────────────
function ShortCard({ video, onClick }: { video: YTVideo; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-shrink-0 group" style={{ width: 110 }}>
      <div
        className="relative rounded-2xl overflow-hidden bg-[var(--bg-card)] ring-1 ring-white/10 group-hover:ring-red-500/50 transition-all duration-200 group-hover:scale-105"
        style={{ aspectRatio: '9/16' }}
      >
        {video.thumbnail ? (
          // Plain <img> — YouTube thumbnails are already CDN-optimised, no Next.js processing needed
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--bg-card)] flex items-center justify-center">
            <SquarePlay size={24} className="text-[var(--text-muted)]" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-red-600/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <Play size={16} className="text-white fill-current ml-0.5" />
          </div>
        </div>
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-red-600/90 text-[9px] font-black text-white uppercase tracking-wide">
          Short
        </div>
      </div>
      <p className="text-[10px] font-medium text-[var(--text-primary)] mt-2 line-clamp-2 group-hover:text-red-400 transition-colors text-left leading-tight">
        {video.title}
      </p>
      <p className="text-[9px] text-[var(--text-muted)] mt-0.5 truncate text-left">{video.channelTitle}</p>
    </button>
  );
}

// ─── Video card (landscape 16:9) ──────────────────────────────────────────────
function VideoCard({ video, onClick }: { video: YTVideo; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-shrink-0 group text-left" style={{ width: 220 }}>
      <div
        className="relative rounded-xl overflow-hidden bg-[var(--bg-card)] ring-1 ring-white/10 group-hover:ring-[var(--accent-primary)]/50 transition-all duration-200 group-hover:-translate-y-1"
        style={{ aspectRatio: '16/9' }}
      >
        {video.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--bg-card)] flex items-center justify-center">
            <Play size={24} className="text-[var(--text-muted)]" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-red-600/90 backdrop-blur-sm flex items-center justify-center shadow-xl">
            <Play size={18} className="text-white fill-current ml-0.5" />
          </div>
        </div>
      </div>
      <p className="text-xs font-medium text-[var(--text-primary)] mt-2 line-clamp-2 group-hover:text-[var(--accent-primary)] transition-colors leading-tight">
        {video.title}
      </p>
      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{video.channelTitle}</p>
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="mt-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-[var(--bg-card)] animate-pulse" />
        <div className="h-6 w-40 bg-[var(--bg-card)] rounded animate-pulse" />
      </div>
      <div className="flex gap-3 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`sk-short-${i}`} className="flex-shrink-0 rounded-2xl bg-[var(--bg-card)] animate-pulse" style={{ width: 110, aspectRatio: '9/16' }} />
        ))}
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`sk-video-${i}`} className="flex-shrink-0 rounded-xl bg-[var(--bg-card)] animate-pulse" style={{ width: 220, aspectRatio: '16/9' }} />
        ))}
      </div>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────
interface Props {
  /** Movie/show title or person name — used as the YouTube search base query */
  query: string;
  /** Extra context for the videos search (e.g. "official clip", "interview") */
  videoSuffix?: string;
  sectionTitle?: string;
}

export function YouTubeSection({ query, videoSuffix = 'official clip', sectionTitle = 'Videos & Shorts' }: Props) {
  const [player, setPlayer] = useState<PlayerState | null>(null);

  const { data: shorts = [], isLoading: loadingShorts } = useQuery({
    queryKey: ['yt-section-shorts', query],
    queryFn: () => fetchYT(query, 10, 'shorts'),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: videos = [], isLoading: loadingVideos } = useQuery({
    queryKey: ['yt-section-videos', query, videoSuffix],
    queryFn: () => fetchYT(`${query} ${videoSuffix}`, 8, 'videos'),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const isLoading = loadingShorts && loadingVideos;

  if (isLoading) return <Skeleton />;

  // Hide section entirely if YouTube key not configured (both return empty)
  if (!shorts.length && !videos.length) return null;

  return (
    <div className="mt-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <SquarePlay size={16} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">{sectionTitle}</h2>
        </div>
        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          YouTube
        </span>
      </div>

      {/* Shorts row */}
      {shorts.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Shorts</p>
          <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
            {shorts.map((s) => (
              <ShortCard
                key={s.videoId}
                video={s}
                onClick={() => setPlayer({ videoId: s.videoId, isShort: true, title: s.title })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Videos row */}
      {videos.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Clips & Videos</p>
          <div className="flex gap-4 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
            {videos.map((v) => (
              <VideoCard
                key={v.videoId}
                video={v}
                onClick={() => setPlayer({ videoId: v.videoId, isShort: false, title: v.title })}
              />
            ))}
          </div>
        </div>
      )}

      {player && <VideoModal player={player} onClose={() => setPlayer(null)} />}
    </div>
  );
}
