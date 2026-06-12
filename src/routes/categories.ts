import { Router } from "express";
import { db } from "../db";
import { categoriesTable } from "../db";
import { eq } from "drizzle-orm";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
  UpdateCategoryParams,
  DeleteCategoryParams,
} from "../api-zod";

const router = Router();

router.get("/categories", async (req, res) => {
  const categories = await db
    .select()
    .from(categoriesTable)
    .orderBy(categoriesTable.sortOrder);
  res.json(categories);
});

router.post("/categories", async (req, res) => {
  const body = CreateCategoryBody.parse(req.body);
  const [category] = await db.insert(categoriesTable).values(body).returning();
  res.status(201).json(category);
});

router.put("/categories/:id", async (req, res) => {
  const { id } = UpdateCategoryParams.parse(req.params);
  const body = UpdateCategoryBody.parse(req.body);
  const [category] = await db
    .update(categoriesTable)
    .set(body)
    .where(eq(categoriesTable.id, id))
    .returning();
  if (!category) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(category);
});

router.delete("/categories/:id", async (req, res) => {
  const { id } = DeleteCategoryParams.parse(req.params);
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.status(204).send();
});

export default router;
