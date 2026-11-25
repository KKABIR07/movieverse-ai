'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { checkYouTubeKey, fetchYouTubeVideos } from '@/lib/youtube';
import { VideoGrid } from '@/components/detail/Videos';

export interface YouTubeSectionProps {
  /** Search phrase, e.g. "Fight Club 1999". */
  query: string;
  title: string;
}

/**
 * Extra clips from YouTube search. Costs YouTube quota, so nothing is requested until the
 * user asks (button), and results are cached by the server (24h) and the client session.
 * Hidden entirely when the server has no YouTube key.
 */
export function YouTubeSection({ query, title }: YouTubeSectionProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    let alive = true;
    void checkYouTubeKey().then((ok) => alive && setConfigured(ok));
    return () => {
      alive = false;
    };
  }, []);

  const q = useQuery({
    queryKey: ['yt-videos', query],
    queryFn: () => fetchYouTubeVideos(`${query} official clip`, 6),
    enabled: requested && configured === true,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  if (configured !== true) return null;

  return (
    <section aria-labelledby="yt-more" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="yt-more" className="text-h2 text-fg">
            More on YouTube
          </h2>
          <p className="mt-1 text-caption text-fg-muted">Search results for {title}. Videos play from youtube-nocookie.com.</p>
        </div>
        {!requested && (
          <Button variant="secondary" size="sm" leadingIcon={<Search />} onClick={() => setRequested(true)}>
            Find clips
          </Button>
        )}
      </div>
      {requested &&
        (q.isPending ? (
          <p className="text-caption text-fg-muted" role="status">
            Searching YouTube…
          </p>
        ) : q.isError || !q.data ? (
          <ErrorState compact title="YouTube search is unavailable" description="The daily search quota may be used up. Try again later." />
        ) : q.data.length === 0 ? (
          <p className="text-caption text-fg-muted">No clips found.</p>
        ) : (
          <VideoGrid videos={q.data.map((v) => ({ key: v.videoId, name: v.title, type: v.channelTitle }))} />
        ))}
    </section>
  );
}
