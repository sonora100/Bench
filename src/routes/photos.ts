import { Router } from "express";
import multer from "multer";
import { db } from "../db";
import { estimatePhotosTable } from "../db";
import { eq, and } from "drizzle-orm";
import {
  ListEstimatePhotosParams,
  AddEstimatePhotoParams,
  DeleteEstimatePhotoParams,
} from "../api-zod";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/estimates/:id/photos", async (req, res) => {
  const { id } = ListEstimatePhotosParams.parse(req.params);
  const photos = await db
    .select({
      id: estimatePhotosTable.id,
      estimateId: estimatePhotosTable.estimateId,
      objectPath: estimatePhotosTable.objectPath,
      photoType: estimatePhotosTable.photoType,
      caption: estimatePhotosTable.caption,
      createdAt: estimatePhotosTable.createdAt,
    })
    .from(estimatePhotosTable)
    .where(eq(estimatePhotosTable.estimateId, id))
    .orderBy(estimatePhotosTable.createdAt);
  res.json(photos);
});

router.post("/estimates/:id/photos/upload", upload.single("photo"), async (req, res) => {
  const { id } = AddEstimatePhotoParams.parse(req.params);
  const photoType = (req.body?.photoType ?? "intake") as "intake" | "completion";
  const caption = req.body?.caption ?? null;

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const mimeType = req.file.mimetype || "image/jpeg";
  const objectPath = `/db/${id}`;

  const [photo] = await db
    .insert(estimatePhotosTable)
    .values({
      estimateId: id,
      objectPath,
      photoType,
      caption: caption ?? null,
      photoData: req.file.buffer,
      mimeType,
    })
    .returning({
      id: estimatePhotosTable.id,
      estimateId: estimatePhotosTable.estimateId,
      objectPath: estimatePhotosTable.objectPath,
      photoType: estimatePhotosTable.photoType,
      caption: estimatePhotosTable.caption,
      createdAt: estimatePhotosTable.createdAt,
    });

  res.status(201).json(photo);
});

router.get("/estimates/:id/photos/:photoId/image", async (req, res) => {
  const estimateId = parseInt(req.params.id, 10);
  const photoId = parseInt(req.params.photoId, 10);

  if (isNaN(estimateId) || isNaN(photoId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [photo] = await db
    .select({
      photoData: estimatePhotosTable.photoData,
      mimeType: estimatePhotosTable.mimeType,
    })
    .from(estimatePhotosTable)
    .where(and(eq(estimatePhotosTable.id, photoId), eq(estimatePhotosTable.estimateId, estimateId)));

  if (!photo || !photo.photoData) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  res.setHeader("Content-Type", photo.mimeType ?? "image/jpeg");
  res.setHeader("Cache-Control", "private, max-age=31536000");
  res.send(photo.photoData);
});

router.delete("/estimates/:id/photos/:photoId", async (req, res) => {
  const { id, photoId } = DeleteEstimatePhotoParams.parse(req.params);
  await db
    .delete(estimatePhotosTable)
    .where(and(eq(estimatePhotosTable.id, photoId), eq(estimatePhotosTable.estimateId, id)));
  res.status(204).send();
});

export default router;
