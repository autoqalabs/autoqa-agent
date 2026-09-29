# BUG-01 Guest order confirmation, with name, email and address, is visible to anyone who has the URL
Severity: critical
Area: Checkout / order confirmation (privacy)
Environment: https://autoqalabs-demo-store.vercel.app, Chromium (Desktop Chrome profile), 1280x720
Confidence: 90%

## Steps to reproduce
1. In browser A, add Stoneware Mug to the cart and check out as a guest with the test card 4242 4242 4242 4242.
2. Note the confirmation URL, e.g. `/order/HC-10514`.
3. Open a brand-new browser context B (no cookies, not signed in) and go to the same URL.

## Expected
Context B gets the 404 page (or a sign-in prompt) and none of the customer's personal data. That is how signed-in customers' orders already behave: after signing out, `/order/HC-10503` returns 404.

## Actual
Context B sees the full confirmation: "Thank you, your order is confirmed", the guest's email ("A confirmation would be sent to private+…@example.test"), full name, street address, city, postcode, country, items, totals and last 4 card digits.

Order numbers are sequential (`HC-10502`, `HC-10503`, `HC-10504`, … `HC-10514` seen in this run), so the URLs can be guessed. Some IDs returned 404 during exploration, so not every ID resolves, but any guest order that does resolve is exposed.

## Evidence
- Failing test: `generated-tests/specs/security.spec.ts` › Order privacy › "does not show a guest order confirmation to a different browser session". It failed the same way in all 3 runs.
- Assertion: `expect(strangerOrder.heading).toHaveCount(0)`, which received 1.
- Screenshot of the stranger context: `test-results/security-Order-privacy-doe-ddf47-a-different-browser-session-desktop/test-failed-2.png` (header shows "Sign in", "Cart 0", and the page shows the guest's email and address).
- Exploration: `/order/HC-10502` (guest) stayed viewable after signing in as a different account and after signing out. `/order/HC-10503` (account order) returned 404 once signed out.
