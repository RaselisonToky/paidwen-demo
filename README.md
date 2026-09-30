# Norbill

Norbill is a small invoicing application for freelancers and small teams. A workspace has clients, sends them invoices and can subscribe to a Pro plan through Stripe.

The whole stack starts with one command:

```sh
docker compose up
```

Then open http://localhost:3000.

## What runs

- `web`: Next.js app on port 3000. The browser only ever talks to this service. Its route handlers call the API on the server side.
- `api`: Fastify API on port 4000, internal only. Runs the database migrations on start.
- `worker`: BullMQ worker. Sends the emails and processes the Stripe webhook events.
- `db`: Postgres 16.
- `redis`: Redis 7, the job queue.

The code is an npm workspace: `apps/web`, `apps/api`, `apps/worker`, `packages/shared` (shared types and helpers) and `tests/e2e` (Playwright journeys).

## Demo account

Create the demo data once the stack is up:

```sh
docker compose exec api node dist/seed.js
```

This creates a confirmed account with 2 clients and 8 invoices:

- email: `demo@norbill.test`
- password: `demo-password-123`

Running the seed again does nothing.

## User journeys

1. Sign up. Fill in the form on `/signup` (Company name, Email, Password). The worker sends a confirmation email with a link to `/confirm?token=...`. Opening the link confirms the account and lands on `/dashboard`, logged in.
2. Log in. `/login` asks for Email and Password and lands on `/dashboard`. An unconfirmed account gets the message "Confirm your email first". The top bar has a Log out button.
3. Clients and invoices. `/clients` lists the clients, `/clients/new` creates one (Name, Email). `/invoices` lists the invoices five per page, newest first, and "Largest first" sorts them by total across all pages. `/invoices/new` creates one (Client, Date, Tax rate, up to three lines with a description, a quantity and a unit price). The invoice page shows the number, the lines, the subtotal, the tax, the total and the status. "Mark as sent" changes the status from Draft to Sent and emails the client.
4. Billing. `/billing` shows the current plan (Free or Pro). "Subscribe to Pro" creates a Stripe Checkout session and sends the browser to Stripe. Stripe calls the webhook, the worker processes the `checkout.session.completed` event and the plan becomes Pro. Without a Stripe key the page says that payments are not configured.
5. Export. "Export CSV" on `/invoices` downloads `invoices.csv` with one line per invoice: number, client, date, total, status.

Without an SMTP server the worker prints every email in its log, confirmation links included:

```sh
docker compose logs -f worker
```

## Environment variables

Every variable has a default in `docker-compose.yml`, so no `.env` file is needed. See `.env.example` for the full list.

- `DATABASE_URL` (default `postgres://norbill:norbill@db:5432/norbill`): Postgres connection string, used by the API and the worker.
- `REDIS_URL` (default `redis://redis:6379`): Redis connection string, used by the API and the worker.
- `APP_URL` (default `http://localhost:3000`): public URL of the web app, used by the API in email links and Stripe redirect URLs.
- `API_URL` (default `http://api:4000`): URL of the API as seen from the web container.
- `SESSION_SECRET` (development default): signs the session cookie in the web app.
- `SMTP_HOST` and `SMTP_PORT` (default empty and `25`): SMTP relay used by the worker. An empty host sends the emails to the worker log.
- `SMTP_USER` and `SMTP_PASSWORD` (default empty): optional SMTP authentication.
- `MAIL_FROM` (default `Norbill <no-reply@norbill.test>`): sender of the emails.
- `STRIPE_SECRET_KEY` (default empty): Stripe API key. Empty means payments are not configured.
- `STRIPE_WEBHOOK_SECRET` (default empty): signing secret of the webhook endpoint. Empty means unsigned webhooks are accepted, unless `NODE_ENV` is `production`.
- `STRIPE_PRICE_PRO` (default empty): Stripe price of the Pro plan.
- `STRIPE_API_BASE` (default empty): sends every Stripe call to another host, for example `http://stripe-mock:12111`.
- `NODE_ENV` (default `development`): used by the API and the worker.

## Endpoints

Web app (port 3000):

- Pages: `/signup`, `/login`, `/dashboard`, `/clients`, `/clients/new`, `/invoices`, `/invoices/new`, `/invoices/:id`, `/billing`. `/` redirects to `/dashboard`.
- Route handlers: `POST /api/signup`, `POST /api/login`, `POST /api/logout`, `GET /confirm?token=...`, `POST /api/clients`, `POST /api/invoices`, `GET /api/invoices/export` (the CSV), `POST /api/invoices/:id/send`, `POST /api/billing/checkout`, `POST /api/webhooks/stripe` (forwarded to the API), `GET /api/health`.

API (port 4000, internal): `GET /health`, `POST /auth/signup`, `POST /auth/confirm`, `POST /auth/login`, `GET /me`, `GET /dashboard`, `GET /clients`, `POST /clients`, `GET /invoices?sort=newest|amount&page=N`, `GET /invoices/export`, `POST /invoices`, `GET /invoices/:id`, `POST /invoices/:id/send`, `GET /billing`, `POST /billing/checkout`, `POST /webhooks/stripe`.

The web app authenticates the browser with a signed, httpOnly session cookie and forwards the user id to the API in the `x-user-id` header. The API is only reachable inside the Docker network, so it trusts that header.

## Development

Node 24 and npm are enough to build and type check everything without Docker:

```sh
npm install
npm run build
npm run typecheck
```

The database schema lives in `apps/api/src/schema.ts`. After a change, generate a migration with `npm run db:generate -w apps/api` and commit the files in `apps/api/drizzle`. The API applies the pending migrations when it starts.

## Tests

`.github/workflows/ci.yml` builds the stack with `docker-compose.ci.yml` (which adds a Mailpit inbox), seeds the demo account and runs the Playwright journeys in `tests/e2e`. To run them against a stack started with the CI override:

```sh
docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d --build
docker compose exec api node dist/seed.js
npm ci -w tests/e2e
npx playwright install --with-deps chromium
npm run test:e2e
```

The Stripe Checkout journey only runs when `STRIPE_SECRET_KEY` is set.
