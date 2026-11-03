#!/usr/bin/env node
// Serves a run's report with a picker for sending its bug reports to ClickUp
// as subtasks of a parent task. Runs on 127.0.0.1 only and stops when you
// click "Finish review" or press Ctrl+C.
//
//   node bin/review.mjs                  newest run that has bug reports
//   node bin/review.mjs <run-id>         one run
//   options: --parent <task id or URL>   (default: CLICKUP_PARENT_TASK)
//            --port <n>                  (default: a free port)
//            --site <name>               read .env.<name>, as autoqa does
//
// Needs CLICKUP_API_TOKEN in .env. The token stays in this process: the page
// only gets a random per-run key, which every request must send back.

import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBugTask, getTask, parseTaskId, readBugs } from './clickup.mjs';
import { openInBrowser } from './panel.mjs';
import { renderHtmlReport } from './report-html.mjs';
import { loadSiteEnv } from './site-env.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = path.join(ROOT, 'runs');
const MAX_BODY = 64 * 1024;

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new Error('Request too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

/** The newest run that has at least one bug report. */
export function newestRunWithBugs() {
  if (!existsSync(RUNS)) return null;
  return readdirSync(RUNS).sort().reverse().find((id) => readBugs(path.join(RUNS, id)).length > 0) ?? null;
}

/**
 * Starts the review page for one run. Resolves with its URL and a `finished`
 * promise that settles when the user clicks "Finish review".
 */
export async function startReview({ runId, parent = '', port = 0, target } = {}) {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) throw new Error('Set CLICKUP_API_TOKEN in .env to send bugs to ClickUp (see .env.example).');

  const runDir = path.join(RUNS, runId);
  const bugs = readBugs(runDir);
  if (!bugs.length) throw new Error(`runs/${runId} has no bug reports to send.`);

  const sessionKey = randomBytes(24).toString('hex');
  const html = renderHtmlReport(runDir, { review: { sessionKey, defaultParent: parent } });
  if (!html) throw new Error(`runs/${runId} has no report.md or heal-report.md.`);

  const byId = new Map(bugs.map((b) => [b.id, b]));
  const created = new Map(); // bug id → created task, so a second click never duplicates
  let finish;
  const finished = new Promise((resolve) => (finish = resolve));

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method !== 'POST') return json(res, 404, { error: 'Not found' });
    if (req.headers['x-review-key'] !== sessionKey) {
      return json(res, 403, { error: 'This page is out of date. Open the link the terminal printed.' });
    }

    try {
      const body = await readBody(req);

      if (url.pathname === '/api/finish') {
        json(res, 200, { ok: true });
        return finish();
      }

      if (url.pathname === '/api/clickup/tasks') {
        const picked = (Array.isArray(body.bugIds) ? body.bugIds : []).map((id) => byId.get(String(id))).filter(Boolean);
        if (!String(body.parent ?? '').trim()) return json(res, 400, { error: 'Enter the parent task ID or URL.' });
        if (!picked.length) return json(res, 400, { error: 'Select at least one bug.' });

        const parentTask = await getTask(token, parseTaskId(body.parent));
        if (!parentTask.listId) return json(res, 400, { error: `"${parentTask.name}" has no list to add subtasks to.` });

        const results = [];
        let newOnes = 0;
        for (const bug of picked) {
          if (created.has(bug.id)) {
            results.push({ bugId: bug.id, ok: true, alreadyCreated: true, ...created.get(bug.id) });
            continue;
          }
          try {
            const task = await createBugTask(token, parentTask, bug, { runId, target });
            created.set(bug.id, { url: task.url, taskId: task.taskId });
            results.push({ bugId: bug.id, ok: true, ...task });
            newOnes++;
          } catch (error) {
            results.push({ bugId: bug.id, ok: false, error: error.message });
          }
        }
        if (newOnes) console.log(`  ClickUp: created ${newOnes} subtask(s) under "${parentTask.name}"`);
        return json(res, 200, { parent: { name: parentTask.name, url: parentTask.url }, results });
      }

      json(res, 404, { error: 'Not found' });
    } catch (error) {
      json(res, 502, { error: error.message });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}/`;
  return { url, bugs, finished: finished.then(() => server.close()), close: () => server.close() };
}

/** Serve the review page, open it, and wait until the user is done. */
export async function runReview({ runId, parent, port, target }) {
  const review = await startReview({ runId, parent, port, target });
  console.log(`\nClickUp review for runs/${runId}: ${review.bugs.length} bug report(s)`);
  console.log(`  ${review.url}`);
  console.log('  Tick the bugs to send, click "Create tasks", then "Finish review" (or press Ctrl+C).');
  openInBrowser(review.url);
  await Promise.race([review.finished, new Promise((resolve) => process.once('SIGINT', resolve))]);
  review.close();
  console.log('ClickUp review finished.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  loadSiteEnv({ root: ROOT, flag: opt('site') });
  const flagValues = new Set(['parent', 'port', 'site'].map(opt));
  const runId = args.find((a) => !a.startsWith('--') && !flagValues.has(a)) ?? newestRunWithBugs();
  if (!runId) {
    console.error('No run with bug reports found in runs/.');
    process.exit(1);
  }
  try {
    await runReview({
      runId,
      parent: opt('parent') ?? process.env.CLICKUP_PARENT_TASK ?? '',
      port: Number(opt('port') ?? 0),
      target: process.env.TARGET_URL,
    });
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
