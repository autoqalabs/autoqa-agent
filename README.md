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

## Usage

```bash
npm install
npx playwright install chromium

npm run generate                      # explore + write + run tests (headless)
npm run generate:headed               # same, with a visible browser for recording
node bin/autoqa.mjs generate --reset  # reset the demo store first (needs DEMO_ADMIN_TOKEN)
npm test                              # replay the generated suite, no AI involved
npm run report                        # open the HTML report
```

Copy `.env.example` to `.env` to set `TARGET_URL` or the demo store token. The token is used only by the runner for resets and is removed from the agent's environment.

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
