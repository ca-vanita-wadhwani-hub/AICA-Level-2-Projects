import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { parties, partyCodeSequences, partyDocuments } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const MANDATORY_REQUIRED = ["tin_certificate", "business_licence", "brela_search", "id_copy"] as const;
const MANDATORY_OPTIONAL = ["vat_certificate", "other_document"] as const;

async function nextPartyCode(type: "customer" | "supplier" | "dealer" | "super_dealer"): Promise<string> {
  // Simple sequential allocation. In a high-concurrency deployment this would
  // run inside a transaction with a row lock (SELECT ... FOR UPDATE); kept
  // straightforward here since party creation is a low-frequency workflow.
  const [row] = await db.select().from(partyCodeSequences).where(eq(partyCodeSequences.type, type));
  if (!row) throw new Error(`No code sequence configured for party type '${type}'`);
  const nextSeq = row.lastSeq + 1;
  await db
    .update(partyCodeSequences)
    .set({ lastSeq: nextSeq })
    .where(eq(partyCodeSequences.type, type));
  return `${row.prefix}${String(nextSeq).padStart(5, "0")}`;
}

const partySchema = z.object({
  type: z.enum(["customer", "supplier", "dealer", "super_dealer"]),
  name: z.string().min(1).max(255),
  nature: z.string().max(128).optional(),
  region: z.string().max(128).optional(),
  currency: z.enum(["TZS", "USD"]).default("TZS"),
  paymentTerms: z.enum(["advance", "credit"]),
  creditPeriodDays: z.number().int().min(0).default(0),
  approvedCreditAmount: z.string().default("0"),
  openingBalance: z.string().default("0"),
});

// Any creating role may create a party (e.g. operations_manager for
// customers, procurement_manager for suppliers); enforced generically via the
// 'parties' write permission rather than per-role branching.
router.post("/", requirePermission("parties", "write"), async (req, res, next) => {
  try {
    const parsed = partySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const data = parsed.data;
    const code = await nextPartyCode(data.type);

    const [created] = await db
      .insert(parties)
      .values({
        code,
        type: data.type,
        name: data.name,
        nature: data.nature,
        region: data.region,
        currency: data.currency,
        paymentTerms: data.paymentTerms,
        creditPeriodDays: data.creditPeriodDays,
        approvedCreditAmount: data.approvedCreditAmount,
        openingBalance: data.openingBalance,
        approvalStatus: "pending",
        createdBy: req.user!.id,
      })
      .returning();

    const docRows = [
      ...MANDATORY_REQUIRED.map((documentType) => ({ partyId: created.id, documentType, required: true })),
      ...MANDATORY_OPTIONAL.map((documentType) => ({ partyId: created.id, documentType, required: false })),
    ];
    await db.insert(partyDocuments).values(docRows as any);

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.get("/", requirePermission("parties", "read"), async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const rows = status
      ? await db.select().from(parties).where(eq(parties.approvalStatus, status as any))
      : await db.select().from(parties);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requirePermission("parties", "read"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [party] = await db.select().from(parties).where(eq(parties.id, id));
    if (!party) {
      res.status(404).json({ error: "Party not found" });
      return;
    }
    const documents = await db.select().from(partyDocuments).where(eq(partyDocuments.partyId, id));
    res.json({ ...party, documents });
  } catch (err) {
    next(err);
  }
});

// Edit + resubmit after rejection: same record re-enters pending status.
router.put("/:id", requirePermission("parties", "write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const parsed = partySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const [existing] = await db.select().from(parties).where(eq(parties.id, id));
    if (!existing) {
      res.status(404).json({ error: "Party not found" });
      return;
    }
    if (existing.approvalStatus === "approved") {
      res.status(409).json({ error: "An already-approved party cannot be edited through this endpoint" });
      return;
    }
    const [updated] = await db
      .update(parties)
      .set({
        ...parsed.data,
        approvalStatus: "pending",
        rejectedBy: null,
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(parties.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const decisionSchema = z.object({
  reason: z.string().min(1).optional(),
});

// finance_manager approves/rejects; accounts is view-only (write not granted
// to 'parties_approval' for the accounts role in the permission seed).
router.post("/:id/approve", requirePermission("parties_approval", "write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(parties)
      .set({ approvalStatus: "approved", approvedBy: req.user!.id, updatedAt: new Date() })
      .where(and(eq(parties.id, id), eq(parties.approvalStatus, "pending")))
      .returning();
    if (!updated) {
      res.status(409).json({ error: "Party is not in a pending state" });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reject", requirePermission("parties_approval", "write"), async (req, res, next) => {
  try {
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success || !parsed.data.reason) {
      res.status(400).json({ error: "A rejection reason is required" });
      return;
    }
    const id = Number(req.params.id);
    const [updated] = await db
      .update(parties)
      .set({
        approvalStatus: "rejected",
        rejectedBy: req.user!.id,
        rejectionReason: parsed.data.reason,
        updatedAt: new Date(),
      })
      .where(and(eq(parties.id, id), eq(parties.approvalStatus, "pending")))
      .returning();
    if (!updated) {
      res.status(409).json({ error: "Party is not in a pending state" });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
