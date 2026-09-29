import {expect, type APIRequestContext} from '@playwright/test';

let counter = 0;
export function uniqueEmail(label = 'customer') {
  counter += 1;
  return `${label}-${Date.now().toString(36)}-${counter}@example.test`;
}

/** Registers a fresh customer (which also signs this request context in). */
export async function registerCustomer(request: APIRequestContext, name = 'Test Customer') {
  const account = {email: uniqueEmail(), name, password: 'test-password-123'};
  const response = await request.post('/api/auth/register', {data: account});
  expect(response.status(), await response.text()).toBe(200);
  return account;
}

/** Id of a seeded catalog package, looked up by SKU (database ids differ per run). */
export async function catalogId(request: APIRequestContext, sku: string) {
  const body = await (await request.get('/api/catalog')).json() as {products: {id: string; sku: string}[]};
  const product = body.products.find(item => item.sku === sku);
  expect(product, `catalog package ${sku}`).toBeTruthy();
  return product!.id;
}
