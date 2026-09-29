import type { Locator, Page } from '@playwright/test';

export class Header {
  readonly cartLink: Locator;
  readonly signInLink: Locator;
  readonly accountLink: Locator;

  constructor(readonly page: Page) {
    const banner = page.getByRole('banner');
    this.cartLink = banner.getByRole('link', { name: /^Cart, \d+ items?$/ });
    this.signInLink = banner.getByRole('link', { name: 'Sign in', exact: true });
    this.accountLink = banner.getByRole('link', { name: 'Account', exact: true });
  }

  /** Accessible name the cart link should have for a given count. */
  static cartName(count: number): string {
    return `Cart, ${count} ${count === 1 ? 'item' : 'items'}`;
  }
}
