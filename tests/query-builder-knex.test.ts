import { describe, it, expect } from "vitest";
import { QueryBuilder } from "../src/database/builder/query-builder";
import { SQLCompiler } from "../src/database/builder/compiler";

describe("Knex-compatible QueryBuilder", () => {
  it("builds basic SELECT queries and toSQL / toString", () => {
    const qb = new QueryBuilder("users")
      .select("id", "email", "name")
      .where("role", "admin")
      .orderBy("name", "ASC")
      .limit(10)
      .offset(20);

    const sql = qb.toSQL();
    expect(sql.sql).toBe('SELECT "id", "email", "name" FROM "users" WHERE "role" = ? ORDER BY "name" ASC LIMIT 10 OFFSET 20');
    expect(sql.bindings).toEqual(["admin"]);
    expect(qb.toString()).toBe(`SELECT "id", "email", "name" FROM "users" WHERE "role" = 'admin' ORDER BY "name" ASC LIMIT 10 OFFSET 20`);
  });

  it("supports whereNot, whereIn, whereNotIn, whereNull, whereNotNull, whereBetween", () => {
    const qb = new QueryBuilder("products")
      .select()
      .whereNot("status", "archived")
      .whereIn("category", ["electronics", "books"])
      .whereNotIn("tag", ["deprecated"])
      .whereNull("deletedAt")
      .whereNotNull("publishedAt")
      .whereBetween("price", [10, 100]);

    const sql = qb.toSQL();
    expect(sql.sql).toContain('"status" != ?');
    expect(sql.sql).toContain('"category" IN (?, ?)');
    expect(sql.sql).toContain('"tag" NOT IN (?)');
    expect(sql.sql).toContain('"deletedAt" IS NULL');
    expect(sql.sql).toContain('"publishedAt" IS NOT NULL');
    expect(sql.sql).toContain('"price" BETWEEN ? AND ?');
    expect(sql.bindings).toEqual(["archived", "electronics", "books", "deprecated", 10, 100]);
  });

  it("supports orWhere clauses", () => {
    const qb = new QueryBuilder("users")
      .select()
      .where("role", "admin")
      .orWhere("isSuperuser", true);

    const sql = qb.toSQL();
    expect(sql.sql).toBe('SELECT * FROM "users" WHERE "role" = ? OR "isSuperuser" = ?');
    expect(sql.bindings).toEqual(["admin", true]);
  });

  it("supports joins: innerJoin, leftJoin, rightJoin, fullOuterJoin", () => {
    const qb = new QueryBuilder("orders")
      .select("orders.id", "users.name", "payments.amount")
      .innerJoin("users", "orders.userId", "users.id")
      .leftJoin("payments", "orders.id", "payments.orderId");

    const sql = qb.toSQL();
    expect(sql.sql).toBe(
      'SELECT "orders"."id", "users"."name", "payments"."amount" FROM "orders" INNER JOIN "users" ON "orders"."userId" = "users"."id" LEFT JOIN "payments" ON "orders"."id" = "payments"."orderId"'
    );
  });

  it("supports aggregate methods: count, sum, avg, min, max", () => {
    const countQb = new QueryBuilder("orders").count("id", "totalOrders");
    expect(countQb.toSQL().sql).toBe('SELECT COUNT("id") AS "totalOrders" FROM "orders"');

    const multiAggQb = new QueryBuilder("metrics")
      .sum("revenue", "totalRevenue")
      .avg("score", "avgScore")
      .min("latency", "minLatency")
      .max("latency", "maxLatency");
    
    expect(multiAggQb.toSQL().sql).toBe(
      'SELECT SUM("revenue") AS "totalRevenue", AVG("score") AS "avgScore", MIN("latency") AS "minLatency", MAX("latency") AS "maxLatency" FROM "metrics"'
    );
  });

  it("supports groupBy and having", () => {
    const qb = new QueryBuilder("sales")
      .select("department")
      .sum("amount", "total")
      .groupBy("department")
      .having("total", ">", 1000);

    const sql = qb.toSQL();
    expect(sql.sql).toBe('SELECT "department", SUM("amount") AS "total" FROM "sales" GROUP BY "department" HAVING "total" > ?');
    expect(sql.bindings).toEqual([1000]);
  });

  it("supports INSERT with onConflict merge (upsert)", () => {
    const qb = new QueryBuilder("settings")
      .insert({ key: "theme", value: "dark" })
      .onConflict("key")
      .merge({ value: "dark" });

    const sql = qb.toSQL();
    expect(sql.sql).toBe(
      'INSERT INTO "settings" ("key", "value") VALUES (?, ?) ON CONFLICT ("key") DO UPDATE SET "value" = ?'
    );
    expect(sql.bindings).toEqual(["theme", "dark", "dark"]);
  });

  it("supports increment and decrement mutations", () => {
    const incQb = new QueryBuilder("articles").where("id", "abc").increment("views", 1);
    expect(incQb.toSQL().sql).toBe('UPDATE "articles" SET "views" = "views" + ? WHERE "id" = ?');
    expect(incQb.toSQL().bindings).toEqual([1, "abc"]);

    const decQb = new QueryBuilder("inventory").where("sku", "XYZ").decrement("quantity", 5);
    expect(decQb.toSQL().sql).toBe('UPDATE "inventory" SET "quantity" = "quantity" - ? WHERE "sku" = ?');
    expect(decQb.toSQL().bindings).toEqual([5, "XYZ"]);
  });

  it("supports DELETE queries", () => {
    const qb = new QueryBuilder("logs").where("level", "debug").delete();
    const sql = qb.toSQL();
    expect(sql.sql).toBe('DELETE FROM "logs" WHERE "level" = ?');
    expect(sql.bindings).toEqual(["debug"]);
  });

  it("properly serializes Knex operations to QueryPayload for remote execution", () => {
    const qb = new QueryBuilder("orders")
      .select("id", "total")
      .where("status", "completed")
      .whereBetween("created_at", [1000, 2000])
      .limit(5);

    const payload = qb.toPayload();
    expect(payload.table).toBe("orders");
    expect(payload.select).toEqual(["id", "total"]);
    expect(payload.where).toHaveLength(2);
    expect(payload.limit).toBe(5);
  });
});
