export interface YTShort {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  /** Which movie this short is associated with */
  relatedMovie: string;
  relatedMovieId: number;
  relatedMoviePoster: string | null;
  relatedMovieRating: number;
  relatedMovieType: 'movie' | 'tv';
  relatedMovieDate?: string;
}

const cache = new Map<string, Pick<YTShort, 'videoId' | 'title' | 'channelTitle' | 'thumbnail'>[]>();

async function searchYT(
  movieTitle: string,
  n: number,
): Promise<Pick<YTShort, 'videoId' | 'title' | 'channelTitle' | 'thumbnail'>[]> {
  if (cache.has(movieTitle)) return cache.get(movieTitle)!;

  try {
    const res = await fetch(
      `/api/youtube/shorts?${new URLSearchParams({ q: movieTitle, n: String(n) })}`,
    );
    if (!res.ok) return [];
    const { items } = (await res.json()) as {
      items?: Pick<YTShort, 'videoId' | 'title' | 'channelTitle' | 'thumbnail'>[];
      error?: string;
    };
    const result = items ?? [];
    cache.set(movieTitle, result);
    return result;
  } catch {
    return [];
  }
}

export async function fetchMovieShorts(
  movie: {
    title: string;
    id: number;
    poster_path: string | null;
    vote_average: number;
    type: 'movie' | 'tv';
    date?: string;
  },
  n = 3,
): Promise<YTShort[]> {
  const items = await searchYT(movie.title, n);
  return items.map((item) => ({
    ...item,
    relatedMovie: movie.title,
    relatedMovieId: movie.id,
    relatedMoviePoster: movie.poster_path,
    relatedMovieRating: movie.vote_average,
    relatedMovieType: movie.type,
    relatedMovieDate: movie.date,
  }));
}

/** Returns true if YOUTUBE_API_KEY is configured (detected via API response) */
export async function checkYouTubeKey(): Promise<boolean> {
  try {
    const res = await fetch('/api/youtube/shorts?q=test&n=1');
    if (res.status === 503) return false;
    return res.ok;
  } catch {
    return false;
  }
}
