import type { Locator, Page } from '@playwright/test';
import { OrderSummary } from './order-summary';

export class CartPage {
  readonly heading: Locator;
  readonly items: Locator;
  readonly freeShippingHint: Locator;
  readonly summaryRegion: Locator;
  readonly summary: OrderSummary;
  readonly discountInput: Locator;
  readonly applyDiscountButton: Locator;
  readonly discountMessage: Locator;
  readonly checkoutLink: Locator;

  constructor(readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { name: 'Your cart', level: 1 });
    this.items = main.getByRole('list', { name: 'Cart items' }).getByRole('listitem');
    this.freeShippingHint = main.getByText(/more for free shipping\.$/);
    this.summaryRegion = main.getByRole('region').filter({ has: page.getByRole('heading', { name: 'Order summary' }) });
    this.summary = new OrderSummary(page, this.summaryRegion);
    this.discountInput = main.getByRole('textbox', { name: 'Discount code' });
    this.applyDiscountButton = this.summaryRegion.getByRole('button', { name: 'Apply' });
    this.discountMessage = this.summaryRegion.getByText(/not a valid code|applied/);
    this.checkoutLink = main.getByRole('link', { name: 'Proceed to checkout' });
  }

  async open() {
    await this.page.goto('/cart');
    await this.heading.waitFor();
  }

  line(productName: string): Locator {
    return this.items.filter({ has: this.page.getByRole('link', { name: productName, exact: true }) });
  }

  quantityOf(productName: string): Locator {
    return this.page.getByLabel(`Quantity of ${productName}`, { exact: true });
  }

  async increase(productName: string) {
    await this.page.getByRole('button', { name: `Increase quantity of ${productName}` }).click();
  }

  async decrease(productName: string) {
    await this.page.getByRole('button', { name: `Decrease quantity of ${productName}` }).click();
  }

  async remove(productName: string) {
    await this.page.getByRole('button', { name: `Remove ${productName}` }).click();
  }

  async applyDiscount(code: string) {
    await this.discountInput.fill(code);
    await this.applyDiscountButton.click();
  }

  async removeDiscount() {
    await this.summaryRegion.getByRole('button', { name: 'Remove' }).click();
  }

  async proceedToCheckout() {
    await this.checkoutLink.click();
    await this.page.waitForURL(/\/checkout$/);
  }
}
