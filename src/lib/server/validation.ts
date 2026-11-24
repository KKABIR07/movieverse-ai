/**
 * zod schemas for every API input. Objects are non-strict (unknown keys are stripped), and every
 * field is typed, so operator payloads such as {"$gt": ""} fail validation with 400.
 */
import { z } from 'zod';

// ─── Primitives ────────────────────────────────────────────────────────────────

/** TMDB image path, e.g. "/kqjL17yufvn9OVLyXYpvtyrFfak.jpg". */
export const TMDB_PATH_RE = /^\/[\w.-]+$/;
export const tmdbImagePath = z.string().max(200).regex(TMDB_PATH_RE, 'Invalid image path');
export const nullableImagePath = tmdbImagePath.nullable().optional().transform((v) => v ?? null);

export const tmdbId = z.number().int().positive().max(2_147_483_647);
/** Integer id from a query string ("550") */
export const tmdbIdFromString = z
  .string()
  .regex(/^\d{1,10}$/, 'Must be a positive integer')
  .transform(Number)
  .pipe(tmdbId);

export const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const mediaType = z.enum(['movie', 'tv']);

const isoDateLike = z.string().max(40).regex(/^\d{4}(-\d{2}(-\d{2})?)?/, 'Invalid date');

// ─── Auth ──────────────────────────────────────────────────────────────────────

const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address.'));

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(60, 'Name must be at most 60 characters.'),
  email,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be at most 72 characters.')
    .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password is too long.'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Email is required.').max(254),
  password: z.string().min(1, 'Password is required.').max(72),
});

// ─── AI ────────────────────────────────────────────────────────────────────────

export const aiRecommendSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1, 'No messages provided.')
    .max(20, 'At most 20 messages.'),
});

// ─── YouTube ───────────────────────────────────────────────────────────────────

export const youtubeShortsQuery = z.object({
  q: z.string().trim().min(1, 'q is required').max(100),
  n: z
    .string()
    .regex(/^\d{1,2}$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(10))
    .optional()
    .default(3),
  type: z.enum(['shorts', 'videos']).optional().default('shorts'),
});

// ─── Watchlist ─────────────────────────────────────────────────────────────────

export const WATCHLIST_MAX_ITEMS = 1000;

export const watchlistItemSchema = z.object({
  id: tmdbId,
  media_type: mediaType,
  title: z.string().trim().max(300).optional(),
  name: z.string().trim().max(300).optional(),
  poster_path: nullableImagePath,
  backdrop_path: nullableImagePath,
  vote_average: z.number().min(0).max(10).optional().default(0),
  release_date: isoDateLike.or(z.literal('')).optional(),
  first_air_date: isoDateLike.or(z.literal('')).optional(),
  addedAt: z.iso.datetime({ offset: true }).optional(),
});
export type WatchlistItemInput = z.infer<typeof watchlistItemSchema>;

export const watchlistRemoveSchema = z.object({
  id: tmdbId,
  media_type: mediaType,
});

// ─── Reviews ───────────────────────────────────────────────────────────────────

export const reviewCreateSchema = z.object({
  movieId: tmdbId,
  movieTitle: z.string().trim().min(1).max(300),
  moviePoster: nullableImagePath,
  rating: z.number().int().min(1).max(10),
  content: z.string().trim().min(1, 'Review cannot be empty.').max(2000),
  spoiler: z.boolean().optional().default(false),
});

export const reviewsQuery = z.object({ movieId: tmdbIdFromString });
export const reviewDeleteQuery = z.object({ id: objectIdString });
export const reviewLikeSchema = z.object({ id: objectIdString, like: z.boolean() });

// ─── Chat ──────────────────────────────────────────────────────────────────────

/** Must match CHAT_ROOMS in src/store/chatStore.ts */
export const CHAT_ROOM_IDS = ['general', 'movies', 'tv-shows', 'recommendations', 'spoilers'] as const;
export const chatRoomId = z.enum(CHAT_ROOM_IDS);

export const chatListQuery = z.object({
  roomId: chatRoomId.optional().default('general'),
  after: z.iso.datetime({ offset: true }).optional(),
});

export const chatPostSchema = z.object({
  roomId: chatRoomId.optional().default('general'),
  text: z.string().trim().min(1, 'Message cannot be empty.').max(500),
});

// ─── Follows ───────────────────────────────────────────────────────────────────

export const followCreateSchema = z.object({
  personId: tmdbId,
  personName: z.string().trim().min(1).max(200),
  personImage: nullableImagePath,
  department: z.string().trim().max(50).optional().default('Acting'),
});

export const followDeleteSchema = z.object({ personId: tmdbId });

export const followCountsQuery = z.object({
  ids: z
    .string()
    .max(1200)
    .regex(/^\d{1,10}(,\d{1,10})*$/, 'ids must be a comma-separated list of integers')
    .transform((s) => [...new Set(s.split(',').map(Number))])
    .pipe(z.array(tmdbId).min(1).max(100, 'At most 100 ids.')),
});
