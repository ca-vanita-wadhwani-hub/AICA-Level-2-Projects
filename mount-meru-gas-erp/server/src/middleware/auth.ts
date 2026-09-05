import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt.js";
import { db } from "../db/client.js";
import { rolePermissions } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import type { Role } from "../types.js";

const COOKIE_NAME = "mmg_token";

/**
 * Requires a valid JWT — from the Authorization: Bearer header or the
 * mmg_token cookie. No fallback to any default/admin identity: missing or
 * invalid credentials always return 401.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearer = header && header.startsWith("Bearer ") ? header.slice(7) : undefined;
  const cookieToken = (req as any).cookies?.[COOKIE_NAME];
  const token = bearer || cookieToken;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const user = verifyToken(token);
    if (!user || !user.id || !user.role) {
      res.status(401).json({ error: "Invalid authentication token" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired authentication token" });
  }
}

/** Restricts a route to an explicit allow-list of roles. */
export function requireRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden: insufficient role" });
      return;
    }
    next();
  };
}

/**
 * Data-driven permission check against the role_permissions table (role ->
 * module -> read/write), not a hardcoded switch statement. `write` implies
 * `read` is also satisfied.
 */
export function requirePermission(module: string, level: "read" | "write") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const [perm] = await db
        .select()
        .from(rolePermissions)
        .where(and(eq(rolePermissions.role, req.user.role), eq(rolePermissions.module, module)));

      const granted = perm?.level;
      const ok = level === "read" ? granted === "read" || granted === "write" : granted === "write";

      if (!ok) {
        res.status(403).json({ error: `Forbidden: role '${req.user.role}' lacks '${level}' access to '${module}'` });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export { COOKIE_NAME };
