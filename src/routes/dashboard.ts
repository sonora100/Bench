import { Router } from "express";
import { db } from "../db";
import { estimatesTable, servicesTable, categoriesTable, metalPricesTable } from "../db";
import { eq, count, sum, desc, and, lt, isNotNull, isNull, ne, or } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  const [estimateStats] = await db
    .select({
      totalEstimates: count(estimatesTable.id),
      totalEstimateValue: sum(estimatesTable.total),
    })
    .from(estimatesTable);

  const [draftStats] = await db
    .select({ draftCount: count(estimatesTable.id) })
    .from(estimatesTable)
    .where(eq(estimatesTable.status, "draft"));

  const [approvedStats] = await db
    .select({ approvedCount: count(estimatesTable.id) })
    .from(estimatesTable)
    .where(eq(estimatesTable.status, "approved"));

  const [readyStats] = await db
    .select({ readyForPickupCount: count(estimatesTable.id) })
    .from(estimatesTable)
    .where(eq(estimatesTable.repairStatus, "ready"));

  const [openJobStats] = await db
    .select({ openJobsCount: count(estimatesTable.id) })
    .from(estimatesTable)
    .where(
      and(
        eq(estimatesTable.jobType, "job"),
        or(isNull(estimatesTable.repairStatus), ne(estimatesTable.repairStatus, "picked_up"))
      )
    );

  const today = new Date().toISOString().split("T")[0];
  const [overdueStats] = await db
    .select({ overdueCount: count(estimatesTable.id) })
    .from(estimatesTable)
    .where(
      and(
        isNotNull(estimatesTable.expectedCompletionDate),
        lt(estimatesTable.expectedCompletionDate, today),
        or(isNull(estimatesTable.repairStatus), ne(estimatesTable.repairStatus, "picked_up"))
      )
    );

  const [serviceStats] = await db
    .select({ totalServices: count(servicesTable.id) })
    .from(servicesTable);

  const [categoryStats] = await db
    .select({ totalCategories: count(categoriesTable.id) })
    .from(categoriesTable);

  const gold14k = await db
    .select({ pricePerDwt: metalPricesTable.pricePerDwt })
    .from(metalPricesTable)
    .where(eq(metalPricesTable.metalType, "gold_14k"))
    .limit(1);

  const silver = await db
    .select({ pricePerDwt: metalPricesTable.pricePerDwt })
    .from(metalPricesTable)
    .where(eq(metalPricesTable.metalType, "silver"))
    .limit(1);

  res.json({
    totalEstimates: Number(estimateStats?.totalEstimates ?? 0),
    draftCount: Number(draftStats?.draftCount ?? 0),
    approvedCount: Number(approvedStats?.approvedCount ?? 0),
    totalEstimateValue: Number(estimateStats?.totalEstimateValue ?? 0),
    totalServices: Number(serviceStats?.totalServices ?? 0),
    totalCategories: Number(categoryStats?.totalCategories ?? 0),
    goldPricePerDwt: Number(gold14k[0]?.pricePerDwt ?? 0),
    silverPricePerDwt: Number(silver[0]?.pricePerDwt ?? 0),
    readyForPickupCount: Number(readyStats?.readyForPickupCount ?? 0),
    overdueCount: Number(overdueStats?.overdueCount ?? 0),
    openJobsCount: Number(openJobStats?.openJobsCount ?? 0),
  });
});

router.get("/dashboard/recent-estimates", async (req, res) => {
  const estimates = await db
    .select()
    .from(estimatesTable)
    .orderBy(desc(estimatesTable.updatedAt))
    .limit(5);

  res.json(
    estimates.map((e) => ({
      ...e,
      subtotal: Number(e.subtotal),
      laborTotal: Number(e.laborTotal),
      materialsTotal: Number(e.materialsTotal),
      total: Number(e.total),
    }))
  );
});

export default router;
