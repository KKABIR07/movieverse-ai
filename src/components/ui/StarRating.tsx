'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  max?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
}

export function StarRating({ value, max = 10, size = 16, interactive = false, onChange, className = '' }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const stars = max === 10 ? 5 : max;
  const displayValue = hovered ?? value;
  const normalizedValue = max === 10 ? displayValue / 2 : displayValue;

  return (
    <div className={`flex items-center gap-0.5 ${className}`} role="group" aria-label={`Rating: ${value} out of ${max}`}>
      {Array.from({ length: stars }).map((_, i) => {
        const filled = normalizedValue >= i + 1;
        const half = !filled && normalizedValue >= i + 0.5;
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(max === 10 ? (i + 1) * 2 : i + 1)}
            onMouseEnter={() => interactive && setHovered(max === 10 ? (i + 1) * 2 : i + 1)}
            onMouseLeave={() => interactive && setHovered(null)}
            className={interactive ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default'}
            aria-label={`${max === 10 ? (i + 1) * 2 : i + 1} stars`}
          >
            <Star
              size={size}
              className={filled || half ? 'star-filled fill-current' : 'star-empty'}
              style={{ opacity: half ? 0.6 : 1 }}
            />
          </button>
        );
      })}
    </div>
  );
}

interface RatingBadgeProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
}

export function RatingBadge({ rating, size = 'md' }: RatingBadgeProps) {
  const color =
    rating >= 7.5 ? '#22c55e' : rating >= 6 ? '#f59e0b' : rating >= 4 ? '#f97316' : '#ef4444';
  const sizeMap = { sm: 'text-xs px-1.5 py-0.5', md: 'text-sm px-2 py-1', lg: 'text-base px-3 py-1.5' };

  return (
    <span
      className={`font-bold rounded-md inline-flex items-center gap-1 ${sizeMap[size]}`}
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      <Star size={size === 'lg' ? 14 : 12} className="fill-current" />
      {rating.toFixed(1)}
    </span>
  );
}
