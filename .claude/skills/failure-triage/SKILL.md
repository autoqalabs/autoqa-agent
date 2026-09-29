---
name: failure-triage
description: Classify a failing test or an unexpected app behaviour as broken locator, timing, test data, test logic, or real bug, with evidence. Use whenever a generated test fails or the app does something surprising during exploration.
---

# Failure triage

A failing test is a question, not an instruction to change the test. Answer it with evidence before touching any file.

## Classify

| Class | Signature | Action |
| --- | --- | --- |
| Broken locator | Element not found, but the same control exists with a different name, role or position, and doing the step manually still works | Fix the locator (self-healing). Behaviour unchanged. |
| Timing | Passes on retry, or the element appears shortly after | Replace the wait with a web-first assertion on the result. Never add a sleep. |
| Test data | Depends on stock, an account, a code or state that changed | Fix the data or create it inside the test. |
| Test logic | The test asserts something the app never promised | Fix the test, and note why in the report. |
| **Real bug** | The app contradicts its own stated rules, the journey cannot be completed, or a value is computed wrongly | **Do not change the test.** Write a bug report. |

## Evidence required

Reproduce the step in the browser tools and look at the snapshot before deciding. State in one line each: what the test expected, what the app did, and which rule or promise that breaks. Give a confidence from 0 to 100 percent.

Treat it as a real bug when any of these hold, even if a locator also changed:
- a number is wrong (total, discount, shipping, stock, count);
- the app accepts something it says it rejects, or rejects something it says it accepts;
- the behaviour differs by viewport or input case when nothing says it should.

If confidence is below 80 percent for anything other than a real bug, report it as needs review instead of changing the test.

## Bug report: `runs/<run-id>/bugs/BUG-<nn>-<slug>.md`

```markdown
# BUG-01 <short title>
Severity: critical | major | minor
Area: <journey>
Environment: <URL>, <browser>, <viewport>

## Steps to reproduce
1. ...
## Expected
## Actual
## Evidence
Screenshot path, failing test name, relevant snapshot excerpt.
```
