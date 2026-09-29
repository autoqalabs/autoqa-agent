import type { Locator, Page } from '@playwright/test';

export class ShopPage {
  readonly heading: Locator;
  readonly filters: Locator;
  readonly searchBox: Locator;
  readonly sortSelect: Locator;
  readonly applyButton: Locator;
  readonly products: Locator;
  readonly productCards: Locator;
  readonly noMatches: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.filters = page.getByRole('complementary', { name: 'Filters' });
    this.searchBox = this.filters.getByRole('searchbox', { name: 'Search' });
    this.sortSelect = this.filters.getByLabel('Sort by');
    this.applyButton = this.filters.getByRole('button', { name: 'Apply' });
    this.products = page.getByRole('region', { name: 'Products' });
    this.productCards = this.products.getByRole('article');
    this.noMatches = page.getByText('No matches');
  }

  async open(query = '') {
    await this.page.goto(`/shop${query}`);
  }

  async sortBy(option: string) {
    await this.sortSelect.selectOption({ label: option });
    await this.applyButton.click();
  }

  async search(term: string) {
    await this.searchBox.fill(term);
    await this.applyButton.click();
  }

  async chooseCategory(name: string) {
    await this.filters.getByRole('link', { name, exact: true }).click();
  }

  async chooseRoast(name: string) {
    await this.filters.getByRole('link', { name, exact: true }).click();
  }

  productNames(): Promise<string[]> {
    return this.productCards.getByRole('heading', { level: 3 }).allTextContents();
  }

  async productPrices(): Promise<number[]> {
    const texts = await this.productCards.getByText(/^\$\d+\.\d{2}$/).allTextContents();
    return texts.map((t) => Number(t.replace('$', '')));
  }
}
