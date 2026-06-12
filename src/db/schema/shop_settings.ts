import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const shopSettingsTable = pgTable("shop_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default(""),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ShopSetting = typeof shopSettingsTable.$inferSelect;
