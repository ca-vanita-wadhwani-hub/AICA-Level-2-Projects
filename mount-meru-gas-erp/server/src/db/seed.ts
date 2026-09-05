// One-time / idempotent seed data: role permission matrix, bill-of-materials
// (fixed 1:1 refilling rule, non-editable via API), chart of accounts, and
// an initial admin user. Run with: tsx server/src/db/seed.ts
import "dotenv/config";
import bcrypt from "bcrypt";
import { db, pool } from "./client.js";
import {
  users,
  rolePermissions,
  items,
  billOfMaterials,
  chartOfAccounts,
  partyCodeSequences,
  locations,
} from "./schema.js";
import { eq, and } from "drizzle-orm";

type Role =
  | "admin"
  | "finance_manager"
  | "accounts"
  | "procurement_manager"
  | "operations_manager"
  | "warehouse_manager"
  | "plant_engineer";

const MODULES = [
  "users",
  "locations",
  "items",
  "parties",
  "parties_approval",
  "stock",
  "stock_adjustment",
  "vouchers",
  "financial_reports",
] as const;

// role -> module -> level. Admin gets write everywhere. financial_reports is
// deliberately restricted to admin/finance_manager/accounts only.
const PERMISSION_MATRIX: Record<Role, Partial<Record<(typeof MODULES)[number], "read" | "write">>> = {
  admin: {
    users: "write",
    locations: "write",
    items: "write",
    parties: "write",
    parties_approval: "write",
    stock: "write",
    stock_adjustment: "write",
    vouchers: "write",
    financial_reports: "write",
  },
  finance_manager: {
    locations: "write",
    items: "write",
    parties: "read",
    parties_approval: "write",
    stock: "read",
    vouchers: "write",
    financial_reports: "write",
  },
  accounts: {
    locations: "read",
    items: "read",
    parties: "read",
    parties_approval: "read",
    stock: "read",
    vouchers: "write",
    financial_reports: "read",
  },
  procurement_manager: {
    locations: "read",
    items: "read",
    parties: "write",
    stock: "write",
  },
  operations_manager: {
    locations: "read",
    items: "read",
    parties: "write",
    stock: "write",
  },
  warehouse_manager: {
    locations: "read",
    items: "read",
    stock: "write",
    stock_adjustment: "write",
  },
  plant_engineer: {
    locations: "read",
    items: "read",
    stock: "write",
  },
};

async function upsertPermission(role: Role, module: string, level: "none" | "read" | "write") {
  const existing = await db
    .select()
    .from(rolePermissions)
    .where(and(eq(rolePermissions.role, role), eq(rolePermissions.module, module)));
  if (existing.length > 0) {
    await db
      .update(rolePermissions)
      .set({ level })
      .where(and(eq(rolePermissions.role, role), eq(rolePermissions.module, module)));
  } else {
    await db.insert(rolePermissions).values({ role, module, level });
  }
}

async function seedPermissions() {
  const roles = Object.keys(PERMISSION_MATRIX) as Role[];
  for (const role of roles) {
    for (const module of MODULES) {
      const level = PERMISSION_MATRIX[role][module] ?? "none";
      await upsertPermission(role, module, level);
    }
  }
  console.log("Seeded role_permissions matrix.");
}

async function seedAdmin() {
  const existing = await db.select().from(users).where(eq(users.username, "admin"));
  if (existing.length > 0) {
    console.log("Admin user already exists, skipping.");
    return;
  }
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  await db.insert(users).values({
    username: "admin",
    email: "admin@mountmerugas.co.tz",
    passwordHash,
    fullName: "System Administrator",
    role: "admin",
  });
  console.log("Seeded admin user (username: admin, password: ChangeMe123!) — change immediately.");
}

async function seedLocations() {
  const existing = await db.select().from(locations);
  if (existing.length > 0) {
    console.log("Locations already seeded, skipping.");
    return;
  }
  await db.insert(locations).values([
    { code: "PLT-DSM", name: "Dar es Salaam Plant", type: "plant" },
    { code: "WH-DSM", name: "Dar es Salaam Warehouse", type: "warehouse" },
    { code: "DEP-ARU", name: "Arusha Depot", type: "depot" },
  ]);
  console.log("Seeded locations.");
}

const CYLINDER_SIZES = ["6kg", "15kg", "38kg"] as const;
const LPG_WEIGHT_BY_SIZE: Record<(typeof CYLINDER_SIZES)[number], string> = {
  "6kg": "6.000",
  "15kg": "15.000",
  "38kg": "38.000",
};

async function seedItemsAndBom() {
  const existingItems = await db.select().from(items);
  const bulkLpg =
    existingItems.find((i) => i.category === "bulk_lpg") ??
    (
      await db
        .insert(items)
        .values({
          code: "BLK-LPG",
          name: "Bulk LPG",
          category: "bulk_lpg",
          uom: "KG",
          taxTreatment: "vatable_18",
          specification: "Bulk propane/butane mix stored at plant",
        })
        .returning()
    )[0];

  for (const size of CYLINDER_SIZES) {
    let empty = existingItems.find((i) => i.category === "empty_cylinder" && i.size === size);
    if (!empty) {
      [empty] = await db
        .insert(items)
        .values({
          code: `EMP-${size.toUpperCase()}`,
          name: `Empty Cylinder ${size}`,
          category: "empty_cylinder",
          size,
          uom: "EA",
          taxTreatment: "exempt",
        })
        .returning();
    }

    let refilled = existingItems.find((i) => i.category === "refilled_cylinder" && i.size === size);
    if (!refilled) {
      [refilled] = await db
        .insert(items)
        .values({
          code: `REF-${size.toUpperCase()}`,
          name: `Refilled Cylinder ${size}`,
          category: "refilled_cylinder",
          size,
          uom: "EA",
          taxTreatment: "vatable_18",
        })
        .returning();
    }

    const existingBom = await db.select().from(billOfMaterials).where(eq(billOfMaterials.size, size));
    if (existingBom.length === 0) {
      await db.insert(billOfMaterials).values({
        size,
        refilledItemId: refilled.id,
        emptyItemId: empty.id,
        lpgWeightKg: LPG_WEIGHT_BY_SIZE[size],
      });
    }
  }
  console.log("Seeded items and bill_of_materials (fixed 1:1 rule per size).", { bulkLpgId: bulkLpg.id });
}

async function seedPartyCodeSequences() {
  const rows: Array<{ type: "customer" | "supplier" | "dealer" | "super_dealer"; prefix: string }> = [
    { type: "customer", prefix: "CAMG" },
    { type: "supplier", prefix: "SAMG" },
    { type: "dealer", prefix: "DEMG" },
    { type: "super_dealer", prefix: "SDEMG" },
  ];
  for (const row of rows) {
    const existing = await db.select().from(partyCodeSequences).where(eq(partyCodeSequences.type, row.type));
    if (existing.length === 0) {
      await db.insert(partyCodeSequences).values({ type: row.type, prefix: row.prefix, lastSeq: 0 });
    }
  }
  console.log("Seeded party code sequences.");
}

// ~20 TZS ledgers + 2 USD ledgers (trade bank account + import expense account)
async function seedChartOfAccounts() {
  const existing = await db.select().from(chartOfAccounts);
  if (existing.length > 0) {
    console.log("Chart of accounts already seeded, skipping.");
    return;
  }
  const tzsLedgers: Array<{ code: string; name: string; group: "asset" | "liability" | "equity" | "income" | "expense" }> = [
    { code: "1001", name: "Cash in Hand", group: "asset" },
    { code: "1002", name: "Petty Cash", group: "asset" },
    { code: "1010", name: "CRDB Bank - TZS Current Account", group: "asset" },
    { code: "1011", name: "NMB Bank - TZS Current Account", group: "asset" },
    { code: "1100", name: "Accounts Receivable - Trade Debtors", group: "asset" },
    { code: "1200", name: "Inventory - Bulk LPG", group: "asset" },
    { code: "1201", name: "Inventory - Cylinders", group: "asset" },
    { code: "1300", name: "Prepaid Expenses", group: "asset" },
    { code: "1500", name: "Plant & Machinery", group: "asset" },
    { code: "1510", name: "Motor Vehicles", group: "asset" },
    { code: "2001", name: "Accounts Payable - Trade Creditors", group: "liability" },
    { code: "2010", name: "VAT Payable", group: "liability" },
    { code: "2020", name: "PAYE Payable", group: "liability" },
    { code: "2030", name: "NSSF Payable", group: "liability" },
    { code: "2100", name: "Accrued Expenses", group: "liability" },
    { code: "3001", name: "Share Capital", group: "equity" },
    { code: "3002", name: "Retained Earnings", group: "equity" },
    { code: "4001", name: "Sales - Refilled Cylinders", group: "income" },
    { code: "4002", name: "Sales - Bulk LPG", group: "income" },
    { code: "5001", name: "Purchase - Bulk LPG", group: "expense" },
    { code: "5100", name: "Fuel & Transport Expense", group: "expense" },
    { code: "5200", name: "Salaries & Wages", group: "expense" },
    { code: "5300", name: "Plant Maintenance Expense", group: "expense" },
    { code: "5400", name: "Office & Administration Expense", group: "expense" },
  ];
  await db.insert(chartOfAccounts).values(
    tzsLedgers.map((l) => ({ ...l, currency: "TZS" as const })),
  );
  await db.insert(chartOfAccounts).values([
    { code: "1020", name: "CRDB Bank - USD Trade Account", group: "asset", currency: "USD" },
    { code: "5002", name: "Import Expense - USD", group: "expense", currency: "USD" },
  ]);
  console.log("Seeded chart of accounts (23 ledgers).");
}

async function main() {
  await seedPermissions();
  await seedAdmin();
  await seedLocations();
  await seedItemsAndBom();
  await seedPartyCodeSequences();
  await seedChartOfAccounts();
  await pool.end();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
