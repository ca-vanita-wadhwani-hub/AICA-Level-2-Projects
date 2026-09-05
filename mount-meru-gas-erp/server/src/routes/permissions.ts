import { Router } from "express";
import { db } from "../db/client.js";
import { rolePermissions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Returns the permission set for the logged-in user's own role, so the
// frontend can build its nav from the SAME data-driven model the server
// enforces — no separately hand-maintained UI permission list.
router.get("/me", async (req, res, next) => {
  try {
    const rows = await db.select().from(rolePermissions).where(eq(rolePermissions.role, req.user!.role));
    const permissions: Record<string, "none" | "read" | "write"> = {};
    for (const row of rows) permissions[row.module] = row.level;
    res.json({ role: req.user!.role, permissions });
  } catch (err) {
    next(err);
  }
});

export default router;
