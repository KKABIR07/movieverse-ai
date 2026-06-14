import { NextRequest, NextResponse } from 'next/server';

const KEY = process.env.YOUTUBE_API_KEY ?? '';

export interface YTShortItem {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const n = Math.min(parseInt(searchParams.get('n') ?? '3', 10), 10);

  if (!q) return NextResponse.json({ items: [] });

  if (!KEY || KEY === 'your_youtube_api_key_here') {
    return NextResponse.json({ error: 'NO_KEY', items: [] }, { status: 503 });
  }

  // type=shorts → #shorts tag + short duration filter (default)
  // type=videos → raw query, any duration (clips, interviews, behind-the-scenes)
  const type = searchParams.get('type') ?? 'shorts';
  const searchQuery = type === 'shorts' ? `${q} #shorts` : q;

  const ytParams: Record<string, string> = {
    part: 'snippet',
    q: searchQuery,
    type: 'video',
    maxResults: String(n),
    relevanceLanguage: 'en',
    key: KEY,
  };
  if (type === 'shorts') ytParams.videoDuration = 'short';

  const url = `https://www.googleapis.com/youtube/v3/search?` + new URLSearchParams(ytParams);

  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 }, // cache 24h at edge
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: { message?: string } };
      console.error('[YouTube API]', res.status, err?.error?.message);
      return NextResponse.json({ items: [] }, { status: res.status });
    }

    const data = (await res.json()) as {
      items?: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          thumbnails: {
            high?: { url: string };
            medium?: { url: string };
            default?: { url: string };
          };
        };
      }>;
    };

    const items: YTShortItem[] = (data.items ?? [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail:
          item.snippet.thumbnails?.high?.url ??
          item.snippet.thumbnails?.medium?.url ??
          item.snippet.thumbnails?.default?.url ??
          '',
      }));

    return NextResponse.json({ items });
  } catch (e) {
    console.error('[YouTube API] fetch error', e);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}
