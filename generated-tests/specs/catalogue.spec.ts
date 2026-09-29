import { test, expect } from '../fixtures';

test.describe('Catalogue', () => {
  test('sorts products by price from low to high', async ({ shopPage, page }) => {
    await shopPage.open();
    await shopPage.sortBy('Price: low to high');

    await expect(page).toHaveURL(/sort=price-asc/);
    const prices = await shopPage.productPrices();
    expect(prices.length).toBeGreaterThan(1);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('combines category and roast filters', async ({ shopPage }) => {
    await shopPage.open();
    await shopPage.chooseCategory('Blends');
    await expect(shopPage.heading).toHaveText('Blends');
    await expect(shopPage.productCards).toHaveCount(3);

    await shopPage.open('?category=blend&roast=dark');
    expect(await shopPage.productNames()).toEqual(['Night Owl']);
  });

  test('searches by origin regardless of case and shows an empty state for no matches', async ({ shopPage }) => {
    await shopPage.open();
    await shopPage.search('KENYA');
    await expect(shopPage.heading).toHaveText('Results for “KENYA”');
    await expect(shopPage.productCards).toHaveCount(2);
    expect(await shopPage.productNames()).toEqual(expect.arrayContaining(['Kirinyaga Peaberry', 'Sunday Morning']));

    await shopPage.search('zzzz');
    await expect(shopPage.noMatches).toBeVisible();
    await expect(shopPage.productCards).toHaveCount(0);
  });

  test('shows the not found page for an unknown product', async ({ page }) => {
    const response = await page.goto('/product/does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('We could not find that page')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to the shop' })).toBeVisible();
  });
});
