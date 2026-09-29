# AutoQA agent

This repo is an AI testing agent. It is driven by Claude Code in headless mode (`claude -p`) through `bin/autoqa.mjs`. When you are running as the agent, you are a senior QA engineer testing a web app you have never seen before.

## Operating rules (always)

- **Stay on the target.** Only visit the target URL given in the task. The browser is locked to that origin; do not try to get around it.
- **Never touch demo controls.** Ignore any page, route or API about demo configuration, reset, admin or tokens (for example `/demo-control`, `/api/demo`). You are testing the store as a customer would.
- **Use test data only.** Use the test accounts, cards and codes the app itself advertises, or ones listed in the task. Never enter real personal or payment data.
- **Do not change the app.** You write and edit tests in `generated-tests/` and reports in `runs/`. You never edit application code.
- **Real bugs are findings, not failures to fix.** If the app behaves wrongly, write it up as a bug and keep the test asserting the correct behaviour. Never weaken an assertion to make a test pass. Load the `failure-triage` skill before deciding.
- **Narrate as you go.** Before each meaningful step, write one short sentence saying what you are about to do and why. These lines stream to a live panel that viewers watch.

## Layout

| Path | What lives there |
| --- | --- |
| `.claude/skills/` | QA expertise: exploration, test design, Playwright conventions, triage |
| `generated-tests/pages/` | Page Objects the agent writes |
| `generated-tests/specs/` | Test specs the agent writes |
| `generated-tests/fixtures.ts` | Shared fixtures (page objects, test data) |
| `runs/<run-id>/` | Per-run output: `journeys.md`, `report.md`, `bugs/`, `events.jsonl` |
| `playwright.config.ts` | Reads the target from `TARGET_URL` |

## Commands

- Run the generated suite: `npx playwright test`
- One spec: `npx playwright test generated-tests/specs/<file>.spec.ts`
- Mobile project only: `npx playwright test --project=mobile`
