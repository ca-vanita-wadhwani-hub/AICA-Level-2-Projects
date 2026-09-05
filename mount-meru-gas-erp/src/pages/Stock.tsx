import React, { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.js";
import { formatDateDisplay } from "../lib/format.js";

interface Location {
  id: number;
  code: string;
  name: string;
}
interface Item {
  id: number;
  code: string;
  name: string;
  category: string;
}
interface StockTx {
  id: number;
  locationId: number;
  itemId: number;
  quantity: string;
  direction: string;
  transactionType: string;
  referenceId: string | null;
  createdAt: string;
}

type FormType = "purchase" | "transfer" | "refill" | "sale" | "return" | "adjustment";
const FORM_TYPES: FormType[] = ["purchase", "transfer", "refill", "sale", "return", "adjustment"];
const SIZES = ["6kg", "15kg", "38kg"];
const REASON_CODES = ["physical_count_variance", "damage", "leakage", "theft_or_loss", "data_entry_correction", "other"];

export default function Stock() {
  const { can } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [txs, setTxs] = useState<StockTx[]>([]);
  const [formType, setFormType] = useState<FormType>("purchase");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState({ location: "", item: "" });

  const canWrite = can("stock", "write");
  const canAdjust = can("stock_adjustment", "write");

  async function loadMasters() {
    setLocations(await api<Location[]>("/locations"));
    setItems(await api<Item[]>("/items"));
  }

  async function loadLedger() {
    const qs = new URLSearchParams();
    if (ledgerFilter.location) qs.set("location", ledgerFilter.location);
    if (ledgerFilter.item) qs.set("item", ledgerFilter.item);
    const result = await api<{ transactions: StockTx[] }>(`/stock/ledger?${qs.toString()}`);
    setTxs(result.transactions);
  }

  useEffect(() => {
    loadMasters().catch(() => {});
    loadLedger().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLedger().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgerFilter]);

  // form state (shared shape, unused fields ignored per form type)
  const [locationId, setLocationId] = useState<string>("");
  const [itemId, setItemId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [size, setSize] = useState(SIZES[0]);
  const [mode, setMode] = useState<"dispatch" | "receipt">("dispatch");
  const [referenceId, setReferenceId] = useState("");
  const [reasonCode, setReasonCode] = useState(REASON_CODES[0]);
  const [notes, setNotes] = useState("");
  const [approvedByInput, setApprovedByInput] = useState("");
  const [outstanding, setOutstanding] = useState(true);
  const [partyId, setPartyId] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      let body: Record<string, unknown> = {};
      let path = "";
      switch (formType) {
        case "purchase":
          path = "/stock/purchase";
          body = { locationId: Number(locationId), itemId: Number(itemId), quantity: Number(quantity), referenceId: referenceId || undefined };
          break;
        case "transfer":
          path = "/stock/transfer";
          body = { mode, locationId: Number(locationId), itemId: Number(itemId), quantity: Number(quantity), referenceId };
          break;
        case "refill":
          path = "/stock/refill";
          body = { locationId: Number(locationId), size, cylindersProduced: Number(quantity), bulkLpgItemId: Number(itemId) };
          break;
        case "sale":
          path = "/stock/sale";
          body = {
            locationId: Number(locationId),
            itemId: Number(itemId),
            partyId: Number(partyId),
            quantity: Number(quantity),
            outstanding,
            referenceId: referenceId || undefined,
          };
          break;
        case "return":
          path = "/stock/return";
          body = { locationId: Number(locationId), itemId: Number(itemId), quantity: Number(quantity), referenceId: referenceId || undefined };
          break;
        case "adjustment":
          path = "/stock/adjustment";
          body = {
            locationId: Number(locationId),
            itemId: Number(itemId),
            quantity: Number(quantity),
            reasonCode,
            notes,
            approvedBy: Number(approvedByInput),
          };
          break;
      }
      await api(path, { method: "POST", body });
      setMessage({ kind: "ok", text: `${formType} recorded successfully.` });
      setQuantity("");
      await loadLedger();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Failed to submit transaction" });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Stock</h1>

      {canWrite && (
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {FORM_TYPES.map((t) => {
              if (t === "adjustment" && !canAdjust) return null;
              return (
                <button
                  key={t}
                  onClick={() => setFormType(t)}
                  className={`px-3 py-1 rounded text-sm capitalize ${formType === t ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {message && (
            <div className={`text-sm rounded p-2 ${message.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={onSubmit} className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600">Location</label>
              <select className="border rounded px-2 py-1 w-full" value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
                <option value="">Select…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                ))}
              </select>
            </div>

            {formType === "refill" ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Cylinder size</label>
                  <select className="border rounded px-2 py-1 w-full" value={size} onChange={(e) => setSize(e.target.value)}>
                    {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Bulk LPG item</label>
                  <select className="border rounded px-2 py-1 w-full" value={itemId} onChange={(e) => setItemId(e.target.value)} required>
                    <option value="">Select…</option>
                    {items.filter((i) => i.category === "bulk_lpg").map((i) => (
                      <option key={i.id} value={i.id}>{i.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Cylinders produced</label>
                  <input type="number" className="border rounded px-2 py-1 w-full" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                </div>
                <p className="col-span-full text-xs text-slate-500">
                  LPG and empty-cylinder consumption is calculated server-side from the fixed 1:1 bill-of-materials —
                  it cannot be overridden from this form.
                </p>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Item</label>
                  <select className="border rounded px-2 py-1 w-full" value={itemId} onChange={(e) => setItemId(e.target.value)} required>
                    <option value="">Select…</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>{i.code} — {i.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Quantity</label>
                  <input type="number" step="0.001" className="border rounded px-2 py-1 w-full" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                </div>
              </>
            )}

            {formType === "transfer" && (
              <div>
                <label className="block text-xs font-medium text-slate-600">Mode</label>
                <select className="border rounded px-2 py-1 w-full" value={mode} onChange={(e) => setMode(e.target.value as "dispatch" | "receipt")}>
                  <option value="dispatch">Dispatch</option>
                  <option value="receipt">Receipt</option>
                </select>
              </div>
            )}

            {(formType === "transfer" || formType === "purchase" || formType === "sale" || formType === "return") && (
              <div>
                <label className="block text-xs font-medium text-slate-600">Reference ID {formType === "transfer" ? "(shared across dispatch+receipt)" : ""}</label>
                <input className="border rounded px-2 py-1 w-full" value={referenceId} onChange={(e) => setReferenceId(e.target.value)} required={formType === "transfer"} />
              </div>
            )}

            {formType === "sale" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Party ID</label>
                  <input type="number" className="border rounded px-2 py-1 w-full" value={partyId} onChange={(e) => setPartyId(e.target.value)} required />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="outstanding" checked={outstanding} onChange={(e) => setOutstanding(e.target.checked)} />
                  <label htmlFor="outstanding" className="text-xs font-medium text-slate-600">Flag as outstanding (refilled cylinder, no linked return yet)</label>
                </div>
              </>
            )}

            {formType === "adjustment" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Reason code</label>
                  <select className="border rounded px-2 py-1 w-full" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                    {REASON_CODES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Approver user ID (must differ from you)</label>
                  <input type="number" className="border rounded px-2 py-1 w-full" value={approvedByInput} onChange={(e) => setApprovedByInput(e.target.value)} required />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600">Notes (mandatory)</label>
                  <input className="border rounded px-2 py-1 w-full" value={notes} onChange={(e) => setNotes(e.target.value)} required />
                </div>
              </>
            )}

            <button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-1.5">Submit</button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex gap-3 items-end">
          <h2 className="font-semibold text-slate-700">Stock Ledger</h2>
          <select className="border rounded px-2 py-1 text-sm" value={ledgerFilter.location} onChange={(e) => setLedgerFilter({ ...ledgerFilter, location: e.target.value })}>
            <option value="">All locations</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
          </select>
          <select className="border rounded px-2 py-1 text-sm" value={ledgerFilter.item} onChange={(e) => setLedgerFilter({ ...ledgerFilter, item: e.target.value })}>
            <option value="">All items</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.code}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Direction</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2 text-slate-500">{formatDateDisplay(t.createdAt)}</td>
                  <td className="px-3 py-2">{locations.find((l) => l.id === t.locationId)?.code ?? t.locationId}</td>
                  <td className="px-3 py-2">{items.find((i) => i.id === t.itemId)?.code ?? t.itemId}</td>
                  <td className="px-3 py-2">{t.transactionType}</td>
                  <td className={`px-3 py-2 ${t.direction === "in" ? "text-emerald-700" : "text-red-600"}`}>{t.direction}</td>
                  <td className="px-3 py-2">{t.quantity}</td>
                  <td className="px-3 py-2 text-slate-500">{t.referenceId}</td>
                </tr>
              ))}
              {txs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-400">No transactions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
