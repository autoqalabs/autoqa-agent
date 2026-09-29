import { test, expect } from '../fixtures';
import { Header } from '../pages/header.page';
import { ADDRESS, CARDS, PRODUCTS, SHIPPING, money, uniqueEmail } from '../data';

test.describe('Mobile', () => {
  test('updates the cart and completes checkout on a phone @mobile', async ({
    page,
    productPage,
    cartPage,
    checkoutPage,
    orderPage,
    header,
  }) => {
    const { houseEspresso } = PRODUCTS;
    await productPage.add(houseEspresso.slug);
    await cartPage.open();

    await cartPage.increase(houseEspresso.name);
    const subtotal = houseEspresso.price * 2;
    await expect(cartPage.quantityOf(houseEspresso.name)).toHaveText('2');
    await expect(header.cartLink).toHaveAccessibleName(Header.cartName(2));
    await expect(cartPage.summary.total).toHaveText(money(subtotal + SHIPPING.flatRate));

    // No horizontal scrolling on a phone.
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflows).toBe(false);

    await cartPage.proceedToCheckout();
    await checkoutPage.completeAsGuest(uniqueEmail('mobile'), ADDRESS, CARDS.success);
    await orderPage.waitForConfirmation();
    await expect(orderPage.summary.total).toHaveText(money(subtotal + SHIPPING.flatRate));
  });
});
