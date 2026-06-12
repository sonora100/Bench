import { Router } from "express";
import { db } from "../db";
import { metalPricesTable } from "../db";
import { eq } from "drizzle-orm";
import {
  UpdateMetalPriceParams,
  UpdateMetalPriceBody,
} from "../api-zod";

const router = Router();

const GRAMS_PER_OZT = 31.1035;
const GRAMS_PER_DWT = 1.55517;

// Karat purity multipliers (applied when converting ozt spot price to per-gram price)
const KARAT_PURITY: Record<string, number> = {
  gold_10k:       10 / 24,
  gold_14k:       14 / 24,
  gold_18k:       18 / 24,
  gold_24k:       1,
  platinum:       0.95,
  silver:         0.925,
  white_gold_10k: 10 / 24,
  white_gold_14k: 14 / 24,
  white_gold_18k: 18 / 24,
};

// Which Coinbase symbol to use per metal group
const METAL_SYMBOL: Record<string, "XAU" | "XAG" | "XPT"> = {
  gold_10k:       "XAU",
  gold_14k:       "XAU",
  gold_18k:       "XAU",
  gold_24k:       "XAU",
  platinum:       "XPT",
  silver:         "XAG",
  white_gold_10k: "XAU",
  white_gold_14k: "XAU",
  white_gold_18k: "XAU",
};

router.get("/metal-prices", async (req, res) => {
  const prices = await db
    .select()
    .from(metalPricesTable)
    .orderBy(metalPricesTable.id);
  res.json(prices);
});

router.put("/metal-prices/:metalType", async (req, res) => {
  const { metalType } = UpdateMetalPriceParams.parse(req.params);
  const { pricePerOzt } = UpdateMetalPriceBody.parse(req.body);

  const purity    = KARAT_PURITY[metalType] ?? 1;
  const baseOzt   = pricePerOzt;
  const pricePerGram = (baseOzt / GRAMS_PER_OZT) * purity;
  const pricePerDwt  = pricePerGram * GRAMS_PER_DWT;

  const [existing] = await db
    .update(metalPricesTable)
    .set({
      pricePerOzt:  String(baseOzt),
      pricePerGram: pricePerGram.toFixed(4),
      pricePerDwt:  pricePerDwt.toFixed(4),
      updatedAt:    new Date(),
    })
    .where(eq(metalPricesTable.metalType, metalType))
    .returning();

  if (!existing) {
    const [inserted] = await db
      .insert(metalPricesTable)
      .values({
        metalType,
        displayName: metalType
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        pricePerOzt:  String(baseOzt),
        pricePerGram: pricePerGram.toFixed(4),
        pricePerDwt:  pricePerDwt.toFixed(4),
      })
      .returning();
    res.json(inserted); return;
  }

  res.json(existing);
});

/**
 * Core sync logic — fetches live spot prices from Coinbase and writes them
 * to the DB. Exported so index.ts can call it on startup and on a schedule.
 */
export async function syncMetalPricesNow(): Promise<{
  gold_24k_ozt: number;
  silver_ozt: number;
  platinum_ozt: number;
}> {
  const fetchSpot = async (symbol: "XAU" | "XAG" | "XPT"): Promise<number> => {
    const r = await fetch(
      `https://api.coinbase.com/v2/prices/${symbol}-USD/spot`
    );
    if (!r.ok) throw new Error(`Coinbase ${symbol} fetch failed: ${r.status}`);
    const json = (await r.json()) as { data: { amount: string } };
    const val = parseFloat(json.data.amount);
    if (!Number.isFinite(val) || val <= 0)
      throw new Error(`Invalid ${symbol} price: ${json.data.amount}`);
    return val;
  };

  const [goldOzt, silverOzt, platinumOzt] = await Promise.all([
    fetchSpot("XAU"),
    fetchSpot("XAG"),
    fetchSpot("XPT"),
  ]);

  const spotMap: Record<"XAU" | "XAG" | "XPT", number> = {
    XAU: goldOzt,
    XAG: silverOzt,
    XPT: platinumOzt,
  };

  await Promise.all(
    Object.entries(KARAT_PURITY).map(async ([metalType, purity]) => {
      const symbol = METAL_SYMBOL[metalType] ?? "XAU";
      const baseOzt = spotMap[symbol];
      const pricePerGram = (baseOzt / GRAMS_PER_OZT) * purity;
      const pricePerDwt  = pricePerGram * GRAMS_PER_DWT;

      const [existing] = await db
        .update(metalPricesTable)
        .set({
          pricePerOzt:  String(baseOzt),
          pricePerGram: pricePerGram.toFixed(4),
          pricePerDwt:  pricePerDwt.toFixed(4),
          updatedAt:    new Date(),
        })
        .where(eq(metalPricesTable.metalType, metalType))
        .returning();

      if (!existing) {
        await db.insert(metalPricesTable).values({
          metalType,
          displayName: metalType
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          pricePerOzt:  String(baseOzt),
          pricePerGram: pricePerGram.toFixed(4),
          pricePerDwt:  pricePerDwt.toFixed(4),
        });
      }
    })
  );

  return { gold_24k_ozt: goldOzt, silver_ozt: silverOzt, platinum_ozt: platinumOzt };
}

/**
 * POST /api/metal-prices/sync
 * Manual trigger — also called automatically on startup and hourly.
 */
router.post("/metal-prices/sync", async (req, res) => {
  try {
    const spotPrices = await syncMetalPricesNow();
    const prices = await db
      .select()
      .from(metalPricesTable)
      .orderBy(metalPricesTable.id);
    res.json({ synced: true, spotPrices, prices });
  } catch (err: any) {
    req.log.error({ err }, "Failed to fetch live metal prices");
    res.status(502).json({
      error: "Could not fetch live prices",
      detail: err?.message ?? String(err),
    }); return;
  }
});

export default router;
