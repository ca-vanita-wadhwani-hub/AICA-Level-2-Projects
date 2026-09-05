import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "./types.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import locationRoutes from "./routes/locations.js";
import itemRoutes from "./routes/items.js";
import partyRoutes from "./routes/parties.js";
import stockRoutes from "./routes/stock.js";
import voucherRoutes from "./routes/vouchers.js";
import uploadRoutes from "./routes/uploads.js";
import permissionRoutes from "./routes/permissions.js";
import reportRoutes from "./routes/reports.js";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "mount-meru-gas-erp", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/reports", reportRoutes);

// 404 for unmatched API routes
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Central error handler — never leaks stack traces to the client.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Mount Meru Gas ERP API listening on port ${PORT}`);
});
