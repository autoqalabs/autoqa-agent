// A signed-in session the operator saves by hand, for apps the agent cannot
// sign in to itself (2FA, SSO, CAPTCHA) or when you would rather not give it a
// password at all.
//
//   autoqa login      opens a browser at the app; you sign in, press Enter,
//                     and the session is saved to .auth/user.json
//
// Runs then load that file into the agent's browser (--storage-state) and the
// generated tests reuse it. The agent's file tools cannot read .auth/.

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

export const AUTH_DIR = '.auth';
export const AUTH_FILE = path.join(AUTH_DIR, 'user.json');
// Marks the session as one saved by `autoqa login`, so the test config does not
// run a sign-in setup step that would overwrite it.
export const SESSION_MARKER = path.join(AUTH_DIR, 'session.json');

/** The saved session, or null. `ageHours` helps warn about sessions that may have expired. */
export function savedSession(root) {
  const file = path.join(root, AUTH_FILE);
  const marker = path.join(root, SESSION_MARKER);
  if (!existsSync(file) || !existsSync(marker)) return null;
  try {
    const meta = JSON.parse(readFileSync(marker, 'utf8'));
    const ageHours = (Date.now() - Date.parse(meta.savedAt)) / 3_600_000;
    return { file, target: meta.target, savedAt: meta.savedAt, ageHours };
  } catch {
    return null;
  }
}

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, () => { rl.close(); resolve(); }));
}

/** Open a visible browser, let the operator sign in, and save the session. */
export async function saveSessionByHand({ root, target, loginUrl }) {
  const { chromium } = await import('@playwright/test');
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
  } catch (error) {
    throw new Error(`Could not open Chromium (${error.message.split('\n')[0]}). Run: npx playwright install chromium`);
  }
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  const start = loginUrl || target;
  console.log(`  Opening ${start}`);
  await page.goto(start).catch(() => {}); // a slow or failing first load is fine: the operator can navigate

  let closed = false;
  browser.on('disconnected', () => { closed = true; });
  console.log('\n  Sign in in the browser window (2FA and SSO are fine).');
  console.log('  When you can see the app signed in, come back here and press Enter.');
  console.log('  Close the browser instead to cancel.\n');
  await Promise.race([
    waitForEnter('  Press Enter to save the session… '),
    new Promise((resolve) => browser.on('disconnected', resolve)),
  ]);
  if (closed) throw new Error('Browser closed before Enter: nothing was saved.');

  mkdirSync(path.join(root, AUTH_DIR), { recursive: true });
  const file = path.join(root, AUTH_FILE);
  // IndexedDB too: apps using Firebase keep their sign-in there, not only in cookies.
  const state = await context.storageState({ path: file, indexedDB: true });
  chmodSync(file, 0o600);
  writeFileSync(
    path.join(root, SESSION_MARKER),
    JSON.stringify({ savedAt: new Date().toISOString(), target, url: page.url() }, null, 2),
    { mode: 0o600 },
  );
  await browser.close();
  process.stdin.pause();
  return { file, cookies: state.cookies.length, origins: state.origins.length };
}
