> **Sample output.** This is the report the AutoQA Agent wrote, unedited, at the end of a run against our own demo store, [Halcyon Coffee Roasters](https://github.com/autoqalabs/demo-store), on 12 October 2026. In 17 minutes it explored the store, wrote 34 Playwright tests, ran the suite four times and found 2 minor bugs. The [video in the README](../../README.md#watch-a-real-run) is a recording of this same run.
>
> The two bug reports are in [bugs/](bugs/). The other files the report refers to (journey map, test plan, test files) are the rest of that run's output and are not included here.

# AutoQA report: Halcyon Coffee Roasters

Target: https://autoqalabs-demo-store.vercel.app
Run: 20261012-092517-generate

## Summary

The store's main journeys work. All 34 generated tests pass, and they passed the same way in every one of 3 further stability runs. Exploration found 2 minor defects, neither of which blocks a purchase.

| Tests | Passed | Failed | Flaky | Bugs |
| --- | --- | --- | --- | --- |
| 34 | 34 | 0 | 0 | 2 |

Counts are from the last full run of the suite (stability run 3). 31 tests run on desktop Chrome and 3 on the mobile project (Pixel 7).

| Spec | Tests | What it covers |
| --- | --- | --- |
| `catalog.spec.ts` | 6 | listing, category and roast filters, price and name sorting, search, empty state |
| `product.spec.ts` | 4 | add to cart with grind and quantity, sold-out product, 404 pages |
| `cart.spec.ts` | 9 | subtotal, shipping at $38, $49 and $50, WELCOME10, invalid code, quantity changes, remove, 10-per-line cap, separate lines per grind |
| `checkout.spec.ts` | 6 | guest order with discount, empty-form validation, declined card, expired card, empty-cart guard, totals carried to checkout |
| `account.spec.ts` | 6 | register, sign out, sign in, duplicate email, wrong password, account guard, order history, order privacy |
| `mobile.spec.ts` | 3 | category navigation, cart maths and guest checkout on a phone |

Money assertions are recomputed in the tests from the catalogue prices and the store's stated rules, not copied from the page.

## Stability

- Runs: 3 full runs of `npx playwright test`, one after another, with no file changed in between (and none changed since the first green run before them).
- Stable pass: 34 tests. Consistent failure: 0. Flaky: 0.
- Nothing needed fixing during the stability check. Run times were 37.2 s, 42.4 s and 40.6 s with 6 workers.
- The suite also passed 34 of 34 on its first run, so no test was repaired after being written; there was nothing to triage.

Tests are isolated by design: the cart and session are server-side per browser context, each test builds its own cart, and account tests register their own unique `@example.test` user.

## Failures

None. No test failed in any of the 4 runs.

## Bugs

| ID | Severity | Title | Found by |
| --- | --- | --- | --- |
| [BUG-01](bugs/BUG-01-added-message-at-quantity-cap.md) | minor | Product page says "Added 1 × …" when nothing was added at the 10-per-line cap | exploration; reproduced on every run by the quantity-cap test |
| [BUG-02](bugs/BUG-02-duplicate-cart-button-names.md) | minor (accessibility) | Cart buttons for the same coffee in two grinds have identical accessible names | exploration |

Neither bug has a failing test. For BUG-01 the cap itself holds and the app states no wording for that case; for BUG-02 the suite does not assert accessible-name uniqueness. Both are written up from what was observed in the browser.

### Observations, not counted as bugs

- The footer says "Free shipping on orders over $50" while the home page says "$50+"; the cart gives free shipping at exactly $50.00. The suite asserts the behaviour the app shows ($49 pays $6, $50 is free). If "over $50" is the intended rule, the `ships free when the subtotal reaches the threshold exactly` test needs to flip.
- Free shipping is judged on the subtotal before the discount: a $50.00 cart with WELCOME10 pays $45.00 and still ships free.
- `WELCOME10` is advertised for "New customers" but was accepted a second time by an account that had already used it. The app states no single-use rule.
- The checkout submit button is labelled "Checkout", the same as the page heading.

## Not tested

- **`/demo-control` and `/api/demo`**: excluded by the operator; not opened, called or tested.
- **Top-rated sort, and every individual category and roast link**: price and name sorting and one category-plus-roast combination cover the mechanism. Top-rated order was checked by hand during exploration and was correct.
- **A single-use limit on `WELCOME10`**: no stated rule to assert against.
- **Visual styling, product illustrations, marketing copy, "You might also like"**: low value and likely to change.
- **Real payment, confirmation email, stock decrement**: the store simulates payment and sends nothing.
- **Password change, profile edit, admin or management screens**: none exist for a customer account (`/admin` is a 404).
- **A provided test account**: none was supplied for this run, so no `auth.setup.ts` was written; signed-in tests register throwaway accounts. Each run leaves about 5 such accounts and about 5 test orders behind on the demo store.
- **Browsers other than Chromium**: the config runs desktop Chrome and Pixel 7 emulation only.

## Files

- `journeys.md`, `test-plan.md`: the journey map and the plan in this folder.
- `generated-tests/`: `data.ts`, `fixtures.ts`, 8 files in `pages/`, 6 specs in `specs/`.
