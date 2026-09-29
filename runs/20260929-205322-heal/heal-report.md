# Heal report: run 20260929-205322-heal

Target: https://autoqalabs-demo-store.vercel.app
Suite: `generated-tests/` (25 tests: 24 desktop, 1 mobile)

## Result

| | Passed | Failed |
| --- | --- | --- |
| Initial run | 12 | 13 |
| After healing | **19** | **6** |

All 6 remaining failures are real app bugs (BUG-01 to BUG-04 below). No assertion was changed.

## Failures and classification

| # | Test | Initial error | Class | Confidence | Outcome |
| --- | --- | --- | --- | --- | --- |
| 1 | `account.spec.ts:5` registers, checks out signed in and sees the order in history | timeout waiting for button "Checkout" | Broken locator | 100% | Healed, passes |
| 2 | `account.spec.ts:66` Promotions › refuses WELCOME10 on a second order | timeout waiting for button "Checkout" | Broken locator, then **real bug** | 95% | Still fails: first order not discounted (BUG-01) |
| 3 | `checkout.spec.ts:10` completes checkout as a guest with the test card | timeout waiting for button "Checkout" | Broken locator | 100% | Healed, passes |
| 4 | `checkout.spec.ts:29` shows an error for every required field when the form is empty | timeout waiting for button "Checkout" | Broken locator | 100% | Healed, passes |
| 5 | `checkout.spec.ts:51` refuses the always-declined card and creates no order | timeout waiting for button "Checkout" | Broken locator | 100% | Healed, passes |
| 6 | `checkout.spec.ts:61` rejects an expired card | timeout waiting for button "Checkout" | Broken locator | 100% | Healed, passes |
| 7 | `checkout.spec.ts:70` keeps shipping details after a declined card | timeout waiting for button "Checkout" | Broken locator | 100% | Healed, passes |
| 8 | `security.spec.ts:6` does not show a guest order confirmation to a different session | timeout waiting for button "Checkout" | Broken locator | 100% | Healed, passes |
| 9 | `cart.spec.ts:45` applies WELCOME10 for 10% off, case-insensitively | "Code WELCOME10 applied" not found | **Real bug** | 95% | Fails (BUG-01) |
| 10 | `cart.spec.ts:73` never charges more after applying a discount code | "Code WELCOME10 applied" not found | **Real bug** | 95% | Fails (BUG-01) |
| 11 | `catalogue.spec.ts:24` searches by origin regardless of case | expected 2 product cards, got 0 | **Real bug** | 95% | Fails (BUG-02) |
| 12 | `product.spec.ts:23` does not let a sold out product be added | button "Sold out" not found | **Real bug** | 95% | Fails (BUG-03) |
| 13 | `mobile.spec.ts:6` updates the cart and completes checkout on a phone | Total expected $38.00, got $32.00 | **Real bug** | 98% | Fails (BUG-04) |

### Evidence

**Failures 1–8: checkout submit button renamed (broken locator).**
- Expected: a button named "Checkout" in `main` on `/checkout`.
- App did: the snapshot of `/checkout` shows `button "Place order"` in the same spot, after the Payment group. There is no button named "Checkout" (the only "Checkout" is the h1).
- Still works by hand: I filled the form with the advertised test card, clicked **Place order**, and landed on `/order/HC-10507` "Order confirmed". Only the label changed; the behaviour did not.
- After the fix, 7 of 8 pass. #2 got past checkout and now fails on its own discount assertion (see BUG-01).

**Failures 2, 9, 10: WELCOME10 rejected (real bug).** The footer says "New customers: WELCOME10 for 10% off", but `WELCOME10` and `welcome10` both return `"WELCOME10" is not a valid code.`, both for a guest and for a customer who has just registered. Not test data: the app still advertises the code. See BUG-01.

**Failure 11: case-sensitive search (real bug).** `?q=Kenya` gives 2 products, while `?q=KENYA` and `?q=kenya` give 0. The Filters search box locator (`complementary "Filters"` → `searchbox "Search"`) still resolves correctly, so this is not a locator problem. See BUG-02.

**Failure 12: sold-out product addable (real bug).** `/product/panama-gesha-reserve` still says "Sold out", but it now shows an enabled "Add to cart", and clicking it adds the item (header count 3 → 4). I did not "heal" this by pointing the locator at "Add to cart": the control changed because the behaviour broke. See BUG-03.

**Failure 13: mobile total leaves out shipping (real bug).** At 412 px: Subtotal $32.00, Shipping $6.00, Total $32.00 on both cart and checkout. The same cart at 1280 px shows Total $38.00, and the order placed at 412 px says "Total paid $38.00". See BUG-04.

## Locator changes

Only one locator changed. It lives in the page object, so no spec was edited.

`generated-tests/pages/checkout.page.ts:34`

```diff
- this.submitButton = main.getByRole('button', { name: 'Checkout', exact: true });
+ this.submitButton = main.getByRole('button', { name: 'Place order', exact: true });
```

Nothing changed in specs, `data.ts`, fixtures or any assertion.

## Bugs

| ID | Title | Severity | Failing tests |
| --- | --- | --- | --- |
| [BUG-01](bugs/BUG-01-welcome10-rejected.md) | Advertised new-customer code WELCOME10 is rejected as "not a valid code" | major | cart.spec.ts:45, cart.spec.ts:73, account.spec.ts:66 |
| [BUG-02](bugs/BUG-02-search-case-sensitive.md) | Shop search is case-sensitive: "KENYA" and "kenya" find nothing | minor | catalogue.spec.ts:24 |
| [BUG-03](bugs/BUG-03-sold-out-addable.md) | Sold-out product can be added to the cart | major | product.spec.ts:23 |
| [BUG-04](bugs/BUG-04-mobile-total-missing-shipping.md) | On phones, cart and checkout totals leave out shipping, then the customer is charged more | major | mobile.spec.ts:6 |

## Final run

```
6 failed
  [desktop] account.spec.ts:66  Promotions › refuses the new-customer code WELCOME10 on a second order   -> BUG-01
  [desktop] cart.spec.ts:45     Cart › applies WELCOME10 for 10% off, case-insensitively, and can remove it -> BUG-01
  [desktop] cart.spec.ts:73     Cart › never charges more after applying a discount code                 -> BUG-01
  [desktop] catalogue.spec.ts:24 Catalogue › searches by origin regardless of case ...                   -> BUG-02
  [desktop] product.spec.ts:23  Product › does not let a sold out product be added to the cart          -> BUG-03
  [mobile]  mobile.spec.ts:6    Mobile › updates the cart and completes checkout on a phone @mobile     -> BUG-04
19 passed (33.0s)
```

Final count: **19 passed, 6 failed**. Each of the 6 failures is a reported app bug.

## Notes
- The manual reproduction placed two test-card orders on the store (HC-10507 as a guest; HC-10508 as test account `heal+new1@example.test`), and registered that account. The suite also places its own test orders.
- The failing tests were left red, not marked `test.fail()`, because the task did not ask for a green suite.
