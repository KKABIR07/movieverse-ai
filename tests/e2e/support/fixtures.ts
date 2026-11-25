/**
 * Shared Playwright fixtures for the mkmovies E2E / security suites.
 *
 *  - `pageErrors`  : collects console errors, uncaught page errors and same-origin responses ≥ 500
 *                    for the current page; `expectClean()` asserts none happened (allowlist below).
 *  - `spreadIp`    : (opt-in, @full only) routes /api/** with a unique X-Real-IP per test so the
 *                    per-IP auth bucket (10 req/min) doesn't throttle a whole test run. Only effective
 *                    when the app trusts X-Real-IP from the client, i.e. NOT behind Caddy — exactly the
 *                    local/staging-without-proxy case @full is meant for.
 *
 * Selectors everywhere are role/name/URL based so the suite survives the visual redesign.
 */
import { test as base, expect, type Page, type Response, type ConsoleMessage, type BrowserContext } from '@playwright/test';

/** Third-party / tooling noise that is not an app defect. Keep this list SHORT and justified. */
export const CONSOLE_ALLOWLIST: RegExp[] = [
  /youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com|doubleclick\.net|google\.com\/js/i, // embedded player
  /Download the React DevTools/i, // dev only
  /\[HMR\]|\[Fast Refresh\]/i, // dev only
  // dev only: React's dev build wants eval() for stack reconstruction; the prod CSP correctly omits 'unsafe-eval'
  /eval\(\) is not supported in this environment/i,
  /Failed to load resource: net::ERR_BLOCKED_BY_ORB/i, // third-party image CORB on throttled CDNs
];

export interface CollectedIssue {
  kind: 'console' | 'pageerror' | 'http5xx' | 'requestfailed';
  text: string;
}

function isAllowed(text: string): boolean {
  return CONSOLE_ALLOWLIST.some((re) => re.test(text));
}

export class PageIssueCollector {
  readonly issues: CollectedIssue[] = [];
  constructor(
    private readonly page: Page,
    private readonly origin: string,
  ) {
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() !== 'error') return;
      const loc = msg.location()?.url ?? '';
      const text = `${msg.text()}${loc ? ` @ ${loc}` : ''}`;
      // "Failed to load resource" for a third-party URL is the third party's problem.
      if (/Failed to load resource/i.test(msg.text()) && loc && !loc.startsWith(this.origin)) return;
      if (isAllowed(text)) return;
      this.issues.push({ kind: 'console', text });
    });
    page.on('pageerror', (err) => {
      const text = `${err.name}: ${err.message}`;
      if (!isAllowed(text + (err.stack ?? ''))) this.issues.push({ kind: 'pageerror', text });
    });
    page.on('response', (res: Response) => {
      if (res.status() >= 500 && res.url().startsWith(this.origin)) {
        this.issues.push({ kind: 'http5xx', text: `${res.status()} ${res.request().method()} ${res.url()}` });
      }
    });
    page.on('requestfailed', (req) => {
      const url = req.url();
      const failure = req.failure()?.errorText ?? '';
      // Aborted navigations/prefetches (net::ERR_ABORTED) are normal during client routing.
      if (!url.startsWith(this.origin) || /ERR_ABORTED|NS_BINDING_ABORTED/i.test(failure)) return;
      this.issues.push({ kind: 'requestfailed', text: `${failure} ${req.method()} ${url}` });
    });
  }

  reset(): void {
    this.issues.length = 0;
  }

  /** Issues of the given kinds (default: all). */
  of(...kinds: CollectedIssue['kind'][]): CollectedIssue[] {
    return kinds.length ? this.issues.filter((i) => kinds.includes(i.kind)) : [...this.issues];
  }

  expectClean(kinds: CollectedIssue['kind'][] = []): void {
    const found = this.of(...kinds);
    expect(found, `page issues on ${this.page.url()}:\n${found.map((i) => `  [${i.kind}] ${i.text}`).join('\n')}`).toEqual([]);
  }
}

let ipCounter = 0;
/** A TEST-NET-3 address unique to this worker + call (RFC 5737, never routable). */
export function uniqueTestIp(): string {
  const w = Number(process.env.TEST_PARALLEL_INDEX ?? 0) % 200;
  ipCounter = (ipCounter + 1) % 250;
  return `203.0.${w + 1}.${ipCounter + 1}`;
}

/** Route same-origin /api/** through a fixed X-Real-IP (see header comment). */
export async function spreadIpForContext(context: BrowserContext, ip = uniqueTestIp()): Promise<string> {
  await context.route('**/api/**', (route) => {
    const req = route.request();
    route.continue({ headers: { ...req.headers(), 'x-real-ip': ip } });
  });
  return ip;
}

/** Wait for the network to settle, but never fail on long-polling / video pages. */
export async function settle(page: Page, ms = 8_000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: ms }).catch(() => undefined);
}

/**
 * `next dev` mounts its dev-tools badge (<nextjs-portal>) bottom-left, on top of the mobile tab bar,
 * where it intercepts taps. Hide it — production builds never render it, so this is a no-op there.
 */
export async function hideDevOverlay(target: Page | BrowserContext): Promise<void> {
  await target.addInitScript(() => {
    const css = 'nextjs-portal{display:none!important;pointer-events:none!important}';
    const add = () => {
      const s = document.createElement('style');
      s.setAttribute('data-e2e', 'hide-next-dev-overlay');
      s.textContent = css;
      document.documentElement.appendChild(s);
    };
    if (document.documentElement) add();
    else document.addEventListener('DOMContentLoaded', add, { once: true });
  });
}

type Fixtures = {
  origin: string;
  issues: PageIssueCollector;
};

export const test = base.extend<Fixtures>({
  context: async ({ context }, provide) => {
    await hideDevOverlay(context);
    await provide(context);
  },
  // (`provide` rather than `use` so eslint's react-hooks rule doesn't mistake it for React.use)
  origin: async ({ baseURL }, provide) => {
    await provide(new URL(baseURL ?? 'http://localhost:3000').origin);
  },
  issues: async ({ page, origin }, provide) => {
    await provide(new PageIssueCollector(page, origin));
  },
});

export { expect };

/** True for the mobile Playwright project. */
export function isMobileProject(name: string): boolean {
  return /mobile/i.test(name);
}
