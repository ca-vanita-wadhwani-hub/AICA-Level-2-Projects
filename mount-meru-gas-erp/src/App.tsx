import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.js";
import Layout from "./components/Layout.js";
import Login from "./pages/Login.js";
import Dashboard from "./pages/Dashboard.js";
import Locations from "./pages/Locations.js";
import Items from "./pages/Items.js";
import Parties from "./pages/Parties.js";
import Stock from "./pages/Stock.js";
import Vouchers from "./pages/Vouchers.js";
import Users from "./pages/Users.js";
import Reports from "./pages/Reports.js";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="master/locations" element={<Locations />} />
        <Route path="master/items" element={<Items />} />
        <Route path="master/parties" element={<Parties />} />
        <Route path="stock" element={<Stock />} />
        <Route path="vouchers" element={<Vouchers />} />
        <Route path="reports" element={<Reports />} />
        <Route
          path="users"
          element={
            <RequireAdmin>
              <Users />
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
