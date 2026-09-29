# BUG-04 Country resets to "Select" after a failed checkout submit
Severity: minor
Area: Checkout form
Environment: https://autoqalabs-demo-store.vercel.app, Chromium (Desktop Chrome profile), 1280x720
Confidence: 90%

## Steps to reproduce
1. Add any product and open `/checkout`.
2. Fill Email, Full name, Street address, City, Postcode, Country "United States", and card 4000 0000 0000 0002 (always declined), 12/30, 123. Press Checkout.
3. See "Your card was declined. No payment was taken."
4. Enter the good card 4242 4242 4242 4242, 12/30, 123 and press Checkout again.

## Expected
Every shipping field the customer entered is kept after the failed attempt, including Country. Clearing card number and CVC is fine. Re-entering the card is enough to complete the order.

## Actual
Email, name, street, city and postcode are kept, but Country goes back to "Select". The retry then fails with "Please fix the highlighted fields." / "Choose a country." and the customer has to find and fix a field they already filled. The same reset happens after any server-side validation error, such as the expired card "This card has expired.".

## Evidence
- Failing test: `generated-tests/specs/checkout.spec.ts` › Checkout › "keeps shipping details after a declined card so the customer can retry". The Country `option:checked` expected "United States" and received "Select". It failed the same way in all 3 runs.
- Screenshot: `test-results/checkout-Checkout-keeps-sh-694fe-d-so-the-customer-can-retry-desktop/test-failed-1.png`
- Exploration: after the declined attempt, field values were `country=`, `cardNumber=`, `cvc=`, with every other field kept.
