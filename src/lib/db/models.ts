import mongoose, { Schema, model, models, type Model, type Types } from 'mongoose';

// NOTE: each index is declared exactly once (field-level `unique` OR schema.index, never both).

// ─── User ────────────────────────────────────────────────────────────────────
export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  avatar: string | null;
  initials: string;
  /** Incremented to revoke every JWT issued before (logout-all / password change). */
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    avatar: { type: String, default: null },
    initials: { type: String, required: true, maxlength: 4 },
    tokenVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// ─── Review ──────────────────────────────────────────────────────────────────
export interface IReview {
  _id: Types.ObjectId;
  movieId: number;
  movieTitle: string;
  moviePoster: string | null;
  userId: Types.ObjectId;
  userName: string;
  userInitials: string;
  rating: number;
  content: string;
  spoiler: boolean;
  /** user ids (string) who liked the review — never exposed; clients get likeCount / likedByMe */
  likedBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    movieId: { type: Number, required: true, min: 1 },
    movieTitle: { type: String, required: true, maxlength: 300 },
    moviePoster: { type: String, default: null, maxlength: 200 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true, maxlength: 60 },
    userInitials: { type: String, required: true, maxlength: 4 },
    rating: { type: Number, required: true, min: 1, max: 10 },
    content: { type: String, required: true, maxlength: 2000 },
    spoiler: { type: Boolean, default: false },
    likedBy: { type: [String], default: [] },
  },
  { timestamps: true },
);

ReviewSchema.index({ movieId: 1, createdAt: -1 });
ReviewSchema.index({ movieId: 1, userId: 1 }, { unique: true }); // one review per user per movie
ReviewSchema.index({ userId: 1 });

// ─── Watchlist ────────────────────────────────────────────────────────────────
export interface IWatchlistItem {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  addedAt: string;
}

const WatchlistItemSchema = new Schema<IWatchlistItem>(
  {
    id: { type: Number, required: true },
    media_type: { type: String, enum: ['movie', 'tv'], required: true },
    title: { type: String, maxlength: 300 },
    name: { type: String, maxlength: 300 },
    poster_path: { type: String, default: null },
    backdrop_path: { type: String, default: null },
    vote_average: { type: Number, default: 0 },
    release_date: { type: String },
    first_air_date: { type: String },
    addedAt: { type: String, required: true },
  },
  { _id: false },
);

export interface IWatchlist {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  items: IWatchlistItem[];
}

const WatchlistSchema = new Schema<IWatchlist>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: { type: [WatchlistItemSchema], default: [] },
});

// ─── Chat Message ─────────────────────────────────────────────────────────────
export const CHAT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface IChatMessage {
  _id: Types.ObjectId;
  roomId: string;
  userId: Types.ObjectId;
  userName: string;
  userInitials: string;
  color: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    roomId: { type: String, required: true, maxlength: 40 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true, maxlength: 60 },
    userInitials: { type: String, required: true, maxlength: 4 },
    color: { type: String, required: true, maxlength: 16 },
    text: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: true },
);

ChatMessageSchema.index({ roomId: 1, createdAt: -1 });
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: CHAT_TTL_SECONDS });

// ─── Follow ───────────────────────────────────────────────────────────────────
export interface IFollow {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  personId: number;
  personName: string;
  personImage: string | null;
  department: string;
  followedAt: Date;
}

const FollowSchema = new Schema<IFollow>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  personId: { type: Number, required: true, min: 1 },
  personName: { type: String, required: true, maxlength: 200 },
  personImage: { type: String, default: null, maxlength: 200 },
  department: { type: String, default: 'Acting', maxlength: 50 },
  followedAt: { type: Date, default: Date.now },
});

FollowSchema.index({ userId: 1, personId: 1 }, { unique: true });
FollowSchema.index({ personId: 1 });
FollowSchema.index({ userId: 1, followedAt: -1 });

// ─── YouTube search cache ─────────────────────────────────────────────────────
export const YOUTUBE_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export interface IYoutubeCacheItem {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

export interface IYoutubeCache {
  _id: Types.ObjectId;
  key: string;
  items: IYoutubeCacheItem[];
  createdAt: Date;
}

const YoutubeCacheSchema = new Schema<IYoutubeCache>({
  key: { type: String, required: true, unique: true, maxlength: 200 },
  items: {
    type: [
      new Schema<IYoutubeCacheItem>(
        { videoId: String, title: String, channelTitle: String, thumbnail: String },
        { _id: false },
      ),
    ],
    default: [],
  },
  createdAt: { type: Date, default: Date.now, expires: YOUTUBE_CACHE_TTL_SECONDS },
});

// ─── Exports (avoid model re-registration in dev hot-reload) ──────────────────
function getModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (models[name] as Model<T> | undefined) ?? model<T>(name, schema);
}

export const User = getModel<IUser>('User', UserSchema);
export const Review = getModel<IReview>('Review', ReviewSchema);
export const Watchlist = getModel<IWatchlist>('Watchlist', WatchlistSchema);
export const ChatMessage = getModel<IChatMessage>('ChatMessage', ChatMessageSchema);
export const Follow = getModel<IFollow>('Follow', FollowSchema);
export const YoutubeCache = getModel<IYoutubeCache>('YoutubeCache', YoutubeCacheSchema);

export { mongoose };
