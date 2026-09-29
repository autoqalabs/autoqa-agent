# BUG-02 Applying WELCOME10 can make the order cost more than without it
Severity: major
Area: Cart totals / shipping threshold / discounts
Environment: https://autoqalabs-demo-store.vercel.app, Chromium (Desktop Chrome profile), 1280x720
Confidence: 80%. The free-shipping rule does not say whether "order" means before or after discount. Either way, a "10% off" code must not raise the price.

## Steps to reproduce
1. Add Ceramic Pour Over Dripper ($28.00) and Stoneware Mug ($22.00) to the cart.
2. Open `/cart`: Subtotal $50.00, Shipping Free, **Total $50.00**.
3. Enter discount code `WELCOME10` and press Apply.

## Expected
A 10% discount leaves the customer paying no more than $50.00. For example, free shipping is decided on the pre-discount subtotal ($50 → free shipping, total $45.00), or the total is never allowed to exceed the undiscounted total.

## Actual
Discount (WELCOME10) −$5.00. The discounted subtotal $45.00 is now under the $50 threshold, so Shipping becomes $6.00 and **Total is $51.00**. The customer pays $1.00 more for using the advertised discount. Checkout charges this amount: order HC-10503 was placed during exploration with "Total paid $51.00".

This affects any cart with a subtotal between $50.00 and $55.55: the 10% discount drops it under $50 and adds $6 shipping, which is more than the discount saves in that range.

## Evidence
- Failing test: `generated-tests/specs/cart.spec.ts` › Cart › "never charges more after applying a discount code". Message: `total with WELCOME10 was $51.00`, expected <= 50, received 51. It failed the same way in all 3 runs.
- Screenshot: `test-results/cart-Cart-never-charges-more-after-applying-a-discount-code-desktop/test-failed-1.png`
- Exploration: order HC-10503 confirmation shows Subtotal $50.00, Discount −$5.00, Shipping $6.00, Total paid $51.00.
