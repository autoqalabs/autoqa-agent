# AutoQA agent

An AI testing agent from AutoQALabs. Give it the address of a web app and it:

1. explores the app like a new QA engineer;
2. writes a Playwright test suite for it;
3. runs the suite and reports real bugs;
4. repairs the tests when the app's UI changes, without hiding real bugs.

**This repo is the agent only.** The tests and reports it produces for a site are kept on a separate branch per site, in a private repo of your own. That keeps this repo clean and reusable for every site.

Start here:

- [1. Set up on a new machine](#1-set-up-on-a-new-machine) (once per machine)
- [2. Work on a site you have already tested](#2-work-on-a-site-you-have-already-tested)
- [3. Test a new web app](#3-test-a-new-web-app)
- [Rules](#rules)
- [Reference](#reference)

## 1. Set up on a new machine

Do this once per machine.

**Step 1. Install the tools**

- [Node.js 22 LTS](https://nodejs.org) and [Git](https://git-scm.com).
- Claude Code: `npm install -g @anthropic-ai/claude-code`, then run `claude` once and log in. The agent runs on the Claude subscription, so no API key is needed.

**Step 2. Get the agent**

```bash
git clone https://github.com/autoqalabs/autoqa-agent.git
cd autoqa-agent
npm install
npx playwright install chromium
```

**Step 3. Connect your private repo for site work**

Create an empty private repo for your sites' tests, then run this with its address:

```bash
npm run setup -- --sites git@github.com:<you>/<private-repo>.git
```

This adds the private repo as a second remote called `sites`, and installs a safety check that refuses to push site test work to the agent repo.

**Step 4. Bring in your existing sites (skip on a first-ever setup)**

```bash
git fetch sites
```

Settings files are never stored in git. Re-create each site's `.env.<name>` file from your password manager (see step 2 of [Test a new web app](#3-test-a-new-web-app) for what goes in one).

## 2. Work on a site you have already tested

Each tested site is a branch named `site/<name>`. Switching to the branch brings back that site's tests and reports, and the agent reads that site's settings file by itself.

| Step | Command |
| --- | --- |
| 1. Switch to the site | `git checkout site/<name>` |
| 2. Get the latest agent improvements | `git merge main` |
| 3. Run what you need | see below |
| 4. Save the results | `git add -A`, then `git commit -m "<what changed>"` |
| 5. Back up to the private repo | `git push` |

What to run in step 3:

| You want to | Command | Uses AI |
| --- | --- | --- |
| Re-run the existing tests | `npm test` | No |
| Repair the tests after the site changed | `npm run heal:demo` | Yes |
| Explore again and rewrite the suite | `npm run generate:demo` | Yes |

The first lines of every run show which site and settings file are in use. Check them before the agent starts.

## 3. Test a new web app

Before you start, check the app is one the agent can test:

- it is a web app, reachable in a browser;
- you have permission to test it, on a test environment and not production;
- if it has a login, you have a dedicated test account, and sign-in needs no CAPTCHA, one-time code or Google/Microsoft sign-in.

**Step 1. Create a branch for the site, from the clean agent**

```bash
git checkout main
git checkout -b site/<name>
```

**Step 2. Create the site's settings file**

Copy `.env.example` to `.env.<name>` and fill it in:

```
TARGET_URL=https://staging.example.com
TEST_USERNAME=qa@example.com          # only if the app has a login
TEST_PASSWORD='the password'          # only if the app has a login
```

The name must match the branch: branch `site/myshop` reads `.env.myshop`. Git ignores these files, so keep a copy of the credentials in a password manager.

**Step 3. Check the login (only if the app has one)**

```bash
npm run check-login
```

It takes about a minute. If it reports that another address was blocked (an API on a different host), add that address to the settings file as `ALLOWED_ORIGINS=https://api.example.com` and run it again.

**Step 4. Run the agent**

```bash
npm run generate:demo
```

A browser window shows the agent working, and a live panel opens at `http://localhost:4400` with every step. It takes roughly 15 to 25 minutes. When it finishes:

- the tests are in `generated-tests/`;
- the journey map, test plan, bug reports and final report are in `runs/<run-id>/`. Start with `report.md`.

**Step 5. Save the site to your private repo**

```bash
git add -A
git commit -m "first suite for <name>"
git push -u sites site/<name>
git config branch.site/<name>.pushRemote sites
```

The last two commands are needed only this first time. From then on, `git push` on this branch goes to the private repo.

The site is now an existing one: next time, follow [section 2](#2-work-on-a-site-you-have-already-tested).

## Rules

- **Never push a `site/<name>` branch to this repo, and never merge one into `main`.** The safety check from setup blocks the push.
- **Improve the agent on `main` only.** Each site branch picks the improvements up with `git merge main`. Changes never flow from a site branch back to `main`.
- **In GitHub Desktop, never use "Publish branch" or "Create Pull Request" on a site branch.** Both target this repo. Do the first push from the terminal (step 5 above); after that, Desktop's push button sends the branch to the private repo.

---

# Reference

## Commands

```bash
npm run setup                         # install the push safety check (add -- --sites <url> to connect the private repo)
npm run generate                      # explore + write + run tests (headless)
npm run generate:demo                 # same, with a visible browser and the live panel
npm run heal                          # re-run the suite on a changed app, repair tests, report bugs
npm run heal:demo                     # same, with a visible browser and the live panel
npm run check-login                   # sites with a login: confirm the test account can sign in
npm test                              # replay the generated suite, no AI involved
npm run test:ui                       # same, in Playwright UI mode
npm run report                        # open the HTML report
npm run panel                         # open the live panel on its own (follows the newest run)
```

The agent commands (`generate`, `heal`, `check-login`) and `npm test` accept `--site <name>` to use `.env.<name>` from any branch, for example `npm test -- --site myshop`.

In `npm run test:ui`, open the filter under the search box and tick every project (`desktop`, `mobile`, and `setup` for sites with a login), or UI mode runs only the first one.

## How it works

The agent is [Claude Code](https://code.claude.com) running headless, with a real browser through [Playwright MCP](https://github.com/microsoft/playwright-mcp) and QA expertise packaged as skills.

| Piece | Where | Role |
| --- | --- | --- |
| Runner | `bin/autoqa.mjs` | Starts Claude Code headless, locks the browser to the target origin, streams every step to the terminal and to `runs/<id>/events.jsonl` |
| Rules | `CLAUDE.md` | Stay on the target, test data only, never weaken a test to hide a bug, narrate each step |
| Skills | `.claude/skills/` | `app-exploration`, `test-design`, `playwright-conventions`, `failure-triage` |
| Browser | Playwright MCP | Accessibility snapshots, clicks, forms, resize; restricted with `--allowed-origins` |
| Output | `generated-tests/`, `runs/<id>/` | Page objects and specs; journey map, test plan, bug reports, run report |

The skills are where the QA expertise lives. Tailoring them to a client's standards (naming, risk model, locator policy) changes how the agent works without touching the runner.

## Settings files

```
.env              shared by every site (optional)
.env.myshop       TARGET_URL, test account, LOGIN_URL, ALLOWED_ORIGINS for one site
.env.otherapp     the same for another site
```

The agent picks the site file in this order:

1. `--site <name>` on the command line.
2. The git branch: on `site/myshop` it reads `.env.myshop`.
3. Neither: only the shared `.env` is read.

When both files set a value, the site file wins. `npm test` and Playwright UI mode follow the same rules, so they always hit the same site as the agent. Git ignores every one of these files, and the agent's file tools cannot open them. `.env.example` lists every setting.

## Sites with a login

How the test account's credentials are handled:

- **The agent is not given them.** They are passed to its browser as secrets. The agent types the names `TEST_USERNAME` and `TEST_PASSWORD`, the browser fills in the real values, and the values are masked in everything the agent reads back.
- **They stay out of the logs.** The runner replaces the values with their names in the terminal output, in `events.jsonl` and so in the live panel.
- **They stay out of the tests.** Generated tests read `process.env`; `auth.setup.ts` signs in once and saves the session to `.auth/user.json`, which git ignores. Specs that need to be signed in reuse that session.
- **The agent cannot open the settings files or `.auth/`.** Its file tools are denied access to both.

This keeps credentials out of the agent's context, the logs and the repo. It is not a hard security boundary: the tests the agent writes do receive the password in order to sign in. Playwright traces of failed tests in `test-results/` (ignored by git) can also contain what was typed. So use a low-privilege test account on a test environment, never a real user's or an admin's.

**Apps that call another host.** The agent's browser only reaches the target's own address. If the app talks to an API on another host (say `api.example.com`), sign-in and data loading fail with a network error until you allow it with `ALLOWED_ORIGINS` (commas between several), or `--allow` on the command line. `check-login` reports the blocked host by name.

**Limits.** Sign-in that needs a CAPTCHA, a one-time code (2FA) or an email link is not supported, and neither is sign-in through another site (Google, Microsoft), because the browser is locked to the target's address. One test account per run. Set `LOGIN_URL` if the sign-in page is hard to find from the app's navigation.

## Live panel

`--panel` (used by the `:demo` scripts) opens a local page at `http://localhost:4400` that shows each step the agent takes as it happens:

- its narration;
- every browser action, file edit (with the before and after) and test run;
- the latest pass/fail count, the bug reports it files and the files it changed.

The page reads `runs/<run-id>/events.jsonl`, so choosing a past run in its menu replays it. Local paths and the machine's user name are stripped before anything reaches the page.

## Self-healing

When the app's UI changes, `npm run heal` re-runs the existing suite, reproduces each failure in the browser, repairs the tests that broke (a renamed button, a moved field) and re-runs to green. Failures caused by real defects are left failing, with a bug report for each.

## Run output

```
runs/<run-id>/
  events.jsonl     every agent event (feeds the live panel; not committed)
  journeys.md      what the agent found while exploring
  test-plan.md     risk-rated cases and what it chose not to test
  bugs/            one report per real bug
  report.md        suite results and findings
```

## Demo store

[Halcyon Coffee Roasters](https://github.com/autoqalabs/demo-store) is a store built to try the agent on. It has a v1/v2 UI switch for self-healing and planted bugs for bug finding. With no settings file, the agent targets it by default.

To try self-healing on it:

1. **Generate** a suite while the store is on v1: `npm run generate:demo`.
2. **Switch to v2.** Open `https://autoqalabs-demo-store.vercel.app/demo-control?token=<DEMO_ADMIN_TOKEN>` once: it stores the token in a cookie and redirects to plain `/demo-control`. Select **v2** and **Save demo settings**. v2 renames the checkout button from "Checkout" to "Place order".
3. **Break.** `npm test`: the tests that submit the checkout form fail on the renamed button.
4. **Heal.** `npm run heal:demo`: the agent fixes the locator and re-runs to green. With planted bugs switched on, it also files bug reports and leaves those tests failing.
5. **Reset.** On the control page select **v1** and save, or use Reset store with "Also return to v1".

`DEMO_ADMIN_TOKEN` goes in the shared `.env`. It is used only by the runner (`--reset` restores the store before a run) and is removed from the agent's environment. Never commit it.

## Committing to this repo

Commits here use the company identity. Set it inside the repo before the first commit:

```bash
git config user.name "AutoQALabs"
git config user.email "334280884+autoqalabs@users.noreply.github.com"
```

Cloning and running need no GitHub login; pushing needs the company account's SSH key.
