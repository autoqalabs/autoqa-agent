# Journey map: Halcyon Coffee Roasters

## App summary
Halcyon Coffee Roasters is a small, fictional e-commerce store (Next.js, server actions) selling 14 products: coffee (single origin, blends, decaf) and brewing gear. Shoppers browse, search, filter and sort a catalogue, pick a grind and quantity, manage a cart with a discount code, and check out as a guest or signed-in customer with a simulated card payment. Stated rules: free shipping on orders over $50 (home page says "$50+"), flat $6.00 shipping otherwise, `WELCOME10` gives new customers 10% off, test card `4242 4242 4242 4242` succeeds and `4000 0000 0000 0002` is always declined. One product (Panama Gesha Reserve) is sold out. On mobile (390 px) the header search is hidden and the main nav becomes a "Categories" strip.

## Routes
| Route | Purpose | Key elements (role: name) |
| --- | --- | --- |
| `/` | Home, hero, featured products | link "Shop coffee", link "Customer favourite House Espresso", heading "Featured this month", link "View all coffee" |
| header (all pages) | Global nav | link "Halcyon Coffee Roasters home", navigation "Main" (desktop) / "Categories" (mobile): links "Shop all", "Single origin", "Blends", "Brewing gear"; searchbox "Search coffee" (desktop only); link "Sign in" / "Account"; link "Cart, N items" |
| `/shop` | Catalogue, 14 products | heading level 1 "All coffee & gear", text "14 products", searchbox "Search", combobox "Sort by" (Featured, Price: low to high, Price: high to low, Top rated, Name A to Z), button "Apply", category links (All, Single origin, Blends, Decaf, Brewing gear), roast links (Any roast, light, medium, dark), region "Products" > article > link per product |
| `/shop?category=…&roast=…&q=…&sort=…` | Filtered views | h1 becomes category name or `Results for “q”`; empty state "No matches" + link "Browse all coffee" |
| `/product/<slug>` | Product detail | breadcrumb nav "Breadcrumb", h1 product name, price "/ 250 g", stock text ("In stock, ships in 2 days", "Only 12 left", "Sold out"), radio group "Grind" (Whole bean, Espresso, Pour over, French press; coffee only), combobox "Quantity" (1-10), button "Add to cart" (or disabled button "Sold out"); confirmation "Added N × Name to your cart." + link "View cart"; heading "You might also like" |
| `/cart` | Cart | h1 "Your cart", free-shipping hint "Add $X more for free shipping.", list "Cart items", buttons "Decrease quantity of X", "Increase quantity of X", "Remove X", status "Quantity of X"; region "Order summary" with Subtotal (N items), Discount (CODE), Shipping, Total; textbox "Discount code", button "Apply", link "Proceed to checkout", link "Continue shopping" |
| `/checkout` | Checkout | groups "Contact", "Shipping address", "Payment"; textboxes "Email", "Full name", "Street address", "City", "Postcode", combobox "Country", textboxes "Card number", "Expiry (MM/YY)", "Security code"; button "Checkout"; order summary |
| `/order/<id>` | Confirmation | heading "Thank you, your order is confirmed", "Order number HC-NNNNN", totals incl. "Total paid", shipping line, "card ending 4242", link "View order history" |
| `/login` | Sign in | heading "Welcome back", textbox "Email", textbox "Password", button "Sign in", link "Create an account"; supports `?next=` |
| `/register` | Register | heading "Create an account", textboxes "Name", "Email", "Password", button "Create account" |
| `/account` | Account + order history (auth required, else redirect to `/login?next=/account`) | "Signed in as <email>", "Hi, <first name>", button "Sign out", heading "Order history", link "Order HC-NNNNN" with date, total, status "Roasting" |
| any unknown route | 404 | "404", "We could not find that page", link "Back to the shop" |

Not visited on purpose: `/demo-control`, `/api/demo` (demo controls, out of scope).

## Journeys
### J1 Guest purchase, happy path (risk: high)
1. `/product/yirgacheffe-kochere`, radio "Pour over", combobox "Quantity" = 2, button "Add to cart".
2. See "Added 2 × Yirgacheffe Kochere to your cart." and header link "Cart, 2 items".
3. `/cart`: Subtotal (2 items) $38.00, Shipping $6.00, Total $44.00, hint "Add $12.00 more for free shipping."
4. link "Proceed to checkout", fill Email, Full name, Street address, City, Postcode, Country "United States", card 4242 4242 4242 4242, 12/30, 123, button "Checkout".
5. Redirect to `/order/HC-10502`: "Thank you, your order is confirmed", totals match cart, "Paid with card ending 4242". Header cart resets to "Cart, 0 items".

### J2 Cart maths, free shipping and discount (risk: high)
- Increase to 3 → $57.00, Shipping "Free", Total $57.00.
- Discount "BOGUS99" → `"BOGUS99" is not a valid code.`
- Discount "WELCOME10" → "Discount (WELCOME10) −$5.70", Total $51.30, "Code WELCOME10 applied" + button "Remove". Lower-case "welcome10" also accepted.
- Decrease to 2 with code → $38.00 − $3.80, Shipping $6.00, Total $40.20, hint "Add $15.80 more" (threshold uses the discounted subtotal).
- Dripper $28 + Mug $22 = exactly $50.00 → Shipping "Free". Applying WELCOME10 → subtotal after discount $45 → Shipping $6.00 → **Total $51.00, higher than the $50.00 without the code.**

### J3 Checkout validation and payment failures (risk: high)
- Empty submit: alert "Please fix the highlighted fields." plus per-field messages: "Enter a valid email address.", "Enter your full name.", "Enter your street address.", "Enter your city.", "Enter a valid postcode.", "Choose a country.", "Enter a 16 digit card number.", "Use MM/YY.", "Enter the 3 digit security code." (fields get aria-invalid).
- Card 4000 0000 0000 0002 → alert "Your card was declined. No payment was taken." (stays on /checkout).
- Expiry 01/20 → "This card has expired."
- After a failed server submit, card number and CVC are cleared (fine) but Country resets to "Select" too.

### J4 Browse, search, filter, sort (risk: medium)
All verified correct: 5 sorts, category counts (single origin 6, blend 3, decaf 1, gear 4), roast counts (light 4, medium 4, dark 2), combined filters (blend + dark = Night Owl), search by origin is case-insensitive ("ethiopia" 3, "KENYA" 2), no-results empty state.

### J5 Sold-out product (risk: medium)
`/product/panama-gesha-reserve`: text "Sold out", button "Sold out" disabled, no Add to cart. Listing card shows "Sold out" badge.

### J6 Register, sign in, account history (risk: medium)
- `/register` with 3-char password → "Use at least 8 characters."
- Valid registration → redirect to `/account`, "Hi, QA", "You have not placed any orders yet."
- Header shows link "Account" instead of "Sign in".
- Checkout as signed-in user pre-fills Email and Full name; order appears under "Order history" with status "Roasting".
- Wrong credentials → "Email or password is incorrect."
- Sign out → home; `/account` redirects to `/login?next=/account`; own orders then 404.

### J7 Mobile (390x844) cart and checkout (risk: medium)
Header collapses: search hidden, nav "Categories". Cart quantity buttons recalc correctly, no horizontal overflow; checkout completes (HC-10504).

### J8 Error pages (risk: low)
`/nope` and `/product/does-not-exist` return 404 with "We could not find that page" and link "Back to the shop".

## Rules and test data
- Free shipping threshold: $50 (inclusive; exactly $50 is free), otherwise $6.00; threshold is evaluated on the discounted subtotal.
- Discount: `WELCOME10` = 10% off subtotal, case-insensitive. Stated for "New customers".
- Cards: `4242 4242 4242 4242` success; `4000 0000 0000 0002` always declined; any future MM/YY, any 3-digit CVC.
- Quantity select 1-10 on product page; cart +/− buttons.
- Password: at least 8 characters.
- Order numbers are sequential: `HC-105NN`.
- No pre-seeded test account; register throwaway `@example.test` accounts.

## Anomalies seen
1. **Applying WELCOME10 can increase the total.** Cart = Ceramic Pour Over Dripper + Stoneware Mug ($50.00, free shipping). Apply WELCOME10 → −$5.00 discount, shipping becomes $6.00, total $51.00. The customer pays $1 more for using a discount. (Bug candidate, business logic.)
2. **WELCOME10 is not restricted to new customers.** Account qa.explore.0929@example.test placed HC-10503 with WELCOME10, then used WELCOME10 again on HC-10504. Footer states "New customers: WELCOME10 for 10% off". (Bug candidate.)
3. **Country resets after a failed checkout submit.** After a declined card, Email/Name/Address/City/Postcode persist but Country goes back to "Select", which then triggers "Choose a country." on the next submit. (Minor UX.)
4. **No search on mobile.** The header searchbox is hidden at 390 px and there is no alternative entry point except `/shop`'s filter search box. (Observation.)
5. Guest order page `/order/HC-10502` is viewable by the same browser after signing in to a different account (it is cookie-scoped, other IDs 404). Needs a fresh-context check for exposure. (Security check to automate.)
