#!/usr/bin/env node
// autoqa: runs Claude Code headless as a QA agent against a target web app.
//
//   autoqa generate --url <target> [--headed] [--panel] [--model <id>] [--reset]
//   autoqa heal     --url <target> [--headed] [--panel] [--model <id>]
//   autoqa test     [--url <target>]
//
// Each run gets runs/<run-id>/ with the raw event stream (events.jsonl) that
// the live reasoning panel reads, plus whatever the agent writes there.

import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

// ---------- prompts ----------

function generatePrompt({ target, id }) {
  return `You are the AutoQA agent. Target app: ${target}
Run id: ${id}. Write all run output to runs/${id}/.

Task: explore this app you have never seen, then write and run an automated Playwright test suite for it, and report real bugs.

1. Load the app-exploration skill. Explore ${target} with the Playwright browser tools and write runs/${id}/journeys.md.
2. Load the test-design skill. Write runs/${id}/test-plan.md.
3. Load the playwright-conventions skill. Write page objects, fixtures, data and specs under generated-tests/. Tests use relative URLs; the base URL comes from playwright.config.ts. Tag viewport-specific tests with @mobile in the title.
4. Run \`npx playwright test\`. For every failure, load the failure-triage skill and classify it. Fix test mistakes. Do not change tests to hide real bugs; write a bug report in runs/${id}/bugs/ instead.
5. Write runs/${id}/report.md: suite summary (tests, passed, failed), what each failure means, the bug list with severity, and anything you chose not to test.

Keep narrating in one short sentence before each meaningful step.`;
}

function healPrompt({ target, id }) {
  return `You are the AutoQA agent. Target app: ${target}
Run id: ${id}. Write all run output to runs/${id}/.

Task: the existing Playwright suite in generated-tests/ was green on an earlier version of this app. The app has changed since. Run the suite, work out why each test fails, repair what is broken in the tests, and report what is broken in the app.

1. Run \`npx playwright test\`. List every failing test.
2. Load the failure-triage skill. For each failure, open the app with the Playwright browser tools and reproduce it. Classify it with evidence.
3. Broken locator, timing or test data: repair it. Fix the page object, not the spec, when the locator lives there. Load the playwright-conventions skill first and keep its house style. Change only what the evidence shows has changed.
4. Real bug: do not touch the test's assertions. Write a bug report in runs/${id}/bugs/.
5. Run the full suite again. Every remaining failure must be a real bug you reported.
6. Write runs/${id}/heal-report.md: each failure, its classification and evidence, the exact locator changes (before and after), the bug list with severity, and the final pass/fail count.

Keep narrating in one short sentence before each meaningful step.`;
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

function runAgent({ prompt, target, id, headed, model }) {
  const runDir = path.join(ROOT, 'runs', id);
  mkdirSync(path.join(runDir, 'bugs'), { recursive: true });

  const origin = new URL(target).origin;
  const mcpArgs = [
    path.join(ROOT, 'node_modules', '@playwright', 'mcp', 'cli.js'),
    '--isolated',
    `--allowed-origins=${origin}`,
    `--output-dir=${path.join(runDir, 'browser')}`,
    '--viewport-size=1440,900',
  ];
  if (!headed) mcpArgs.push('--headless');
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
          deny: ['WebFetch', 'WebSearch', 'PowerShell'],
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
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      events.write(line + '\n');
      try {
        printEvent(JSON.parse(line));
      } catch {
        console.log(line);
      }
    }
  });

  return new Promise((resolve) => {
    child.on('close', (code) => {
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

  if (command === 'generate') {
    const id = runId(command);
    console.log(`AutoQA generate → ${target}  (run ${id})`);
    if (opts.reset) await resetDemoStore(target);
    process.exit(
      await withPanel(opts, () =>
        runAgent({ prompt: generatePrompt({ target, id }), target, id, headed: !!opts.headed, model: opts.model }),
      ),
    );
  }

  if (command === 'heal') {
    const id = runId(command);
    console.log(`AutoQA heal → ${target}  (run ${id})`);
    process.exit(
      await withPanel(opts, () =>
        runAgent({ prompt: healPrompt({ target, id }), target, id, headed: !!opts.headed, model: opts.model }),
      ),
    );
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
  autoqa test [--url <target>]`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
