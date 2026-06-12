import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const metalPricesTable = pgTable("metal_prices", {
  id: serial("id").primaryKey(),
  metalType: text("metal_type").notNull().unique(),
  displayName: text("display_name").notNull(),
  pricePerGram: numeric("price_per_gram", { precision: 12, scale: 4 }).notNull(),
  pricePerDwt: numeric("price_per_dwt", { precision: 12, scale: 4 }).notNull(),
  pricePerOzt: numeric("price_per_ozt", { precision: 12, scale: 4 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMetalPriceSchema = createInsertSchema(metalPricesTable).omit({ id: true, updatedAt: true });
export type InsertMetalPrice = z.infer<typeof insertMetalPriceSchema>;
export type MetalPrice = typeof metalPricesTable.$inferSelect;
