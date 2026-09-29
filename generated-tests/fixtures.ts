import { test as base, expect } from '@playwright/test';
import { Header } from './pages/header.page';
import { ShopPage } from './pages/shop.page';
import { ProductPage } from './pages/product.page';
import { CartPage } from './pages/cart.page';
import { CheckoutPage } from './pages/checkout.page';
import { OrderPage } from './pages/order.page';
import { AccountPage, LoginPage, RegisterPage } from './pages/auth.page';
import { PASSWORD, uniqueEmail } from './data';

type Customer = { name: string; email: string; password: string };

type Fixtures = {
  header: Header;
  shopPage: ShopPage;
  productPage: ProductPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  orderPage: OrderPage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  accountPage: AccountPage;
  /** A freshly registered customer, signed in on `page`. */
  customer: Customer;
};

export const test = base.extend<Fixtures>({
  header: async ({ page }, use) => use(new Header(page)),
  shopPage: async ({ page }, use) => use(new ShopPage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  orderPage: async ({ page }, use) => use(new OrderPage(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  accountPage: async ({ page }, use) => use(new AccountPage(page)),
  customer: async ({ page, registerPage }, use) => {
    const customer = { name: 'QA Customer', email: uniqueEmail('customer'), password: PASSWORD };
    await registerPage.open();
    await registerPage.register(customer.name, customer.email, customer.password);
    await page.waitForURL(/\/account$/);
    await use(customer);
  },
});

export { expect };
