import { test, expect } from '../fixtures';
import { OrderPage } from '../pages/order.page';
import { ADDRESS, CARDS, PRODUCTS, uniqueEmail } from '../data';

test.describe('Order privacy', () => {
  test('does not show a guest order confirmation to a different browser session', async ({
    browser,
    productPage,
    checkoutPage,
    orderPage,
  }) => {
    const email = uniqueEmail('private');
    await productPage.add(PRODUCTS.mug.slug);
    await checkoutPage.open();
    await checkoutPage.completeAsGuest(email, ADDRESS, CARDS.success);
    const orderId = await orderPage.waitForConfirmation();

    const strangerContext = await browser.newContext();
    try {
      const strangerPage = await strangerContext.newPage();
      const strangerOrder = new OrderPage(strangerPage);
      await strangerOrder.open(orderId);

      await expect(strangerOrder.heading).toHaveCount(0);
      await expect(strangerPage.getByText(email)).toHaveCount(0);
      await expect(strangerPage.getByText(ADDRESS.street)).toHaveCount(0);
    } finally {
      await strangerContext.close();
    }
  });
});
