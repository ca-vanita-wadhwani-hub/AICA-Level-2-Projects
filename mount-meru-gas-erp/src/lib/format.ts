// Dates are stored/transmitted as ISO (YYYY-MM-DD) everywhere. This module is
// the ONLY place display formatting happens — it never mutates the stored
// value, only renders it.

export function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatTzs(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return String(amount);
  return new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 2 }).format(n) + " TZS";
}
