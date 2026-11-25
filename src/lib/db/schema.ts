/**
 * PostgreSQL schema (Drizzle pg-core). Single source of truth for the SQL migrations in
 * drizzle/migrations (generate with `npx drizzle-kit generate`, never edit applied migrations).
 *
 * Design notes
 *  - CHECK constraints mirror the zod limits in src/lib/server/validation.ts, so the database
 *    enforces the same bounds even for code paths that bypass validation.
 *  - Every timestamp is timestamptz(3): millisecond precision matches JS Dates, so an ISO string
 *    returned to a client round-trips exactly (the chat `after` cursor relies on this).
 *  - Indexes are kept to the minimum the queries need (5 GB total disk budget incl. backups).
 *  - No extensions: gen_random_uuid() is built in (PG13+); emails are stored lower-cased
 *    (CHECK) with a plain unique index instead of citext.
 *  - Child rows cascade on user delete.
 *
 * Import relatively (no "@/") so drizzle-kit can load this file without path aliases.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { CHAT_ROOM_IDS } from '../server/validation';

const ts = (name: string) => timestamp(name, { withTimezone: true, precision: 3, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();
/** SQL literal list of constant (code-owned) values, e.g. ('a', 'b'). Never user input. */
const literalList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', '));
const maxLen = (col: unknown, n: number) => sql`char_length(${col}) <= ${sql.raw(String(n))}`;

// ─── users ────────────────────────────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    avatar: text('avatar'),
    initials: text('initials').notNull(),
    /** Incremented to revoke every JWT issued before (logout-all / password change). */
    tokenVersion: integer('token_version').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    unique('users_email_key').on(t.email),
    check('users_email_ck', sql`${t.email} = lower(${t.email}) and char_length(${t.email}) between 3 and 254`),
    check('users_name_ck', sql`char_length(${t.name}) between 1 and 60`),
    check('users_initials_ck', maxLen(t.initials, 4)),
    check('users_avatar_ck', maxLen(t.avatar, 500)),
    check('users_password_hash_ck', maxLen(t.passwordHash, 255)),
    check('users_token_version_ck', sql`${t.tokenVersion} >= 0`),
  ],
);

// ─── reviews ──────────────────────────────────────────────────────────────────
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    movieId: integer('movie_id').notNull(),
    movieTitle: text('movie_title').notNull(),
    moviePoster: text('movie_poster'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: smallint('rating').notNull(),
    content: text('content').notNull(),
    spoiler: boolean('spoiler').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // One review per user per movie. user_id leads so the index also serves the FK cascade.
    unique('reviews_user_movie_key').on(t.userId, t.movieId),
    index('reviews_movie_created_idx').on(t.movieId, t.createdAt.desc()),
    check('reviews_movie_id_ck', sql`${t.movieId} > 0`),
    check('reviews_rating_ck', sql`${t.rating} between 1 and 10`),
    check('reviews_content_ck', sql`char_length(${t.content}) between 1 and 2000`),
    check('reviews_movie_title_ck', sql`char_length(${t.movieTitle}) between 1 and 300`),
    check('reviews_movie_poster_ck', maxLen(t.moviePoster, 200)),
  ],
);

export const reviewLikes = pgTable(
  'review_likes',
  {
    reviewId: uuid('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ name: 'review_likes_pkey', columns: [t.reviewId, t.userId] })],
);

// ─── watchlist ────────────────────────────────────────────────────────────────
export const MEDIA_TYPES = ['movie', 'tv'] as const;

export const watchlistItems = pgTable(
  'watchlist_items',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mediaType: text('media_type', { enum: MEDIA_TYPES }).notNull(),
    tmdbId: integer('tmdb_id').notNull(),
    title: text('title'),
    name: text('name'),
    posterPath: text('poster_path'),
    backdropPath: text('backdrop_path'),
    voteAverage: real('vote_average').notNull().default(0),
    releaseDate: text('release_date'),
    firstAirDate: text('first_air_date'),
    addedAt: ts('added_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'watchlist_items_pkey', columns: [t.userId, t.mediaType, t.tmdbId] }),
    index('watchlist_items_user_added_idx').on(t.userId, t.addedAt.desc()),
    check('watchlist_media_type_ck', sql`${t.mediaType} in (${literalList(MEDIA_TYPES)})`),
    check('watchlist_tmdb_id_ck', sql`${t.tmdbId} > 0`),
    check('watchlist_vote_average_ck', sql`${t.voteAverage} between 0 and 10`),
    check('watchlist_title_ck', maxLen(t.title, 300)),
    check('watchlist_name_ck', maxLen(t.name, 300)),
    check('watchlist_poster_path_ck', maxLen(t.posterPath, 200)),
    check('watchlist_backdrop_path_ck', maxLen(t.backdropPath, 200)),
    check('watchlist_release_date_ck', maxLen(t.releaseDate, 40)),
    check('watchlist_first_air_date_ck', maxLen(t.firstAirDate, 40)),
  ],
);

// ─── chat ─────────────────────────────────────────────────────────────────────
export const CHAT_RETENTION_DAYS = 30;

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: text('room_id', { enum: CHAT_ROOM_IDS }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userName: text('user_name').notNull(),
    userInitials: text('user_initials').notNull(),
    color: text('color').notNull(),
    text: text('text').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('chat_messages_room_created_idx').on(t.roomId, t.createdAt),
    check('chat_room_id_ck', sql`${t.roomId} in (${literalList(CHAT_ROOM_IDS)})`),
    check('chat_text_ck', sql`char_length(${t.text}) between 1 and 500`),
    check('chat_user_name_ck', maxLen(t.userName, 60)),
    check('chat_user_initials_ck', maxLen(t.userInitials, 4)),
    check('chat_color_ck', maxLen(t.color, 16)),
  ],
);

// ─── follows ──────────────────────────────────────────────────────────────────
export const follows = pgTable(
  'follows',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    personId: integer('person_id').notNull(),
    personName: text('person_name').notNull(),
    personImage: text('person_image'),
    department: text('department').notNull().default('Acting'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: 'follows_pkey', columns: [t.userId, t.personId] }),
    index('follows_person_idx').on(t.personId),
    check('follows_person_id_ck', sql`${t.personId} > 0`),
    check('follows_person_name_ck', sql`char_length(${t.personName}) between 1 and 200`),
    check('follows_person_image_ck', maxLen(t.personImage, 200)),
    check('follows_department_ck', maxLen(t.department, 50)),
  ],
);

// ─── YouTube search cache ─────────────────────────────────────────────────────
export const YOUTUBE_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export interface YoutubeCacheItem {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

export const youtubeCache = pgTable(
  'youtube_cache',
  {
    key: text('key').primaryKey(),
    payload: jsonb('payload').$type<YoutubeCacheItem[]>().notNull(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [index('youtube_cache_expires_idx').on(t.expiresAt), check('youtube_cache_key_ck', maxLen(t.key, 200))],
);

export type UserRow = typeof users.$inferSelect;
export type ReviewRow = typeof reviews.$inferSelect;
export type WatchlistItemRow = typeof watchlistItems.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type FollowRow = typeof follows.$inferSelect;
