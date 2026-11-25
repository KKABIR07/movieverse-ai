import type { Metadata } from 'next';

export interface PageMetaInput {
  /** Page title; the root layout template appends " · mkmovies". */
  title: string;
  description: string;
  /** Canonical path (resolved against metadataBase), e.g. "/trending". */
  path: string;
  /** Keep the page out of search indexes (e.g. /search). */
  noindex?: boolean;
}

/**
 * Per-page metadata with canonical + matching Open Graph / Twitter text.
 * (Child `openGraph` objects replace the parent's, so set siteName/type again.)
 */
export function pageMeta({ title, description, path, noindex }: PageMetaInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: 'mkmovies', title: `${title} · mkmovies`, description, url: path },
    twitter: { card: 'summary_large_image', title: `${title} · mkmovies`, description },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
