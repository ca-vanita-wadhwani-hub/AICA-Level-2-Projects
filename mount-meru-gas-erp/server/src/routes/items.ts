import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { items } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", requirePermission("items", "read"), async (_req, res, next) => {
  try {
    res.json(await db.select().from(items));
  } catch (err) {
    next(err);
  }
});

const itemSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(255),
  category: z.enum(["bulk_lpg", "empty_cylinder", "refilled_cylinder", "accessory", "spare"]),
  size: z.enum(["6kg", "15kg", "38kg"]).nullable().optional(),
  uom: z.string().min(1).max(16),
  taxTreatment: z.enum(["exempt", "vatable_18"]),
  specification: z.string().optional(),
  hsnCode: z.string().max(32).nullable().optional(),
});

// Items are managed by admin/finance_manager per spec — enforced via the
// role_permissions matrix (items: write only for those two roles).
router.post("/", requirePermission("items", "write"), async (req, res, next) => {
  try {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const [created] = await db.insert(items).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "An item with that code already exists" });
      return;
    }
    next(err);
  }
});

router.put("/:id", requirePermission("items", "write"), async (req, res, next) => {
  try {
    const parsed = itemSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const id = Number(req.params.id);
    const [updated] = await db
      .update(items)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(items.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
