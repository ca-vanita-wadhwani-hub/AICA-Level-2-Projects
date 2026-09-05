export type Role =
  | "admin"
  | "finance_manager"
  | "accounts"
  | "procurement_manager"
  | "operations_manager"
  | "warehouse_manager"
  | "plant_engineer";

export interface AuthUser {
  id: number;
  username: string;
  role: Role;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
