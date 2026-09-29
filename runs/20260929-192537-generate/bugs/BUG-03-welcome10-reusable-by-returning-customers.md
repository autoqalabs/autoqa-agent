# BUG-03 New-customer code WELCOME10 can be used again on every later order
Severity: major
Area: Promotions / checkout
Environment: https://autoqalabs-demo-store.vercel.app, Chromium (Desktop Chrome profile), 1280x720
Confidence: 85%. The footer on every page says "New customers: WELCOME10 for 10% off".

## Steps to reproduce
1. Register a new account (e.g. `customer+…@example.test`, password `TestPass123`).
2. Add House Espresso, apply `WELCOME10` in the cart, and check out with 4242 4242 4242 4242. The order is discounted, which is correct.
3. Add House Espresso again, apply `WELCOME10`, and check out again.

## Expected
The second order is refused the code (a cart or checkout message) and is not discounted, because the customer is no longer new.

## Actual
The cart accepts the code again ("Code WELCOME10 applied") and the second order is confirmed with "Discount (WELCOME10) −$1.60". This happened on exploration orders HC-10503 then HC-10504 (same account, both discounted), and again in every automated run.

## Evidence
- Failing test: `generated-tests/specs/account.spec.ts` › Promotions › "refuses the new-customer code WELCOME10 on a second order". Message: `second order was still discounted by WELCOME10`, expected 0 discount rows, received 1. It failed the same way in all 3 runs.
- Screenshot: `test-results/account-Promotions-refuses-0c1aa-WELCOME10-on-a-second-order-desktop/test-failed-1.png`
- Guest reuse (same email, second guest order) was not checked.
