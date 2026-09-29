# BUG-01 Advertised new-customer code WELCOME10 is rejected as "not a valid code"
Severity: major
Area: Cart / promotions
Environment: https://autoqalabs-demo-store.vercel.app, Chromium (Playwright MCP), 1280×800

## Steps to reproduce
1. Open `/product/yirgacheffe-kochere`, choose quantity 3, click **Add to cart**.
2. Open `/cart`.
3. Type `WELCOME10` in **Discount code** and click **Apply**.
4. Repeat as a brand-new signed-in customer (register at `/register`, then steps 1–3).
5. Repeat with lower case `welcome10`.

## Expected
The site footer says "New customers: WELCOME10 for 10% off". The code applies, the summary shows "Code WELCOME10 applied" and a Discount line of −$5.70, and the total drops from $57.00 to $51.30. Case should not matter. The previous version of the app did this.

## Actual
In every case (guest, newly registered customer, upper or lower case) the summary shows `"WELCOME10" is not a valid code.`, the field is marked invalid, and no discount is applied. Total stays at $57.00.

## Evidence
- Screenshot: `runs/20260929-205322-heal/bugs/BUG-01-welcome10-rejected.png` (new signed-in customer)
- Failing tests:
  - `cart.spec.ts:45` Cart › applies WELCOME10 for 10% off, case-insensitively, and can remove it
  - `cart.spec.ts:73` Cart › never charges more after applying a discount code
  - `account.spec.ts:66` Promotions › refuses the new-customer code WELCOME10 on a second order (the first order, which should be discounted, is not)
- Snapshot excerpt (cart, Order summary region):
  ```
  - textbox "Discount code" [invalid]: WELCOME10
  - button "Apply"
  - paragraph: "\"WELCOME10\" is not a valid code."
  ```
- Footer on the same page: `listitem: "New customers: WELCOME10 for 10% off"`

Confidence: 95%. The app rejects a code it advertises on every page.
