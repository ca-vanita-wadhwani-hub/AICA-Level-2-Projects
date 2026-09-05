import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "../db/client.js";
import { uploads, parties } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const PRIVILEGED_ROLES = ["admin", "finance_manager", "accounts"];

// GET /api/uploads/:id — KYC documents are sensitive: this must never be
// "anyone with the ID". Access is scoped to admin/finance_manager/accounts,
// or the user who originally created the associated party record.
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [upload] = await db.select().from(uploads).where(eq(uploads.id, id));
    if (!upload) {
      res.status(404).json({ error: "Upload not found" });
      return;
    }

    const isPrivileged = PRIVILEGED_ROLES.includes(req.user!.role);
    let isOwningCreator = false;
    if (!isPrivileged && upload.partyId) {
      const [party] = await db.select().from(parties).where(eq(parties.id, upload.partyId));
      isOwningCreator = !!party && party.createdBy === req.user!.id;
    }

    if (!isPrivileged && !isOwningCreator) {
      res.status(403).json({ error: "You do not have access to this document" });
      return;
    }

    // Metadata only in this pass — actual file bytes would be streamed from
    // disk/object storage keyed by upload.storageKey in a full deployment.
    res.json({
      id: upload.id,
      originalFilename: upload.originalFilename,
      mimeType: upload.mimeType,
      storageKey: upload.storageKey,
      partyId: upload.partyId,
      uploadedBy: upload.uploadedBy,
      createdAt: upload.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// Records metadata for an already-uploaded file (actual byte storage is out
// of scope for this pass) and links it to a party's mandatory document row.
router.post("/", async (req, res, next) => {
  try {
    const { partyId, originalFilename, mimeType } = req.body ?? {};
    if (!originalFilename || !mimeType) {
      res.status(400).json({ error: "originalFilename and mimeType are required" });
      return;
    }
    const storageKey = `uploads/${randomUUID()}`;
    const [created] = await db
      .insert(uploads)
      .values({
        partyId: partyId ? Number(partyId) : null,
        originalFilename: String(originalFilename),
        mimeType: String(mimeType),
        storageKey,
        uploadedBy: req.user!.id,
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

export default router;
