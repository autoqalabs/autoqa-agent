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

**3. Configure the settings**

Settings live in `.env` files that git ignores: one per site, plus a shared one (see "One settings file per site"). For a first run against the demo store, a plain `.env` is enough.

For a site with a login, also set `TEST_USERNAME` and `TEST_PASSWORD` (see "Sites with a login").

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
npm run generate:demo   # the agent explores the demo store, writes a suite and runs it
npm test                # replays that suite, no AI involved
```

This repo ships with no tests: `generated-tests/` and `runs/` start empty and the agent fills them. Until a suite has been generated, `npm test` reports that it found no tests.

In `npm run test:ui`, open the filter under the search box and tick both the `desktop` and `mobile` projects, or UI mode runs only the first one.

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
npm run check-login                   # sites with a login: confirm the test account can sign in
```

## One settings file per site

Each site you test gets its own settings file, `.env.<site>`, so switching sites never means editing a shared file:

```
.env              shared by every site (for example DEMO_ADMIN_TOKEN)
.env.myshop       TARGET_URL, test account, LOGIN_URL, ALLOWED_ORIGINS for one site
.env.otherapp     the same for another site
```

The agent picks the file in this order:

1. `--site <name>` on the command line: `npm run generate:demo -- --site myshop`.
2. The git branch: on `site/myshop` it reads `.env.myshop` with no flag needed.
3. Neither: only the shared `.env` is read.

When both files set a value, the site file wins. Each run prints the site and file it is using on its first lines. `npm test` and Playwright UI mode follow the same rules, so they always hit the same site as the agent.

To add a site: copy `.env.example` to `.env.<name>`, fill it in, and create the branch `site/<name>`. Git ignores every `.env.<site>` file, and the agent's file tools cannot open them.

## Sites with a login

Give the agent a dedicated test account in the site's settings file (`.env.<site>`, or `.env`):

```
TARGET_URL=https://staging.example.com
TEST_USERNAME=qa@example.com
TEST_PASSWORD='the password'
LOGIN_URL=https://staging.example.com/login   # optional
```

Then run `npm run check-login` (about a minute) before a full `generate`: it signs in and reports whether it worked.

How the credentials are handled:
- **The agent is not given them.** They are passed to its browser as secrets. The agent types the names `TEST_USERNAME` and `TEST_PASSWORD`, the browser fills in the real values, and the values are masked in everything the agent reads back.
- **They stay out of the logs.** The runner replaces the values with their names in the terminal output, in `events.jsonl` and so in the live panel.
- **They stay out of the tests.** Generated tests read `process.env`; `auth.setup.ts` signs in once and saves the session to `.auth/user.json`, which git ignores. Specs that need to be signed in reuse that session.
- **The agent cannot open `.env` or `.auth/`.** Its file tools are denied access to both.

This keeps credentials out of the agent's context, the logs and the repo. It is not a hard security boundary: the tests the agent writes do receive the password in order to sign in. Playwright traces of failed tests in `test-results/` (ignored by git) can also contain what was typed. So use a low-privilege test account on a test environment, never a real user's or an admin's.

**Apps that call another host.** The agent's browser only reaches the target's own address. If the app talks to an API on another host (say `api.example.com`), sign-in and data loading fail with a network error until you allow it: set `ALLOWED_ORIGINS=https://api.example.com` in `.env` (commas between several), or pass `--allow`. `check-login` reports the blocked host by name.

Limits: sign-in that needs a CAPTCHA, a one-time code (2FA) or an email link is not supported, and neither is sign-in through another site (Google, Microsoft), because the browser is locked to the target's address. One test account per run. In Playwright UI mode, tick the `setup` project in the filter once so the sign-in step runs.

## Live panel

`--panel` (used by the `:demo` scripts) opens a local page at `http://localhost:4400` that shows each step the agent takes as it happens:
- its narration;
- every browser action, file edit (with the before and after) and test run;
- the latest pass/fail count, the bug reports it files and the files it changed.

The page reads `runs/<run-id>/events.jsonl`, so choosing a past run in its menu replays it. Local paths and the machine's user name are stripped before anything reaches the page.

## Self-healing

When the app's UI changes, `npm run heal` re-runs the existing suite, reproduces each failure in the browser, repairs the tests that broke (a renamed button, a moved field) and re-runs to green. Failures caused by real defects are left failing, with a bug report for each.

To try it on the demo store:

1. **Generate** a suite while the store is on v1: `npm run generate:demo`.
2. **Switch to v2.** Open `https://autoqalabs-demo-store.vercel.app/demo-control?token=<DEMO_ADMIN_TOKEN>` once: it stores the token in a cookie and redirects to plain `/demo-control`. Select **v2** and **Save demo settings**. v2 renames the checkout button from "Checkout" to "Place order".
3. **Break.** `npm test`: the tests that submit the checkout form fail on the renamed button.
4. **Heal.** `npm run heal:demo`: the agent fixes the locator and re-runs to green. The panel shows each step. With planted bugs switched on, it also files bug reports and leaves those tests failing.
5. **Reset.** On the control page select **v1** and save, or use Reset store with "Also return to v1".

## Keep site work out of this repo

This repo holds the agent only: the runner, the skills, the panel and the config. The tests and reports the agent produces for a site belong to that site's owner, so they live in a separate private repo, on one branch per site.

**One-time setup.** Create a private repo for site work and add it to this folder as a second remote:

```bash
git remote add sites git@github.com:<you>/<private-repo>.git
```

**For each site:**

1. Start from the clean agent: `git checkout main`, then `git checkout -b site/<name>`.
2. Create its settings file, `.env.<name>` (see "One settings file per site"), and run the agent.
3. Commit, then push the branch to the private repo. The first push sets where the branch goes from then on:

   ```bash
   git push -u sites site/<name>
   git config branch.site/<name>.pushRemote sites
   ```

**Rules:**

- Never push a `site/<name>` branch to this repo, and never merge one into `main`.
- Improvements to the agent go the other way: commit them on `main`, then merge `main` into the site branch.
- In GitHub Desktop, do not use **Publish branch** or **Create Pull Request** on a site branch: both target this repo. Do the first push from the terminal as above; after that the push button goes to the private repo.

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
