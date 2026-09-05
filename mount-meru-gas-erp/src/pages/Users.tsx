import React, { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.js";

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

const ROLES = [
  "admin",
  "finance_manager",
  "accounts",
  "procurement_manager",
  "operations_manager",
  "warehouse_manager",
  "plant_engineer",
];

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ username: "", email: "", password: "", fullName: "", role: ROLES[0] });

  async function load() {
    try {
      setUsers(await api<User[]>("/users"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load users");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/users", { method: "POST", body: form });
      setForm({ username: "", email: "", password: "", fullName: "", role: ROLES[0] });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Users</h1>
      <p className="text-sm text-slate-500">Admin only — this endpoint requires authentication and the admin role server-side.</p>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

      <form onSubmit={onCreate} className="bg-white rounded-lg shadow p-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
        <input placeholder="Username" className="border rounded px-2 py-1" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <input placeholder="Email" type="email" className="border rounded px-2 py-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input placeholder="Password (min 8 chars)" type="password" className="border rounded px-2 py-1" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <input placeholder="Full name" className="border rounded px-2 py-1" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        <select className="border rounded px-2 py-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-1.5">Create user</button>
      </form>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Full name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2 font-mono">{u.username}</td>
                <td className="px-3 py-2">{u.fullName}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.role.replace(/_/g, " ")}</td>
                <td className="px-3 py-2">{u.isActive ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
