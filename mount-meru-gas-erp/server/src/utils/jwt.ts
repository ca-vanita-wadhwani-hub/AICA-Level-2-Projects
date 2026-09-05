import jwt from "jsonwebtoken";
import type { AuthUser } from "../types.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn(
    "[auth] JWT_SECRET is not set. Refusing to start with an insecure default — " +
      "set JWT_SECRET in your .env file (see .env.example).",
  );
}

const SECRET = JWT_SECRET || "";
const EXPIRES_IN = "12h";

export function signToken(user: AuthUser): string {
  if (!SECRET) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.fullName },
    SECRET,
    { expiresIn: EXPIRES_IN },
  );
}

export function verifyToken(token: string): AuthUser {
  if (!SECRET) throw new Error("JWT_SECRET is not configured");
  const decoded = jwt.verify(token, SECRET) as AuthUser;
  return decoded;
}
