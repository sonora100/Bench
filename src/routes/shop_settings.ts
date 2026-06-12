import { Router } from "express";
import { db, shopSettingsTable } from "../db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";

const router = Router();

const SINGLETON_ID = 1;

async function getOrInit() {
  const rows = await db.select().from(shopSettingsTable).where(eq(shopSettingsTable.id, SINGLETON_ID)).limit(1);
  if (rows[0]) return rows[0];
  const [created] = await db
    .insert(shopSettingsTable)
    .values({ id: SINGLETON_ID, name: "", address: "", phone: "" })
    .returning();
  return created!;
}

const UpdateBody = z.object({
  name: z.string().max(200).default(""),
  address: z.string().max(500).default(""),
  phone: z.string().max(50).default(""),
});

router.get("/shop-settings", async (req, res) => {
  try {
    const s = await getOrInit();
    res.json({ name: s.name, address: s.address, phone: s.phone });
  } catch (err) {
    logger.error({ err }, "Failed to get shop settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/shop-settings", async (req, res) => {
  if (!req.session?.authenticated) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const body = UpdateBody.parse(req.body);
    await getOrInit();
    const [updated] = await db
      .update(shopSettingsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(shopSettingsTable.id, SINGLETON_ID))
      .returning();
    const result = updated ?? body;
    res.json({ name: result.name, address: result.address, phone: result.phone });
  } catch (err) {
    logger.error({ err }, "Failed to update shop settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
