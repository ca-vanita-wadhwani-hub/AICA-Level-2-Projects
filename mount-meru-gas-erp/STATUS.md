# Implementation Status

Last updated: this pass (greenfield build). See `SPEC.md` for the full brief
and `README.md` for how to run this.

## Verified in this pass

- `npm install` — clean, no errors.
- `npm run db:generate` (`drizzle-kit generate`) — succeeds, produces
  `drizzle/0000_silky_hercules.sql` from `server/src/db/schema.ts` (16 tables).
  No live database was used or required.
- `npm run typecheck` — `tsc --noEmit` passes for both `server/tsconfig.json`
  and the root (frontend) `tsconfig.json`.
- `npm run build` — `tsc -p server/tsconfig.json` (emits `dist-server/`) and
  `vite build` (emits `dist-client/`) both succeed.

## Implemented

### Schema (`server/src/db/schema.ts`)
- `users`, `role_permissions` (data-driven role→module→read/write model)
- `locations` (Location Master)
- `items` (item master with category/size/tax_treatment enums)
- `bill_of_materials` (fixed 1:1 rule per cylinder size — seeded only, no
  update route exposed)
- `parties`, `party_code_sequences` (auto-incrementing CAMG/SAMG/DEMG/SDEMG
  codes), `party_documents` (mandatory + optional KYC doc tracking), `uploads`
  (upload metadata store)
- `stock_transactions` (append-only ledger — no mutable balance column
  anywhere), `refilling_runs`, `cylinder_sale_tracking` (outstanding refilled-
  cylinder sale ↔ return linkage)
- `chart_of_accounts` (23 ledgers seeded: 21 TZS + 2 USD — a trade bank
  account and an import expense account), `vouchers`, `voucher_lines`,
  `petty_cash_vouchers`

### Auth & authorization
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` — real
  bcrypt verification, JWT issued via `jsonwebtoken`, no default-admin
  fallback; missing/invalid credentials always 401.
- `requireAuth`, `requireRoles(...)`, `requirePermission(module, level)`
  middleware (`server/src/middleware/auth.ts`) — the permission check queries
  `role_permissions` at request time; it is not a hardcoded switch.
- `GET /api/permissions/me` — exposes the caller's own permission set so the
  frontend nav is driven by the exact same table the server enforces against.

### API routes
- `GET/POST /api/users` — admin-only (both `requireAuth` and
  `requireRoles("admin")`), passwords bcrypt-hashed before storage.
- `GET/POST/PUT/DELETE /api/locations` — write gated to
  `locations: write` (admin/finance_manager per the seeded matrix); delete
  blocked if any `stock_transactions` row references the location.
- `GET/POST/PUT /api/items` — same permission gate.
- `POST/GET/PUT /api/parties`, `POST /api/parties/:id/approve`,
  `POST /api/parties/:id/reject` — full pending→approved/rejected workflow,
  mandatory rejection reason, edit-and-resubmit re-enters `pending`,
  auto-sequenced party codes, mandatory/optional document rows seeded per
  party on creation.
- `GET /api/stock/ledger` — balances always derived via `SUM(...)` grouped by
  location+item; never read from a stored column.
- `POST /api/stock/purchase`, `/transfer` (`dispatch`/`receipt` modes),
  `/refill` (server-computed 1:1 BOM consumption; the request schema is a
  Zod `.strict()` object so any client-supplied consumption override field is
  rejected), `/sale` (refilled-cylinder sales require either
  `linkedReturnStockTxId` or an explicit `outstanding: true` flag),
  `/return`, `/adjustment` (mandatory `reasonCode` + `notes`, and the request
  is rejected if `approvedBy === createdBy`).
- `POST /api/vouchers` — debit/credit totals summed and compared before any
  insert; petty-cash vouchers validate the expense ledger is in the
  `expense` group and compute `requiresElevatedApproval` against a
  configurable cap. `POST /api/vouchers/:id/approve` for the elevated-approval
  step (admin/finance_manager only).
- `GET /api/uploads/:id` — requires auth; scoped to
  admin/finance_manager/accounts OR the user who created the associated
  party record — not "anyone with the ID".
- `GET /api/reports/trial-balance` — gated by `financial_reports` permission
  (admin/finance_manager/accounts only per the seeded matrix); computed from
  ledger opening balances plus approved-voucher movements, not a stored
  total.

### Frontend (React + Vite + Tailwind)
- Login page, `AuthContext` (JWT stored in `localStorage`, sent as a Bearer
  header; also set as an httpOnly cookie by the server as a second channel).
- Role-aware sidebar (`src/components/Layout.tsx`) that renders nav entries
  based on `GET /api/permissions/me`, not a separate hardcoded list.
- Dashboard (location count, pending-party count, write-access module count —
  all live-fetched, no placeholder numbers).
- Master Data: Locations, Items, Parties (create form + approval queue with
  approve/reject-with-reason actions).
- Stock: a single form component that switches field sets per transaction
  type (purchase/transfer/refill/sale/return/adjustment) plus a filterable
  ledger table.
- Vouchers: multi-line debit/credit entry form with live balance-check
  feedback, ledger picker sourced from `GET /api/vouchers/ledgers`, and a
  voucher list.
- Users: admin-only page (route-guarded client-side in addition to the
  server-side 401/403 — the server guard is the real control).
- Reports: trial balance (admin/finance_manager/accounts).

## Deferred (not built in this pass)

Following the "Suggested order for remaining work" shape from the full spec's
section 16, in the order it would make sense to pick these up:

1. **Payroll module** — employee master, PAYE tax bands, NSSF, payslip
   generation, disbursement vouchers. Nothing scaffolded; would need its own
   `employees`, `payslips`, `payroll_runs` tables and a dedicated route set.
2. **Remaining 9 voucher types** — only payment/receipt/journal/contra/
   petty_cash exist. The `voucher_type` enum and route would need extending;
   the debit=credit and approval-cap enforcement already in
   `server/src/routes/vouchers.ts` should generalize to new types with
   minimal change.
3. **Tally XML export** — no exporter exists yet. `chart_of_accounts` and
   `vouchers`/`voucher_lines` are already normalized in a shape that should
   map cleanly to Tally's ledger/voucher XML schema when this is built.
4. **Actual binary file storage for uploads** — `uploads.storage_key` is a
   placeholder reference; there is no disk/S3-equivalent backing store or
   multipart upload handling in this pass, only JSON metadata records via
   `POST /api/uploads`.
5. **Multi-currency FX handling** — the two USD ledgers exist in
   `chart_of_accounts`, but no FX-rate table or conversion logic exists; the
   trial balance report sums currencies numerically with an explicit caveat
   rather than converting.
6. **Concurrency hardening on party-code allocation** — `nextPartyCode` in
   `server/src/routes/parties.ts` does a read-then-write without a row lock
   or transaction; fine for the low-frequency approval workflow this models,
   but should move to `SELECT ... FOR UPDATE` inside a transaction (or a
   Postgres sequence per party type) before concurrent creation load.
7. **Audit trail / activity log** — creations/approvals/rejections record
   `created_by`/`approved_by`/`rejected_by` on the row itself, but there is no
   separate immutable audit log table for full change history.
8. **Automated tests** — none included in this pass; the correctness checks
   performed were `drizzle-kit generate`, `tsc --noEmit` (both projects), and
   `vite build` / `tsc` build, not unit/integration tests.
9. **Session/refresh-token rotation** — JWTs are short-lived (12h) with no
   refresh flow; re-login is required after expiry.
10. **Plant maintenance module** — referenced in the original domain summary
    (plant/machinery upkeep tracking) but not scoped into this pass's
    priority list; would sit alongside `refilling_runs` and reference
    `locations`/a future `equipment` table.
