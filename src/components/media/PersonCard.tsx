import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { profileSrc } from './tmdbImage';

export interface PersonLike {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  /** Cast credit */
  character?: string;
  /** Crew credit */
  job?: string;
}

export interface PersonCardProps {
  person: PersonLike;
  /** Second line. Defaults to character → job → department. */
  subtitle?: ReactNode;
  /** Optional slot under the subtitle (e.g. a FollowButton; rendered OUTSIDE the link). */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** `sizes` attribute override. */
  sizes?: string;
  className?: string;
}

const avatar = { sm: 'w-16', md: 'w-24', lg: 'w-32' };
const defaultSizes = { sm: '64px', md: '96px', lg: '128px' };

/**
 * Circular avatar + name → /person/:id.
 * @example <PersonCard person={castMember} />
 * @example <PersonCard person={p} size="lg" footer={<FollowButton person={p} />} />
 */
export function PersonCard({ person, subtitle, footer, size = 'md', sizes, className }: PersonCardProps) {
  const sub = subtitle ?? person.character ?? person.job ?? person.known_for_department;
  return (
    <div className={cn('group/person flex flex-col items-center text-center', className)}>
      <Link href={`/person/${person.id}`} className="flex flex-col items-center rounded-card outline-offset-4">
        <div
          className={cn(
            'relative aspect-square overflow-hidden rounded-full bg-surface-2 ring-1 ring-line transition-[box-shadow] duration-200',
            'group-hover/person:ring-2 group-hover/person:ring-accent',
            avatar[size],
          )}
        >
          {person.profile_path ? (
            <Image
              src={profileSrc(person.profile_path)!}
              alt=""
              fill
              sizes={sizes ?? defaultSizes[size]}
              className="object-cover"
            />
          ) : (
            <User aria-hidden className="absolute inset-0 m-auto size-1/3 text-fg-muted" />
          )}
        </div>
        <span className="mt-2.5 line-clamp-2 max-w-[10rem] text-caption font-semibold text-fg group-hover/person:text-accent transition-colors">
          {person.name}
        </span>
        {sub && <span className="mt-0.5 line-clamp-1 max-w-[10rem] text-micro text-fg-muted">{sub}</span>}
      </Link>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

