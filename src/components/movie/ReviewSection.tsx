'use client';

import { useId, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, MessageSquare, Pencil, ThumbsUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { ToggleGroup } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/components/ui/cn';
import { toast } from '@/store/toastStore';
import { openAuth } from '@/store';
import { useAuthStatus } from '@/store/authStore';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { ApiError, friendlyError } from '@/lib/sync/http';
import { REVIEW_MAX, reviewsApi, reviewsKey, validateReview, type Review, type ReviewErrors } from '@/lib/sync/reviews';

export interface ReviewSectionProps {
  movieId: number;
  movieTitle: string;
  moviePoster?: string | null;
}

type Sort = 'recent' | 'liked';

/** Server-backed reviews for one movie: list, likes, spoiler toggle, own review edit/delete, form. */
export function ReviewSection({ movieId, movieTitle, moviePoster }: ReviewSectionProps) {
  const status = useAuthStatus();
  const qc = useQueryClient();
  const key = reviewsKey(movieId);
  const [sort, setSort] = useState<Sort>('recent');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Review | null>(null);

  const query = useQuery({
    // Refetch when the session changes so likedByMe / isMine are right.
    queryKey: [...key, status],
    queryFn: ({ signal }) => reviewsApi.list(movieId, signal),
    enabled: status !== 'unknown',
    staleTime: 60_000,
    retry: (n, err) => n < 1 && !(err instanceof ApiError && err.status < 500),
  });

  const reviews = useMemo(() => {
    const list = [...(query.data ?? [])];
    if (sort === 'liked') list.sort((a, b) => b.likeCount - a.likeCount || Date.parse(b.createdAt) - Date.parse(a.createdAt));
    else list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return list;
  }, [query.data, sort]);
  const mine = reviews.find((r) => r.isMine) ?? null;
  const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  const setCache = (fn: (list: Review[]) => Review[]) =>
    qc.setQueryData<Review[]>([...key, status], (old) => (old ? fn(old) : old));

  const like = useMutation({
    mutationFn: ({ id, like }: { id: string; like: boolean }) => reviewsApi.like(id, like),
    onMutate: ({ id, like }) => {
      const prev = qc.getQueryData<Review[]>([...key, status]);
      setCache((list) =>
        list.map((r) => (r.id === id ? { ...r, likedByMe: like, likeCount: Math.max(0, r.likeCount + (like ? 1 : -1)) } : r)),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData([...key, status], ctx.prev);
      toast({ title: "Couldn't update the like", description: friendlyError(err), tone: 'danger' });
    },
    onSuccess: (review) => {
      if (review) setCache((list) => list.map((r) => (r.id === review.id ? { ...r, ...review } : r)));
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => reviewsApi.remove(id),
    onSuccess: (_d, id) => {
      setCache((list) => list.filter((r) => r.id !== id));
      setEditing(false);
      toast({ title: 'Review deleted', tone: 'neutral' });
    },
    onError: (err) => toast({ title: "Couldn't delete the review", description: friendlyError(err), tone: 'danger' }),
    onSettled: () => setConfirmDelete(null),
  });

  const onLike = (r: Review) => {
    if (status !== 'authenticated') return openAuth('login');
    if (r.isMine) return;
    like.mutate({ id: r.id, like: !r.likedByMe });
  };

  const showForm = status === 'authenticated' && (!mine || editing);

  return (
    <section aria-labelledby="reviews-title" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="reviews-title" className="text-h2 text-fg">
            Reviews
          </h2>
          <p className="mt-1 text-caption text-fg-muted">
            {query.isSuccess
              ? reviews.length
                ? `${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'} from mkmovies members · average ${average!.toFixed(1)}/10`
                : 'From mkmovies members'
              : 'From mkmovies members'}
          </p>
        </div>
        {reviews.length > 1 && (
          <ToggleGroup
            label="Sort reviews"
            size="sm"
            options={[
              { value: 'recent', label: 'Newest' },
              { value: 'liked', label: 'Most liked' },
            ]}
            value={sort}
            onChange={(v) => setSort((v as Sort) || 'recent')}
          />
        )}
      </div>

      {status === 'anonymous' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-surface-1 p-4">
          <p className="text-body text-fg-secondary">Sign in to rate and review {movieTitle}.</p>
          <Button size="sm" onClick={() => openAuth('login')}>
            Sign in
          </Button>
        </div>
      )}

      {showForm && (
        <ReviewForm
          key={mine?.id ?? 'new'}
          initial={editing ? mine : null}
          movieId={movieId}
          movieTitle={movieTitle}
          moviePoster={moviePoster}
          onCancel={mine ? () => setEditing(false) : undefined}
          onSaved={(saved) => {
            setEditing(false);
            if (saved) setCache((list) => [saved, ...list.filter((r) => r.id !== saved.id)]);
            void qc.invalidateQueries({ queryKey: key });
          }}
        />
      )}

      {query.isPending ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading reviews">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-panel border border-line p-4">
              <Skeleton variant="text" lines={3} />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          compact
          title="Reviews are unavailable"
          description={friendlyError(query.error, "We couldn't load reviews right now.")}
          onRetry={() => void query.refetch()}
        />
      ) : reviews.length === 0 ? (
        <EmptyState
          compact
          icon={<MessageSquare />}
          title="No reviews yet"
          description={status === 'authenticated' ? `Be the first to review ${movieTitle}.` : undefined}
        />
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              onLike={() => onLike(r)}
              likeBusy={like.isPending && like.variables?.id === r.id}
              onEdit={r.isMine ? () => setEditing(true) : undefined}
              onDelete={r.isMine ? () => setConfirmDelete(r) : undefined}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete your review?"
        description={`Your review of ${movieTitle} will be removed. This can't be undone.`}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
              data-autofocus
            >
              Delete
            </Button>
          </div>
        }
      />
    </section>
  );
}

function ReviewCard({
  review: r,
  onLike,
  likeBusy,
  onEdit,
  onDelete,
}: {
  review: Review;
  onLike: () => void;
  likeBusy: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const bodyId = useId();
  const hidden = r.spoiler && !revealed;
  const edited = r.updatedAt && r.createdAt && Date.parse(r.updatedAt) - Date.parse(r.createdAt) > 60_000;
  return (
    <li className={cn('rounded-panel border bg-surface-1 p-4 md:p-5', r.isMine ? 'border-accent/40' : 'border-line')}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-3 text-caption font-semibold text-fg">
          {r.userInitials || r.userName.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-caption font-semibold text-fg">
              {r.userName}
              {r.isMine && <span className="ml-1.5 text-micro font-normal text-accent">(you)</span>}
            </p>
            <span className="inline-flex h-6 items-center rounded-chip bg-accent/15 px-2 text-micro font-semibold tabular text-accent">
              <span className="sr-only">Rated </span>
              {r.rating}/10
            </span>
            {r.spoiler && <span className="text-micro font-medium uppercase tracking-[0.08em] text-danger">Spoilers</span>}
          </div>
          <p className="text-micro text-fg-muted">
            <time dateTime={r.createdAt} title={formatDate(r.createdAt)}>
              {formatRelativeTime(r.createdAt) || formatDate(r.createdAt)}
            </time>
            {edited ? ' · edited' : ''}
          </p>
        </div>
      </div>

      <div className="relative mt-3">
        <p
          id={bodyId}
          className={cn(
            'whitespace-pre-line break-words text-body text-fg-secondary transition-[filter] duration-200',
            hidden && 'select-none blur-md',
          )}
          aria-hidden={hidden}
        >
          {r.content}
        </p>
        {hidden && (
          <div className="absolute inset-0 grid place-items-center">
            <Button size="sm" variant="secondary" leadingIcon={<Eye />} aria-controls={bodyId} aria-expanded={false} onClick={() => setRevealed(true)}>
              Show spoiler
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onLike}
          disabled={r.isMine || likeBusy}
          aria-pressed={r.likedByMe}
          aria-label={`${r.likedByMe ? 'Unlike' : 'Like'} review by ${r.userName}, ${r.likeCount} ${r.likeCount === 1 ? 'like' : 'likes'}`}
          leadingIcon={<ThumbsUp className={cn(r.likedByMe && 'fill-accent text-accent')} />}
        >
          <span className="tabular">{r.likeCount}</span>
        </Button>
        {r.spoiler && revealed && (
          <Button size="sm" variant="ghost" leadingIcon={<EyeOff />} aria-controls={bodyId} aria-expanded onClick={() => setRevealed(false)}>
            Hide spoiler
          </Button>
        )}
        {onEdit && (
          <Button size="sm" variant="ghost" leadingIcon={<Pencil />} onClick={onEdit}>
            Edit
          </Button>
        )}
        {onDelete && (
          <Button size="sm" variant="ghost" leadingIcon={<Trash2 />} onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </li>
  );
}

function ReviewForm({
  initial,
  movieId,
  movieTitle,
  moviePoster,
  onCancel,
  onSaved,
}: {
  initial: Review | null;
  movieId: number;
  movieTitle: string;
  moviePoster?: string | null;
  onCancel?: () => void;
  onSaved: (review: Review | null) => void;
}) {
  const ids = { rating: useId(), content: useId(), count: useId(), err: useId() };
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [content, setContent] = useState(initial?.content ?? '');
  const [spoiler, setSpoiler] = useState(initial?.spoiler ?? false);
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [touched, setTouched] = useState(false);

  const save = useMutation({
    mutationFn: () => reviewsApi.save({ movieId, movieTitle, moviePoster, rating, content, spoiler }),
    onSuccess: (r) => {
      toast({ title: initial ? 'Review updated' : 'Review posted', tone: 'success' });
      onSaved(r?.review ?? null);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.isAuth) openAuth('login');
      toast({ title: "Couldn't save your review", description: friendlyError(err), tone: 'danger' });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const v = validateReview({ rating, content });
    setErrors(v);
    if (v.rating || v.content) return;
    save.mutate();
  };

  const len = content.trim().length;
  const over = len > REVIEW_MAX;

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-panel border border-line bg-surface-1 p-4 md:p-5" aria-label={initial ? 'Edit your review' : 'Write a review'}>
      <h3 className="text-h3 text-fg">{initial ? 'Edit your review' : `Review ${movieTitle}`}</h3>

      <fieldset aria-describedby={errors.rating ? `${ids.err}-r` : undefined}>
        <legend className="text-caption font-medium text-fg">
          Rating <span className="text-fg-muted">(1 to 10)</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <label key={n} className="relative">
              <input
                type="radio"
                name={ids.rating}
                value={n}
                checked={rating === n}
                onChange={() => {
                  setRating(n);
                  if (touched) setErrors(validateReview({ rating: n, content }));
                }}
                className="peer sr-only"
                aria-label={`${n} out of 10`}
              />
              <span
                className={cn(
                  'grid size-10 cursor-pointer place-items-center rounded-control border text-caption font-semibold tabular transition-colors duration-120',
                  'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
                  n <= rating ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface-2 text-fg-secondary hover:border-line-strong',
                )}
                aria-hidden
              >
                {n}
              </span>
            </label>
          ))}
        </div>
        {errors.rating && (
          <p id={`${ids.err}-r`} className="mt-2 text-caption text-danger">
            {errors.rating}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor={ids.content} className="text-caption font-medium text-fg">
          Your review
        </label>
        <textarea
          id={ids.content}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (touched) setErrors(validateReview({ rating, content: e.target.value }));
          }}
          rows={5}
          maxLength={REVIEW_MAX + 200}
          aria-invalid={!!errors.content}
          aria-describedby={`${ids.count}${errors.content ? ` ${ids.err}-c` : ''}`}
          placeholder="What worked, what didn't? Mark spoilers below."
          className="mt-2 block w-full resize-y rounded-control border border-line bg-surface-2 px-3 py-2.5 text-body text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none aria-[invalid=true]:border-danger"
        />
        <div className="mt-1.5 flex items-start justify-between gap-3">
          {errors.content ? (
            <p id={`${ids.err}-c`} className="text-caption text-danger">
              {errors.content}
            </p>
          ) : (
            <span />
          )}
          <p id={ids.count} className={cn('shrink-0 text-micro tabular', over ? 'text-danger' : 'text-fg-muted')}>
            {len.toLocaleString('en-US')} / {REVIEW_MAX.toLocaleString('en-US')}
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-caption text-fg-secondary">
        <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
        Contains spoilers (hidden until readers choose to show it)
      </label>

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={save.isPending}>
          {initial ? 'Save changes' : 'Post review'}
        </Button>
      </div>
    </form>
  );
}
