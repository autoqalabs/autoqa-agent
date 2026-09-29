# Test plan: Halcyon Coffee Roasters

Source: `journeys.md` (same run). Expected totals are recomputed in the tests from catalogue prices ($16 House Espresso, $19 Yirgacheffe Kochere, $22 Stoneware Mug, $28 Ceramic Pour Over Dripper), shipping $6.00 under the $50 threshold, 10% for WELCOME10.

## Risk rating

| Journey | Impact | Likelihood | Risk |
| --- | --- | --- | --- |
| J1 Guest purchase | revenue | server actions, multi-step form | high |
| J2 Cart maths, shipping, discount | revenue, trust | calculations, thresholds | high |
| J3 Checkout validation / payment failures | revenue, trust | validation, state across submits | high |
| J6 Account, sign in, history, promo eligibility | trust, revenue | auth + per-user rules | high (login) / medium |
| J4 Browse, search, filter, sort | conversion | query logic | medium |
| J5 Sold-out product | trust | stock state | medium |
| J7 Mobile cart and checkout | revenue | responsive layout | medium |
| Order page privacy | trust (PII) | access control | high |
| J8 404 pages | low | static | low |

## Cases

| ID | Journey | Case | Type | Risk | Spec file |
| --- | --- | --- | --- | --- | --- |
| T01 | Checkout | Guest completes checkout with test card; confirmation number, totals and card ending match; cart empties | happy | high | checkout.spec.ts |
| T02 | Checkout | Empty form submit shows every field error and stays on /checkout | negative | high | checkout.spec.ts |
| T03 | Checkout | Declined card 4000 0000 0000 0002 shows "Your card was declined" and no order is created | negative | high | checkout.spec.ts |
| T04 | Checkout | Expired card (01/20) is rejected with "This card has expired." | edge | high | checkout.spec.ts |
| T05 | Checkout | After a declined card, shipping details (incl. Country) are kept so retrying with a good card succeeds | edge | high | checkout.spec.ts |
| T06 | Cart | Subtotal, $6 shipping, total and "Add $X more" hint are correct under the threshold; +/− recalculates | happy | high | cart.spec.ts |
| T07 | Cart | Subtotal of exactly $50 gets free shipping | edge | high | cart.spec.ts |
| T08 | Cart | WELCOME10 (entered lower case) takes exactly 10% off and can be removed | happy | high | cart.spec.ts |
| T09 | Cart | Invalid code is rejected with a message and totals unchanged | negative | high | cart.spec.ts |
| T10 | Cart | Applying a discount never makes the order total higher than without it ($50 cart) | edge | high | cart.spec.ts |
| T11 | Cart | Removing the last item empties the cart and the header count goes to 0 | happy | medium | cart.spec.ts |
| T12 | Catalogue | Sort "Price: low to high" orders products by ascending price | happy | medium | catalogue.spec.ts |
| T13 | Catalogue | Category + roast filters combine (Blends + dark = Night Owl only) | happy | medium | catalogue.spec.ts |
| T14 | Catalogue | Search is case-insensitive by origin; nonsense search shows "No matches" | edge / negative | medium | catalogue.spec.ts |
| T15 | Product | Add to cart with grind and quantity updates header count and cart line | happy | high | product.spec.ts |
| T16 | Product | Sold-out product shows disabled "Sold out" button and no "Add to cart" | edge | medium | product.spec.ts |
| T17 | Account | Register, check out signed in (details prefilled), order shows in history | happy | medium | account.spec.ts |
| T18 | Account | Wrong password is rejected with a generic message | negative | high | account.spec.ts |
| T19 | Account | Registration rejects passwords under 8 characters | negative | medium | account.spec.ts |
| T20 | Account | /account redirects signed-out visitors to /login?next=/account | negative | medium | account.spec.ts |
| T21 | Promotions | WELCOME10 ("new customers") is refused for a customer who already has an order | negative | high | account.spec.ts |
| T22 | Security | Guest order confirmation is not viewable from a different browser session | negative | high | security.spec.ts |
| T23 | Mobile | @mobile cart quantity change and checkout complete on a phone viewport | edge | medium | mobile.spec.ts |
| T25 | Account | Customer can sign out and sign back in with their password | happy | high | account.spec.ts |
| T24 | Errors | Unknown product URL shows the 404 page with a way back to the shop | edge | low | catalogue.spec.ts |

## Not testing (and why)

- Demo controls (`/demo-control`, `/api/demo`): out of scope by operating rules.
- Visual styling, hero copy, marketing blocks, footer copy: low value, changes often.
- Every sort option and every category: T12/T13 cover the query logic; the rest was verified manually during exploration and are the same code path.
- Quantity select limit (1-10) vs stock "Only 12 left": no rule stated to test against.
- Postcode formats per country: no stated rule; UK and US both accepted during exploration.
- Mobile header search absence: design decision, noted in report, not asserted.
- Real email delivery: store says it only would send one.
