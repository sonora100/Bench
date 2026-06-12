import { Router } from "express";
import { db } from "../db";
import { servicesTable, categoriesTable } from "../db";
import { eq, and } from "drizzle-orm";
import {
  CreateServiceBody,
  UpdateServiceBody,
  UpdateServiceParams,
  DeleteServiceParams,
  GetServiceParams,
  ListServicesQueryParams,
  AdjustAllPricesBody,
} from "../api-zod";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/services", async (req, res) => {
  const { categoryId } = ListServicesQueryParams.parse(req.query);

  const query = db
    .select({
      id: servicesTable.id,
      categoryId: servicesTable.categoryId,
      categoryName: categoriesTable.name,
      name: servicesTable.name,
      description: servicesTable.description,
      basePrice: servicesTable.basePrice,
      metalType: servicesTable.metalType,
      isEstimateOnly: servicesTable.isEstimateOnly,
      notes: servicesTable.notes,
      createdAt: servicesTable.createdAt,
      updatedAt: servicesTable.updatedAt,
    })
    .from(servicesTable)
    .innerJoin(categoriesTable, eq(servicesTable.categoryId, categoriesTable.id))
    .orderBy(categoriesTable.sortOrder, servicesTable.name);

  const services = categoryId
    ? await query.where(eq(servicesTable.categoryId, categoryId))
    : await query;

  res.json(services.map((s) => ({ ...s, basePrice: Number(s.basePrice) })));
});

router.post("/services/adjust-prices", async (req, res) => {
  const { adjustmentType, adjustmentValue, categoryId } = AdjustAllPricesBody.parse(req.body);

  let whereClause = categoryId ? eq(servicesTable.categoryId, categoryId) : undefined;

  let updatedCount = 0;

  if (adjustmentType === "percentage") {
    const factor = 1 + adjustmentValue / 100;
    const result = await db
      .update(servicesTable)
      .set({
        basePrice: sql`ROUND(${servicesTable.basePrice} * ${factor}, 2)`,
        updatedAt: new Date(),
      })
      .where(whereClause ?? sql`1=1`)
      .returning({ id: servicesTable.id });
    updatedCount = result.length;
  } else {
    const result = await db
      .update(servicesTable)
      .set({
        basePrice: sql`GREATEST(0, ROUND(${servicesTable.basePrice} + ${adjustmentValue}, 2))`,
        updatedAt: new Date(),
      })
      .where(whereClause ?? sql`1=1`)
      .returning({ id: servicesTable.id });
    updatedCount = result.length;
  }

  res.json({ updatedCount, adjustmentType, adjustmentValue });
});

router.get("/services/:id", async (req, res) => {
  const { id } = GetServiceParams.parse(req.params);
  const [service] = await db
    .select({
      id: servicesTable.id,
      categoryId: servicesTable.categoryId,
      categoryName: categoriesTable.name,
      name: servicesTable.name,
      description: servicesTable.description,
      basePrice: servicesTable.basePrice,
      metalType: servicesTable.metalType,
      isEstimateOnly: servicesTable.isEstimateOnly,
      notes: servicesTable.notes,
      createdAt: servicesTable.createdAt,
      updatedAt: servicesTable.updatedAt,
    })
    .from(servicesTable)
    .innerJoin(categoriesTable, eq(servicesTable.categoryId, categoriesTable.id))
    .where(eq(servicesTable.id, id));

  if (!service) { res.status(404).json({ error: "Service not found" }); return; }
  res.json({ ...service, basePrice: Number(service.basePrice) });
});

router.post("/services", async (req, res) => {
  const body = CreateServiceBody.parse(req.body);
  const [service] = await db
    .insert(servicesTable)
    .values({ ...body, basePrice: String(body.basePrice) })
    .returning();

  const [category] = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, service.categoryId));

  res.status(201).json({
    ...service,
    categoryName: category?.name ?? "",
    basePrice: Number(service.basePrice),
  });
});

router.put("/services/:id", async (req, res) => {
  const { id } = UpdateServiceParams.parse(req.params);
  const body = UpdateServiceBody.parse(req.body);
  const [service] = await db
    .update(servicesTable)
    .set({ ...body, basePrice: String(body.basePrice), updatedAt: new Date() })
    .where(eq(servicesTable.id, id))
    .returning();

  if (!service) { res.status(404).json({ error: "Service not found" }); return; }

  const [category] = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, service.categoryId));

  res.json({
    ...service,
    categoryName: category?.name ?? "",
    basePrice: Number(service.basePrice),
  });
});

router.delete("/services/:id", async (req, res) => {
  const { id } = DeleteServiceParams.parse(req.params);
  await db.delete(servicesTable).where(eq(servicesTable.id, id));
  res.status(204).send();
});

export default router;
