import type { Locator, Page } from '@playwright/test';

export class ProductPage {
  readonly heading: Locator;
  readonly quantitySelect: Locator;
  readonly addToCartButton: Locator;
  readonly soldOutButton: Locator;
  readonly addedMessage: Locator;

  constructor(readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { level: 1 });
    this.quantitySelect = main.getByLabel('Quantity');
    this.addToCartButton = main.getByRole('button', { name: 'Add to cart' });
    this.soldOutButton = main.getByRole('button', { name: 'Sold out' });
    this.addedMessage = main.getByText(/^Added \d+ × .+ to your cart\./);
  }

  async open(slug: string) {
    await this.page.goto(`/product/${slug}`);
  }

  async chooseGrind(grind: string) {
    await this.page.getByRole('group', { name: 'Grind' }).getByRole('radio', { name: grind }).check();
  }

  /** Adds to cart and waits for the server to confirm. */
  async addToCart({ quantity = 1, grind }: { quantity?: number; grind?: string } = {}) {
    if (grind) await this.chooseGrind(grind);
    if (quantity !== 1) await this.quantitySelect.selectOption(String(quantity));
    await this.addToCartButton.click();
    await this.addedMessage.waitFor();
  }

  /** Opens a product and adds it, the usual setup step for cart tests. */
  async add(slug: string, options: { quantity?: number; grind?: string } = {}) {
    await this.open(slug);
    await this.addToCart(options);
  }
}
