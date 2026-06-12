import { Router } from "express";
import { db } from "../db";
import { customersTable, estimatesTable } from "../db";
import { eq, count, sum, desc, max } from "drizzle-orm";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  UpdateCustomerParams,
  DeleteCustomerParams,
  GetCustomerParams,
} from "../api-zod";

const router = Router();

router.get("/customers", async (req, res) => {
  const rows = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      phone: customersTable.phone,
      email: customersTable.email,
      address: customersTable.address,
      notes: customersTable.notes,
      createdAt: customersTable.createdAt,
      updatedAt: customersTable.updatedAt,
      totalEstimates: count(estimatesTable.id),
      totalSpend: sum(estimatesTable.total),
      lastVisit: max(estimatesTable.updatedAt),
    })
    .from(customersTable)
    .leftJoin(estimatesTable, eq(estimatesTable.customerId, customersTable.id))
    .groupBy(customersTable.id)
    .orderBy(desc(customersTable.updatedAt))
    .limit(500);

  res.json(
    rows.map((r) => ({
      ...r,
      totalEstimates: Number(r.totalEstimates ?? 0),
      totalSpend: Number(r.totalSpend ?? 0),
      lastVisit: r.lastVisit ?? null,
    }))
  );
});

router.post("/customers", async (req, res) => {
  const body = CreateCustomerBody.parse(req.body);
  const [customer] = await db.insert(customersTable).values({
    name: body.name,
    phone: body.phone ?? null,
    email: body.email ?? null,
    address: body.address ?? null,
    notes: body.notes ?? null,
  }).returning();
  res.status(201).json(customer);
});

router.get("/customers/:id", async (req, res) => {
  const { id } = GetCustomerParams.parse(req.params);

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

  const estimates = await db
    .select()
    .from(estimatesTable)
    .where(eq(estimatesTable.customerId, id))
    .orderBy(desc(estimatesTable.updatedAt));

  const totalSpend = estimates.reduce((s, e) => s + Number(e.total), 0);

  res.json({
    ...customer,
    estimates: estimates.map((e) => ({
      ...e,
      subtotal: Number(e.subtotal),
      laborTotal: Number(e.laborTotal),
      materialsTotal: Number(e.materialsTotal),
      total: Number(e.total),
    })),
    totalEstimates: estimates.length,
    totalSpend,
  });
});

router.put("/customers/:id", async (req, res) => {
  const { id } = UpdateCustomerParams.parse(req.params);
  const body = UpdateCustomerBody.parse(req.body);

  const [customer] = await db
    .update(customersTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(customersTable.id, id))
    .returning();

  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(customer);
});

router.delete("/customers/:id", async (req, res) => {
  const { id } = DeleteCustomerParams.parse(req.params);
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.status(204).send();
});

export default router;
