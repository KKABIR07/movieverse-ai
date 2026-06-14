'use client';

import { useState } from 'react';
import { X, Key, ExternalLink, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { TMDB_KEY_MISSING } from '@/lib/tmdb';

export function SetupBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!TMDB_KEY_MISSING || dismissed) return null;

  const envContent = `NEXT_PUBLIC_TMDB_API_KEY=paste_your_key_here`;

  const copyEnv = async () => {
    await navigator.clipboard.writeText(envContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-xl shadow-2xl rounded-2xl border border-amber-500/30 bg-[#1a1508] text-sm overflow-hidden"
      role="alert"
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 flex-shrink-0">
          <Key size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-300">TMDB API key missing</p>
          <p className="text-amber-500/80 text-xs mt-0.5 truncate">
            Add a free key to see movies — takes 2 minutes
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 rounded-lg text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Expanded steps */}
      {expanded && (
        <div className="border-t border-amber-500/20 px-4 py-4 space-y-4">
          <ol className="space-y-3 text-amber-200/80">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">1</span>
              <span>
                Go to{' '}
                <a
                  href="https://www.themoviedb.org/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:underline inline-flex items-center gap-1"
                >
                  themoviedb.org/settings/api
                  <ExternalLink size={11} />
                </a>
                {' '}→ create a free account → request an API key (Developer type)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">2</span>
              <span>Open <code className="bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-300">movieverse/.env.local</code> and replace the placeholder:</span>
            </li>
          </ol>

          {/* Code block with copy */}
          <div className="relative rounded-xl bg-black/40 border border-amber-500/20 overflow-hidden">
            <div className="px-4 py-3 font-mono text-xs text-amber-300 break-all">
              {envContent}
            </div>
            <button
              onClick={copyEnv}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors"
              aria-label="Copy to clipboard"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>

          <p className="text-xs text-amber-500/60">
            After saving the file, restart the dev server (<code className="bg-amber-500/10 px-1 py-0.5 rounded">npm run dev</code>).
          </p>
        </div>
      )}
    </div>
  );
}
