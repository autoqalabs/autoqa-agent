// Finds the hosts an app needs, so ALLOWED_ORIGINS can be set before a run
// instead of discovering them one blocked run at a time.
//
//   autoqa hosts                       open TARGET_URL (signed in, if `autoqa login` saved a session)
//   autoqa hosts --also <url,url>      also open other pages the feature uses, such as a checkout
//   autoqa hosts --write               add the suggested hosts to the settings file
//
// The browser here is not locked down: it records every host the pages contact,
// then compares them with ALLOWED_ORIGINS. Hosts that only serve analytics,
// CAPTCHAs, other payment methods or social sign-in are listed separately and
// not suggested: the agent does not need them, and should not solve CAPTCHAs.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { savedSession } from './session.mjs';

// Hosts the agent does not need, by why. Matched against the host name.
const NOT_NEEDED = [
  ['analytics', /(^|\.)(google-analytics\.com|googletagmanager\.com|doubleclick\.net|segment\.(io|com)|hotjar\.(com|io)|clarity\.ms|mixpanel\.com|amplitude\.com|fullstory\.com|heap(analytics)?\.(io|com)|newrelic\.com|nr-data\.net|datadoghq\.com|sentry\.io|logrocket\.(io|com)|cloudflareinsights\.com)$/],
  ['CAPTCHA', /(^|\.)(hcaptcha\.com|recaptcha\.net)$|^www\.google\.com$/],
  ['other payment methods', /(^|\.)(paypal\.com|paypalobjects\.com|pay\.google\.com|play\.google\.com|apple\.com)$/],
  ['social sign-in', /^(accounts\.google\.com|appleid\.apple\.com|login\.microsoftonline\.com|www\.facebook\.com|connect\.facebook\.net)$/],
  ['feedback and chat widgets', /(^|\.)(canny\.io|intercom\.io|intercomcdn\.com|zendesk\.com|zdassets\.com|drift\.com|crisp\.chat|tawk\.to)$/],
];

const reasonNotNeeded = (origin) => {
  const host = new URL(origin).host;
  return NOT_NEEDED.find(([, pattern]) => pattern.test(host))?.[0] ?? null;
};

function currentAllowed() {
  return (process.env.ALLOWED_ORIGINS ?? '')
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map((v) => new URL(v.includes('://') ? v : `https://${v}`).origin);
}

/**
 * Opens each page in an unrestricted browser and records every origin it
 * contacts. Waits until no new origin has appeared for a few seconds, so late
 * loaders (feature flags, payment forms) are caught too.
 */
export async function discoverHosts({ root, urls, quietSeconds = 8, maxSeconds = 60 }) {
  const { chromium } = await import('@playwright/test');
  const session = savedSession(root);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...(session ? { storageState: session.file } : {}),
  });
  const seen = new Map(); // origin → request count
  let lastNew = Date.now();
  context.on('request', (request) => {
    let origin;
    try { origin = new URL(request.url()).origin; } catch { return; }
    if (!origin.startsWith('http')) return;
    if (!seen.has(origin)) lastNew = Date.now();
    seen.set(origin, (seen.get(origin) ?? 0) + 1);
  });

  const pages = [];
  for (const url of urls) {
    const page = await context.newPage();
    const started = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    lastNew = Date.now();
    while (Date.now() - lastNew < quietSeconds * 1000 && Date.now() - started < maxSeconds * 1000) {
      await page.waitForTimeout(1000);
    }
    pages.push({ url, landed: page.url(), title: await page.title().catch(() => '') });
    await page.close();
  }
  await browser.close();
  return { seen, pages, signedIn: !!session };
}

/** Sorts what was seen into: the target itself, already allowed, suggested, and not needed. */
export function classifyHosts(seen, target) {
  const targetOrigin = new URL(target).origin;
  const allowed = new Set(currentAllowed());
  const result = { allowed: [], suggested: [], notNeeded: [] };
  for (const [origin, count] of [...seen].sort((a, b) => b[1] - a[1])) {
    if (origin === targetOrigin) continue;
    const reason = reasonNotNeeded(origin);
    if (allowed.has(origin)) result.allowed.push({ origin, count });
    else if (reason) result.notNeeded.push({ origin, count, reason });
    else result.suggested.push({ origin, count });
  }
  return result;
}

/** Adds origins to ALLOWED_ORIGINS in a settings file, creating the line if it is missing. */
export function writeAllowedOrigins(file, origins) {
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const lines = text.split('\n');
  const index = lines.findIndex((l) => /^\s*ALLOWED_ORIGINS\s*=/.test(l));
  const existing = index >= 0 ? lines[index].split('=').slice(1).join('=').split(',').map((s) => s.trim()).filter(Boolean) : [];
  const merged = [...existing, ...origins.filter((o) => !existing.includes(o))];
  const line = `ALLOWED_ORIGINS=${merged.join(',')}`;
  if (index >= 0) lines[index] = line;
  else lines.push(line);
  writeFileSync(file, lines.join('\n').replace(/\n*$/, '\n'));
  return path.basename(file);
}
