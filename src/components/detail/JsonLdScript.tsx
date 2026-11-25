import { serializeJsonLd } from './jsonld';

/** Inline schema.org data (not executed, so the CSP's script rules don't apply to its content). */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
