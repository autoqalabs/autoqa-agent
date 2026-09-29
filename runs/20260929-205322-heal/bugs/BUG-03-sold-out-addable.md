# BUG-03 Sold-out product can be added to the cart
Severity: major
Area: Product page / stock
Environment: https://autoqalabs-demo-store.vercel.app, Chromium (Playwright MCP), 1280×800

## Steps to reproduce
1. Open `/product/panama-gesha-reserve`. The page says "Sold out" and "Back in stock next harvest."
2. Click **Add to cart**.

## Expected
A sold-out product cannot be added. The purchase button is disabled and labelled "Sold out" (as in the previous version), and the cart count does not change.

## Actual
The button is an enabled **Add to cart**. Clicking it shows "Added 1 × Panama Gesha Reserve to your cart." and the header cart count goes up by one (3 → 4 in the manual run). The item stays in the cart and can go on to checkout.

## Evidence
- Screenshot: `runs/20260929-205322-heal/bugs/BUG-03-sold-out-addable.png`
- Failing test: `product.spec.ts:23` Product › does not let a sold out product be added to the cart (no "Sold out" button found)
- Snapshot excerpt after clicking:
  ```
  - paragraph: Sold out
  - paragraph: Our rarest lot ... Back in stock next harvest.
  - button "Add to cart"
  - paragraph: Added 1 × Panama Gesha Reserve to your cart.
  - link "Cart, 4 items"
  ```

Confidence: 95%. The app accepts an item it says is unavailable.
