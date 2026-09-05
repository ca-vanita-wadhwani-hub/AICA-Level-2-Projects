import React, { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.js";

interface Location {
  id: number;
  code: string;
  name: string;
  type: string;
  address: string | null;
  isActive: boolean;
}

const TYPES = ["plant", "warehouse", "depot", "dealer_point", "vehicle"];

export default function Locations() {
  const { can } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", type: TYPES[0], address: "" });
  const canWrite = can("locations", "write");

  async function load() {
    try {
      setLocations(await api<Location[]>("/locations"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load locations");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/locations", { method: "POST", body: form });
      setForm({ code: "", name: "", type: TYPES[0], address: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create location");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Location Master</h1>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

      {canWrite && (
        <form onSubmit={onCreate} className="bg-white rounded-lg shadow p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600">Code</label>
            <input
              className="border rounded px-2 py-1 w-full"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Name</label>
            <input
              className="border rounded px-2 py-1 w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Type</label>
            <select
              className="border rounded px-2 py-1 w-full"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Address</label>
            <input
              className="border rounded px-2 py-1 w-full"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-1.5">Add</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Address</th>
              <th className="px-3 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((loc) => (
              <tr key={loc.id} className="border-t">
                <td className="px-3 py-2 font-mono">{loc.code}</td>
                <td className="px-3 py-2">{loc.name}</td>
                <td className="px-3 py-2">{loc.type}</td>
                <td className="px-3 py-2 text-slate-500">{loc.address || "—"}</td>
                <td className="px-3 py-2">{loc.isActive ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
