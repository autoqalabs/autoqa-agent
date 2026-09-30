# Heal report: 20260930-080821-heal

Target: https://autoqalabs-demo-store.vercel.app
Date: 2026-09-30

## Summary

| | Before | After |
| --- | --- | --- |
| Passed | 16 | 25 |
| Failed | 9 | 0 |
| Total | 25 | 25 |

All 9 failures had the same root cause: the checkout submit button was renamed from "Checkout" to "Place order". One locator change in the checkout page object fixed all nine. No spec files or assertions were changed. No real bugs were found.

## Failures

| # | Test | Classification | Confidence |
| --- | --- | --- | --- |
| 1 | account.spec.ts › Account › registers, checks out signed in and sees the order in history | Broken locator | 97% |
| 2 | account.spec.ts › Promotions › refuses the new-customer code WELCOME10 on a second order | Broken locator | 97% |
| 3 | checkout.spec.ts › Checkout › completes checkout as a guest with the test card | Broken locator | 97% |
| 4 | checkout.spec.ts › Checkout › shows an error for every required field when the form is empty | Broken locator | 97% |
| 5 | checkout.spec.ts › Checkout › refuses the always-declined card and creates no order | Broken locator | 97% |
| 6 | checkout.spec.ts › Checkout › rejects an expired card | Broken locator | 97% |
| 7 | checkout.spec.ts › Checkout › keeps shipping details after a declined card so the customer can retry | Broken locator | 97% |
| 8 | security.spec.ts › Order privacy › does not show a guest order confirmation to a different browser session | Broken locator | 97% |
| 9 | mobile.spec.ts › Mobile › updates the cart and completes checkout on a phone @mobile (mobile project) | Broken locator | 97% |

### Evidence (applies to all nine)

- **Expected:** a button in `main` with the accessible name exactly "Checkout" on `/checkout`.
- **What the app did:** every failure timed out after 30 s in `CheckoutPage.submit()` (`generated-tests/pages/checkout.page.ts:66`), waiting for `getByRole('main').getByRole('button', { name: 'Checkout', exact: true })`. The same call log appears in all 9 entries in `playwright-report/results.json`.
- **Reproduced in the browser:** I added 2 × House Espresso to the cart and opened `/checkout`. The accessibility snapshot shows the form's only submit control as `button "Place order"`. The labels for Email, Full name, Street address, City, Postcode, Country, Card number, Expiry (MM/YY) and Security code, the "Checkout" h1, and the "Order summary" region all still match the page object.
- **Behaviour unchanged:** I filled the form by hand with the advertised test card (4242 4242 4242 4242, 12/30, 123) and clicked "Place order". The app went to `/order/HC-10515` with "Thank you, your order is confirmed", Subtotal $32.00, Shipping $6.00, Total paid $38.00 and "Paid with card ending 4242". All of these match the store's rules ($6 flat shipping under $50).
- **Rule check:** no number was wrong, nothing was accepted or rejected against the app's stated rules, and desktop and mobile behaved the same. Only the button's label changed, so this is a broken locator and not a bug.

## Locator changes

`generated-tests/pages/checkout.page.ts:34`

Before:
```ts
this.submitButton = main.getByRole('button', { name: 'Checkout', exact: true });
```

After:
```ts
this.submitButton = main.getByRole('button', { name: 'Place order', exact: true });
```

This was the only change. It is still a role-based locator with `exact: true`, which is the house style. No spec, assertion or test data was touched.

## Bugs

None. `bugs/` is empty for this run.

## Final result

`npx playwright test`: **25 passed, 0 failed** (24 desktop, 1 mobile).
