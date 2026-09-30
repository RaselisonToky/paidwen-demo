import { eq } from 'drizzle-orm';
import { hashPassword } from './auth';
import { db, pool, runMigrations, waitForDatabase } from './db';
import { createInvoice } from './invoice-service';
import { clients, invoices, users, workspaces } from './schema';

export const DEMO_EMAIL = 'demo@norbill.test';
export const DEMO_PASSWORD = 'demo-password-123';
export const DEMO_COMPANY = 'Demo Company';

async function seed(): Promise<void> {
  await waitForDatabase();
  await runMigrations();

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (existing) {
    console.log(`The demo account ${DEMO_EMAIL} already exists. Nothing to do.`);
    return;
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await db.transaction(async (tx) => {
    const [workspace] = await tx.insert(workspaces).values({ name: DEMO_COMPANY }).returning({ id: workspaces.id });
    await tx.insert(users).values({ workspaceId: workspace.id, email: DEMO_EMAIL, passwordHash, confirmedAt: new Date() });

    const [acme, globex] = await tx
      .insert(clients)
      .values([
        { workspaceId: workspace.id, name: 'Acme Corporation', email: 'billing@acme.test' },
        { workspaceId: workspace.id, name: 'Globex Industries', email: 'accounts@globex.test' },
      ])
      .returning({ id: clients.id });

    const first = await createInvoice(tx, workspace.id, {
      clientId: acme.id,
      issuedAt: '2026-08-03',
      taxRate: 20,
      lines: [
        { description: 'Website redesign', quantity: 1, unitPriceCents: 480000 },
        { description: 'Hosting, monthly', quantity: 3, unitPriceCents: 4900 },
      ],
    });
    const second = await createInvoice(tx, workspace.id, {
      clientId: globex.id,
      issuedAt: '2026-09-01',
      taxRate: 20,
      lines: [{ description: 'Consulting, hourly', quantity: 12.5, unitPriceCents: 15000 }],
    });
    await createInvoice(tx, workspace.id, {
      clientId: acme.id,
      issuedAt: '2026-09-22',
      taxRate: 0,
      lines: [
        { description: 'Support retainer', quantity: 1, unitPriceCents: 120000 },
        { description: 'Extra support hours', quantity: 4, unitPriceCents: 9500 },
      ],
    });
    const fourth = await createInvoice(tx, workspace.id, {
      clientId: globex.id,
      issuedAt: '2026-09-24',
      taxRate: 20,
      lines: [{ description: 'Logo refresh', quantity: 1, unitPriceCents: 145000 }],
    });
    await createInvoice(tx, workspace.id, {
      clientId: acme.id,
      issuedAt: '2026-09-25',
      taxRate: 20,
      lines: [{ description: 'Newsletter templates', quantity: 3, unitPriceCents: 38000 }],
    });
    const sixth = await createInvoice(tx, workspace.id, {
      clientId: globex.id,
      issuedAt: '2026-09-26',
      taxRate: 20,
      lines: [{ description: 'Data migration', quantity: 1, unitPriceCents: 320000 }],
    });
    await createInvoice(tx, workspace.id, {
      clientId: acme.id,
      issuedAt: '2026-09-28',
      taxRate: 0,
      lines: [{ description: 'Bug fixes, hourly', quantity: 6, unitPriceCents: 9500 }],
    });
    await createInvoice(tx, workspace.id, {
      clientId: globex.id,
      issuedAt: '2026-09-29',
      taxRate: 20,
      lines: [{ description: 'Training session', quantity: 1, unitPriceCents: 90000 }],
    });

    for (const id of [first, second, fourth, sixth]) {
      await tx.update(invoices).set({ status: 'sent', sentAt: new Date() }).where(eq(invoices.id, id));
    }
  });

  console.log(`Seeded ${DEMO_EMAIL} (password: ${DEMO_PASSWORD}) with 2 clients and 8 invoices.`);
}

seed()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
