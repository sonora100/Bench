import { Router } from "express";
import { db } from "../db";
import { estimatesTable, estimateItemsTable } from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  CreateEstimateBody,
  UpdateEstimateBody,
  UpdateEstimateParams,
  DeleteEstimateParams,
  GetEstimateParams,
  ListEstimatesQueryParams,
  AddEstimateItemParams,
  AddEstimateItemBody,
  UpdateEstimateItemParams,
  UpdateEstimateItemBody,
  DeleteEstimateItemParams,
} from "../api-zod";

const router = Router();

function formatEstimate(e: Record<string, unknown>) {
  return {
    ...e,
    subtotal: Number(e.subtotal),
    laborTotal: Number(e.laborTotal),
    materialsTotal: Number(e.materialsTotal),
    total: Number(e.total),
  };
}

function formatItem(item: Record<string, unknown>) {
  return {
    ...item,
    unitPrice: Number(item.unitPrice),
    laborPrice: Number(item.laborPrice),
    metalCost: Number(item.metalCost),
    totalPrice: Number(item.totalPrice),
  };
}

async function generateTagNumber(id: number): Promise<string> {
  return `RPR-${String(id).padStart(4, "0")}`;
}

router.get("/estimates", async (req, res) => {
  const { status, jobType } = ListEstimatesQueryParams.parse(req.query);

  const conditions = [];
  if (status)  conditions.push(eq(estimatesTable.status, status));
  if (jobType) conditions.push(eq(estimatesTable.jobType, jobType));

  const query = db
    .select()
    .from(estimatesTable)
    .orderBy(desc(estimatesTable.updatedAt))
    .limit(500);

  const estimates = conditions.length > 0
    ? await query.where(and(...conditions))
    : await query;

  res.json(estimates.map(formatEstimate));
});

router.post("/estimates", async (req, res) => {
  const body = CreateEstimateBody.parse(req.body);

  const isJob = body.jobType === "job";
  const insertValues = {
    ...body,
    jobType: body.jobType ?? "estimate",
    ...(isJob ? { status: "approved", repairStatus: "received" } : {}),
  };

  const [estimate] = await db.insert(estimatesTable).values(insertValues).returning();

  const tagNumber = await generateTagNumber(estimate.id);
  const [updated] = await db
    .update(estimatesTable)
    .set({ tagNumber })
    .where(eq(estimatesTable.id, estimate.id))
    .returning();

  res.status(201).json(formatEstimate(updated as Record<string, unknown>));
});

router.get("/estimates/:id", async (req, res) => {
  const { id } = GetEstimateParams.parse(req.params);

  const [estimate] = await db
    .select()
    .from(estimatesTable)
    .where(eq(estimatesTable.id, id));

  if (!estimate) { res.status(404).json({ error: "Estimate not found" }); return; }

  const items = await db
    .select()
    .from(estimateItemsTable)
    .where(eq(estimateItemsTable.estimateId, id))
    .orderBy(estimateItemsTable.id);

  res.json({
    ...formatEstimate(estimate as Record<string, unknown>),
    items: items.map(formatItem),
  });
});

router.put("/estimates/:id", async (req, res) => {
  const { id } = UpdateEstimateParams.parse(req.params);
  const body = UpdateEstimateBody.parse(req.body);

  const [estimate] = await db
    .update(estimatesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(estimatesTable.id, id))
    .returning();

  if (!estimate) { res.status(404).json({ error: "Estimate not found" }); return; }
  res.json(formatEstimate(estimate as Record<string, unknown>));
});

router.delete("/estimates/:id", async (req, res) => {
  const { id } = DeleteEstimateParams.parse(req.params);
  await db.delete(estimatesTable).where(eq(estimatesTable.id, id));
  res.status(204).send();
});

router.post("/estimates/:id/items", async (req, res) => {
  const { id } = AddEstimateItemParams.parse(req.params);
  const body = AddEstimateItemBody.parse(req.body);

  const totalPrice =
    Math.round(((Number(body.unitPrice) + Number(body.laborPrice) + Number(body.metalCost)) * body.quantity) * 100) / 100;

  const item = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(estimateItemsTable)
      .values({
        estimateId: id,
        serviceId: body.serviceId,
        serviceName: body.serviceName,
        description: body.description,
        quantity: body.quantity,
        unitPrice: String(body.unitPrice),
        laborPrice: String(body.laborPrice),
        metalCost: String(body.metalCost),
        totalPrice: totalPrice.toFixed(2),
        notes: body.notes,
      })
      .returning();

    const items = await tx
      .select()
      .from(estimateItemsTable)
      .where(eq(estimateItemsTable.estimateId, id));

    let laborTotal = 0;
    let materialsTotal = 0;
    for (const i of items) {
      laborTotal += (Number(i.unitPrice) + Number(i.laborPrice)) * i.quantity;
      materialsTotal += Number(i.metalCost) * i.quantity;
    }
    const subtotal = laborTotal + materialsTotal;

    await tx
      .update(estimatesTable)
      .set({
        laborTotal: laborTotal.toFixed(2),
        materialsTotal: materialsTotal.toFixed(2),
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(estimatesTable.id, id));

    return inserted;
  });

  res.status(201).json(formatItem(item as Record<string, unknown>));
});

router.put("/estimates/:id/items/:itemId", async (req, res) => {
  const { id, itemId } = UpdateEstimateItemParams.parse(req.params);
  const body = UpdateEstimateItemBody.parse(req.body);

  const totalPrice =
    Math.round(((Number(body.unitPrice) + Number(body.laborPrice) + Number(body.metalCost)) * body.quantity) * 100) / 100;

  const item = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(estimateItemsTable)
      .set({
        serviceId: body.serviceId,
        serviceName: body.serviceName,
        description: body.description,
        quantity: body.quantity,
        unitPrice: String(body.unitPrice),
        laborPrice: String(body.laborPrice),
        metalCost: String(body.metalCost),
        totalPrice: totalPrice.toFixed(2),
        notes: body.notes,
      })
      .where(and(eq(estimateItemsTable.id, itemId), eq(estimateItemsTable.estimateId, id)))
      .returning();

    if (!updated) return null;

    const items = await tx
      .select()
      .from(estimateItemsTable)
      .where(eq(estimateItemsTable.estimateId, id));

    let laborTotal = 0;
    let materialsTotal = 0;
    for (const i of items) {
      laborTotal += (Number(i.unitPrice) + Number(i.laborPrice)) * i.quantity;
      materialsTotal += Number(i.metalCost) * i.quantity;
    }
    const subtotal = laborTotal + materialsTotal;

    await tx
      .update(estimatesTable)
      .set({
        laborTotal: laborTotal.toFixed(2),
        materialsTotal: materialsTotal.toFixed(2),
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(estimatesTable.id, id));

    return updated;
  });

  if (!item) { res.status(404).json({ error: "Item not found" }); return; }
  res.json(formatItem(item as Record<string, unknown>));
});

router.delete("/estimates/:id/items/:itemId", async (req, res) => {
  const { id, itemId } = DeleteEstimateItemParams.parse(req.params);

  await db.transaction(async (tx) => {
    await tx
      .delete(estimateItemsTable)
      .where(and(eq(estimateItemsTable.id, itemId), eq(estimateItemsTable.estimateId, id)));

    const items = await tx
      .select()
      .from(estimateItemsTable)
      .where(eq(estimateItemsTable.estimateId, id));

    let laborTotal = 0;
    let materialsTotal = 0;
    for (const i of items) {
      laborTotal += (Number(i.unitPrice) + Number(i.laborPrice)) * i.quantity;
      materialsTotal += Number(i.metalCost) * i.quantity;
    }
    const subtotal = laborTotal + materialsTotal;

    await tx
      .update(estimatesTable)
      .set({
        laborTotal: laborTotal.toFixed(2),
        materialsTotal: materialsTotal.toFixed(2),
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(estimatesTable.id, id));
  });

  res.status(204).send();
});

export default router;
