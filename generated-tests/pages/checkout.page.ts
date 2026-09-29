import type { Locator, Page } from '@playwright/test';
import type { Address } from '../data';
import { OrderSummary } from './order-summary';

type Card = { number: string; expiry: string; cvc: string };

export class CheckoutPage {
  readonly heading: Locator;
  readonly email: Locator;
  readonly fullName: Locator;
  readonly street: Locator;
  readonly city: Locator;
  readonly postcode: Locator;
  readonly country: Locator;
  readonly cardNumber: Locator;
  readonly expiry: Locator;
  readonly cvc: Locator;
  readonly submitButton: Locator;
  readonly formAlert: Locator;
  readonly summary: OrderSummary;

  constructor(readonly page: Page) {
    const main = page.getByRole('main');
    this.heading = main.getByRole('heading', { name: 'Checkout', level: 1 });
    this.email = main.getByLabel('Email');
    this.fullName = main.getByLabel('Full name');
    this.street = main.getByLabel('Street address');
    this.city = main.getByLabel('City');
    this.postcode = main.getByLabel('Postcode');
    this.country = main.getByLabel('Country');
    this.cardNumber = main.getByLabel('Card number');
    this.expiry = main.getByLabel('Expiry (MM/YY)');
    this.cvc = main.getByLabel('Security code');
    this.submitButton = main.getByRole('button', { name: 'Place order', exact: true });
    this.formAlert = main.getByRole('alert');
    this.summary = new OrderSummary(
      page,
      main.getByRole('region').filter({ has: page.getByRole('heading', { name: 'Order summary' }) }),
    );
  }

  async open() {
    await this.page.goto('/checkout');
    await this.heading.waitFor();
  }

  async fillContact(email: string) {
    await this.email.fill(email);
  }

  async fillShipping(address: Address) {
    await this.fullName.fill(address.fullName);
    await this.street.fill(address.street);
    await this.city.fill(address.city);
    await this.postcode.fill(address.postcode);
    await this.country.selectOption({ label: address.country });
  }

  async fillCard(card: Card) {
    await this.cardNumber.fill(card.number);
    await this.expiry.fill(card.expiry);
    await this.cvc.fill(card.cvc);
  }

  async submit() {
    await this.submitButton.click();
  }

  /** Full guest checkout from the checkout page. */
  async completeAsGuest(email: string, address: Address, card: Card) {
    await this.fillContact(email);
    await this.fillShipping(address);
    await this.fillCard(card);
    await this.submit();
  }
}
