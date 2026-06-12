import { pgTable, serial, text, numeric, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { customersTable } from "./customers";

export const estimatesTable = pgTable("estimates", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  laborTotal: numeric("labor_total", { precision: 10, scale: 2 }).notNull().default("0"),
  materialsTotal: numeric("materials_total", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  tagNumber: text("tag_number"),
  repairStatus: text("repair_status"),
  itemDescription: text("item_description"),
  receivedAt: timestamp("received_at"),
  expectedCompletionDate: text("expected_completion_date"),
  repairNotes: text("repair_notes"),
  jobType: text("job_type").notNull().default("estimate"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEstimateSchema = createInsertSchema(estimatesTable).omit({ id: true, createdAt: true, updatedAt: true, subtotal: true, laborTotal: true, materialsTotal: true, total: true });
export type InsertEstimate = z.infer<typeof insertEstimateSchema>;
export type Estimate = typeof estimatesTable.$inferSelect;
