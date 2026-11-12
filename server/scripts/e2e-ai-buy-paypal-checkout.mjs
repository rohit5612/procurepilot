/**
 * Full AI Buy checkout E2E: extract → compare → PayPal approve (sandbox buyer) → capture → direct PO.
 *
 * Usage (server running on :5000):
 *   PAYPAL_BUYER_EMAIL=... PAYPAL_BUYER_PASSWORD=... node scripts/e2e-ai-buy-paypal-checkout.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.API_BASE || 'http://localhost:5000';
const BUYER_EMAIL = process.env.PAYPAL_BUYER_EMAIL || 'sb-ivhli53483543@personal.example.com';
const BUYER_PASSWORD = process.env.PAYPAL_BUYER_PASSWORD || '';
const APP_USER = process.env.E2E_USER || 'demo_manager';
const APP_PASS = process.env.E2E_PASS || 'Test@2025!';

const demoPenOffers = (budget = 12000, friday = '2026-11-20') => [
  { id: 'A', supplier_name: 'Supplier A (demo)', price: Math.round(budget * 0.95), delivery_date: friday },
  { id: 'B', supplier_name: 'Supplier B (demo)', price: Math.round(budget * 1.05), delivery_date: friday },
  { id: 'C', supplier_name: 'Supplier C (demo)', price: Math.round(budget * 0.9), delivery_date: friday }
];

async function loginApp() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername: APP_USER, password: APP_PASS })
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(`App login failed: ${json.message}`);
  return json.tokens.accessToken;
}

async function api(token, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, json };
}

async function completeGuestCardCheckout(page, checkoutUrl, shot) {
  await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForTimeout(4000);
  await shot(page, 'card-01-loaded');

  const payWithCard = page.getByRole('button', { name: /pay with.*card/i }).first();
  await payWithCard.waitFor({ state: 'visible', timeout: 90_000 });
  await payWithCard.click();
  await page.waitForURL(/hermes|signup|checkoutweb/i, { timeout: 60_000 });
  await page.waitForTimeout(2000);

  await page.getByPlaceholder(/card number/i).fill('4012888888881881');
  await page.getByPlaceholder(/expiry|mm\/yy/i).fill('12/2030');
  await page.getByPlaceholder(/cvv|security code/i).fill('123');
  await page.getByPlaceholder(/first name/i).fill('Sandbox');
  await page.getByPlaceholder(/last name/i).fill('Buyer');
  await page.getByPlaceholder(/address line 1|street/i).fill('12 MI Road');
  await page.getByPlaceholder(/town|city/i).fill('Jaipur');
  await page.getByPlaceholder(/pin code|zip|postal/i).fill('302006');
  await page.getByPlaceholder(/^email$/i).fill(BUYER_EMAIL);

  const phone = page.getByPlaceholder(/mobile|phone/i).last();
  if (await phone.isVisible({ timeout: 3000 }).catch(() => false)) {
    await phone.fill('9876543210');
  }

  const state = page.getByLabel(/^state$/i);
  if (await state.isVisible({ timeout: 2000 }).catch(() => false)) {
    await state.selectOption({ label: /Rajasthan/i }).catch(() => state.selectOption({ index: 1 }));
  }

  const noAccount = page.getByText(/don't want an account now/i);
  if (await noAccount.isVisible({ timeout: 3000 }).catch(() => false)) {
    await noAccount.click();
  }

  await shot(page, 'card-02-filled');

  const payBtn = page
    .locator('#payment-submit-btn, button:has-text("Pay Now"), button:has-text("Complete Purchase"), #confirmButtonTop, button:has-text("Pay $")')
    .first();
  await payBtn.waitFor({ state: 'visible', timeout: 120_000 });
  await payBtn.click({ timeout: 30_000 });

  await page.waitForURL(/localhost:5173|paypal=success|thank/i, { timeout: 120_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await shot(page, 'card-03-done');
}

async function paypalApproveInBrowser(orderId, buyerEmail, buyerPassword) {
  const checkoutUrl = `https://www.sandbox.paypal.com/checkoutnow?token=${encodeURIComponent(orderId)}`;
  const browser = await chromium.launch({ headless: true });
  const shot = (page, name) => page.screenshot({ path: `e2e-paypal-${name}.png`, fullPage: true }).catch(() => {});

  try {
    const loginContext = await browser.newContext({ locale: 'en-US' });
    const loginPage = await loginContext.newPage();
    await loginPage.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await shot(loginPage, '01-loaded');

    const emailField = loginPage.locator('#email, input[name="login_email"], input#login_email, input[type="email"]').first();
    await emailField.waitFor({ state: 'visible', timeout: 60_000 });
    await emailField.fill(buyerEmail);
    await loginPage.locator('#btnNext, button:has-text("Next")').first().click();
    const pwdField = loginPage.locator('#password, input[name="login_password"], input[type="password"]').first();
    await pwdField.waitFor({ state: 'visible', timeout: 60_000 });
    await pwdField.fill(buyerPassword);
    await loginPage.locator('#btnLogin, button:has-text("Log In")').first().click();
    await loginPage.waitForTimeout(3000);
    await shot(loginPage, '02-buyer-login');

    const buyerCurrencyBlocked = await loginPage
      .getByText(/accept payments in your currency/i)
      .isVisible({ timeout: 8000 })
      .catch(() => false);
    if (!buyerCurrencyBlocked) {
      const payBtn = loginPage.locator('#payment-submit-btn, button:has-text("Pay Now"), #confirmButtonTop').first();
      if (await payBtn.isVisible({ timeout: 15_000 }).catch(() => false)) {
        await payBtn.click();
        await loginPage.waitForURL(/localhost:5173|paypal=success/i, { timeout: 120_000 }).catch(() => {});
        await loginContext.close();
        return;
      }
    } else {
      console.warn('Buyer sandbox account logged in but cannot pay USD — using guest card in a fresh session.');
    }
    await loginContext.close();

    const cardContext = await browser.newContext({ locale: 'en-US' });
    const cardPage = await cardContext.newPage();
    await completeGuestCardCheckout(cardPage, checkoutUrl, shot);
    await cardContext.close();
  } finally {
    await browser.close();
  }
}

async function run() {
  if (!BUYER_PASSWORD) {
    throw new Error('Set PAYPAL_BUYER_PASSWORD (sandbox buyer password).');
  }

  const token = await loginApp();
  const text =
    '20 packs of ballpoint pens for Jaipur office, budget ₹12,000, delivery in 1 week.';

  const extract = await api(token, 'POST', '/api/procurepilot/ai-buy/extract', { text });
  if (!extract.ok) throw new Error(`extract: ${JSON.stringify(extract.json)}`);

  const request = {
    ...extract.json.data,
    item: extract.json.data?.item || 'Ballpoint pen packs',
    quantity: 20,
    procurement_category: 'office',
    maximum_budget: 12000,
    delivery_location: 'Jaipur office',
    delivery_deadline: '2026-11-20'
  };

  const compare = await api(token, 'POST', '/api/procurepilot/ai-buy/compare', {
    request,
    offers: demoPenOffers(12000, request.delivery_deadline)
  });
  if (!compare.ok) throw new Error(`compare: ${JSON.stringify(compare.json)}`);
  const session = compare.json.data;
  if (session.policy?.approval?.required) {
    throw new Error(`Expected auto-approve checkout path, got ${JSON.stringify(session.policy?.approval)}`);
  }

  const offerId = session.policy?.recommended_offer_id;
  const create = await api(token, 'POST', '/api/procurepilot/paypal/orders', {
    purchase_request_id: session.purchase_request_id,
    offer_id: String(offerId)
  });
  if (!create.ok) throw new Error(`create order: ${JSON.stringify(create.json)}`);
  const orderId = create.json.data?.id;
  if (!orderId) throw new Error('Missing PayPal order id');

  console.log('Approving PayPal order in sandbox UI...', orderId);
  await paypalApproveInBrowser(orderId, BUYER_EMAIL, BUYER_PASSWORD);

  const capture = await api(token, 'POST', '/api/procurepilot/paypal/capture', { orderId });
  if (!capture.ok) throw new Error(`capture: ${JSON.stringify(capture.json)}`);

  const data = capture.json.data || {};
  const po = data.purchase_order;
  if (!data.newlyPaid) console.warn('Capture ok but newlyPaid=false (may be duplicate capture)');
  if (!po?.po_number) throw new Error(`Expected direct PO after checkout: ${JSON.stringify(capture.json)}`);

  console.log(
    JSON.stringify(
      {
        e2e: 'PASS',
        paypal_order_id: orderId,
        purchase_request_id: session.purchase_request_id,
        capture_status: data.status,
        purchase_order: po
      },
      null,
      2
    )
  );
}

run().catch((e) => {
  console.error('E2E FAIL:', e.message);
  process.exit(1);
});
