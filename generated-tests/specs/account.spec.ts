import { test, expect } from '../fixtures';
import { ADDRESS, CARDS, CODES, PASSWORD, PRODUCTS, uniqueEmail } from '../data';

test.describe('Account', () => {
  test('registers, checks out signed in and sees the order in history', async ({
    customer,
    accountPage,
    header,
    productPage,
    checkoutPage,
    orderPage,
  }) => {
    await expect(accountPage.signedInAs).toHaveText(`Signed in as ${customer.email}`);
    await expect(accountPage.noOrders).toBeVisible();
    await expect(header.accountLink).toBeVisible();

    await productPage.add(PRODUCTS.houseEspresso.slug);
    await checkoutPage.open();
    await expect(checkoutPage.email).toHaveValue(customer.email);
    await expect(checkoutPage.fullName).toHaveValue(customer.name);

    await checkoutPage.fillShipping({ ...ADDRESS, fullName: customer.name });
    await checkoutPage.fillCard(CARDS.success);
    await checkoutPage.submit();
    const orderId = await orderPage.waitForConfirmation();

    await accountPage.open();
    await expect(accountPage.orderLink(orderId)).toBeVisible();
    await expect(accountPage.noOrders).toBeHidden();
  });

  test('rejects a wrong password with a generic message', async ({ loginPage, page }) => {
    await loginPage.open();
    await loginPage.signIn(uniqueEmail('nobody'), 'wrongpass1');

    await expect(loginPage.error).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('requires a password of at least 8 characters to register', async ({ registerPage, page }) => {
    await registerPage.open();
    await registerPage.register('Short Pass', uniqueEmail('short'), 'abc');

    await expect(page.getByRole('main').getByText('Use at least 8 characters.')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('sends signed-out visitors from the account page to sign in', async ({ page, loginPage }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login\?next=%2Faccount|\/login\?next=\/account/);
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('can sign back in after signing out', async ({ customer, accountPage, loginPage, header, page }) => {
    await accountPage.signOutButton.click();
    await expect(header.signInLink).toBeVisible();

    await loginPage.open();
    await loginPage.signIn(customer.email, PASSWORD);
    await expect(page).toHaveURL(/\/account$/);
    await expect(accountPage.signedInAs).toHaveText(`Signed in as ${customer.email}`);
  });
});

test.describe('Promotions', () => {
  test('refuses the new-customer code WELCOME10 on a second order', async ({
    customer,
    productPage,
    cartPage,
    checkoutPage,
    orderPage,
    page,
  }) => {
    const placeOrderWithWelcomeCode = async () => {
      await productPage.add(PRODUCTS.houseEspresso.slug);
      await cartPage.open();
      await cartPage.applyDiscount(CODES.welcome);
      await expect(cartPage.summaryRegion.getByText(/WELCOME10|valid|code/i).first()).toBeVisible();
      await cartPage.proceedToCheckout();
      await checkoutPage.fillShipping({ ...ADDRESS, fullName: customer.name });
      await checkoutPage.fillCard(CARDS.success);
      await checkoutPage.submit();
    };

    // First order: a new customer is entitled to the code.
    await placeOrderWithWelcomeCode();
    await orderPage.waitForConfirmation();
    await expect(orderPage.summary.discount).toBeVisible();

    // Second order: the customer is no longer new, so the code must not reduce the price.
    // The store may refuse the code in the cart or at checkout; either way the order must not be discounted.
    await placeOrderWithWelcomeCode();
    await expect(orderPage.heading.or(checkoutPage.formAlert)).toBeVisible();
    if (/\/order\//.test(page.url())) {
      await expect(orderPage.summary.discount, 'second order was still discounted by WELCOME10').toHaveCount(0);
    }
  });
});
