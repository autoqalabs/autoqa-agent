# BUG-02 Shop search is case-sensitive: "KENYA" and "kenya" find nothing
Severity: minor
Area: Catalogue / search
Environment: https://autoqalabs-demo-store.vercel.app, Chromium (Playwright MCP), 1280×800

## Steps to reproduce
1. Open `/shop`.
2. In the Filters panel, type `KENYA` in **Search** and click **Apply** (URL `/shop?q=KENYA&sort=featured`).
3. Repeat with `kenya` and with `Kenya`.

## Expected
Search matches origins regardless of case. All three searches list the 2 Kenyan coffees: Kirinyaga Peaberry (KENYA) and Sunday Morning (ETHIOPIA + KENYA). The previous version of the app did this.

## Actual
| Query | Result |
| --- | --- |
| `KENYA` | "0 products", "No matches" |
| `kenya` | "0 products" |
| `Kenya` | "2 products" |

Only an exact-case match works. Customers typing in lower case (the norm on mobile keyboards and in the search placeholder "e.g. Kenya, chocolate") get an empty result.

## Evidence
- Screenshot: `runs/20260929-205322-heal/bugs/BUG-02-search-case-sensitive.png`
- Failing test: `catalogue.spec.ts:24` Catalogue › searches by origin regardless of case and shows an empty state for no matches (expected 2 product cards, received 0)
- Snapshot excerpt for `?q=KENYA`:
  ```
  - heading "Results for “KENYA”" [level=1]
  - paragraph: 0 products
  - region "Products":
    - heading "No matches" [level=2]
  ```

Confidence: 95%. Results differ by input case with nothing in the UI saying search is case-sensitive.
