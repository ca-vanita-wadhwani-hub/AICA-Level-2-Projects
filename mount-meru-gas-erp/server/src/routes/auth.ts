import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { signToken } from "../utils/jwt.js";
import { requireAuth, COOKIE_NAME } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    const { username, password } = parsed.data;

    const [row] = await db.select().from(users).where(eq(users.username, username));
    if (!row || !row.isActive) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    const ok = await bcrypt.compare(password, row.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const authUser = { id: row.id, username: row.username, role: row.role, fullName: row.fullName };
    const token = signToken(authUser);

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 12 * 60 * 60 * 1000,
    });
    res.json({ token, user: authUser });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
