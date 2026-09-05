import { Router } from "express";
import { db } from "../db/client.js";
import { chartOfAccounts, voucherLines, vouchers } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Financial reports are restricted server-side to admin/finance_manager/
// accounts via the role_permissions matrix — this is a hard requirement, not
// just UI hiding, so requirePermission is the actual gate here.
router.get("/trial-balance", requirePermission("financial_reports", "read"), async (_req, res, next) => {
  try {
    const movements = await db
      .select({
        ledgerId: voucherLines.ledgerId,
        totalDebit: sql<string>`COALESCE(SUM(${voucherLines.debit}), 0)`,
        totalCredit: sql<string>`COALESCE(SUM(${voucherLines.credit}), 0)`,
      })
      .from(voucherLines)
      .innerJoin(vouchers, eq(voucherLines.voucherId, vouchers.id))
      .where(eq(vouchers.approvalStatus, "approved"))
      .groupBy(voucherLines.ledgerId);

    const ledgers = await db.select().from(chartOfAccounts);
    const movementByLedger = new Map(movements.map((m) => [m.ledgerId, m]));

    const rows = ledgers.map((ledger) => {
      const movement = movementByLedger.get(ledger.id);
      const debit = movement ? Number(movement.totalDebit) : 0;
      const credit = movement ? Number(movement.totalCredit) : 0;
      const closingBalance = Number(ledger.openingBalance) + debit - credit;
      return {
        ledgerId: ledger.id,
        code: ledger.code,
        name: ledger.name,
        group: ledger.group,
        currency: ledger.currency,
        openingBalance: ledger.openingBalance,
        periodDebit: debit,
        periodCredit: credit,
        closingBalance,
      };
    });

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
