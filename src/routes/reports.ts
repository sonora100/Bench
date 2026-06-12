import { Router } from "express";
import { db } from "../db";
import { estimatesTable } from "../db";
import { eq, sum, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const ReportQueryParams = z.object({
  from: z.string().optional(),
  to:   z.string().optional(),
});

router.get("/reports/summary", async (req, res) => {
  const { from, to } = ReportQueryParams.parse(req.query);

  const fromDate = from ? new Date(from) : null;
  const toDate   = to   ? new Date(to)   : null;

  // Build date clause fragments
  const fromClause = fromDate ? sql` AND ${estimatesTable.createdAt} >= ${fromDate}` : sql``;
  const toClause   = toDate   ? sql` AND ${estimatesTable.createdAt} <= ${toDate}`   : sql``;

  // Total approved revenue (filtered by range if provided)
  const [totalRow] = await db
    .select({ total: sum(estimatesTable.total) })
    .from(estimatesTable)
    .where(sql`${estimatesTable.status} = 'approved'${fromClause}${toClause}`);

  // Revenue "this period" — if no dates use current month, otherwise same as total
  let revenueThisMonth: number;
  if (fromDate || toDate) {
    revenueThisMonth = Number(totalRow?.total ?? 0);
  } else {
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const [monthRow] = await db
      .select({ total: sum(estimatesTable.total) })
      .from(estimatesTable)
      .where(sql`${estimatesTable.status} = 'approved' AND ${estimatesTable.createdAt} >= ${thisMonthStart}`);
    revenueThisMonth = Number(monthRow?.total ?? 0);
  }

  // Pipeline counts (always all-time, not filtered — reflects current state)
  const pipelineRows = await db
    .select({
      status: estimatesTable.status,
      cnt: sql<number>`COUNT(*)::int`,
    })
    .from(estimatesTable)
    .groupBy(estimatesTable.status);

  const pipeline = { draft: 0, sent: 0, approved: 0, declined: 0 };
  for (const row of pipelineRows) {
    if (row.status in pipeline) {
      pipeline[row.status as keyof typeof pipeline] = Number(row.cnt);
    }
  }

  // Monthly revenue bar chart — respect date range if given, else last 6 months
  const monthlyFromClause = fromDate
    ? sql` AND created_at >= ${fromDate}`
    : sql` AND created_at >= NOW() - INTERVAL '6 months'`;
  const monthlyToClause = toDate ? sql` AND created_at <= ${toDate}` : sql``;

  const { rows: monthlyRows } = await db.execute(
    sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YY') AS month,
        ROUND(SUM(total)::numeric, 2) AS revenue
      FROM estimates
      WHERE status = 'approved'
        ${monthlyFromClause}${monthlyToClause}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `
  );

  const monthlyRevenue = (monthlyRows as any[]).map((r) => ({
    month: String(r.month),
    revenue: Number(r.revenue),
  }));

  res.json({
    totalRevenue: Number(totalRow?.total ?? 0),
    revenueThisMonth,
    pipeline,
    monthlyRevenue,
  });
});

export default router;
