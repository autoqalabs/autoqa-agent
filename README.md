# AutoQA agent

An AI testing agent from AutoQALabs. Give it a URL: it explores the app like a new QA engineer, writes a Playwright test suite, runs it, and reports real bugs. When the UI changes, it repairs broken locators and refuses to "fix" real bugs.

The agent is [Claude Code](https://code.claude.com) running headless, with a real browser through [Playwright MCP](https://github.com/microsoft/playwright-mcp) and QA expertise packaged as skills.

```
autoqa generate --url https://autoqalabs-demo-store.vercel.app
```

## How it works

| Piece | Where | Role |
| --- | --- | --- |
| Runner | `bin/autoqa.mjs` | Starts Claude Code headless, locks the browser to the target origin, streams every step to the terminal and to `runs/<id>/events.jsonl` |
| Rules | `CLAUDE.md` | Stay on the target, test data only, never weaken a test to hide a bug, narrate each step |
| Skills | `.claude/skills/` | `app-exploration`, `test-design`, `playwright-conventions`, `failure-triage` |
| Browser | Playwright MCP | Accessibility snapshots, clicks, forms, resize; restricted with `--allowed-origins` |
| Output | `generated-tests/`, `runs/<id>/` | Page objects and specs; journey map, test plan, bug reports, run report |

The skills are where the QA expertise lives. Tailoring them to a client's standards (naming, risk model, locator policy) changes how the agent works without touching the runner.

## Set up on a new machine

The demo store runs on Vercel, so only this repo is needed locally.

**1. Install**
- [Node.js 22 LTS](https://nodejs.org) and [Git](https://git-scm.com).
- Claude Code: `npm install -g @anthropic-ai/claude-code`, then run `claude` once and log in. The agent runs on the Claude subscription, so no API key is needed.
- For recording: [OBS](https://obsproject.com) or ffmpeg (`winget install ffmpeg` on Windows).

**2. Clone and install**

```bash
git clone https://github.com/autoqalabs/autoqa-agent.git
cd autoqa-agent
npm install
npx playwright install chromium
cp .env.example .env        # Windows cmd: copy .env.example .env
```

**3. Configure `.env`**

Set `DEMO_ADMIN_TOKEN` to the demo store's admin token. Copy it from an existing setup by hand; never commit it or share it in chat. The token is used only by the runner for store resets and is removed from the agent's environment. `TARGET_URL` can point the agent at another app.

**4. Git identity (only if you will commit from this machine)**

Commits to this repo use the company identity. Set it inside the repo before the first commit:

```bash
git config user.name "AutoQALabs"
git config user.email "334280884+autoqalabs@users.noreply.github.com"
```

Cloning and running need no GitHub login; pushing needs the company account's SSH key.

**5. Check it works**

```bash
npm test            # 25 passed while the store is on v1
npm run heal:demo   # agent run with a visible browser and the live panel
```

In `npm run test:ui`, open the filter under the search box and tick both the `desktop` and `mobile` projects, or UI mode shows 24 tests instead of 25.

## Usage

```bash
npm run generate                      # explore + write + run tests (headless)
npm run generate:demo                 # same, with a visible browser and the live panel
npm run heal                          # re-run the suite on a changed app, repair tests, report bugs
npm run heal:demo                     # same, with a visible browser and the live panel
node bin/autoqa.mjs generate --reset  # reset the demo store first (needs DEMO_ADMIN_TOKEN)
npm test                              # replay the generated suite, no AI involved
npm run test:ui                       # same, in Playwright UI mode
npm run report                        # open the HTML report
npm run panel                         # open the live panel on its own (follows the newest run)
```

## Live panel

`--panel` (used by the `:demo` scripts) opens a local page at `http://localhost:4400` that shows each step the agent takes as it happens:
- its narration;
- every browser action, file edit (with the before and after) and test run;
- the latest pass/fail count, the bug reports it files and the files it changed.

The page reads `runs/<run-id>/events.jsonl`, so choosing a past run in its menu replays it. Local paths and the machine's user name are stripped before anything reaches the page.

## Self-healing demo

The suite on `main` targets the store's v1 UI (checkout button "Checkout"). v2 renames it to "Place order".

1. **v1 baseline.** `npm run test:ui`, run all: 25 passed.
2. **Switch to v2.** Open `https://autoqalabs-demo-store.vercel.app/demo-control?token=<DEMO_ADMIN_TOKEN>` once (off camera): it stores the token in a cookie and redirects to plain `/demo-control`. Select **v2** and **Save demo settings**.
3. **Break.** Run all again in UI mode: the checkout, account, promotions and security tests fail on the renamed button.
4. **Heal.** `npm run heal:demo`: the agent reproduces the failures, fixes the one locator in the checkout page object and re-runs to green. The panel shows each step. With planted bugs switched on, it also files bug reports and leaves those tests failing.
5. **Green.** Run all in UI mode again: 25 passed.
6. **Reset.** On the control page select **v1** and save (or Reset store with "Also return to v1"), then `git checkout generated-tests` to undo the healed locator.

## Run output

```
runs/<run-id>/
  events.jsonl     every agent event (feeds the live reasoning panel)
  journeys.md      what the agent found while exploring
  test-plan.md     risk-rated cases and what it chose not to test
  bugs/            one report per real bug
  report.md        suite results and findings
```

## Demo target

[Halcyon Coffee Roasters](https://github.com/autoqalabs/demo-store), a store built for this demo with a v1/v2 UI switch (for self-healing) and planted bugs (for bug finding).
