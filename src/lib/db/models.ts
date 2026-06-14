import mongoose, { Schema, model, models, type Document } from 'mongoose';

// ─── User ────────────────────────────────────────────────────────────────────
export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  avatar: string | null;
  initials: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatar:       { type: String, default: null },
    initials:     { type: String, required: true },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 });

// ─── Review ──────────────────────────────────────────────────────────────────
export interface IReview extends Document {
  movieId: number;
  movieTitle: string;
  moviePoster: string | null;
  userId: mongoose.Types.ObjectId;
  userName: string;
  userInitials: string;
  rating: number;
  content: string;
  spoiler: boolean;
  likes: number;
  likedBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    movieId:      { type: Number, required: true, index: true },
    movieTitle:   { type: String, required: true },
    moviePoster:  { type: String, default: null },
    userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName:     { type: String, required: true },
    userInitials: { type: String, required: true },
    rating:       { type: Number, required: true, min: 1, max: 10 },
    content:      { type: String, required: true, maxlength: 2000 },
    spoiler:      { type: Boolean, default: false },
    likes:        { type: Number, default: 0 },
    likedBy:      { type: [String], default: [] },
  },
  { timestamps: true }
);

ReviewSchema.index({ movieId: 1, createdAt: -1 });
ReviewSchema.index({ userId: 1 });

// ─── Watchlist ────────────────────────────────────────────────────────────────
export interface IWatchlistItem {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  media_type: 'movie' | 'tv';
  addedAt: string;
}

export interface IWatchlist extends Document {
  userId: mongoose.Types.ObjectId;
  items: IWatchlistItem[];
}

const WatchlistSchema = new Schema<IWatchlist>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items:  { type: Schema.Types.Mixed, default: [] },
});

WatchlistSchema.index({ userId: 1 });

// ─── Chat Message ─────────────────────────────────────────────────────────────
export interface IChatMessage extends Document {
  roomId: string;
  userId: mongoose.Types.ObjectId;
  userName: string;
  userInitials: string;
  color: string;
  text: string;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    roomId:       { type: String, required: true, index: true },
    userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName:     { type: String, required: true },
    userInitials: { type: String, required: true },
    color:        { type: String, required: true },
    text:         { type: String, required: true, maxlength: 500 },
  },
  { timestamps: true }
);

ChatMessageSchema.index({ roomId: 1, createdAt: -1 });

// ─── Follow ───────────────────────────────────────────────────────────────────
export interface IFollow extends Document {
  userId: mongoose.Types.ObjectId;
  personId: number;
  personName: string;
  personImage: string | null;
  department: string;
  followedAt: Date;
}

const FollowSchema = new Schema<IFollow>({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  personId:    { type: Number, required: true },
  personName:  { type: String, required: true },
  personImage: { type: String, default: null },
  department:  { type: String, default: 'Acting' },
  followedAt:  { type: Date, default: Date.now },
});

FollowSchema.index({ userId: 1, personId: 1 }, { unique: true });
FollowSchema.index({ personId: 1 });

// ─── Exports (avoid model re-registration in dev hot-reload) ──────────────────
export const User        = models.User        || model<IUser>('User', UserSchema);
export const Review      = models.Review      || model<IReview>('Review', ReviewSchema);
export const Watchlist   = models.Watchlist   || model<IWatchlist>('Watchlist', WatchlistSchema);
export const ChatMessage = models.ChatMessage || model<IChatMessage>('ChatMessage', ChatMessageSchema);
export const Follow      = models.Follow      || model<IFollow>('Follow', FollowSchema);
