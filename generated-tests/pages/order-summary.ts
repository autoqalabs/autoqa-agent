import type { Locator, Page } from '@playwright/test';

/** The "Order summary" totals list shown on cart and checkout, and the totals on the confirmation page. */
export class OrderSummary {
  constructor(readonly page: Page, readonly root: Locator) {}

  /** The value cell (definition) next to a term such as "Shipping" or /^Total$/. */
  value(term: string | RegExp): Locator {
    return this.root
      .locator('dl > div')
      .filter({ has: this.page.getByRole('term').filter({ hasText: term }) })
      .getByRole('definition');
  }

  get subtotal() {
    return this.value(/^Subtotal/);
  }
  get discount() {
    return this.value(/^Discount/);
  }
  get shipping() {
    return this.value(/^Shipping$/);
  }
  get total() {
    return this.value(/^Total( paid)?$/);
  }
}
