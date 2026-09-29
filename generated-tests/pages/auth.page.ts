import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submitButton: Locator;
  readonly error: Locator;

  constructor(readonly page: Page) {
    const main = page.getByRole('main');
    this.email = main.getByLabel('Email');
    this.password = main.getByLabel('Password');
    this.submitButton = main.getByRole('button', { name: 'Sign in' });
    this.error = main.getByText('Email or password is incorrect.');
  }

  async open() {
    await this.page.goto('/login');
  }

  async signIn(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submitButton.click();
  }
}

export class RegisterPage {
  readonly name: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submitButton: Locator;

  constructor(readonly page: Page) {
    const main = page.getByRole('main');
    this.name = main.getByLabel('Name', { exact: true });
    this.email = main.getByLabel('Email');
    this.password = main.getByLabel('Password');
    this.submitButton = main.getByRole('button', { name: 'Create account' });
  }

  async open() {
    await this.page.goto('/register');
  }

  async register(name: string, email: string, password: string) {
    await this.name.fill(name);
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submitButton.click();
  }
}

export class AccountPage {
  readonly signedInAs: Locator;
  readonly signOutButton: Locator;
  readonly orderHistory: Locator;
  readonly noOrders: Locator;

  constructor(readonly page: Page) {
    const main = page.getByRole('main');
    this.signedInAs = main.getByText(/^Signed in as /);
    this.signOutButton = main.getByRole('button', { name: 'Sign out' });
    this.orderHistory = main.getByRole('heading', { name: 'Order history' });
    this.noOrders = main.getByText('You have not placed any orders yet.');
  }

  async open() {
    await this.page.goto('/account');
  }

  orderLink(orderId: string): Locator {
    return this.page.getByRole('main').getByRole('link', { name: `Order ${orderId}` });
  }
}
