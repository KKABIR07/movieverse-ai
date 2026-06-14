export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  categoryColor: string;
  readTime: number;
  author: string;
  authorRole: string;
  keywords: string[];
  content: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'best-movies-to-watch-2025',
    title: 'Best Movies to Watch Right Now in 2025',
    description:
      'From blockbuster action to quiet indie dramas, these are the must-watch films dominating 2025 — curated with ratings, trailers, and where to stream them.',
    date: '2025-06-10',
    category: 'Recommendations',
    categoryColor: '#7c3aed',
    readTime: 6,
    author: 'mkmovies Editorial',
    authorRole: 'Film Team',
    keywords: [
      'best movies 2025', 'movies to watch 2025', 'top films 2025',
      'new movies streaming', 'must watch movies',
    ],
    content: `
<p>2025 has already delivered a stunning range of cinema — from sprawling sci-fi epics to intimate character studies. Whether you're looking for something to watch on a Friday night or planning a full weekend marathon, this guide covers the films earning the highest praise from critics and audiences alike.</p>

<h2>Action & Adventure</h2>
<p>The action genre is thriving in 2025. Studios have invested heavily in practical effects and grounded storytelling, moving away from the CGI-heavy spectacles of the past decade. Expect high-octane sequences grounded in real stakes and emotionally resonant character arcs. Films in this category frequently top streaming charts within days of release, making them excellent first picks if you want something crowd-pleasing and immediate.</p>
<p>Key things to watch for: stunt choreography, ensemble casts, and post-credit sequences that tease upcoming releases. If you enjoy action films, use mkmovies' genre filter under <strong>Discover</strong> to surface titles rated 7.5 and above with thousands of audience votes — a reliable signal of quality.</p>

<h2>Drama & Awards Contenders</h2>
<p>Awards season films tend to land in the second half of the year, but 2025 has seen several early releases already generating Oscar buzz. These films typically explore complex themes — identity, grief, systemic injustice, and human connection — through meticulous writing and career-best performances.</p>
<p>If you prefer slower-burn storytelling with rich dialogue and layered characters, sort by <em>Top Rated</em> in mkmovies and look for films with vote averages above 8.0 and runtimes over 100 minutes. These metrics strongly correlate with critically acclaimed dramas.</p>

<h2>Horror & Thriller</h2>
<p>The horror genre continues its creative renaissance. 2025's crop of thrillers leans into psychological dread and social commentary rather than cheap jump scares. These films work best watched in one sitting with the lights off — the controlled pacing and sound design are crafted for full immersion.</p>
<p>Standout subgenres this year include folk horror, tech-paranoia thrillers, and supernatural slow-burn narratives. Many are available on major streaming platforms within 30–45 days of theatrical release.</p>

<h2>Comedy & Feel-Good Films</h2>
<p>After years of the comedy genre being declared "dead" by think-pieces, 2025 has seen a genuine revival. Original comedies — not sequels or IP adaptations — are landing well with audiences starved for genuine laughter. Expect sharp dialogue, breakout performances from character actors, and tight 90-minute runtimes that respect your time.</p>

<h2>How to Find These Films on mkmovies</h2>
<p>Every movie mentioned in our editorial recommendations is searchable directly on mkmovies. Use the <strong>Search</strong> feature to find any title by name, or browse <strong>Trending Now</strong> for real-time popular films pulled from TMDB's global data. You can save anything to your Watchlist with one click — no account required for browsing, though signing up lets you track everything across devices.</p>

<h2>Where to Stream</h2>
<p>Each movie detail page on mkmovies shows available streaming providers for your region, including subscription services, rental, and purchase options. This saves you the frustration of hunting across multiple platforms. The data is sourced from TMDB's provider partnerships and updated regularly.</p>

<p>Cinema in 2025 rewards patience and exploration. Use mkmovies' AI recommendation feature (the chat widget in the bottom-right corner) to describe your mood and get personalised suggestions — it understands genre nuance, pacing preferences, and thematic depth in a way that keyword search alone cannot match.</p>
    `.trim(),
  },
  {
    slug: 'how-ai-is-changing-movie-discovery',
    title: 'How AI Is Changing the Way We Discover Movies',
    description:
      'Recommendation algorithms have evolved far beyond "you watched X, try Y." Here\'s how modern AI understands your taste — and how mkmovies uses it to surface films you\'ll actually love.',
    date: '2025-06-03',
    category: 'Technology',
    categoryColor: '#059669',
    readTime: 7,
    author: 'mkmovies Editorial',
    authorRole: 'Tech Team',
    keywords: [
      'AI movie recommendations', 'movie discovery algorithm', 'personalised film suggestions',
      'machine learning movies', 'best movie recommendation app',
    ],
    content: `
<p>For decades, movie discovery meant word-of-mouth, newspaper reviews, or whatever was playing at the local cinema. Streaming changed the distribution model, but the discovery problem got worse — with tens of thousands of titles available, choice paralysis became the new barrier. AI is now beginning to genuinely solve this.</p>

<h2>The Problem with Old Recommendation Systems</h2>
<p>Early recommendation engines were purely collaborative: "People who watched Inception also watched Interstellar." This works for obvious surface-level similarities but fails entirely for nuanced taste. A viewer who loved Parasite for its class commentary might hate other Korean thrillers that lack that dimension. A fan of slow-burn noir might despise fast-paced whodunits despite both being in the "mystery" genre.</p>
<p>Pure keyword matching — genre, year, director — also misses the point. The feeling a film creates is rarely captured by its metadata. What you actually want when you say "something like Blade Runner" is probably: rain-soaked atmosphere, existential undertones, stunning visual world-building, and a melancholic score — not necessarily sci-fi set in the future.</p>

<h2>How Modern AI Understands Film</h2>
<p>Large language models trained on film reviews, scripts, and critical analysis can reason about cinematic qualities that traditional metadata ignores: pacing, emotional register, thematic weight, visual language, tonal texture. When you describe what you want in natural language, these models can map your description to films that actually match the feeling — not just the genre label.</p>
<p>This is fundamentally different from older systems. You can say "I want something melancholy but not depressing, set outside the US, with strong female leads and a non-linear structure" and get genuinely relevant results. That query is impossible to express through dropdown filters.</p>

<h2>What mkmovies Does Differently</h2>
<p>mkmovies integrates an AI assistant (powered by Groq's LLaMA architecture) directly into the browsing experience. Rather than filling out a preference profile or answering surveys, you simply describe what you're in the mood for — conversationally, in plain language — and the assistant responds with specific recommendations including title, year, and the key reason each one fits your request.</p>
<p>The assistant also draws on TMDB's database for context: ratings, cast, runtime, streaming availability. It's not generating fictional films — every recommendation is a real, watchable title you can immediately find and save to your watchlist.</p>

<h2>The Limits of AI Recommendation</h2>
<p>AI movie recommendation is powerful but not infallible. It works best when:</p>
<ul>
  <li>You give it descriptive, qualitative prompts rather than just genre names</li>
  <li>You tell it what you <em>don't</em> want (no subtitles, no violence, under 2 hours)</li>
  <li>You engage in a back-and-forth conversation, refining based on its suggestions</li>
</ul>
<p>It works less well for discovering genuinely obscure films with very few reviews, since the training data skews toward widely-discussed titles. For deep-cut discovery, combining AI chat with mkmovies' TMDB-powered search and genre browsing gives you the best coverage.</p>

<h2>The Future of Movie Discovery</h2>
<p>The next wave will integrate viewing history, mood inference from time-of-day and device signals, and social viewing context (watching alone vs. with family). The goal is for the system to know you want a 90-minute comedy on a Tuesday night without you having to say it. We're building toward that — the AI assistant on mkmovies is the first step in that direction.</p>

<p>Try it now: open the chat widget on mkmovies, describe the last film you loved and why, and ask for something similar. The results will surprise you.</p>
    `.trim(),
  },
  {
    slug: 'ultimate-guide-to-building-your-watchlist',
    title: 'The Ultimate Guide to Building Your Perfect Watchlist',
    description:
      'A disorganised watchlist is as bad as no watchlist. Here\'s how to build one that you\'ll actually use — with tips for prioritisation, categorisation, and tracking across platforms.',
    date: '2025-05-26',
    category: 'Guides',
    categoryColor: '#d97706',
    readTime: 5,
    author: 'mkmovies Editorial',
    authorRole: 'Film Team',
    keywords: [
      'movie watchlist app', 'how to track movies', 'best watchlist tool',
      'movie tracking app', 'organize films to watch',
    ],
    content: `
<p>Most people have a "watchlist" that's really just a graveyard of good intentions: a note on your phone, a browser tab pinned for months, a half-remembered recommendation from a friend. The problem isn't the films — it's the system. A good watchlist requires both capture and curation.</p>

<h2>The Two Phases: Capture and Curation</h2>
<p><strong>Capture</strong> is adding films the moment you hear about them — from a trailer, a conversation, a review, or a recommendation. Friction here is fatal. If adding a movie requires more than two taps, you won't do it when the moment passes. mkmovies is designed for this: every movie and TV show has a bookmark button on its detail page. One tap saves it to your active watchlist. No account required to browse, though creating a free account syncs your watchlist to the cloud.</p>
<p><strong>Curation</strong> is the harder part. Your watchlist will grow faster than you watch. Without curation, it becomes a source of anxiety rather than excitement. The goal is to regularly prune it down to a short list of films you're genuinely excited to watch next — not an archive of everything you've ever been vaguely interested in.</p>

<h2>Create Multiple Lists by Mood</h2>
<p>A single monolithic watchlist doesn't account for the fact that you're a different viewer on different days. Some nights you want a 2-hour epic. Others you want a 90-minute comedy. Some weekends you want to share the screen with family; others you want to challenge yourself with something demanding.</p>
<p>mkmovies supports multiple named watchlists. The suggested structure:</p>
<ul>
  <li><strong>Watch Tonight</strong> — 5–10 films, always ready to pick from immediately</li>
  <li><strong>Weekend Cinema</strong> — longer, more demanding films that deserve full attention</li>
  <li><strong>With Family</strong> — appropriate for shared viewing</li>
  <li><strong>Film Club</strong> — titles with discussion potential</li>
  <li><strong>Re-Watch</strong> — films you've loved and want to revisit</li>
</ul>

<h2>The 10-Film Rule</h2>
<p>Keep your "Watch Tonight" list capped at ten titles. Every time you add an eleventh, you must remove one. This forces genuine prioritisation and keeps the list functional. Films you're not ready to remove permanently can move to other lists or be archived.</p>

<h2>Tracking What You've Watched</h2>
<p>Tracking watched films serves a purpose beyond nostalgia. Reviewing your viewing history reveals patterns: genres you've over-indexed on, directors you keep returning to, periods in film history you've neglected. This data makes future recommendations more accurate — both from AI tools and from your own self-knowledge as a viewer.</p>
<p>mkmovies' rating system (1–10 per title) also feeds into this. Rating films you've watched helps the AI assistant understand your taste with greater precision over time. The more context it has, the better it performs.</p>

<h2>Following Stars for Automatic Discovery</h2>
<p>One underused watchlist strategy: follow directors and actors whose track records you trust. When you follow a star on mkmovies, their new and recent work appears in your Feed automatically. This means you never miss a release from filmmakers whose work consistently resonates with you — without having to monitor their news separately.</p>

<p>A watchlist is only valuable if it's a genuine decision-support tool, not a dumping ground. Spend ten minutes building yours properly on mkmovies and it'll reward you every time you sit down to watch something.</p>
    `.trim(),
  },
  {
    slug: 'best-thriller-movies-of-all-time',
    title: 'The 15 Best Thriller Movies of All Time — Ranked',
    description:
      'From Hitchcock\'s masterclasses in suspense to modern psychological mind-benders, these are the thriller films every serious movie lover should have seen.',
    date: '2025-05-18',
    category: 'Top Lists',
    categoryColor: '#dc2626',
    readTime: 8,
    author: 'mkmovies Editorial',
    authorRole: 'Film Team',
    keywords: [
      'best thriller movies', 'top thriller films all time', 'greatest suspense movies',
      'psychological thriller movies', 'must watch thrillers',
    ],
    content: `
<p>The thriller is cinema's most reliable genre contract: I will make you feel something urgent. Great thrillers exploit attention, manipulate time, weaponise music, and exploit your own fears against you. The best of them stay with you for days. Here are fifteen films that represent the absolute apex of what the genre can achieve.</p>

<h2>What Makes a Thriller Great</h2>
<p>A thriller isn't defined by violence or plot twists — it's defined by sustained tension. The audience must feel that something terrible is possible, that the outcome is genuinely uncertain, and that the stakes are real. The greatest thrillers achieve this through character investment: we care about what happens, which makes the fear meaningful rather than merely stimulating.</p>

<h2>The Essential Classics</h2>
<p><strong>Rear Window (1954)</strong> — Hitchcock's masterpiece of voyeurism and dread. A confined protagonist, a suspicious neighbour, and the unbearable question: what if he's wrong? The film invented the language of the suspense sequence that every thriller since has borrowed from.</p>
<p><strong>Vertigo (1958)</strong> — Also Hitchcock. Ranked by many critics as the greatest film ever made, Vertigo is a thriller about obsession that becomes increasingly uncomfortable as the protagonist's fixation reveals deeper truths about control and male fantasy. Its second-act reveal remains one of cinema's most devastating moments.</p>
<p><strong>The Conversation (1974)</strong> — Francis Ford Coppola's surveillance thriller, made in the shadow of Watergate, follows a professional eavesdropper who begins to suspect he's enabled a murder. Paranoia as cinema's highest form.</p>

<h2>Modern Masterworks</h2>
<p><strong>Prisoners (2013)</strong> — Denis Villeneuve's moral thriller about two fathers searching for their missing daughters forces the audience to sit with deeply uncomfortable questions about justice and desperation. Hugh Jackman and Jake Gyllenhaal give career-best performances. Roger Deakins' cinematography turns Pennsylvania winter into a landscape of existential dread.</p>
<p><strong>Gone Girl (2014)</strong> — David Fincher's adaptation of Gillian Flynn's novel is one of cinema's sharpest dissections of marriage, media, and public performance. The mid-film structural shift remains one of the most audacious moves in mainstream cinema this century.</p>
<p><strong>Parasite (2019)</strong> — Bong Joon-ho's Palme d'Or winner is technically a thriller, though it defies every subgenre label. Its escalation from uncomfortable comedy to genuine horror is controlled with extraordinary precision. The use of space — the house as a character, above and below ground — is a masterclass in symbolic architecture.</p>

<h2>Psychological Thrillers Worth Your Full Attention</h2>
<p><strong>Black Swan (2010)</strong> — Darren Aronofsky's ballet thriller collapses the boundary between ambition and psychosis with such controlled ferocity that it's exhausting in the best possible way. Natalie Portman's performance required eighteen months of preparation.</p>
<p><strong>Hereditary (2018)</strong> — Ari Aster's debut is the most formally accomplished horror-thriller of the decade. It uses grief as the engine of dread rather than supernatural mythology, making its terror genuinely personal. The dinner scene is one of the most uncomfortable sequences in contemporary cinema.</p>
<p><strong>Knives Out (2019)</strong> — Rian Johnson's genre-aware murder mystery reinvents the classic whodunit for modern audiences with extraordinary plotting and a career-redefining Daniel Craig performance. The rare thriller that's also genuinely funny.</p>

<h2>International Thrillers</h2>
<p>If you haven't explored thriller cinema beyond Hollywood and the UK, you're missing some of the genre's most innovative work. South Korean cinema (Oldboy, I Saw the Devil, A Tale of Two Sisters) operates with a willingness to go to places Western studios won't. French thrillers (Tell No One, Cache) favour ambiguity and moral complexity over resolution. Scandinavian crime films have influenced a decade of television.</p>
<p>Use mkmovies' language filter on the Discover page to surface non-English thrillers with high audience ratings. Sorted by popularity, you'll find titles that have genuinely broken through global audiences.</p>

<h2>How to Find Similar Films</h2>
<p>Every movie detail page on mkmovies includes a "You Might Also Like" section powered by TMDB's recommendation engine. For thriller fans, this is often the most efficient discovery tool — start with a film you loved and follow the recommendation chain. You can also ask the AI assistant directly: "I loved Prisoners and Parasite — what should I watch next?" and get a curated, reasoned response.</p>

<p>The thriller genre rewards the patient viewer. The best films in the genre give you everything you need to work it out — if you're paying close enough attention.</p>
    `.trim(),
  },
  {
    slug: 'best-tv-shows-to-binge-2025',
    title: 'Best TV Shows to Binge-Watch in 2025',
    description:
      'Peak TV isn\'t over — it just requires better navigation. These are the series worth your time in 2025, from debut seasons to returning favourites delivering their best work yet.',
    date: '2025-05-10',
    category: 'TV Shows',
    categoryColor: '#0891b2',
    readTime: 6,
    author: 'mkmovies Editorial',
    authorRole: 'TV Team',
    keywords: [
      'best TV shows 2025', 'binge watch series 2025', 'top streaming shows',
      'new TV series 2025', 'must watch TV shows',
    ],
    content: `
<p>The streaming era created an abundance problem: more television is produced now than any audience could possibly keep up with. Navigating it requires better signal-to-noise tools. This guide curates what's genuinely worth your time in 2025 — series that reward binge-watching and hold up under sustained attention.</p>

<h2>What "Worth Binge-Watching" Actually Means</h2>
<p>Not every acclaimed series is a binge. Some shows — anthology dramas, procedurals with case-of-the-week structures, nature documentaries — are better consumed one episode at a time. True binge material has: strong episode-ending hooks, serialised mythology that builds across episodes, and character arcs designed to be experienced in compressed time.</p>
<p>The series in this guide are all designed to be consumed in sessions of 3–6 episodes, with each sitting leaving you wanting to immediately continue.</p>

<h2>Drama Series</h2>
<p>The best drama on television in 2025 is operating at film-level ambition. Limited series in particular — typically 6–10 episodes — have become the prestige format, attracting film directors and A-list casts who wouldn't previously have committed to long-form television.</p>
<p>What to look for: novelistic character development across multiple episodes, visual grammar that uses the extended format deliberately rather than just padding, and writing that respects audience intelligence by withholding information strategically rather than randomly.</p>

<h2>Comedy Series</h2>
<p>The half-hour comedy has evolved dramatically. The laugh-track sitcom is essentially extinct in prestige television; what's replaced it is a hybrid form — often called "dramedies" — that explores genuine emotional territory while remaining fundamentally funny. These shows require commitment but deliver a richer experience than traditional comedy.</p>
<p>Single-camera comedies with strong ensemble casts dominate this space. The best ones feel like hanging out with people you genuinely like — which is why they're so rewatch-worthy.</p>

<h2>International Series Worth Subtitles</h2>
<p>If you've never watched subtitled television, 2025 is the year to start. South Korean, Spanish, German, and Scandinavian series have reached levels of production quality and narrative ambition that rival the best American television — and because they're operating in different cultural contexts, they feel genuinely fresh rather than familiar.</p>
<p>The global algorithm has also changed what gets made: international productions are now built for global audiences, which means cultural specificity coexists with universal emotional themes. You don't need background knowledge to engage — you need willingness to pay attention.</p>

<h2>Documentary Series</h2>
<p>Long-form documentary series have become their own prestige genre. Multi-episode investigations — true crime, nature, food, sport, history — benefit enormously from extended runtime. Subjects that would be flattened in a two-hour film can breathe across six episodes.</p>
<p>The best documentary series don't just inform — they build emotional investment in subjects you'd never expected to care about. This is the format that regularly converts people into obsessive fans of sports teams, historical periods, or subcultures they'd never previously encountered.</p>

<h2>How to Discover TV Shows on mkmovies</h2>
<p>The TV Shows section on mkmovies is powered by TMDB's comprehensive television database — every series, every season, every episode count, ratings, and cast details. Filter by genre and sort by rating to surface the best-reviewed series in any category.</p>
<p>Individual show pages include full cast and crew details, genre tags, streaming providers, and similar show recommendations. For ongoing series, the page shows current season and episode count so you know what commitment you're making before you start.</p>
<p>You can also follow showrunners and actors in your Feed — so when a creator whose work you love releases a new series, it appears in your mkmovies feed automatically alongside their other work.</p>

<p>Great television in 2025 is abundant. The discovery problem is real, but it's solvable. Start with one recommendation from this list — something that genuinely matches your taste rather than what's algorithmically popular — and let the quality do the rest.</p>
    `.trim(),
  },
  {
    slug: 'movie-ratings-guide-imdb-tmdb-explained',
    title: 'Movie Ratings Explained: TMDB, IMDb, and What the Numbers Really Mean',
    description:
      'A 7.2 on TMDB vs a 74% on Rotten Tomatoes — are they measuring the same thing? Understanding how ratings work makes you a better consumer of critical consensus.',
    date: '2025-04-30',
    category: 'Guides',
    categoryColor: '#d97706',
    readTime: 5,
    author: 'mkmovies Editorial',
    authorRole: 'Film Team',
    keywords: [
      'TMDB ratings explained', 'IMDb ratings guide', 'how movie ratings work',
      'film rating systems', 'Rotten Tomatoes vs IMDb',
    ],
    content: `
<p>Movie ratings seem simple — a number that tells you how good something is. In reality, each rating system measures something slightly different, and understanding those differences makes you significantly better at using them to find films you'll actually enjoy.</p>

<h2>What TMDB Ratings Measure</h2>
<p>The Movie Database (TMDB) ratings — which power mkmovies — are pure audience scores: registered users rate each title from 0 to 10, and the displayed score is the weighted average. The weighting accounts for vote count and recency, giving higher weight to films with more votes (reducing the noise of small sample sizes) and slightly downweighting very old ratings where audience taste has shifted.</p>
<p>What this means in practice: TMDB ratings reflect the global average opinion of engaged cinema viewers. A 7.5 on TMDB means a large enough sample of film-interested people rated it, on average, a 7.5. It's democratic in the best sense — no critic gatekeeping — and reflects actual audience sentiment rather than industry consensus.</p>

<h2>The IMDb Rating System</h2>
<p>IMDb uses a similar audience rating system (1–10, displayed as weighted average), but its user base is significantly larger and more diverse — including casual viewers who don't engage with film critically. This makes IMDb ratings more reflective of mainstream audience response, which is useful for some purposes and limiting for others.</p>
<p>IMDb ratings also tend to be higher on average than critical consensus suggests. Blockbusters rate well because their large audiences vote enthusiastically. Art-house films are often underrated because they draw smaller but more discriminating voter pools, whose scores pull the average down relative to the film's actual quality.</p>

<h2>Rotten Tomatoes: Binary Aggregation</h2>
<p>Rotten Tomatoes doesn't average quality scores — it measures whether individual critics gave a positive or negative review, then reports the percentage of positive reviews. A 90% on Rotten Tomatoes means 90% of critics gave it a "fresh" (positive) rating. It says nothing about how enthusiastically they liked it.</p>
<p>This creates a known distortion: a film that every critic thinks is "fine but not great" (6/10 universally) would get 100% — while a divisive film that half the critics think is a masterpiece and half think is terrible gets 50%. The divisive film might be the more interesting watch.</p>
<p>The Audience Score on Rotten Tomatoes (separate from the Tomatometer) is more useful for this reason — it captures enthusiasm rather than just positive/negative binary opinion.</p>

<h2>How to Read Ratings Intelligently</h2>
<p>For mkmovies specifically, here's how to interpret TMDB scores:</p>
<ul>
  <li><strong>8.0+</strong> — Exceptional. A film rated this high with significant vote counts is almost certainly worth your time, regardless of genre preference.</li>
  <li><strong>7.0–7.9</strong> — Very good. This range contains a large proportion of the "great films you haven't heard of" — quality is high but they haven't broken through to mainstream awareness.</li>
  <li><strong>6.0–6.9</strong> — Mixed or genre-specific. Might be excellent for fans of the genre, mediocre for everyone else. Context matters here more than the number.</li>
  <li><strong>Below 6.0</strong> — Generally unreliable. Some genuine cult classics rate low initially and improve over time; most films in this range are simply poor. Proceed with specific reason (e.g., a director or actor you're researching).</li>
</ul>

<h2>Vote Count Matters as Much as Score</h2>
<p>A film rated 8.5 with 200 votes is much less reliable than a film rated 7.8 with 200,000 votes. Small sample sizes allow enthusiastic fandoms to inflate scores. mkmovies displays vote counts alongside ratings on every detail page precisely for this reason. Treat high scores with low vote counts as promising but unverified.</p>

<h2>When to Ignore Ratings</h2>
<p>Experimental films, foreign language cinema, documentaries, and genuinely transgressive art consistently underperform in audience rating systems because they're not made for the median viewer. Some of the most important films in cinema history have mediocre TMDB scores. If you're interested in serious film exploration, use ratings as a starting point but not a final arbiter.</p>
<p>The mkmovies AI assistant is particularly useful here: you can ask "what films are considered important despite low ratings" or "recommend critically divisive films from the 2000s" and get curated suggestions that rating filters would never surface.</p>

<p>Ratings are a map, not the territory. Learn to read them properly and they become one of the most efficient discovery tools you have — but always remember that the number doesn't capture what a film made you feel.</p>
    `.trim(),
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getRelatedPosts(currentSlug: string, category: string): BlogPost[] {
  return BLOG_POSTS.filter(
    (p) => p.slug !== currentSlug && p.category === category,
  ).slice(0, 3);
}
