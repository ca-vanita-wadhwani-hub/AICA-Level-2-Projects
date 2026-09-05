import React, { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.js";

interface Item {
  id: number;
  code: string;
  name: string;
  category: string;
  size: string | null;
  uom: string;
  taxTreatment: string;
}

const CATEGORIES = ["bulk_lpg", "empty_cylinder", "refilled_cylinder", "accessory", "spare"];
const SIZES = ["", "6kg", "15kg", "38kg"];
const TAX = ["exempt", "vatable_18"];

export default function Items() {
  const { can } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: CATEGORIES[0],
    size: "",
    uom: "EA",
    taxTreatment: TAX[0],
  });
  const canWrite = can("items", "write");

  async function load() {
    try {
      setItems(await api<Item[]>("/items"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load items");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/items", { method: "POST", body: { ...form, size: form.size || null } });
      setForm({ code: "", name: "", category: CATEGORIES[0], size: "", uom: "EA", taxTreatment: TAX[0] });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create item");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Item Master</h1>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

      {canWrite && (
        <form onSubmit={onCreate} className="bg-white rounded-lg shadow p-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600">Code</label>
            <input className="border rounded px-2 py-1 w-full" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Name</label>
            <input className="border rounded px-2 py-1 w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Category</label>
            <select className="border rounded px-2 py-1 w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Size</label>
            <select className="border rounded px-2 py-1 w-full" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>
              {SIZES.map((s) => (
                <option key={s} value={s}>{s || "n/a"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">UOM</label>
            <input className="border rounded px-2 py-1 w-full" value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Tax</label>
            <select className="border rounded px-2 py-1 w-full" value={form.taxTreatment} onChange={(e) => setForm({ ...form, taxTreatment: e.target.value })}>
              {TAX.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-1.5 col-span-2 sm:col-span-1">Add</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">UOM</th>
              <th className="px-3 py-2">Tax</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2 font-mono">{item.code}</td>
                <td className="px-3 py-2">{item.name}</td>
                <td className="px-3 py-2">{item.category}</td>
                <td className="px-3 py-2">{item.size || "—"}</td>
                <td className="px-3 py-2">{item.uom}</td>
                <td className="px-3 py-2">{item.taxTreatment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
