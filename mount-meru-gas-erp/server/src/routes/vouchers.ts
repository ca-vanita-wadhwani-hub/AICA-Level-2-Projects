import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "../db/client.js";
import { vouchers, voucherLines, chartOfAccounts, pettyCashVouchers } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Default petty-cash approval cap (TZS) above which elevated approval is
// required; a real deployment would source this from a config table.
const DEFAULT_PETTY_CASH_CAP = 100000;

const lineSchema = z.object({
  ledgerId: z.number().int(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  narration: z.string().optional(),
});

const voucherSchema = z.object({
  type: z.enum(["payment", "receipt", "journal", "contra", "petty_cash"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be an ISO YYYY-MM-DD string"),
  narration: z.string().optional(),
  lines: z.array(lineSchema).min(2),
  pettyCash: z
    .object({
      expenseAccountId: z.number().int(),
      receiverSignatureRef: z.string().optional(),
      approvalCapAmount: z.number().positive().optional(),
    })
    .optional(),
});

// Read-only chart-of-accounts lookup so voucher entry can populate a ledger
// picker instead of requiring raw ledger IDs to be typed in blind.
router.get("/ledgers", requirePermission("vouchers", "read"), async (_req, res, next) => {
  try {
    res.json(await db.select().from(chartOfAccounts));
  } catch (err) {
    next(err);
  }
});

router.get("/", requirePermission("vouchers", "read"), async (_req, res, next) => {
  try {
    const rows = await db.select().from(vouchers).orderBy(vouchers.createdAt);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requirePermission("vouchers", "read"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [voucher] = await db.select().from(vouchers).where(eq(vouchers.id, id));
    if (!voucher) {
      res.status(404).json({ error: "Voucher not found" });
      return;
    }
    const lines = await db.select().from(voucherLines).where(eq(voucherLines.voucherId, id));
    res.json({ ...voucher, lines });
  } catch (err) {
    next(err);
  }
});

router.post("/", requirePermission("vouchers", "write"), async (req, res, next) => {
  try {
    const parsed = voucherSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { type, date, narration, lines, pettyCash } = parsed.data;

    // Enforce debit = credit at the API layer before any insert happens.
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      res.status(400).json({
        error: `Voucher is not balanced: total debit (${totalDebit}) must equal total credit (${totalCredit})`,
      });
      return;
    }
    if (totalDebit === 0) {
      res.status(400).json({ error: "Voucher must have a non-zero debit/credit total" });
      return;
    }

    if (type === "petty_cash") {
      if (!pettyCash) {
        res.status(400).json({ error: "petty_cash vouchers require a pettyCash block" });
        return;
      }
      const [expenseLedger] = await db
        .select()
        .from(chartOfAccounts)
        .where(eq(chartOfAccounts.id, pettyCash.expenseAccountId));
      if (!expenseLedger || expenseLedger.group !== "expense") {
        res.status(400).json({ error: "pettyCash.expenseAccountId must reference an Expense-group ledger" });
        return;
      }
    }

    const cap = pettyCash?.approvalCapAmount ?? DEFAULT_PETTY_CASH_CAP;
    const requiresElevatedApproval = type === "petty_cash" && totalDebit > cap;

    const [voucher] = await db
      .insert(vouchers)
      .values({
        type,
        voucherNo: `${type.toUpperCase().slice(0, 3)}-${randomUUID().slice(0, 8).toUpperCase()}`,
        date,
        narration,
        approvalStatus: requiresElevatedApproval ? "pending_approval" : "approved",
        createdBy: req.user!.id,
        approvedBy: requiresElevatedApproval ? null : req.user!.id,
      })
      .returning();

    await db.insert(voucherLines).values(
      lines.map((l) => ({
        voucherId: voucher.id,
        ledgerId: l.ledgerId,
        debit: String(l.debit),
        credit: String(l.credit),
        narration: l.narration,
      })),
    );

    if (type === "petty_cash" && pettyCash) {
      await db.insert(pettyCashVouchers).values({
        voucherId: voucher.id,
        expenseAccountId: pettyCash.expenseAccountId,
        receiverSignatureRef: pettyCash.receiverSignatureRef,
        approvalCapAmount: String(cap),
        requiresElevatedApproval,
      });
    }

    res.status(201).json({ ...voucher, requiresElevatedApproval });
  } catch (err) {
    next(err);
  }
});

// Approve a petty-cash voucher awaiting elevated approval. Restricted to
// finance_manager/admin via the vouchers write permission plus a role check,
// since approval is a distinct action from creation.
router.post(
  "/:id/approve",
  requirePermission("vouchers", "write"),
  async (req, res, next) => {
    try {
      if (req.user!.role !== "admin" && req.user!.role !== "finance_manager") {
        res.status(403).json({ error: "Only admin or finance_manager may approve a voucher" });
        return;
      }
      const id = Number(req.params.id);
      const [updated] = await db
        .update(vouchers)
        .set({ approvalStatus: "approved", approvedBy: req.user!.id, updatedAt: new Date() })
        .where(eq(vouchers.id, id))
        .returning();
      if (!updated) {
        res.status(404).json({ error: "Voucher not found" });
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
