# Mount Meru Gas Limited — Business Management System

A foundation ERP for an LPG distribution company in Tanzania: stock/inventory,
party (customer/supplier/dealer) onboarding with an approval workflow, a
double-entry voucher/accounting layer, and role-based access control. See
`SPEC.md` for the full requirements this is built against and `STATUS.md` for
exactly what is implemented vs. deferred in this pass.

## Stack

- **Backend**: Node.js + Express + TypeScript
- **ORM**: Drizzle ORM targeting PostgreSQL, migrations via drizzle-kit
- **Auth**: bcrypt password hashing + JWT (Bearer header or httpOnly cookie); no fallback identity — missing/invalid auth is always 401
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Currency / dates**: TZS is the primary currency; dates are stored as ISO `YYYY-MM-DD` and only formatted to `DD-MM-YYYY` at display time (see `src/lib/format.ts`) — the stored value is never mutated

## Project layout

```
mount-meru-gas-erp/
├── server/src/
│   ├── db/
│   │   ├── schema.ts      # Drizzle schema — normalized tables, no JSONB blobs
│   │   ├── client.ts      # pg pool + drizzle client
│   │   ├── migrate.ts     # applies drizzle/ migrations against DATABASE_URL
│   │   └── seed.ts        # role_permissions matrix, BOM, chart of accounts, admin user
│   ├── middleware/auth.ts # requireAuth / requireRoles / requirePermission
│   ├── routes/            # auth, users, locations, items, parties, stock, vouchers, uploads, permissions, reports
│   ├── types.ts
│   └── index.ts           # Express app entrypoint
├── drizzle/                # generated SQL migrations (drizzle-kit generate)
├── drizzle.config.ts
├── src/                    # React frontend (Vite)
│   ├── pages/
│   ├── components/Layout.tsx
│   ├── context/AuthContext.tsx
│   └── lib/{api,format}.ts
├── SPEC.md                 # full spec, verbatim
└── STATUS.md               # implemented vs. deferred
```

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable       | Required | Description                                                            |
| -------------- | -------- | ------------------------------------------------------------------------ |
| `DATABASE_URL` | yes      | PostgreSQL connection string, e.g. `postgres://user:pass@host:5432/db`   |
| `JWT_SECRET`   | yes      | Long random secret used to sign auth JWTs. The server refuses to sign/verify tokens without it. |
| `PORT`         | no       | Port the Express API listens on (default `4000`)                        |
| `NODE_ENV`     | no       | `development` / `production` — affects cookie `secure` flag              |

## Running it

This sandbox has no live Postgres instance, so the steps below describe the
intended flow against a real database.

```bash
npm install

# 1. Generate SQL migrations from the Drizzle schema (already committed under drizzle/,
#    re-run after any schema.ts change):
npm run db:generate

# 2. Apply migrations to your PostgreSQL instance (requires DATABASE_URL in .env):
npm run db:migrate

# 3. Seed reference data (role permissions, bill-of-materials, chart of accounts, admin user):
npx tsx server/src/db/seed.ts

# 4. Run the API and the Vite dev server together:
npm run dev
#   API:      http://localhost:4000  (proxied under /api by Vite)
#   Frontend: http://localhost:5173
```

The seed script creates an initial admin login: **username `admin`, password
`ChangeMe123!`** — change this immediately in a real deployment.

### Type-checking / building without a database

`drizzle-kit generate`, `tsc --noEmit` (both server and client), and
`vite build` all succeed without any live database connection — verified in
this pass:

```bash
npm run db:generate        # drizzle-kit generate — schema-only, no DB needed
npm run typecheck          # tsc --noEmit for both server and client
npm run build               # tsc build (server) + vite build (client)
```

## Design notes / decisions worth knowing

- **Stock balances are never stored.** `stock_transactions` is an append-only
  ledger; every balance is derived by summing quantities per
  `(location_id, item_id)` at query time (`GET /api/stock/ledger`).
- **The refilling bill-of-materials is fixed and server-enforced.** The three
  cylinder sizes (6kg/15kg/38kg) are seeded 1:1 against a bulk-LPG weight and
  an empty-cylinder count; there is deliberately no PUT/PATCH route for
  `bill_of_materials`, and `POST /api/stock/refill` uses `.strict()` Zod
  validation so any unexpected client field (an attempted consumption
  override) is rejected outright.
- **Permissions are data, not code.** `role_permissions (role, module, level)`
  is the single source of truth for both the server's `requirePermission`
  middleware and the frontend's nav visibility (`GET /api/permissions/me`) —
  there is no separate hardcoded UI permission list to keep in sync.
- **Financial reports are hard-gated server-side** to `admin` /
  `finance_manager` / `accounts` via the same permission model — not just
  hidden in the UI.
- **KYC document access is scoped**, not "anyone with the ID": `GET
  /api/uploads/:id` requires auth and only serves admin/finance_manager/
  accounts or the user who created the associated party record.
- **Party approval is a real workflow**: `pending → approved/rejected`, with a
  mandatory rejection reason, and `PUT /api/parties/:id` puts an edited record
  back into `pending` rather than creating a duplicate.
- **Voucher lines must balance.** `POST /api/vouchers` sums debit/credit
  across all lines and rejects an unbalanced voucher before any insert.

## What's not built yet

See `STATUS.md` for the full list (payroll, PAYE/NSSF, Tally XML export, the
remaining 9 voucher types, file-byte storage for uploads vs. metadata-only,
etc.) and suggested next steps.
