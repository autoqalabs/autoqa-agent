// Turns a run's bug reports into ClickUp subtasks under a parent task.
// Used by the review page (bin/review.mjs). The token is read here, in the
// runner, and never reaches the agent or the browser.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Read lazily so values loaded from .env by loadSiteEnv apply.
const api = () => process.env.CLICKUP_API_URL || 'https://api.clickup.com/api/v2';

// Bug severity (as the agent writes it) to ClickUp priority: 1 urgent, 2 high, 3 normal, 4 low.
const PRIORITY = { critical: 1, major: 2, minor: 3, trivial: 4 };

const slug = (file) => path.basename(file, '.md').replace(/[^A-Za-z0-9_-]+/g, '-');

/** The bug reports of one run, in file order, with what a ClickUp task needs. */
export function readBugs(runDir) {
  const bugsDir = path.join(runDir, 'bugs');
  if (!existsSync(bugsDir)) return [];
  return readdirSync(bugsDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((file) => {
      const markdown = readFileSync(path.join(bugsDir, file), 'utf8');
      const png = path.join(bugsDir, file.replace(/\.md$/, '.png'));
      return {
        id: slug(file),
        file,
        title: markdown.match(/^#\s+(.+)$/m)?.[1].trim() ?? path.basename(file, '.md'),
        severity: markdown.match(/^\**Severity\**\s*:\s*\**\s*([A-Za-z]+)/im)?.[1].toLowerCase() ?? null,
        markdown,
        screenshot: existsSync(png) ? png : null,
      };
    });
}

/** Accepts a task ID or a task URL such as https://app.clickup.com/t/86abc123 */
export function parseTaskId(input) {
  const trimmed = String(input).trim();
  return trimmed.match(/\/t\/(?:\d+\/)?([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/)?.[1] ?? trimmed;
}

async function call(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: token, ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  if (res.status === 401) throw new Error('ClickUp rejected the API token (401). Check CLICKUP_API_TOKEN.');
  if (res.status === 404) throw new Error('Task not found (404). Check the parent task ID.');
  throw new Error(`ClickUp ${res.status}: ${data.err || data.error || res.statusText}`);
}

/** The parent task: its name and link for the page, and the list its subtasks go in. */
export async function getTask(token, taskId) {
  const data = await call(token, 'GET', `${api()}/task/${encodeURIComponent(taskId)}`);
  return { id: data.id, name: data.name, url: data.url, listId: data.list?.id };
}

/**
 * Creates one subtask for a bug, then attaches its screenshot. A failed
 * attachment does not undo the task; it is reported in `warning`.
 */
export async function createBugTask(token, parent, bug, { runId, target } = {}) {
  const footer = [
    '',
    '---',
    `Found by AutoQA Agent${runId ? ` in run \`${runId}\`` : ''}${target ? ` on ${target}` : ''}.`,
  ].join('\n');
  const task = await call(token, 'POST', `${api()}/list/${parent.listId}/task`, {
    name: bug.title,
    markdown_content: bug.markdown.replace(/^#\s+.+\r?\n/m, '').trim() + '\n' + footer,
    parent: parent.id,
    tags: ['autoqa'],
    ...(PRIORITY[bug.severity] ? { priority: PRIORITY[bug.severity] } : {}),
  });

  let warning;
  if (bug.screenshot) {
    try {
      const form = new FormData();
      form.append('attachment', new Blob([readFileSync(bug.screenshot)], { type: 'image/png' }), path.basename(bug.screenshot));
      await call(token, 'POST', `${api()}/task/${task.id}/attachment`, form);
    } catch (error) {
      warning = `Task created, but the screenshot was not attached: ${error.message}`;
    }
  }
  return { taskId: task.id, url: task.url, warning };
}
