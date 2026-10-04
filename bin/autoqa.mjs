#!/usr/bin/env node
// autoqa: runs Claude Code headless as a QA agent against a target web app.
//
//   autoqa generate --url <target> [--headed] [--panel] [--model <id>] [--reset]
//   autoqa heal     --url <target> [--headed] [--panel] [--model <id>]
//   autoqa check-login --url <target> [--headed]
//   autoqa test     [--url <target>]
//
// Sites that need a login: set TEST_USERNAME and TEST_PASSWORD in .env (and
// LOGIN_URL or --login-url if the sign-in page is not obvious). The values go
// to the browser as secrets and to the test process as environment variables;
// the agent only ever sees their names.
//
// The browser is locked to the target's origin. If the app calls an API or
// loads assets from another host, list those in ALLOWED_ORIGINS in .env (or
// --allow), separated by commas.
//
// Each run gets runs/<run-id>/ with the raw event stream (events.jsonl) that
// the live reasoning panel reads, plus whatever the agent writes there.

import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openInBrowser, startPanel } from './panel.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_URL = 'https://autoqalabs-demo-store.vercel.app';

// ---------- args and env ----------

function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) opts[key] = true;
    else opts[key] = next, i++;
  }
  return { command, opts };
}

function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function runId(command) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  return `${stamp}-${command}`;
}

// ---------- demo store control (optional, never exposed to the agent) ----------

async function resetDemoStore(target) {
  const token = process.env.DEMO_ADMIN_TOKEN;
  if (!token) {
    console.log('  (no DEMO_ADMIN_TOKEN in .env, skipping store reset)');
    return;
  }
  const res = await fetch(new URL('/api/demo/reset', target), {
    method: 'POST',
    headers: { 'x-demo-token': token, 'content-type': 'application/json' },
    body: JSON.stringify({ resetConfig: false }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Store reset failed: ${res.status} ${JSON.stringify(body)}`);
  console.log(`  store reset, running UI ${body.config?.version ?? '?'}`);
}

// ---------- extra origins (optional) ----------

// Hosts besides the target that the browser may reach, such as the app's API.
function extraOrigins() {
  return (process.env.ALLOWED_ORIGINS ?? '')
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value.includes('://') ? value : `https://${value}`).origin;
      } catch {
        throw new Error(`ALLOWED_ORIGINS has an invalid entry: ${value}`);
      }
    });
}

// ---------- test account (optional) ----------

const SECRET_NAMES = ['TEST_USERNAME', 'TEST_PASSWORD'];

// The test account from .env, or null when the target needs no login.
function loginConfig(opts) {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;
  if (!username && !password) return null;
  if (!username || !password) throw new Error('Set both TEST_USERNAME and TEST_PASSWORD in .env, or neither.');
  const loginUrl = typeof opts['login-url'] === 'string' ? opts['login-url'] : process.env.LOGIN_URL;
  return { loginUrl };
}

// Secrets file for the browser, in dotenv format. It lives outside the repo so
// the agent's file tools cannot reach it, and is deleted when the run ends.
function writeSecretsFile() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'autoqa-'));
  const file = path.join(dir, 'secrets.env');
  // dotenv has no escapes inside quotes, so wrap the value in a quote character it does not contain.
  const quote = (v) => {
    const q = ["'", '`', '"'].find((c) => !v.includes(c));
    if (!q || /[\r\n]/.test(v)) throw new Error('TEST_USERNAME / TEST_PASSWORD cannot contain line breaks or all three quote characters.');
    return q + v + q;
  };
  writeFileSync(file, SECRET_NAMES.map((n) => `${n}=${quote(process.env[n])}`).join('\n') + '\n', { mode: 0o600 });
  const remove = () => rmSync(dir, { recursive: true, force: true });
  process.on('exit', remove);
  return { file, remove };
}

// Replace secret values with their names in anything that is logged or shown.
function makeRedactor() {
  const pairs = [];
  for (const name of SECRET_NAMES) {
    const value = process.env[name];
    if (!value) continue;
    pairs.push([value, `[${name}]`]);
    const json = JSON.stringify(value).slice(1, -1);
    if (json !== value) pairs.push([json, `[${name}]`]);
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  return (text) => pairs.reduce((t, [value, label]) => t.replaceAll(value, label), text);
}

function loginBrief(login) {
  if (!login) return '';
  return `

Test account: this app has features behind a login, and a test account is provided.
- Its credentials are browser secrets named TEST_USERNAME and TEST_PASSWORD. To sign in, type the secret's name as the text (for example type TEST_PASSWORD into the password field) and the browser fills in the real value. Values are masked in everything you read back.
- ${login.loginUrl ? `Sign-in page: ${login.loginUrl}` : 'Find the sign-in page from the app navigation.'}
- You never need the real values. Do not try to read, print, guess or write them anywhere, and do not open .env. Tests read them from process.env.TEST_USERNAME and process.env.TEST_PASSWORD; follow the Authentication section of the playwright-conventions skill.
- If sign-in needs a CAPTCHA, a one-time code or an email link, stop trying, say so in the report and test only what is reachable.`;
}

// ---------- prompts ----------

function generatePrompt({ target, id, login }) {
  return `You are the AutoQA agent. Target app: ${target}
Run id: ${id}. Write all run output to runs/${id}/.${loginBrief(login)}

Task: explore this app you have never seen, then write and run an automated Playwright test suite for it, and report real bugs.

1. Load the app-exploration skill. Explore ${target} with the Playwright browser tools and write runs/${id}/journeys.md.
2. Load the test-design skill. Write runs/${id}/test-plan.md.
3. Load the playwright-conventions skill. Write page objects, fixtures, data and specs under generated-tests/. Tests use relative URLs; the base URL comes from playwright.config.ts. Tag viewport-specific tests with @mobile in the title.
4. Run \`npx playwright test\`. For every failure, load the failure-triage skill and classify it. Fix test mistakes. Do not change tests to hide real bugs; write a bug report in runs/${id}/bugs/ instead.
5. Write runs/${id}/report.md: suite summary (tests, passed, failed), what each failure means, the bug list with severity, and anything you chose not to test.

Keep narrating in one short sentence before each meaningful step.`;
}

function healPrompt({ target, id, login }) {
  return `You are the AutoQA agent. Target app: ${target}
Run id: ${id}. Write all run output to runs/${id}/.${loginBrief(login)}

Task: the existing Playwright suite in generated-tests/ was green on an earlier version of this app. The app has changed since. Run the suite, work out why each test fails, repair what is broken in the tests, and report what is broken in the app.

1. Run \`npx playwright test\`. List every failing test.
2. Load the failure-triage skill. For each failure, open the app with the Playwright browser tools and reproduce it. Classify it with evidence.
3. Broken locator, timing or test data: repair it. Fix the page object, not the spec, when the locator lives there. Load the playwright-conventions skill first and keep its house style. Change only what the evidence shows has changed.
4. Real bug: do not touch the test's assertions. Write a bug report in runs/${id}/bugs/.
5. Run the full suite again. Every remaining failure must be a real bug you reported.
6. Write runs/${id}/heal-report.md: each failure, its classification and evidence, the exact locator changes (before and after), the bug list with severity, and the final pass/fail count.

Keep narrating in one short sentence before each meaningful step.`;
}

function checkLoginPrompt({ target, login }) {
  return `You are the AutoQA agent. Target app: ${target}${loginBrief(login)}

Task: check that the test account can sign in. Do nothing else.

1. Open the sign-in page and sign in with the secrets.
2. Confirm you are signed in from what the page shows (an account page, a greeting, a sign-out control).
3. Reply with exactly one final line: "LOGIN_OK: <what proves it>" or "LOGIN_FAILED: <what the page said or what blocked you>".

Do not write any files. Keep narrating in one short sentence before each step.`;
}

// ---------- event stream ----------

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

function describeTool(name, input = {}) {
  const short = name.replace(/^mcp__playwright__browser_/, 'browser.');
  if (input.url) return `${short} ${input.url}`;
  if (input.element) return `${short} "${input.element}"`;
  if (input.command) return `${short} ${String(input.command).slice(0, 80)}`;
  if (input.file_path) return `${short} ${path.relative(ROOT, input.file_path) || input.file_path}`;
  if (input.skill) return `${short} ${input.skill}`;
  return short;
}

function printEvent(event) {
  if (event.type === 'assistant') {
    for (const block of event.message?.content ?? []) {
      if (block.type === 'text' && block.text.trim()) console.log(cyan('● ') + block.text.trim());
      if (block.type === 'tool_use') console.log(dim(`  → ${describeTool(block.name, block.input)}`));
    }
  } else if (event.type === 'result') {
    const cost = event.total_cost_usd != null ? `, ~$${event.total_cost_usd.toFixed(2)} API-equivalent` : '';
    console.log(green(`\n✓ ${event.subtype} in ${Math.round((event.duration_ms ?? 0) / 1000)}s, ${event.num_turns ?? '?'} turns${cost}`));
  }
}

function runAgent({ prompt, target, id, headed, model, login, onResult }) {
  const runDir = path.join(ROOT, 'runs', id);
  mkdirSync(path.join(runDir, 'bugs'), { recursive: true });

  const origin = new URL(target).origin;
  const origins = [origin, ...extraOrigins()].filter((o, i, all) => all.indexOf(o) === i);
  const mcpArgs = [
    path.join(ROOT, 'node_modules', '@playwright', 'mcp', 'cli.js'),
    '--isolated',
    `--allowed-origins=${origins.join(';')}`,
    `--output-dir=${path.join(runDir, 'browser')}`,
    '--viewport-size=1440,900',
  ];
  if (!headed) mcpArgs.push('--headless');
  const secrets = login ? writeSecretsFile() : null;
  if (secrets) mcpArgs.push(`--secrets=${secrets.file}`);
  const redact = makeRedactor();
  const mcpConfig = path.join(runDir, 'mcp.json');
  writeFileSync(
    mcpConfig,
    JSON.stringify({ mcpServers: { playwright: { command: process.execPath, args: mcpArgs } } }, null, 2),
  );

  // Permissions go in a settings file: tool patterns with spaces and parentheses
  // do not survive the Windows shell as CLI arguments.
  const settingsFile = path.join(runDir, 'settings.json');
  writeFileSync(
    settingsFile,
    JSON.stringify(
      {
        permissions: {
          allow: [
            'mcp__playwright',
            'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill', 'TodoWrite',
            'Bash(npx playwright test:*)',
            'Bash(npx playwright show-report:*)',
          ],
          // One shell only, so the agent's test commands match the rules in CLAUDE.md.
          // Credentials and saved sessions are off limits to the agent's file tools.
          deny: [
            'WebFetch', 'WebSearch', 'PowerShell',
            'Read(./.env)', 'Read(./.env.*)', 'Read(./.auth/**)',
            'Edit(./.env)', 'Edit(./.env.*)', 'Edit(./.auth/**)',
          ],
        },
      },
      null,
      2,
    ),
  );

  // Relative paths only: the repo lives under a folder name with a space.
  const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--mcp-config', rel(mcpConfig),
    '--strict-mcp-config',
    '--settings', rel(settingsFile),
    '--permission-mode', 'acceptEdits',
  ];
  if (model) args.push('--model', model);

  const events = createWriteStream(path.join(runDir, 'events.jsonl'));
  const child = spawn('claude', args, {
    cwd: ROOT,
    env: { ...process.env, TARGET_URL: target, DEMO_ADMIN_TOKEN: '' },
    shell: process.platform === 'win32',
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  child.stdin.end(prompt); // prompt via stdin avoids shell quoting of a multi-line string

  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = redact(buffer.slice(0, nl).trim());
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      events.write(line + '\n');
      try {
        const event = JSON.parse(line);
        printEvent(event);
        if (event.type === 'result') onResult?.(event);
      } catch {
        console.log(line);
      }
    }
  });

  return new Promise((resolve) => {
    child.on('close', (code) => {
      secrets?.remove();
      events.end();
      console.log(dim(`\nRun output: runs/${id}/`));
      resolve(code ?? 1);
    });
  });
}

// ---------- commands ----------

// With --panel, open the live reasoning panel before the agent starts and keep
// it up after the run so the final state stays on screen.
async function withPanel(opts, run) {
  if (!opts.panel) return run();
  const port = Number(process.env.PANEL_PORT ?? 4400);
  await startPanel({ port, waitForNew: true });
  const url = `http://localhost:${port}/`;
  console.log(`  live panel: ${url}`);
  openInBrowser(url);
  const code = await run();
  console.log(dim('Panel still open. Press Ctrl+C to exit.'));
  void code;
  return new Promise(() => {});
}

async function main() {
  loadDotEnv();
  const { command, opts } = parseArgs(process.argv.slice(2));
  const target = typeof opts.url === 'string' ? opts.url : process.env.TARGET_URL ?? DEFAULT_URL;
  if (typeof opts.allow === 'string') process.env.ALLOWED_ORIGINS = opts.allow;
  if (extraOrigins().length) console.log(`  also allowed: ${extraOrigins().join(', ')}`);

  if (command === 'generate') {
    const id = runId(command);
    console.log(`AutoQA generate → ${target}  (run ${id})`);
    if (opts.reset) await resetDemoStore(target);
    const login = loginConfig(opts);
    if (login) console.log('  test account: TEST_USERNAME / TEST_PASSWORD from .env');
    process.exit(
      await withPanel(opts, () =>
        runAgent({ prompt: generatePrompt({ target, id, login }), target, id, headed: !!opts.headed, model: opts.model, login }),
      ),
    );
  }

  if (command === 'heal') {
    const id = runId(command);
    console.log(`AutoQA heal → ${target}  (run ${id})`);
    const login = loginConfig(opts);
    if (login) console.log('  test account: TEST_USERNAME / TEST_PASSWORD from .env');
    process.exit(
      await withPanel(opts, () =>
        runAgent({ prompt: healPrompt({ target, id, login }), target, id, headed: !!opts.headed, model: opts.model, login }),
      ),
    );
  }

  if (command === 'check-login') {
    const login = loginConfig(opts);
    if (!login) throw new Error('No test account: set TEST_USERNAME and TEST_PASSWORD in .env first.');
    const id = runId(command);
    console.log(`AutoQA check-login → ${target}  (run ${id})`);
    let verdict = '';
    await runAgent({
      prompt: checkLoginPrompt({ target, login }), target, id, headed: !!opts.headed, model: opts.model, login,
      onResult: (event) => (verdict = String(event.result ?? '')),
    });
    const ok = /LOGIN_OK/.test(verdict) && !/LOGIN_FAILED/.test(verdict);
    console.log(ok ? green('Login works.') : '\x1b[31mLogin did not work. See the last line above.\x1b[0m');
    process.exit(ok ? 0 : 1);
  }

  if (command === 'test') {
    const child = spawn('npx', ['playwright', 'test'], {
      cwd: ROOT,
      env: { ...process.env, TARGET_URL: target },
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });
    child.on('close', (code) => process.exit(code ?? 1));
    return;
  }

  console.log(`Usage:
  autoqa generate --url <target> [--headed] [--panel] [--reset] [--model <id>]
  autoqa heal --url <target> [--headed] [--panel] [--model <id>]
  autoqa check-login --url <target> [--headed]
  autoqa test [--url <target>]

Sites with a login: set TEST_USERNAME and TEST_PASSWORD in .env (optional LOGIN_URL or --login-url).
Apps that call another host (an API subdomain): set ALLOWED_ORIGINS in .env or pass --allow <host,host>.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
