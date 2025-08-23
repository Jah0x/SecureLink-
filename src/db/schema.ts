import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
// Если DB=sqlite — Drizzle сам подставит sqlite-диалект по конфигу.

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price_cents: integer("price_cents").notNull(),
  period_days: integer("period_days").notNull().default(30),
  traffic_mb: integer("traffic_mb"),
  is_active: boolean("is_active").notNull().default(true),
  is_demo: boolean("is_demo").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const planFeatures = pgTable("plan_features", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => plans.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("active"),
  startedAt: timestamp("started_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const affiliates = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  ownerUserId: integer("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  percent: integer("percent").notNull().default(10),
});

export const affiliateClicks = pgTable("affiliate_clicks", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliates.id, { onDelete: "cascade" }),
  ts: timestamp("ts").defaultNow(),
});

export const affiliateLinks = pgTable("affiliate_links", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliates.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const affiliateStats = pgTable(
  "affiliate_stats",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    refId: integer("ref_id").references(() => affiliates.id, { onDelete: "cascade" }),
    earningsCents: integer("earnings_cents").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("idx_aff_stats_user_created").on(t.userId, t.createdAt),
    refCreatedIdx: index("idx_aff_stats_ref_created").on(t.refId, t.createdAt),
  })
);
