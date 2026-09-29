import { test, expect } from '../fixtures';
import { Header } from '../pages/header.page';
import { ADDRESS, CARDS, PRODUCTS, money, shippingFor, uniqueEmail } from '../data';

test.describe('Checkout', () => {
  test.beforeEach(async ({ productPage }) => {
    await productPage.add(PRODUCTS.houseEspresso.slug, { quantity: 2 });
  });

  test('completes checkout as a guest with the test card', async ({ page, checkoutPage, orderPage, header }) => {
    const email = uniqueEmail('guest');
    const subtotal = PRODUCTS.houseEspresso.price * 2;
    const total = subtotal + shippingFor(subtotal);

    await checkoutPage.open();
    await checkoutPage.completeAsGuest(email, ADDRESS, CARDS.success);
    const orderId = await orderPage.waitForConfirmation();

    await expect(orderPage.orderNumber).toContainText(`Order number ${orderId}`);
    await expect(page.getByRole('main')).toContainText(email);
    await expect(page.getByRole('main')).toContainText(`2 × ${PRODUCTS.houseEspresso.name}`);
    await expect(orderPage.summary.subtotal).toHaveText(money(subtotal));
    await expect(orderPage.summary.shipping).toHaveText(money(shippingFor(subtotal)));
    await expect(orderPage.summary.total).toHaveText(money(total));
    await expect(page.getByRole('main')).toContainText('Paid with card ending 4242');
    await expect(header.cartLink).toHaveAccessibleName(Header.cartName(0));
  });

  test('shows an error for every required field when the form is empty', async ({ page, checkoutPage }) => {
    await checkoutPage.open();
    await checkoutPage.submit();

    await expect(checkoutPage.formAlert.filter({ hasText: 'Please fix the highlighted fields.' })).toBeVisible();
    for (const message of [
      'Enter a valid email address.',
      'Enter your full name.',
      'Enter your street address.',
      'Enter your city.',
      'Enter a valid postcode.',
      'Choose a country.',
      'Enter a 16 digit card number.',
      'Use MM/YY.',
      'Enter the 3 digit security code.',
    ]) {
      await expect(page.getByRole('main').getByText(message)).toBeVisible();
    }
    await expect(checkoutPage.email).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test('refuses the always-declined card and creates no order', async ({ page, checkoutPage, header }) => {
    await checkoutPage.open();
    await checkoutPage.completeAsGuest(uniqueEmail('declined'), ADDRESS, CARDS.declined);

    await expect(checkoutPage.formAlert.filter({ hasText: 'Your card was declined. No payment was taken.' })).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
    // Nothing was bought, so the cart still holds the items.
    await expect(header.cartLink).toHaveAccessibleName(Header.cartName(2));
  });

  test('rejects an expired card', async ({ page, checkoutPage }) => {
    await checkoutPage.open();
    await checkoutPage.completeAsGuest(uniqueEmail('expired'), ADDRESS, CARDS.expired);

    await expect(page.getByRole('main').getByText('This card has expired.')).toBeVisible();
    await expect(checkoutPage.expiry).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test('keeps shipping details after a declined card so the customer can retry', async ({ checkoutPage, orderPage }) => {
    await checkoutPage.open();
    await checkoutPage.completeAsGuest(uniqueEmail('retry'), ADDRESS, CARDS.declined);
    await expect(checkoutPage.formAlert.filter({ hasText: 'Your card was declined.' })).toBeVisible();

    // Card fields may be cleared for security, but the address the customer typed must survive.
    await expect(checkoutPage.fullName).toHaveValue(ADDRESS.fullName);
    await expect(checkoutPage.city).toHaveValue(ADDRESS.city);
    await expect(checkoutPage.country.locator('option:checked')).toHaveText(ADDRESS.country);

    // Retry with only the card re-entered.
    await checkoutPage.fillCard(CARDS.success);
    await checkoutPage.submit();
    await orderPage.waitForConfirmation();
  });
});
