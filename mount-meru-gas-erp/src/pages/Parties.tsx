import React, { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.js";
import { formatDateDisplay, formatTzs } from "../lib/format.js";

interface Party {
  id: number;
  code: string;
  type: string;
  name: string;
  region: string | null;
  currency: string;
  paymentTerms: string;
  creditPeriodDays: number;
  approvedCreditAmount: string;
  approvalStatus: string;
  rejectionReason: string | null;
  createdAt: string;
}

const TYPES = ["customer", "supplier", "dealer", "super_dealer"];
const TERMS = ["advance", "credit"];

export default function Parties() {
  const { can } = useAuth();
  const [parties, setParties] = useState<Party[]>([]);
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [form, setForm] = useState({
    type: TYPES[0],
    name: "",
    region: "",
    currency: "TZS",
    paymentTerms: TERMS[0],
    creditPeriodDays: 0,
  });

  const canCreate = can("parties", "write");
  const canApprove = can("parties_approval", "write");

  async function load() {
    setError(null);
    try {
      const qs = filter === "pending" ? "?status=pending" : "";
      setParties(await api<Party[]>(`/parties${qs}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load parties");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/parties", { method: "POST", body: form });
      setForm({ type: TYPES[0], name: "", region: "", currency: "TZS", paymentTerms: TERMS[0], creditPeriodDays: 0 });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create party");
    }
  }

  async function onApprove(id: number) {
    try {
      await api(`/parties/${id}/approve`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to approve party");
    }
  }

  async function onReject(id: number) {
    const reason = rejectReason[id];
    if (!reason) {
      setError("A rejection reason is required");
      return;
    }
    try {
      await api(`/parties/${id}/reject`, { method: "POST", body: { reason } });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reject party");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Parties</h1>
        <div className="space-x-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded text-sm ${filter === "all" ? "bg-emerald-600 text-white" : "bg-white border"}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-3 py-1 rounded text-sm ${filter === "pending" ? "bg-emerald-600 text-white" : "bg-white border"}`}
          >
            Approval queue
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

      {canCreate && filter === "all" && (
        <form onSubmit={onCreate} className="bg-white rounded-lg shadow p-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600">Type</label>
            <select className="border rounded px-2 py-1 w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600">Name</label>
            <input className="border rounded px-2 py-1 w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Region</label>
            <input className="border rounded px-2 py-1 w-full" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Payment Terms</label>
            <select className="border rounded px-2 py-1 w-full" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}>
              {TERMS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Credit Days</label>
            <input
              type="number"
              className="border rounded px-2 py-1 w-full"
              value={form.creditPeriodDays}
              onChange={(e) => setForm({ ...form, creditPeriodDays: Number(e.target.value) })}
            />
          </div>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-1.5">Submit for approval</button>
          <p className="col-span-full text-xs text-slate-500">
            Mandatory KYC documents (TIN certificate, business licence, BRELA search, ID copy) are tracked per party
            and must be uploaded before approval.
          </p>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Terms</th>
              <th className="px-3 py-2">Credit</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              {canApprove && filter === "pending" && <th className="px-3 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {parties.map((p) => (
              <tr key={p.id} className="border-t align-top">
                <td className="px-3 py-2 font-mono">{p.code}</td>
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">{p.type}</td>
                <td className="px-3 py-2">
                  {p.paymentTerms}
                  {p.paymentTerms === "credit" ? ` (${p.creditPeriodDays}d)` : ""}
                </td>
                <td className="px-3 py-2">{formatTzs(p.approvedCreditAmount)}</td>
                <td className="px-3 py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      p.approvalStatus === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : p.approvalStatus === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {p.approvalStatus}
                  </span>
                  {p.rejectionReason && <div className="text-xs text-red-500 mt-1">{p.rejectionReason}</div>}
                </td>
                <td className="px-3 py-2 text-slate-500">{formatDateDisplay(p.createdAt)}</td>
                {canApprove && filter === "pending" && (
                  <td className="px-3 py-2 space-y-1">
                    <button
                      onClick={() => onApprove(p.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2 py-1 text-xs mr-1"
                    >
                      Approve
                    </button>
                    <div className="flex gap-1 mt-1">
                      <input
                        placeholder="Rejection reason"
                        className="border rounded px-1 py-0.5 text-xs w-32"
                        value={rejectReason[p.id] || ""}
                        onChange={(e) => setRejectReason({ ...rejectReason, [p.id]: e.target.value })}
                      />
                      <button
                        onClick={() => onReject(p.id)}
                        className="bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 text-xs"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
