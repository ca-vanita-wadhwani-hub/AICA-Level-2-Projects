import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "../db/client.js";
import {
  stockTransactions,
  billOfMaterials,
  items,
  refillingRuns,
  cylinderSaleTracking,
} from "../db/schema.js";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/stock/ledger — balances are ALWAYS derived by summing the
// append-only stock_transactions ledger; there is no mutable balance column.
// ---------------------------------------------------------------------------
router.get("/ledger", requirePermission("stock", "read"), async (req, res, next) => {
  try {
    const { location, item, from, to } = req.query as Record<string, string | undefined>;

    const conditions = [] as any[];
    if (location) conditions.push(eq(stockTransactions.locationId, Number(location)));
    if (item) conditions.push(eq(stockTransactions.itemId, Number(item)));
    if (from) conditions.push(gte(stockTransactions.createdAt, new Date(from)));
    if (to) conditions.push(lte(stockTransactions.createdAt, new Date(`${to}T23:59:59.999Z`)));

    const rows = await db
      .select()
      .from(stockTransactions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(stockTransactions.createdAt);

    const balance = await db
      .select({
        locationId: stockTransactions.locationId,
        itemId: stockTransactions.itemId,
        balance: sql<string>`SUM(CASE WHEN ${stockTransactions.direction} = 'in' THEN ${stockTransactions.quantity} ELSE -${stockTransactions.quantity} END)`,
      })
      .from(stockTransactions)
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(stockTransactions.locationId, stockTransactions.itemId);

    res.json({ transactions: rows, balances: balance });
  } catch (err) {
    next(err);
  }
});

async function insertTx(params: {
  locationId: number;
  itemId: number;
  quantity: string;
  direction: "in" | "out";
  transactionType: (typeof stockTransactions.$inferInsert)["transactionType"];
  referenceId: string;
  createdBy: number;
  reasonCode?: (typeof stockTransactions.$inferInsert)["reasonCode"];
  approvedBy?: number;
}) {
  const [row] = await db.insert(stockTransactions).values(params).returning();
  return row;
}

// ---------------------------------------------------------------------------
// POST /api/stock/purchase
// ---------------------------------------------------------------------------
const purchaseSchema = z.object({
  locationId: z.number().int(),
  itemId: z.number().int(),
  quantity: z.number().positive(),
  referenceId: z.string().optional(),
});

router.post("/purchase", requirePermission("stock", "write"), async (req, res, next) => {
  try {
    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { locationId, itemId, quantity, referenceId } = parsed.data;
    const tx = await insertTx({
      locationId,
      itemId,
      quantity: String(quantity),
      direction: "in",
      transactionType: "purchase",
      referenceId: referenceId || `PUR-${randomUUID().slice(0, 8)}`,
      createdBy: req.user!.id,
    });
    res.status(201).json(tx);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/stock/transfer — dispatch and receipt are two separate calls,
// linked by a shared referenceId so a transfer-in-transit state is visible.
// ---------------------------------------------------------------------------
const transferSchema = z.object({
  mode: z.enum(["dispatch", "receipt"]),
  locationId: z.number().int(),
  itemId: z.number().int(),
  quantity: z.number().positive(),
  referenceId: z.string().min(1),
});

router.post("/transfer", requirePermission("stock", "write"), async (req, res, next) => {
  try {
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { mode, locationId, itemId, quantity, referenceId } = parsed.data;
    const tx = await insertTx({
      locationId,
      itemId,
      quantity: String(quantity),
      direction: mode === "dispatch" ? "out" : "in",
      transactionType: mode === "dispatch" ? "transfer_dispatch" : "transfer_receipt",
      referenceId,
      createdBy: req.user!.id,
    });
    res.status(201).json(tx);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/stock/refill — server computes LPG + empty-cylinder consumption
// from the seeded 1:1 BOM. Any client-supplied consumption override is
// rejected outright.
// ---------------------------------------------------------------------------
const refillSchema = z
  .object({
    locationId: z.number().int(),
    size: z.enum(["6kg", "15kg", "38kg"]),
    cylindersProduced: z.number().int().positive(),
    bulkLpgItemId: z.number().int(),
    actualWeightUsedKg: z.number().positive().optional(),
  })
  .strict(); // .strict() rejects any unexpected fields (e.g. a client override)

router.post("/refill", requirePermission("stock", "write"), async (req, res, next) => {
  try {
    const parsed = refillSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { locationId, size, cylindersProduced, bulkLpgItemId, actualWeightUsedKg } = parsed.data;

    const [bom] = await db.select().from(billOfMaterials).where(eq(billOfMaterials.size, size));
    if (!bom) {
      res.status(400).json({ error: `No bill-of-materials configured for size '${size}'` });
      return;
    }

    const lpgPerCylinder = Number(bom.lpgWeightKg);
    const calculatedLpgConsumedKg = lpgPerCylinder * cylindersProduced;
    const calculatedEmptyConsumed = cylindersProduced; // fixed 1:1

    const referenceId = `RFL-${randomUUID().slice(0, 8)}`;

    const lpgTx = await insertTx({
      locationId,
      itemId: bulkLpgItemId,
      quantity: String(calculatedLpgConsumedKg),
      direction: "out",
      transactionType: "refilling_consume",
      referenceId,
      createdBy: req.user!.id,
    });
    const emptyTx = await insertTx({
      locationId,
      itemId: bom.emptyItemId,
      quantity: String(calculatedEmptyConsumed),
      direction: "out",
      transactionType: "refilling_consume",
      referenceId,
      createdBy: req.user!.id,
    });
    const refilledTx = await insertTx({
      locationId,
      itemId: bom.refilledItemId,
      quantity: String(cylindersProduced),
      direction: "in",
      transactionType: "refilling_produce",
      referenceId,
      createdBy: req.user!.id,
    });

    const [run] = await db
      .insert(refillingRuns)
      .values({
        locationId,
        size,
        cylindersProduced,
        calculatedLpgConsumedKg: String(calculatedLpgConsumedKg),
        calculatedEmptyConsumed,
        actualWeightUsedKg: actualWeightUsedKg !== undefined ? String(actualWeightUsedKg) : null,
        refilledStockTxId: refilledTx.id,
        lpgConsumeStockTxId: lpgTx.id,
        emptyConsumeStockTxId: emptyTx.id,
        createdBy: req.user!.id,
      })
      .returning();

    res.status(201).json(run);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/stock/sale — a refilled-cylinder sale must either reference a
// prior return (closing an outstanding cylinder position) or be explicitly
// flagged outstanding until a future return closes it.
// ---------------------------------------------------------------------------
const saleSchema = z.object({
  locationId: z.number().int(),
  itemId: z.number().int(),
  partyId: z.number().int(),
  quantity: z.number().positive(),
  linkedReturnStockTxId: z.number().int().optional(),
  outstanding: z.boolean().optional(),
  referenceId: z.string().optional(),
});

router.post("/sale", requirePermission("stock", "write"), async (req, res, next) => {
  try {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { locationId, itemId, partyId, quantity, linkedReturnStockTxId, outstanding, referenceId } = parsed.data;

    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    const isRefilledCylinder = item?.category === "refilled_cylinder";

    if (isRefilledCylinder && linkedReturnStockTxId === undefined && outstanding !== true) {
      res.status(400).json({
        error:
          "A refilled-cylinder sale must either reference a prior return (linkedReturnStockTxId) " +
          "or be explicitly flagged outstanding: true",
      });
      return;
    }

    const ref = referenceId || `SAL-${randomUUID().slice(0, 8)}`;
    const tx = await insertTx({
      locationId,
      itemId,
      quantity: String(quantity),
      direction: "out",
      transactionType: "sale",
      referenceId: ref,
      createdBy: req.user!.id,
    });

    if (isRefilledCylinder) {
      const [tracking] = await db
        .insert(cylinderSaleTracking)
        .values({
          saleStockTxId: tx.id,
          partyId,
          itemId,
          quantity: String(quantity),
          outstanding: linkedReturnStockTxId === undefined,
          returnStockTxId: linkedReturnStockTxId ?? null,
          closedAt: linkedReturnStockTxId !== undefined ? new Date() : null,
        })
        .returning();
      res.status(201).json({ transaction: tx, tracking });
      return;
    }

    res.status(201).json({ transaction: tx });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/stock/return
// ---------------------------------------------------------------------------
const returnSchema = z.object({
  locationId: z.number().int(),
  itemId: z.number().int(),
  quantity: z.number().positive(),
  closesTrackingId: z.number().int().optional(),
  referenceId: z.string().optional(),
});

router.post("/return", requirePermission("stock", "write"), async (req, res, next) => {
  try {
    const parsed = returnSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { locationId, itemId, quantity, closesTrackingId, referenceId } = parsed.data;
    const tx = await insertTx({
      locationId,
      itemId,
      quantity: String(quantity),
      direction: "in",
      transactionType: "return",
      referenceId: referenceId || `RET-${randomUUID().slice(0, 8)}`,
      createdBy: req.user!.id,
    });

    if (closesTrackingId !== undefined) {
      await db
        .update(cylinderSaleTracking)
        .set({ outstanding: false, returnStockTxId: tx.id, closedAt: new Date() })
        .where(eq(cylinderSaleTracking.id, closesTrackingId));
    }

    res.status(201).json(tx);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/stock/adjustment — mandatory reason code, and the approver must
// differ from the creator (segregation of duties).
// ---------------------------------------------------------------------------
const adjustmentSchema = z.object({
  locationId: z.number().int(),
  itemId: z.number().int(),
  quantity: z.number(), // signed: positive increases stock, negative decreases
  reasonCode: z.enum([
    "physical_count_variance",
    "damage",
    "leakage",
    "theft_or_loss",
    "data_entry_correction",
    "other",
  ]),
  notes: z.string().min(1),
  approvedBy: z.number().int(),
  referenceId: z.string().optional(),
});

router.post("/adjustment", requirePermission("stock_adjustment", "write"), async (req, res, next) => {
  try {
    const parsed = adjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { locationId, itemId, quantity, reasonCode, notes, approvedBy, referenceId } = parsed.data;

    if (approvedBy === req.user!.id) {
      res.status(400).json({ error: "The approver must be different from the person creating the adjustment" });
      return;
    }

    const [tx] = await db
      .insert(stockTransactions)
      .values({
        locationId,
        itemId,
        quantity: String(Math.abs(quantity)),
        direction: quantity >= 0 ? "in" : "out",
        transactionType: "adjustment",
        referenceId: referenceId || `ADJ-${randomUUID().slice(0, 8)}`,
        reasonCode,
        notes,
        createdBy: req.user!.id,
        approvedBy,
      })
      .returning();
    res.status(201).json(tx);
  } catch (err) {
    next(err);
  }
});

export default router;
