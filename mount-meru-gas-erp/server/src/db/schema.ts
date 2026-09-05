// Mount Meru Gas Limited — LPG Business Management System
// Drizzle ORM schema — normalized relational tables (no JSONB-blob-everything).
// Balances are NEVER stored as a mutable column; they are always derived by
// summing stock_transactions per (location_id, item_id).

import {
  pgTable,
  pgEnum,
  serial,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "finance_manager",
  "accounts",
  "procurement_manager",
  "operations_manager",
  "warehouse_manager",
  "plant_engineer",
]);

export const permissionLevelEnum = pgEnum("permission_level", [
  "none",
  "read",
  "write",
]);

export const locationTypeEnum = pgEnum("location_type", [
  "plant",
  "warehouse",
  "depot",
  "dealer_point",
  "vehicle",
]);

export const itemCategoryEnum = pgEnum("item_category", [
  "bulk_lpg",
  "empty_cylinder",
  "refilled_cylinder",
  "accessory",
  "spare",
]);

export const taxTreatmentEnum = pgEnum("tax_treatment", [
  "exempt",
  "vatable_18",
]);

export const cylinderSizeEnum = pgEnum("cylinder_size", ["6kg", "15kg", "38kg"]);

export const partyTypeEnum = pgEnum("party_type", [
  "customer",
  "supplier",
  "dealer",
  "super_dealer",
]);

export const paymentTermsEnum = pgEnum("payment_terms", ["advance", "credit"]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const currencyEnum = pgEnum("currency", ["TZS", "USD"]);

export const stockDirectionEnum = pgEnum("stock_direction", ["in", "out"]);

export const stockTransactionTypeEnum = pgEnum("stock_transaction_type", [
  "purchase",
  "transfer_dispatch",
  "transfer_receipt",
  "refilling_consume",
  "refilling_produce",
  "sale",
  "return",
  "adjustment",
]);

export const adjustmentReasonEnum = pgEnum("adjustment_reason", [
  "physical_count_variance",
  "damage",
  "leakage",
  "theft_or_loss",
  "data_entry_correction",
  "other",
]);

export const ledgerGroupEnum = pgEnum("ledger_group", [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

export const voucherTypeEnum = pgEnum("voucher_type", [
  "payment",
  "receipt",
  "journal",
  "contra",
  "petty_cash",
]);

export const voucherApprovalStatusEnum = pgEnum("voucher_approval_status", [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
]);

// ---------------------------------------------------------------------------
// Users & permissions
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  usernameIdx: uniqueIndex("users_username_idx").on(t.username),
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
}));

// Data-driven permission model: role -> module -> read/write.
// Modules are free-text keys (e.g. "locations", "items", "parties", "stock",
// "vouchers", "financial_reports", "users") checked by requirePermission().
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: userRoleEnum("role").notNull(),
  module: varchar("module", { length: 64 }).notNull(),
  level: permissionLevelEnum("level").notNull().default("none"),
}, (t) => ({
  roleModuleIdx: uniqueIndex("role_permissions_role_module_idx").on(t.role, t.module),
}));

// ---------------------------------------------------------------------------
// Location master
// ---------------------------------------------------------------------------

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: locationTypeEnum("type").notNull(),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  codeIdx: uniqueIndex("locations_code_idx").on(t.code),
}));

// ---------------------------------------------------------------------------
// Item master
// ---------------------------------------------------------------------------

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: itemCategoryEnum("category").notNull(),
  size: cylinderSizeEnum("size"),
  uom: varchar("uom", { length: 16 }).notNull(),
  taxTreatment: taxTreatmentEnum("tax_treatment").notNull(),
  specification: text("specification"),
  hsnCode: varchar("hsn_code", { length: 32 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  codeIdx: uniqueIndex("items_code_idx").on(t.code),
}));

// ---------------------------------------------------------------------------
// Bill of materials — fixed 1:1 refilling rule per cylinder size.
// Seeded only (6kg/15kg/38kg); no update route is exposed via the API.
// ---------------------------------------------------------------------------

export const billOfMaterials = pgTable("bill_of_materials", {
  id: serial("id").primaryKey(),
  size: cylinderSizeEnum("size").notNull(),
  refilledItemId: integer("refilled_item_id").notNull().references(() => items.id),
  emptyItemId: integer("empty_item_id").notNull().references(() => items.id),
  lpgWeightKg: numeric("lpg_weight_kg", { precision: 10, scale: 3 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  sizeIdx: uniqueIndex("bom_size_idx").on(t.size),
}));

// ---------------------------------------------------------------------------
// Parties (customer / supplier / dealer / super_dealer)
// ---------------------------------------------------------------------------

export const parties = pgTable("parties", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull(),
  type: partyTypeEnum("type").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  nature: varchar("nature", { length: 128 }),
  region: varchar("region", { length: 128 }),
  currency: currencyEnum("currency").notNull().default("TZS"),
  paymentTerms: paymentTermsEnum("payment_terms").notNull(),
  creditPeriodDays: integer("credit_period_days").notNull().default(0),
  approvedCreditAmount: numeric("approved_credit_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  openingBalance: numeric("opening_balance", { precision: 18, scale: 2 }).notNull().default("0"),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("pending"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  rejectedBy: integer("rejected_by").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  codeIdx: uniqueIndex("parties_code_idx").on(t.code),
  statusIdx: index("parties_status_idx").on(t.approvalStatus),
}));

// Auto-sequence counters per party-type code prefix (CAMG/SAMG/DEMG/SDEMG).
export const partyCodeSequences = pgTable("party_code_sequences", {
  type: partyTypeEnum("type").primaryKey(),
  prefix: varchar("prefix", { length: 16 }).notNull(),
  lastSeq: integer("last_seq").notNull().default(0),
});

export const mandatoryDocumentTypeEnum = pgEnum("mandatory_document_type", [
  "tin_certificate",
  "business_licence",
  "brela_search",
  "id_copy",
  "vat_certificate",
  "other_document",
]);

export const partyDocuments = pgTable("party_documents", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  documentType: mandatoryDocumentTypeEnum("document_type").notNull(),
  required: boolean("required").notNull(),
  uploadRef: text("upload_ref"), // opaque reference into the uploads store
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  uploadedBy: integer("uploaded_by").references(() => users.id),
}, (t) => ({
  partyDocTypeIdx: uniqueIndex("party_documents_party_doctype_idx").on(t.partyId, t.documentType),
}));

// Backing store for uploaded KYC files — metadata only; actual bytes would
// live on disk/object storage in a real deployment, referenced by `storageKey`.
export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").references(() => parties.id, { onDelete: "cascade" }),
  originalFilename: varchar("original_filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 128 }).notNull(),
  storageKey: text("storage_key").notNull(),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Stock ledger (append-only) + refilling runs
// ---------------------------------------------------------------------------

export const stockTransactions = pgTable("stock_transactions", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locations.id),
  itemId: integer("item_id").notNull().references(() => items.id),
  quantity: numeric("quantity", { precision: 18, scale: 3 }).notNull(),
  direction: stockDirectionEnum("direction").notNull(),
  transactionType: stockTransactionTypeEnum("transaction_type").notNull(),
  referenceId: varchar("reference_id", { length: 64 }),
  reasonCode: adjustmentReasonEnum("reason_code"),
  notes: text("notes"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  locationItemIdx: index("stock_tx_location_item_idx").on(t.locationId, t.itemId),
  refIdx: index("stock_tx_reference_idx").on(t.referenceId),
}));

export const refillingRuns = pgTable("refilling_runs", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locations.id),
  size: cylinderSizeEnum("size").notNull(),
  cylindersProduced: integer("cylinders_produced").notNull(),
  calculatedLpgConsumedKg: numeric("calculated_lpg_consumed_kg", { precision: 18, scale: 3 }).notNull(),
  calculatedEmptyConsumed: integer("calculated_empty_consumed").notNull(),
  actualWeightUsedKg: numeric("actual_weight_used_kg", { precision: 18, scale: 3 }), // variance monitoring only
  refilledStockTxId: integer("refilled_stock_tx_id").references(() => stockTransactions.id),
  lpgConsumeStockTxId: integer("lpg_consume_stock_tx_id").references(() => stockTransactions.id),
  emptyConsumeStockTxId: integer("empty_consume_stock_tx_id").references(() => stockTransactions.id),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Links an outstanding refilled-cylinder sale to its future return (deposit-style
// cylinder tracking) — a sale is either linked to a prior return reference or is
// explicitly flagged outstanding until a return closes it.
export const cylinderSaleTracking = pgTable("cylinder_sale_tracking", {
  id: serial("id").primaryKey(),
  saleStockTxId: integer("sale_stock_tx_id").notNull().references(() => stockTransactions.id),
  partyId: integer("party_id").notNull().references(() => parties.id),
  itemId: integer("item_id").notNull().references(() => items.id),
  quantity: numeric("quantity", { precision: 18, scale: 3 }).notNull(),
  outstanding: boolean("outstanding").notNull().default(true),
  returnStockTxId: integer("return_stock_tx_id").references(() => stockTransactions.id),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Chart of accounts & vouchers
// ---------------------------------------------------------------------------

export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  group: ledgerGroupEnum("group").notNull(),
  currency: currencyEnum("currency").notNull().default("TZS"),
  openingBalance: numeric("opening_balance", { precision: 18, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  codeIdx: uniqueIndex("coa_code_idx").on(t.code),
}));

export const vouchers = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  type: voucherTypeEnum("type").notNull(),
  voucherNo: varchar("voucher_no", { length: 32 }).notNull(),
  date: date("date").notNull(),
  narration: text("narration"),
  approvalStatus: voucherApprovalStatusEnum("approval_status").notNull().default("pending_approval"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  rejectedBy: integer("rejected_by").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  voucherNoIdx: uniqueIndex("vouchers_voucher_no_idx").on(t.voucherNo),
}));

export const voucherLines = pgTable("voucher_lines", {
  id: serial("id").primaryKey(),
  voucherId: integer("voucher_id").notNull().references(() => vouchers.id, { onDelete: "cascade" }),
  ledgerId: integer("ledger_id").notNull().references(() => chartOfAccounts.id),
  debit: numeric("debit", { precision: 18, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 18, scale: 2 }).notNull().default("0"),
  narration: text("narration"),
}, (t) => ({
  voucherIdx: index("voucher_lines_voucher_idx").on(t.voucherId),
}));

// Petty-cash-specific extension of a voucher (type = 'petty_cash').
export const pettyCashVouchers = pgTable("petty_cash_vouchers", {
  id: serial("id").primaryKey(),
  voucherId: integer("voucher_id").notNull().references(() => vouchers.id, { onDelete: "cascade" }),
  expenseAccountId: integer("expense_account_id").notNull().references(() => chartOfAccounts.id),
  receiverSignatureRef: text("receiver_signature_ref"),
  approvalCapAmount: numeric("approval_cap_amount", { precision: 18, scale: 2 }).notNull(),
  requiresElevatedApproval: boolean("requires_elevated_approval").notNull().default(false),
}, (t) => ({
  voucherIdx: uniqueIndex("petty_cash_voucher_idx").on(t.voucherId),
}));

// ---------------------------------------------------------------------------
// Relations (for query ergonomics; not required by drizzle-kit generate)
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  createdParties: many(parties),
}));

export const partiesRelations = relations(parties, ({ one, many }) => ({
  creator: one(users, { fields: [parties.createdBy], references: [users.id] }),
  documents: many(partyDocuments),
}));

export const partyDocumentsRelations = relations(partyDocuments, ({ one }) => ({
  party: one(parties, { fields: [partyDocuments.partyId], references: [parties.id] }),
}));

export const stockTransactionsRelations = relations(stockTransactions, ({ one }) => ({
  location: one(locations, { fields: [stockTransactions.locationId], references: [locations.id] }),
  item: one(items, { fields: [stockTransactions.itemId], references: [items.id] }),
}));

export const vouchersRelations = relations(vouchers, ({ many, one }) => ({
  lines: many(voucherLines),
  pettyCash: one(pettyCashVouchers, {
    fields: [vouchers.id],
    references: [pettyCashVouchers.voucherId],
  }),
}));

export const voucherLinesRelations = relations(voucherLines, ({ one }) => ({
  voucher: one(vouchers, { fields: [voucherLines.voucherId], references: [vouchers.id] }),
  ledger: one(chartOfAccounts, { fields: [voucherLines.ledgerId], references: [chartOfAccounts.id] }),
}));

export const billOfMaterialsRelations = relations(billOfMaterials, ({ one }) => ({
  refilledItem: one(items, { fields: [billOfMaterials.refilledItemId], references: [items.id] }),
  emptyItem: one(items, { fields: [billOfMaterials.emptyItemId], references: [items.id] }),
}));
