'use client';

import { useState } from 'react';
import { Heart, Trash2, Edit, AlertTriangle } from 'lucide-react';
import { useReviewsStore, useRatingsStore } from '@/store';
import { StarRating } from '@/components/ui/StarRating';
import type { Movie } from '@/types/tmdb';

interface ReviewSectionProps {
  movie: Movie;
}

export function ReviewSection({ movie }: ReviewSectionProps) {
  const { reviews, addReview, deleteReview, likeReview, getMovieReviews } = useReviewsStore();
  const { rate, getRating } = useRatingsStore();

  const [rating, setRating] = useState(getRating(movie.id) ?? 0);
  const [content, setContent] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());

  const movieReviews = getMovieReviews(movie.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || rating === 0) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 300));
    if (editId) {
      useReviewsStore.getState().updateReview(editId, { content, rating, spoiler });
      setEditId(null);
    } else {
      addReview({
        movieId: movie.id,
        movieTitle: movie.title,
        moviePoster: movie.poster_path,
        rating,
        content,
        spoiler,
      });
    }
    rate(movie.id, rating);
    setContent('');
    setSpoiler(false);
    setSubmitting(false);
  };

  const startEdit = (review: (typeof reviews)[0]) => {
    setEditId(review.id);
    setContent(review.content);
    setRating(review.rating);
    setSpoiler(review.spoiler);
    document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleSpoiler = (id: string) => {
    setRevealedSpoilers((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      {/* Write a review */}
      <div id="review-form" className="glass rounded-2xl p-6">
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-5">
          {editId ? 'Edit Review' : 'Write a Review'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rating picker */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Your Rating</label>
            <div className="flex items-center gap-4">
              <StarRating
                value={rating}
                max={10}
                size={24}
                interactive
                onChange={(r) => setRating(r)}
              />
              <span className="text-lg font-bold text-[var(--accent-gold)]">{rating > 0 ? `${rating}/10` : '—'}</span>
            </div>
          </div>

          {/* Review text */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Your Review</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts about this movie..."
              rows={5}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] resize-none transition-colors"
              maxLength={2000}
            />
            <div className="flex justify-between mt-1">
              <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={spoiler}
                  onChange={(e) => setSpoiler(e.target.checked)}
                  className="accent-[var(--accent-primary)]"
                />
                <AlertTriangle size={14} />
                Contains spoilers
              </label>
              <span className="text-xs text-[var(--text-muted)]">{content.length}/2000</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || !content.trim() || rating === 0}
              className="px-6 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {submitting ? 'Saving...' : editId ? 'Update Review' : 'Post Review'}
            </button>
            {editId && (
              <button
                type="button"
                onClick={() => { setEditId(null); setContent(''); setRating(0); setSpoiler(false); }}
                className="px-4 py-2.5 border border-[var(--border)] text-[var(--text-secondary)] rounded-xl hover:bg-[var(--bg-hover)] transition-colors text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Reviews list */}
      <div>
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">
          Reviews {movieReviews.length > 0 && <span className="text-[var(--text-muted)] font-normal">({movieReviews.length})</span>}
        </h3>

        {movieReviews.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <p className="text-4xl mb-3">🎬</p>
            <p className="font-medium">No reviews yet</p>
            <p className="text-sm mt-1">Be the first to share your thoughts!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {movieReviews.map((review) => (
              <div key={review.id} className="glass rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white font-bold text-sm">
                      You
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">You</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-sm font-bold" style={{ color: '#f59e0b' }}>
                      ⭐ {review.rating}/10
                    </span>
                    <button onClick={() => startEdit(review)} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => deleteReview(review.id)} className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {review.spoiler && !revealedSpoilers.has(review.id) ? (
                  <div className="flex items-center gap-2 py-3">
                    <AlertTriangle size={16} className="text-[var(--accent-gold)]" />
                    <span className="text-sm text-[var(--text-muted)]">This review contains spoilers.</span>
                    <button onClick={() => toggleSpoiler(review.id)} className="text-sm text-[var(--accent-primary)] hover:underline">
                      Reveal
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{review.content}</p>
                )}

                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--border)]">
                  <button
                    onClick={() => likeReview(review.id)}
                    className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
                  >
                    <Heart size={14} />
                    {review.likes > 0 && review.likes} Helpful
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
