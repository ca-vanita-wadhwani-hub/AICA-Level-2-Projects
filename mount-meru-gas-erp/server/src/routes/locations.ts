import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { locations, stockTransactions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", requirePermission("locations", "read"), async (_req, res, next) => {
  try {
    res.json(await db.select().from(locations));
  } catch (err) {
    next(err);
  }
});

const locationSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(255),
  type: z.enum(["plant", "warehouse", "depot", "dealer_point", "vehicle"]),
  address: z.string().optional(),
});

router.post("/", requirePermission("locations", "write"), async (req, res, next) => {
  try {
    const parsed = locationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const [created] = await db.insert(locations).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "A location with that code already exists" });
      return;
    }
    next(err);
  }
});

router.put("/:id", requirePermission("locations", "write"), async (req, res, next) => {
  try {
    const parsed = locationSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const id = Number(req.params.id);
    const [updated] = await db
      .update(locations)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Location not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Deletable only if no transaction history exists for the location.
router.delete("/:id", requirePermission("locations", "write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [tx] = await db
      .select({ id: stockTransactions.id })
      .from(stockTransactions)
      .where(eq(stockTransactions.locationId, id))
      .limit(1);
    if (tx) {
      res.status(409).json({ error: "Cannot delete a location with existing transaction history" });
      return;
    }
    const [deleted] = await db.delete(locations).where(eq(locations.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Location not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
