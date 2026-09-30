import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const DEMO_EMAIL = 'demo@norbill.test';
const DEMO_PASSWORD = 'demo-password-123';

interface MailpitSearch {
  messages: Array<{ ID: string }>;
}

interface MailpitMessage {
  Text: string;
}

function stamp(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

/** Polls the Mailpit API until the confirmation email for the address arrives. */
async function findConfirmationLink(request: APIRequestContext, email: string): Promise<string> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const search = await request.get(`${MAILPIT_URL}/api/v1/search`, { params: { query: `to:${email}` } });
    if (search.ok()) {
      const { messages } = (await search.json()) as MailpitSearch;
      for (const message of messages) {
        const detail = await request.get(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
        const { Text } = (await detail.json()) as MailpitMessage;
        const match = Text.match(/https?:\/\/\S+\/confirm\?token=[A-Za-z0-9_-]+/);
        if (match) {
          return match[0];
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`No confirmation email arrived for ${email}`);
}

async function signUpAndConfirm(page: Page, request: APIRequestContext, company: string): Promise<string> {
  const email = `owner-${stamp()}@example.test`;
  await page.goto('/signup');
  await page.getByLabel('Company name').fill(company);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('a-strong-password-1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  const link = await findConfirmationLink(request, email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: `Welcome, ${company}` })).toBeVisible();
  return email;
}

async function logIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test('a visitor signs up, confirms the email and lands on the dashboard', async ({ page, request }) => {
  const email = await signUpAndConfirm(page, request, 'Acme Studio');
  await expect(page.getByText('Your email is confirmed.')).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);

  await logIn(page, email, 'a-strong-password-1');
  await expect(page.getByRole('heading', { name: 'Welcome, Acme Studio' })).toBeVisible();
});

test('an unconfirmed account cannot log in', async ({ page }) => {
  const email = `pending-${stamp()}@example.test`;
  await page.goto('/signup');
  await page.getByLabel('Company name').fill('Pending Ltd');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('a-strong-password-1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('a-strong-password-1');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Confirm your email first.')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('the demo account logs in and sees its dashboard', async ({ page }) => {
  await logIn(page, DEMO_EMAIL, DEMO_PASSWORD);
  await expect(page.getByRole('heading', { name: 'Welcome, Demo Company' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Clients', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Invoices', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Billing', exact: true })).toBeVisible();
});

test('the demo account creates a client and an invoice, marks it as sent and exports the CSV', async ({ page }) => {
  const id = stamp();
  const clientName = `Client ${id}`;
  await logIn(page, DEMO_EMAIL, DEMO_PASSWORD);

  await page.getByRole('link', { name: 'Clients', exact: true }).click();
  await expect(page).toHaveURL(/\/clients$/);
  await page.getByRole('link', { name: 'New client' }).click();
  await page.getByLabel('Name').fill(clientName);
  await page.getByLabel('Email').fill(`client-${id}@example.test`);
  await page.getByRole('button', { name: 'Create client' }).click();
  await expect(page.getByText('Client created.')).toBeVisible();
  await expect(page.getByRole('cell', { name: clientName })).toBeVisible();

  await page.getByRole('link', { name: 'Invoices', exact: true }).click();
  await page.getByRole('link', { name: 'New invoice' }).click();
  await page.getByLabel('Client', { exact: true }).selectOption({ label: clientName });
  await page.getByLabel('Tax rate (%)').fill('20');
  await page.getByLabel('Line 1 description').fill('Design work');
  await page.getByLabel('Line 1 quantity').fill('2');
  await page.getByLabel('Line 1 unit price').fill('150');
  await page.getByRole('button', { name: 'Create invoice' }).click();
  await expect(page.getByText('Invoice created.')).toBeVisible();

  const heading = (await page.getByRole('heading', { level: 1 }).textContent()) ?? '';
  const number = heading.replace('Invoice', '').trim();
  expect(number).toMatch(/^INV-\d{4}$/);
  await expect(page.getByTestId('invoice-status')).toHaveText('Draft');
  await expect(page.getByRole('cell', { name: '$360.00' })).toBeVisible();

  await page.getByRole('button', { name: 'Mark as sent' }).click();
  await expect(page.getByText('Invoice marked as sent.')).toBeVisible();
  await expect(page.getByTestId('invoice-status')).toHaveText('Sent');
  await expect(page.getByRole('button', { name: 'Mark as sent' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to invoices' }).click();
  await expect(page.getByRole('link', { name: number })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('invoices.csv');
  const csv = readFileSync((await download.path()) ?? '', 'utf8');
  const rows = csv.trim().split(/\r?\n/);
  expect(rows[0]).toBe('number,client,date,total,status');
  const row = rows.find((line) => line.startsWith(`${number},`));
  expect(row).toBeDefined();
  expect(row).toContain(clientName);
  expect(row?.endsWith(',360.00,Sent')).toBe(true);
});

test('the billing page shows the current plan', async ({ page }) => {
  await logIn(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.getByRole('link', { name: 'Billing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
  await expect(page.getByTestId('current-plan')).toHaveText(/^(Free|Pro)$/);
  const plan = await page.getByTestId('current-plan').textContent();
  if (plan === 'Free') {
    if (process.env.STRIPE_SECRET_KEY) {
      await expect(page.getByRole('button', { name: 'Subscribe to Pro' })).toBeVisible();
    } else {
      await expect(page.getByText('Payments are not configured.')).toBeVisible();
    }
  }
});

test('a completed Stripe checkout upgrades the workspace to Pro', async ({ page, request }) => {
  test.skip(Boolean(process.env.STRIPE_WEBHOOK_SECRET), 'Unsigned webhooks are refused when STRIPE_WEBHOOK_SECRET is set');
  await signUpAndConfirm(page, request, 'Webhook Co');
  await page.goto('/billing');
  await expect(page.getByTestId('current-plan')).toHaveText('Free');
  const workspaceId = ((await page.getByTestId('workspace-id').textContent()) ?? '').trim();
  expect(workspaceId).not.toBe('');

  const response = await request.post('/api/webhooks/stripe', {
    data: {
      id: `evt_test_${stamp()}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_journey',
          object: 'checkout.session',
          client_reference_id: workspaceId,
          customer: 'cus_test_journey',
          subscription: 'sub_test_journey',
          metadata: { workspaceId },
        },
      },
    },
  });
  expect(response.ok()).toBeTruthy();

  await expect(async () => {
    await page.reload();
    await expect(page.getByTestId('current-plan')).toHaveText('Pro', { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByText('You are on the Pro plan.')).toBeVisible();
});

test('subscribing to Pro sends the browser to Stripe Checkout', async ({ page }) => {
  test.skip(!process.env.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY is not set');
  await logIn(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.goto('/billing');
  await page.getByRole('button', { name: 'Subscribe to Pro' }).click();
  await expect(page).not.toHaveURL(/localhost:3000\/billing$/);
});
