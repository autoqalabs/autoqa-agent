# BUG-04 On phones, cart and checkout totals leave out shipping, then the customer is charged more
Severity: major
Area: Cart / checkout totals (mobile)
Environment: https://autoqalabs-demo-store.vercel.app, Chromium, 412×839 viewport (Pixel 7 in the suite); compared with 1280×800

## Steps to reproduce
1. Set the viewport to phone width (412 px).
2. Add 1 × House Espresso ($16) and open `/cart`. Click **Increase quantity of House Espresso** (quantity 2).
3. Read the Order summary. Go to `/checkout` and read the Order summary again.
4. Complete checkout with test card 4242 4242 4242 4242, 12/30, 123.
5. With the same cart at 1280 px wide, read the cart summary.

## Expected
Subtotal $32.00 + Shipping $6.00 = Total $38.00 at every viewport, and the amount charged matches the total shown before paying.

## Actual
| Where | Subtotal | Shipping | Total shown |
| --- | --- | --- | --- |
| Cart, 412 px | $32.00 | $6.00 | **$32.00** |
| Checkout, 412 px | $32.00 | $6.00 | **$32.00** |
| Order confirmation HC-10508, 412 px | $32.00 | $6.00 | Total paid **$38.00** |
| Cart, 1280 px (same cart) | $32.00 | $6.00 | $38.00 |

On phones the total leaves out shipping, so the customer is shown $32.00 up to the moment they pay and is then charged $38.00.

## Evidence
- Screenshot: `runs/20260929-205322-heal/bugs/BUG-04-mobile-total-missing-shipping.png` (cart at 412 px)
- Failing test: `mobile.spec.ts:6` Mobile › updates the cart and completes checkout on a phone @mobile. At line 22 it expected "$38.00" and received "$32.00" from `<dd data-testid="summary-total">`.
- Snapshot excerpt (cart, 412 px):
  ```
  - term: Subtotal (2 items)   - definition: $32.00
  - term: Shipping             - definition: $6.00
  - term: Total                - definition: $32.00
  ```

Confidence: 98%. A number is wrong, and only at one viewport.
