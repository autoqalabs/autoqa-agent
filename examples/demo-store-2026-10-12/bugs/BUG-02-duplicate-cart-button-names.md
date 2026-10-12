# BUG-02 Cart buttons for the same coffee in two grinds have identical accessible names
Severity: minor (accessibility)
Area: Cart (J2 Cart maths)
Environment: https://autoqalabs-demo-store.vercel.app, Chromium, desktop 1280x720

## Steps to reproduce
1. Open `/product/house-espresso`, add 1 × "Whole bean" to the cart.
2. On the same page choose "Espresso" and add 1 more.
3. Open `/cart`. There are two lines, both named "House Espresso", one per grind.
4. Inspect the accessible names of the line controls (screen reader, or the accessibility tree).

## Expected
Each control names the line it acts on, for example "Remove House Espresso, Espresso grind", so a screen-reader or voice-control user can tell the two lines apart.

## Actual
Both lines expose the same names: "Decrease quantity of House Espresso", "Quantity of House Espresso", "Increase quantity of House Espresso" and "Remove House Espresso". The grind is not part of any of them, so the user cannot tell which line a button will change or remove.

## Evidence
- Seen during exploration with 10 × Whole bean and 1 × Espresso in the cart: activating the button named "Remove House Espresso" removed the Whole bean line, and the remaining Espresso line carried the same button names.
- `cart.spec.ts › Cart › keeps the same coffee in two grinds as two separate lines` confirms the two-line state on every run; it has to tell the lines apart by the visible grind text because the control names are the same.
- No test fails for this: the suite does not assert accessible-name uniqueness.

Confidence that this is a real defect: 80%. It was observed on one product; other coffees use the same line template.
