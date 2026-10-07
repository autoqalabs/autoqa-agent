> **Sample output.** This is the report the AutoQA Agent wrote, unedited, at the end of its first run against our own demo store, [Halcyon Coffee Roasters](https://github.com/autoqalabs/demo-store). It had never seen the app. In about 18 minutes it explored the store, wrote 25 Playwright tests and found 4 real bugs, which have since been fixed.
>
> The files the report refers to (bug reports, journey map, test plan, test files) are the rest of that run's output and are not included here.

# AutoQA report: Halcyon Coffee Roasters

Run: `20260929-192537-generate` · Target: https://autoqalabs-demo-store.vercel.app · Date: 2026-09-29

## Suite summary

| | Count |
| --- | --- |
| Tests | 25 (24 desktop, 1 mobile / Pixel 7) |
| Passed | 21 |
| Failed | 4. All are real app bugs, none are test defects |
| Flaky | 0. The 4 failures behaved the same in all 3 runs |

Run with `npx playwright test`. HTML report: `playwright-report/`; JSON: `playwright-report/results.json`.

Spec files: `generated-tests/specs/{checkout,cart,catalogue,product,account,security,mobile}.spec.ts`, with page objects in `generated-tests/pages/`, fixtures in `generated-tests/fixtures.ts` and data in `generated-tests/data.ts`. Test cases map to `test-plan.md` T01-T25.

## What each failure means

| Test | Class | Meaning |
| --- | --- | --- |
| `security.spec.ts` › does not show a guest order confirmation to a different browser session | Real bug → BUG-01 | Anyone with (or guessing) a sequential `/order/HC-NNNNN` URL can read a guest's name, email, address and order. |
| `cart.spec.ts` › never charges more after applying a discount code | Real bug → BUG-02 | At a $50 cart, WELCOME10 knocks off $5 but adds $6 shipping, so the total goes up to $51.00. |
| `account.spec.ts` › Promotions › refuses the new-customer code WELCOME10 on a second order | Real bug → BUG-03 | The "new customers" code is accepted on every order, not just the first. |
| `checkout.spec.ts` › keeps shipping details after a declined card so the customer can retry | Real bug → BUG-04 | After a declined or invalid payment, Country resets to "Select" and the retry fails with "Choose a country." |

The failing tests assert the correct behaviour and were deliberately left red. None were weakened or marked `test.fail()`.

### Test mistakes found and fixed during triage
1. **Broken locator, "Added N × … to your cart." (16 tests in run 1).** My regex was anchored with `$`, but the paragraph also contains the "View cart" link text. I removed the end anchor and changed the one exact-text assertion to `toContainText`. Behaviour is unchanged.
2. **Broken locator, cart quantity (3 tests in run 2).** `getByLabel('Quantity of X')` also matched the "Increase/Decrease quantity of X" buttons, which is a strict-mode violation. I added `exact: true`.

## Bug list

| ID | Title | Severity | Report |
| --- | --- | --- | --- |
| BUG-01 | Guest order confirmation (name, email, address) visible to anyone with the URL; IDs are sequential | critical | `bugs/BUG-01-guest-order-visible-to-anyone.md` |
| BUG-02 | Applying WELCOME10 can raise the order total ($50.00 → $51.00) | major | `bugs/BUG-02-discount-code-increases-total.md` |
| BUG-03 | New-customer code WELCOME10 reusable on every later order | major | `bugs/BUG-03-welcome10-reusable-by-returning-customers.md` |
| BUG-04 | Country resets to "Select" after a failed checkout submit | minor | `bugs/BUG-04-country-reset-after-failed-checkout.md` |

Screenshots for each bug are in `test-results/<test>/test-failed-*.png` from the last run. Paths are listed in each bug report. That folder is overwritten on the next run.

## What works well (verified by passing tests)
- Guest and signed-in checkout with the test card; confirmation totals match the cart; cart empties afterwards.
- Checkout validation: all 9 required-field messages; declined card refused without creating an order; expired card rejected.
- Cart maths: subtotal, $6 flat shipping, "Add $X more for free shipping" hint, free shipping at exactly $50, 10% WELCOME10 (case-insensitive), removing the code, invalid code message, removing the last item.
- Catalogue: price sort, category + roast filters combined, case-insensitive search, "No matches" empty state, 404 page.
- Product: grind and quantity carried into the cart; sold-out product has a disabled "Sold out" button.
- Accounts: registration (8-character minimum enforced), generic wrong-password message, `/account` redirects to sign-in, sign out and back in, order history lists new orders.
- Mobile (Pixel 7): cart quantity update, no horizontal overflow, checkout completes.

## Chosen not to test
- Demo controls (`/demo-control`, `/api/demo`): out of scope by operating rules and never visited.
- Visual styling, hero and marketing copy, footer text: low value and changes often.
- Every sort option and category: one sort and one combined filter cover the query path. The other sorts and categories were checked by hand during exploration and were all correct.
- Quantity limit (select 1-10) vs stock ("Only 12 left" on the kettle): the app states no rule to test against.
- Postcode format per country: no stated rule. US and UK formats were both accepted.
- Whether WELCOME10 can be reused by guests with the same email: not checked (noted in BUG-03).
- Missing search on mobile: the header searchbox is hidden at phone width and only `/shop`'s filter search remains. That looks like a design choice, so I noted it here and did not assert it.

## Notes
- Each run creates real (simulated) orders and throwaway `@example.test` accounts in the demo store, about 7 orders per run.
- `runs/20260929-192537-generate/summarise-results.cjs` is a leftover helper I couldn't run in this environment. It is safe to delete.
