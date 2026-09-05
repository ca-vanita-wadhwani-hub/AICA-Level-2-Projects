import React, { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.js";
import { formatDateDisplay, formatTzs, todayIso } from "../lib/format.js";

interface Ledger {
  id: number;
  code: string;
  name: string;
  group: string;
  currency: string;
}
interface Voucher {
  id: number;
  type: string;
  voucherNo: string;
  date: string;
  narration: string | null;
  approvalStatus: string;
}

const TYPES = ["payment", "receipt", "journal", "contra", "petty_cash"];

interface LineForm {
  ledgerId: string;
  debit: string;
  credit: string;
}

export default function Vouchers() {
  const { can } = useAuth();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [type, setType] = useState(TYPES[0]);
  const [date, setDate] = useState(todayIso());
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<LineForm[]>([
    { ledgerId: "", debit: "", credit: "" },
    { ledgerId: "", debit: "", credit: "" },
  ]);
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const canWrite = can("vouchers", "write");

  async function loadVouchers() {
    setVouchers(await api<Voucher[]>("/vouchers"));
  }

  useEffect(() => {
    api<Ledger[]>("/vouchers/ledgers").then(setLedgers).catch(() => {});
    loadVouchers().catch(() => {});
  }, []);

  function updateLine(idx: number, patch: Partial<LineForm>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ledgerId: "", debit: "", credit: "" }]);
  }

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        type,
        date,
        narration,
        lines: lines
          .filter((l) => l.ledgerId)
          .map((l) => ({ ledgerId: Number(l.ledgerId), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
      };
      if (type === "petty_cash") {
        body.pettyCash = { expenseAccountId: Number(expenseAccountId) };
      }
      await api("/vouchers", { method: "POST", body });
      setMessage({ kind: "ok", text: "Voucher recorded." });
      setLines([{ ledgerId: "", debit: "", credit: "" }, { ledgerId: "", debit: "", credit: "" }]);
      setNarration("");
      await loadVouchers();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Failed to submit voucher" });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Vouchers</h1>

      {canWrite && (
        <form onSubmit={onSubmit} className="bg-white rounded-lg shadow p-4 space-y-4">
          {message && (
            <div className={`text-sm rounded p-2 ${message.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {message.text}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600">Type</label>
              <select className="border rounded px-2 py-1 w-full" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Date</label>
              <input type="date" className="border rounded px-2 py-1 w-full" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600">Narration</label>
              <input className="border rounded px-2 py-1 w-full" value={narration} onChange={(e) => setNarration(e.target.value)} />
            </div>
            {type === "petty_cash" && (
              <div>
                <label className="block text-xs font-medium text-slate-600">Expense ledger (must be Expense-group)</label>
                <select className="border rounded px-2 py-1 w-full" value={expenseAccountId} onChange={(e) => setExpenseAccountId(e.target.value)} required>
                  <option value="">Select…</option>
                  {ledgers.filter((l) => l.group === "expense").map((l) => (
                    <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-600">Lines (debit must equal credit)</h3>
              <button type="button" onClick={addLine} className="text-xs text-emerald-700 hover:underline">
                + Add line
              </button>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2">
                <select
                  className="border rounded px-2 py-1"
                  value={line.ledgerId}
                  onChange={(e) => updateLine(idx, { ledgerId: e.target.value })}
                >
                  <option value="">Ledger…</option>
                  {ledgers.map((l) => (
                    <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                  ))}
                </select>
                <input
                  placeholder="Debit"
                  type="number"
                  className="border rounded px-2 py-1"
                  value={line.debit}
                  onChange={(e) => updateLine(idx, { debit: e.target.value })}
                />
                <input
                  placeholder="Credit"
                  type="number"
                  className="border rounded px-2 py-1"
                  value={line.credit}
                  onChange={(e) => updateLine(idx, { credit: e.target.value })}
                />
              </div>
            ))}
            <div className={`text-sm ${balanced ? "text-emerald-700" : "text-red-600"}`}>
              Debit total: {formatTzs(totalDebit)} — Credit total: {formatTzs(totalCredit)} {balanced ? "(balanced)" : "(not balanced)"}
            </div>
          </div>

          <button disabled={!balanced} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded px-3 py-1.5">
            Submit voucher
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Voucher No</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Narration</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v) => (
              <tr key={v.id} className="border-t">
                <td className="px-3 py-2 font-mono">{v.voucherNo}</td>
                <td className="px-3 py-2">{v.type}</td>
                <td className="px-3 py-2 text-slate-500">{formatDateDisplay(v.date)}</td>
                <td className="px-3 py-2">{v.narration || "—"}</td>
                <td className="px-3 py-2">{v.approvalStatus}</td>
              </tr>
            ))}
            {vouchers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">No vouchers yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
