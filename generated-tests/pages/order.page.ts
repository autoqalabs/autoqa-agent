import type { Locator, Page } from '@playwright/test';
import { OrderSummary } from './order-summary';

export class OrderPage {
  readonly heading: Locator;
  readonly orderNumber: Locator;
  readonly summary: OrderSummary;
  readonly notFound: Locator;

  constructor(readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { name: 'Thank you, your order is confirmed' });
    this.orderNumber = main.getByText(/Order number HC-\d+/);
    this.summary = new OrderSummary(page, main);
    this.notFound = main.getByText('We could not find that page');
  }

  /** Waits for the redirect to a confirmation page and returns the order id, e.g. "HC-10502". */
  async waitForConfirmation(): Promise<string> {
    await this.page.waitForURL(/\/order\/HC-\d+$/);
    await this.heading.waitFor();
    return this.page.url().split('/order/')[1];
  }

  async open(orderId: string) {
    await this.page.goto(`/order/${orderId}`);
  }
}
