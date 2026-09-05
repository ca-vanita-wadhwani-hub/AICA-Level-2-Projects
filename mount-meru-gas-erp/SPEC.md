# Mount Meru Gas Limited — LPG Business Management System — Master Spec

> This file preserves, verbatim, the spec text that was supplied as the
> authoritative brief for this project (as given in the build instructions for
> this pass). It is kept here for future reference so whoever picks up this
> project next has the original requirements in one place alongside
> `STATUS.md` (what's built) and `README.md` (how to run it).

## Context

This is a business management system for Mount Meru Gas Limited, an LPG
(liquefied petroleum gas) distribution company in Tanzania. It's a large spec
covering stock/inventory, plant maintenance, sales, accounting, payroll, and
multi-role access.

## Stack decisions (fixed)

- Backend: Node.js + Express + TypeScript
- ORM: Drizzle ORM targeting PostgreSQL (drizzle-kit for migrations). Use real
  normalized tables per entity — explicitly NOT a JSONB-blob-everything
  pattern (flagged as a known mistake from an earlier build).
- Auth: real bcrypt password hashing, session or JWT-based auth middleware,
  NO silent default-to-admin fallback for unauthenticated requests (401 on
  missing/invalid auth, always).
- Frontend: React + TypeScript + Vite, Tailwind for styling.
- Currency: TZS primary, ISO dates (YYYY-MM-DD) in storage, DD-MM-YYYY only at
  display/formatting layer (never mutate stored dates).

## Scope for this pass (in priority order)

1. **Project scaffold**: package.json, tsconfig, vite config, drizzle config,
   folder structure (`server/`, `src/` for frontend, `drizzle/` for
   schema+migrations), README explaining how to run it (env vars needed:
   DATABASE_URL, JWT_SECRET or SESSION_SECRET, PORT).

2. **Database schema** (Drizzle, normalized tables, not JSONB blobs) covering
   at minimum:
   - users (role enum: admin, finance_manager, accounts,
     procurement_manager, operations_manager, warehouse_manager,
     plant_engineer), password_hash, bcrypt.
   - role_permissions table (role → module → read/write) — data-driven
     permission model, not hardcoded switch statements.
   - locations (Location Master: code, name, type, address, deletable only
     if no transaction history).
   - items (code, name, category enum:
     bulk_lpg/empty_cylinder/refilled_cylinder/accessory/spare, size
     nullable, uom, tax_treatment enum: exempt/vatable_18, specification,
     hsn_code nullable).
   - bill_of_materials (refilled_item_id, empty_item_id, lpg_weight_kg) —
     fixed 1:1 rule per size, seed the 3 sizes (6kg/15kg/38kg), non-editable
     via API (no PUT/PATCH route for it, only seeded).
   - parties table (unified or per-type: customer/supplier/dealer/
     super_dealer) with code prefix per type
     (CAMG/SAMG/DEMG/SDEMG, auto-sequence), nature, region, currency,
     payment_terms (advance/credit), credit_period_days,
     approved_credit_amount, opening_balance, approval_status
     (pending/approved/rejected), created_by, approved_by, rejected_by,
     rejection_reason, timestamps, and a mandatory_documents join table
     (tin_certificate, business_licence, brela_search, id_copy required;
     vat_certificate, other_document optional) with upload references.
   - stock_transactions (append-only ledger: location_id, item_id, quantity,
     direction in/out, transaction_type enum covering
     purchase/transfer/refilling/sale/return/adjustment, reference_id,
     created_by, created_at) — balances always derived by summing this
     table per location+item, never a mutable balance column.
   - refilling_runs (cylinders_produced, size, calculated_lpg_consumed,
     calculated_empty_consumed, actual_weight_used nullable — for variance
     monitoring only, never used for deduction).
   - chart_of_accounts (ledger name, group, currency TZS/USD,
     opening_balance) — seed ~20 TZS ledgers + 2 USD ledgers (a trade bank
     account and an import expense account) matching the spec's structure.
   - vouchers (type enum: payment/receipt/journal/contra/petty_cash, date,
     narration, created_by, approval fields) + voucher_lines (voucher_id,
     ledger_id, debit, credit) — enforce debit=credit at the API layer
     before insert.
   - petty_cash_vouchers extension: expense_account_id (must reference an
     Expense-group ledger), receiver_signature_ref, approval_status,
     approval_cap threshold config.

3. **Auth & permission middleware**: `requireAuth` (401 if missing/invalid
   token/session) and `requireRoles([...])` / a generic
   `requirePermission(module, 'read'|'write')` that checks the
   role_permissions table. Real server-side guards — "financial reports
   restricted to admin/finance_manager/accounts, enforced server-side" is a
   hard requirement, not just UI hiding.

4. **Core API routes**:
   - POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me (all
     real, no fallback-to-admin)
   - GET/POST /api/users (admin only — an earlier build's unauthenticated
     /api/users leak is explicitly flagged as a bug not to repeat)
   - CRUD for locations, items (admin/finance_manager)
   - Party creation + approval workflow: POST /api/parties (any creating
     role per type — operations_manager for customers), GET
     /api/parties?status=pending (finance_manager approve/reject with
     reason; accounts view-only), PUT /api/parties/:id (edit+resubmit
     after rejection, same record, re-enters pending)
   - Stock: POST /api/stock/purchase, POST /api/stock/transfer
     (dispatch+receipt as two calls), POST /api/stock/refill (server
     computes LPG+empty-cylinder consumption from BOM, 1:1, rejects any
     client-supplied override), POST /api/stock/sale (refilled cylinder
     sale must accept a linked-return reference or flag as outstanding),
     POST /api/stock/return, POST /api/stock/adjustment (mandatory reason
     code, separate approver != creator), GET
     /api/stock/ledger?location&item&from&to
   - Vouchers: POST /api/vouchers (payment/receipt/journal/contra/petty_cash),
     enforce debit=credit and petty-cash approval cap
   - GET /api/uploads/:id — MUST require auth and be scoped (e.g. only
     admin/finance_manager/accounts/the party's assigned creator role, not
     "anyone with the ID") since this exact leak is explicitly called out as
     unacceptable for KYC documents.

5. **Frontend**: login page, a role-aware sidebar/nav (only show modules the
   logged-in user's role has read access to, sourced from the same
   permission model as the backend), and working pages for: Dashboard
   (basic), Master Data (locations/items/parties incl. approval queue),
   Stock (transaction entry forms + ledger view), Vouchers (create + list).
   Payroll, Tally export, and the 9 extra voucher types are explicitly
   deferred from this pass.

6. `SPEC.md` (this file) + `STATUS.md` documenting exactly what's implemented
   vs. deferred from the "Suggested order for remaining work" list (section
   16 of the original full spec document), so whoever picks this up next
   knows the real state.

## Domain background carried over from prior discussion (for context)

Mount Meru Gas Limited operates LPG plants, warehouses, depots, and dealer
points across Tanzania. The business:

- Purchases bulk LPG and empty cylinders.
- Refills empty cylinders from bulk LPG stock at a fixed weight per cylinder
  size (6kg, 15kg, 38kg) — a strict 1:1 bill-of-materials rule that must
  never be overridden by a client-supplied value, only computed server-side.
- Sells refilled cylinders to dealers, super-dealers, and customers, often
  under a cylinder-deposit/return model where an outstanding refilled
  cylinder sale is expected to be matched by a future empty-cylinder return.
- Onboards customers, suppliers, dealers, and super-dealers through a
  KYC-backed approval workflow (mandatory: TIN certificate, business
  licence, BRELA company search, ID copy; optional: VAT certificate, other
  supporting document) gated by a finance_manager approval step, with
  accounts staff able to view but not approve.
- Runs a TZS-primary chart of accounts with a small number of USD ledgers
  for imports and hard-currency banking, and processes transactions through
  a voucher-based double-entry system (payment, receipt, journal, contra,
  petty cash — with nine additional specialized voucher types envisioned for
  a later pass, e.g. for payroll disbursement, inter-company transfers, and
  Tally-format export reconciliation, none of which are built in this pass).
- Distinguishes multiple operational roles (admin, finance_manager,
  accounts, procurement_manager, operations_manager, warehouse_manager,
  plant_engineer) each with different read/write access to different
  modules — enforced through a single data-driven role_permissions table
  rather than hardcoded per-role branching logic, so the same source of
  truth can drive both server-side authorization and the frontend's
  role-aware navigation.

## Explicitly out of scope for this pass

- Payroll and PAYE/NSSF tax band calculations.
- Tally XML export.
- The remaining 9 voucher types beyond payment/receipt/journal/contra/petty_cash.
- Actual binary file storage for KYC uploads (metadata + storage-key
  reference only in this pass; see STATUS.md).
- Live database provisioning inside the build sandbox (schema + migrations
  are verified to generate correctly; no live Postgres instance is available
  here).
