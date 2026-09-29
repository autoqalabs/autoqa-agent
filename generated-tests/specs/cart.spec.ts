import { test, expect } from '../fixtures';
import { Header } from '../pages/header.page';
import { CODES, PRODUCTS, SHIPPING, discountMoney, money } from '../data';

const { yirgacheffe, mug, dripper } = PRODUCTS;

test.describe('Cart', () => {
  test('calculates subtotal, flat shipping and total below the free shipping threshold', async ({
    productPage,
    cartPage,
  }) => {
    await productPage.add(yirgacheffe.slug, { quantity: 2, grind: 'Pour over' });
    await cartPage.open();

    const subtotal = yirgacheffe.price * 2;
    await expect(cartPage.line(yirgacheffe.name)).toContainText('Pour over');
    await expect(cartPage.summary.subtotal).toHaveText(money(subtotal));
    await expect(cartPage.summary.shipping).toHaveText(money(SHIPPING.flatRate));
    await expect(cartPage.summary.total).toHaveText(money(subtotal + SHIPPING.flatRate));
    await expect(cartPage.freeShippingHint).toHaveText(
      `Add ${money(SHIPPING.freeThreshold - subtotal)} more for free shipping.`,
    );

    // One more bag crosses the threshold: shipping becomes free.
    await cartPage.increase(yirgacheffe.name);
    const bigger = yirgacheffe.price * 3;
    await expect(cartPage.quantityOf(yirgacheffe.name)).toHaveText('3');
    await expect(cartPage.summary.subtotal).toHaveText(money(bigger));
    await expect(cartPage.summary.shipping).toHaveText('Free');
    await expect(cartPage.summary.total).toHaveText(money(bigger));
    await expect(cartPage.freeShippingHint).toBeHidden();
  });

  test('gives free shipping when the subtotal is exactly the threshold', async ({ productPage, cartPage }) => {
    await productPage.add(dripper.slug);
    await productPage.add(mug.slug);
    await cartPage.open();

    expect(dripper.price + mug.price).toBe(SHIPPING.freeThreshold);
    await expect(cartPage.summary.subtotal).toHaveText(money(SHIPPING.freeThreshold));
    await expect(cartPage.summary.shipping).toHaveText('Free');
    await expect(cartPage.summary.total).toHaveText(money(SHIPPING.freeThreshold));
  });

  test('applies WELCOME10 for 10% off, case-insensitively, and can remove it', async ({ productPage, cartPage }) => {
    await productPage.add(yirgacheffe.slug, { quantity: 3 });
    await cartPage.open();

    const subtotal = yirgacheffe.price * 3;
    const discount = subtotal * CODES.welcomeRate;
    await cartPage.applyDiscount(CODES.welcome.toLowerCase());

    await expect(cartPage.summaryRegion.getByText(`Code ${CODES.welcome} applied`)).toBeVisible();
    await expect(cartPage.summary.discount).toHaveText(discountMoney(discount));
    await expect(cartPage.summary.total).toHaveText(money(subtotal - discount));

    await cartPage.removeDiscount();
    await expect(cartPage.summary.discount).toHaveCount(0);
    await expect(cartPage.summary.total).toHaveText(money(subtotal));
  });

  test('rejects an unknown discount code and leaves totals unchanged', async ({ productPage, cartPage }) => {
    await productPage.add(yirgacheffe.slug);
    await cartPage.open();

    await cartPage.applyDiscount(CODES.invalid);

    await expect(cartPage.summaryRegion.getByText(`"${CODES.invalid}" is not a valid code.`)).toBeVisible();
    await expect(cartPage.summary.discount).toHaveCount(0);
    await expect(cartPage.summary.total).toHaveText(money(yirgacheffe.price + SHIPPING.flatRate));
  });

  test('never charges more after applying a discount code', async ({ productPage, cartPage }) => {
    // $28 + $22 = $50: free shipping before the code.
    await productPage.add(dripper.slug);
    await productPage.add(mug.slug);
    await cartPage.open();
    const totalWithoutCode = dripper.price + mug.price;
    await expect(cartPage.summary.total).toHaveText(money(totalWithoutCode));

    await cartPage.applyDiscount(CODES.welcome);
    await expect(cartPage.summaryRegion.getByText(`Code ${CODES.welcome} applied`)).toBeVisible();

    // A discount must not leave the customer worse off than not using it.
    const totalText = (await cartPage.summary.total.textContent()) ?? '';
    const totalWithCode = Number(totalText.replace(/[^0-9.]/g, ''));
    expect(totalWithCode, `total with ${CODES.welcome} was ${totalText}`).toBeLessThanOrEqual(totalWithoutCode);
  });

  test('empties the cart when the last item is removed', async ({ productPage, cartPage, header, page }) => {
    await productPage.add(mug.slug);
    await cartPage.open();
    await expect(header.cartLink).toHaveAccessibleName(Header.cartName(1));

    await cartPage.remove(mug.name);

    await expect(cartPage.items).toHaveCount(0);
    await expect(header.cartLink).toHaveAccessibleName(Header.cartName(0));
    await expect(page.getByRole('link', { name: 'Proceed to checkout' })).toHaveCount(0);
  });
});
