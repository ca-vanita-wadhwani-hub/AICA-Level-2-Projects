import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.js";

interface Location {
  id: number;
  code: string;
  name: string;
}
interface Party {
  id: number;
  approvalStatus: string;
}

export default function Dashboard() {
  const { user, can, permissions } = useAuth();
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [pendingParties, setPendingParties] = useState<Party[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (can("locations", "read")) setLocations(await api<Location[]>("/locations"));
        if (can("parties", "read")) setPendingParties(await api<Party[]>("/parties?status=pending"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      }
    })();
  }, [can]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Welcome, {user?.fullName}</h1>
        <p className="text-slate-500 text-sm">Role: {user?.role.replace(/_/g, " ")}</p>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-slate-500 text-sm">Locations</div>
          <div className="text-3xl font-bold text-emerald-700">
            {locations ? locations.length : can("locations", "read") ? "..." : "—"}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-slate-500 text-sm">Parties awaiting approval</div>
          <div className="text-3xl font-bold text-amber-600">
            {pendingParties ? pendingParties.length : can("parties", "read") ? "..." : "—"}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-slate-500 text-sm">Modules with write access</div>
          <div className="text-3xl font-bold text-slate-700">
            {Object.values(permissions).filter((level) => level === "write").length}
          </div>
        </div>
      </div>
    </div>
  );
}
