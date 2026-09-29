// Test data advertised by the app itself (footer, checkout copy) or observed in the catalogue.

export const CARDS = {
  success: { number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' },
  declined: { number: '4000 0000 0000 0002', expiry: '12/30', cvc: '123' },
  expired: { number: '4242 4242 4242 4242', expiry: '01/20', cvc: '123' },
} as const;

export const CODES = {
  welcome: 'WELCOME10',
  welcomeRate: 0.1,
  invalid: 'BOGUS99',
} as const;

export const SHIPPING = {
  flatRate: 6,
  freeThreshold: 50,
} as const;

export const PRODUCTS = {
  houseEspresso: { slug: 'house-espresso', name: 'House Espresso', price: 16 },
  yirgacheffe: { slug: 'yirgacheffe-kochere', name: 'Yirgacheffe Kochere', price: 19 },
  mug: { slug: 'stoneware-mug', name: 'Stoneware Mug', price: 22 },
  dripper: { slug: 'ceramic-pour-over-dripper', name: 'Ceramic Pour Over Dripper', price: 28 },
  gesha: { slug: 'panama-gesha-reserve', name: 'Panama Gesha Reserve', price: 48 },
} as const;

export type Address = {
  fullName: string;
  street: string;
  city: string;
  postcode: string;
  country: string;
};

export const ADDRESS: Address = {
  fullName: 'Test Buyer',
  street: '1 Test Street',
  city: 'Testville',
  postcode: '94105',
  country: 'United States',
};

export const PASSWORD = 'TestPass123';

export function uniqueEmail(tag = 'qa'): string {
  return `${tag}+${Date.now()}${Math.floor(Math.random() * 1000)}@example.test`;
}

/** Formats a number the way the store shows money, e.g. 38 -> "$38.00". */
export function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** The store's discount line uses a Unicode minus: "−$5.70". */
export function discountMoney(amount: number): string {
  return `−${money(amount)}`;
}

export function shippingFor(subtotalAfterDiscount: number): number {
  return subtotalAfterDiscount >= SHIPPING.freeThreshold ? 0 : SHIPPING.flatRate;
}
