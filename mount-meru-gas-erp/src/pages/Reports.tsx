import React, { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.js";
import { formatTzs } from "../lib/format.js";

interface TrialBalanceRow {
  ledgerId: number;
  code: string;
  name: string;
  group: string;
  currency: string;
  openingBalance: string;
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
}

export default function Reports() {
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<TrialBalanceRow[]>("/reports/trial-balance")
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load report"));
  }, []);

  const totalClosing = rows.reduce((sum, r) => sum + r.closingBalance, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Trial Balance</h1>
      <p className="text-sm text-slate-500">
        Restricted server-side to admin, finance_manager, and accounts roles. Figures are derived from opening
        balances plus approved voucher movements — never a hand-maintained total.
      </p>
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Ledger</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Currency</th>
              <th className="px-3 py-2 text-right">Opening</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
              <th className="px-3 py-2 text-right">Closing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ledgerId} className="border-t">
                <td className="px-3 py-2 font-mono">{r.code}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 capitalize">{r.group}</td>
                <td className="px-3 py-2">{r.currency}</td>
                <td className="px-3 py-2 text-right">{formatTzs(r.openingBalance)}</td>
                <td className="px-3 py-2 text-right">{formatTzs(r.periodDebit)}</td>
                <td className="px-3 py-2 text-right">{formatTzs(r.periodCredit)}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatTzs(r.closingBalance)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t bg-slate-50 font-semibold">
                <td className="px-3 py-2" colSpan={7}>Total (all currencies summed as TZS-equivalent numerically — no FX conversion applied in this pass)</td>
                <td className="px-3 py-2 text-right">{formatTzs(totalClosing)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
