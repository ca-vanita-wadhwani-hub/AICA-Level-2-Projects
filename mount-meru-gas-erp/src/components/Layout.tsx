import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

interface NavItem {
  to: string;
  label: string;
  module: string | null; // null = always visible (e.g. dashboard)
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", module: null },
  { to: "/master/locations", label: "Locations", module: "locations" },
  { to: "/master/items", label: "Items", module: "items" },
  { to: "/master/parties", label: "Parties", module: "parties" },
  { to: "/stock", label: "Stock", module: "stock" },
  { to: "/vouchers", label: "Vouchers", module: "vouchers" },
  { to: "/reports", label: "Financial Reports", module: "financial_reports" },
  { to: "/users", label: "Users", module: null }, // gated separately (admin only)
];

export default function Layout() {
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.to === "/users") return user?.role === "admin";
    if (item.module === null) return true;
    return can(item.module, "read");
  });

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-4 py-5 border-b border-slate-700">
          <div className="font-bold text-emerald-400">Mount Meru Gas</div>
          <div className="text-xs text-slate-400">{user?.fullName}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">{user?.role.replace(/_/g, " ")}</div>
        </div>
        <nav className="flex-1 py-2">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm ${isActive ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={onLogout} className="m-4 text-sm text-slate-300 hover:text-white text-left">
          Log out
        </button>
      </aside>
      <main className="flex-1 bg-slate-50 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
