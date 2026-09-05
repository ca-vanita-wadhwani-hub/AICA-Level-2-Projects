import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = Router();

// Admin-only. An earlier build left this unauthenticated (a KYC/PII leak);
// here both requireAuth and requireRoles("admin") are mandatory.
router.use(requireAuth, requireRoles("admin"));

router.get("/", async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const createUserSchema = z.object({
  username: z.string().min(3).max(64),
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum([
    "admin",
    "finance_manager",
    "accounts",
    "procurement_manager",
    "operations_manager",
    "warehouse_manager",
    "plant_engineer",
  ]),
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { username, email, password, fullName, role } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);
    const [created] = await db
      .insert(users)
      .values({ username, email, passwordHash, fullName, role })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
      });
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "A user with that username or email already exists" });
      return;
    }
    next(err);
  }
});

export default router;
