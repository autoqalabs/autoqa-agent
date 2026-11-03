---
name: prd-testing
description: Test one feature against its PRD - turn every testable requirement into a numbered case, check each one (automated or by hand), and write a requirement-by-requirement report. Use when the task gives a PRD at runs/<run-id>/prd.md.
---

# PRD testing

Input: `runs/<run-id>/prd.md`, the feature's product requirements. Output: `test-plan.md`, specs in `generated-tests/`, bug reports, `report.md` and `summary.json` in the run folder.

The PRD is the contract. Every requirement in it gets a case and every case gets a result. A report that skips requirements is not finished.

## 1. Read the PRD into requirements

- Read the whole file before exploring. Note its sections (functional requirements, UI, limits, errors, permissions, i18n, APIs, workflows, analytics).
- Pull out every statement that is testable: a control that must exist, a default, a limit, a format, an error message, who may do what, what happens at a boundary (expired, scheduled, at the maximum, empty).
- Keep the PRD's own words for labels and messages, so the report can say where the build differs.
- Note what the PRD leaves open or contradicts. These become product questions, not bugs.

## 2. Write the test plan

`runs/<run-id>/test-plan.md`: one table per PRD area, cases numbered by area so the report can be traced back.

```markdown
# Test plan: <feature>

Source: <PRD title>, sections <list>. Target: <url>.

## A. <PRD section name>
| ID | Requirement (PRD section) | Steps | Expected | Check |
| --- | --- | --- | --- | --- |
| A-01 | <what the PRD says> (§A) | <steps> | <result> | automated |
| A-02 | ... | ... | ... | manual |
| A-03 | ... | ... | ... | not testable here: <why> |
```

**Check** is one of:
- `automated`: a Playwright test in `generated-tests/`. Prefer this for anything repeatable in one browser: forms, limits, menus, lists, messages, calculations.
- `manual`: you check it in the browser with the Playwright tools. Use it for one-off flows, things that take real time to happen (a code expiring in two minutes), and cross-page journeys that would be slow or brittle as a test.
- `not testable here`, with the reason: needs a real payment, an email inbox, a second user or role, a host outside the allowed origins, an API or workflow outside the UI, analytics events.

Plan boundary cases on purpose: the exact limit and one past it, empty, expired, not yet started, already used, assigned to someone else, case of codes and text.

## 3. Check every case

- Automated cases: the test title starts with the case ID (`A-07 rejects a 13-character prefix`). Triage failures with the failure-triage skill as usual.
- Manual cases: do the steps in the browser and keep evidence: the exact text on screen, the values, the URL, and a screenshot into `runs/<run-id>/bugs/` for anything that becomes a bug. Write down what you saw, not what you expected to see.
- Test data: name everything you create so it is obviously test data (`QA-<feature>-<what>`) and list it in the report. Never edit or delete records you did not create. Use test cards only where the app shows a test mode.
- If a case cannot be finished (the session expired, a host is blocked, the app errors), mark it `Not run` with the reason and move on.

## 4. Results

Give every case exactly one result:

| Result | Meaning |
| --- | --- |
| Pass | Works as the PRD says. |
| Pass (differs from PRD) | Works, but labels, wording or the control type differ from the PRD. Say how. |
| Pass (note) | Works, with something worth knowing (a UX issue, a slow step). |
| Partial | Part of the requirement is met. Say which part is missing. |
| Fail | The build contradicts the PRD or is broken. It has a bug report. |
| Decision | The PRD is unclear and the build made a choice. It goes under product decisions. |
| Inconclusive | You could not tell, for example the test browser blocks it. Say what to recheck. |
| Not run | Not checked, with the reason. |

Every `Fail` has a bug report in the failure-triage format. Order bug IDs by severity: critical first. Critical means money, security or data is at risk (a discount that should not apply, a lock that does not hold).

## 5. Report: `runs/<run-id>/report.md`

Use this structure and these headings:

```markdown
# AutoQA report: <feature> (PRD run)

Target: <url> · Run: <run-id> · Date: <yyyy-mm-dd>
Source: PRD "<title>" (sections <list>)

## Summary
| Tests | Passed | Failed | Partial | Open |
| --- | --- | --- | --- | --- |
| N | N | N | N | N |

<Two or three sentences: what works, what the most serious problem is.>
"Passed" counts every Pass variant. "Open" counts Decision, Inconclusive and Not run.

## Bugs
| ID | Title | Severity | File |
| --- | --- | --- | --- |
| BUG-01 | ... | critical | bugs/BUG-01-<slug>.md |

## Needs a product decision
- **<question>** <what the build does, which case, what the PRD says>.

## <PRD area A name> (A)
| ID | Case | Result | Notes |
| --- | --- | --- | --- |
| A-01 | ... | Pass | ... |

<one table per area>

## Stability
<as the failure-triage skill describes, for the automated cases>

## Not covered
- <requirement or area>: <why, and what is needed to test it>.

## Test data left in the app
- <record>: <state>.
```

Keep notes short and factual: the value or message you saw, the case it relates to, the bug ID.

## 6. Summary: `runs/<run-id>/summary.json`

Counts are of PRD cases, not of Playwright tests:

```json
{"tests": 45, "passed": 38, "failed": 4, "partial": 1, "open": 2, "flaky": 0, "bugs": 8, "automated": 30, "stability_runs": 3}
```

`passed + failed + partial + open` must equal `tests`. `flaky` and `stability_runs` are about the automated cases, as in the generate task.
