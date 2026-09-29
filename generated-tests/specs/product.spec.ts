import { test, expect } from '../fixtures';
import { Header } from '../pages/header.page';
import { PRODUCTS, money } from '../data';

test.describe('Product', () => {
  test('adds the chosen grind and quantity to the cart', async ({ productPage, cartPage, header }) => {
    const { yirgacheffe } = PRODUCTS;
    await productPage.open(yirgacheffe.slug);
    await expect(productPage.heading).toHaveText(yirgacheffe.name);

    await productPage.addToCart({ quantity: 2, grind: 'French press' });

    await expect(productPage.addedMessage).toContainText(`Added 2 × ${yirgacheffe.name} to your cart.`);
    await expect(header.cartLink).toHaveAccessibleName(Header.cartName(2));

    await cartPage.open();
    await expect(cartPage.items).toHaveCount(1);
    await expect(cartPage.line(yirgacheffe.name)).toContainText('French press');
    await expect(cartPage.quantityOf(yirgacheffe.name)).toHaveText('2');
    await expect(cartPage.line(yirgacheffe.name)).toContainText(money(yirgacheffe.price * 2));
  });

  test('does not let a sold out product be added to the cart', async ({ productPage, page }) => {
    await productPage.open(PRODUCTS.gesha.slug);

    await expect(productPage.soldOutButton).toBeDisabled();
    await expect(productPage.addToCartButton).toHaveCount(0);
    await expect(page.getByRole('main').getByText('Sold out').first()).toBeVisible();
  });
});
