# BUG-01 Product page says "Added 1 × …" when nothing was added at the 10-per-line cap
Severity: minor
Area: Product / cart (J2 Cart maths)
Environment: https://autoqalabs-demo-store.vercel.app, Chromium, desktop 1280x720

## Steps to reproduce
1. Open `/product/house-espresso` with an empty cart.
2. Leave grind on "Whole bean", select Quantity 10, click "Add to cart". The header shows "Cart, 10 items".
3. Select Quantity 1 and click "Add to cart" again.

## Expected
The store tells the shopper that the line is already at the maximum of 10 and that nothing was added (or disables "Add to cart" for that product and grind).

## Actual
The status message reads "Added 1 × House Espresso to your cart. View cart", but the header still shows "Cart, 10 items" and the cart line stays at 10 with a subtotal of $160.00. The shopper is told something was added that was not.

## Evidence
- Seen during exploration: the message after step 3 was "Added 1 × House Espresso to your cart." while the cart link stayed "Cart, 10 items".
- Reproduced in every run of `cart.spec.ts › Cart › does not let a line go above the maximum quantity` (4 runs): the test waits for the text "Added 1 ×" after the second add and then finds the quantity still 10 and the subtotal still $160.00.
- No test fails for this: the cap itself holds, and the app states no wording for this case, so the suite asserts the cap and this report covers the message.

Confidence that this is a real defect: 85%.
