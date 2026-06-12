import { pgTable, serial, text, timestamp, integer, customType } from "drizzle-orm/pg-core";
import { estimatesTable } from "./estimates";

const bytea = customType<{ data: Buffer }>({
  dataType() { return "bytea"; },
});

export const estimatePhotosTable = pgTable("estimate_photos", {
  id: serial("id").primaryKey(),
  estimateId: integer("estimate_id").notNull().references(() => estimatesTable.id, { onDelete: "cascade" }),
  objectPath: text("object_path").notNull(),
  photoType: text("photo_type").notNull().default("intake"),
  caption: text("caption"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  photoData: bytea("photo_data"),
  mimeType: text("mime_type").notNull().default("image/jpeg"),
});

export type EstimatePhoto = typeof estimatePhotosTable.$inferSelect;
