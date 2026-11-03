import { describe, it, expect } from "vitest";
import {
  defineTable,
  text,
  integer,
  boolean,
  timestamp,
  json,
  uuid,
  doublePrecision,
} from "../src/database/schema";
import { SchemaDiff, ExistingTableCatalog } from "../src/database/migration/diff";
import { MigrationGenerator } from "../src/database/migration/generator";
import { MigrationRunner } from "../src/database/migration/runner";

describe("Schema Definitions & Migrations", () => {
  const users = defineTable("users", {
    id: uuid("id").primaryKey(),
    email: text("email").notNull().unique(),
    age: integer("age").default(18),
    isAdmin: boolean("is_admin").default(false),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").default("CURRENT_TIMESTAMP"),
  });

  const orders = defineTable(
    "orders",
    {
      id: uuid("id").primaryKey(),
      userId: uuid("user_id").notNull().references("users", "id", "CASCADE"),
      total: doublePrecision("total").notNull(),
      createdAt: timestamp("created_at"),
    },
    {
      indexes: [
        { name: "idx_orders_user_id", columns: ["user_id"] },
      ],
    }
  );

  it("defines schema tables with correct column metadata", () => {
    expect(users.tableName).toBe("users");
    expect(users.columns.email.options.dataType).toBe("text");
    expect(users.columns.email.options.isNotNull).toBe(true);
    expect(users.columns.email.options.isUnique).toBe(true);
    expect(users.columns.id.options.isPrimaryKey).toBe(true);
  });

  it("diffs against empty catalog to create tables", () => {
    const diffs = SchemaDiff.diff([], [users, orders]);
    expect(diffs).toHaveLength(3); // 2 tables + 1 index
    expect(diffs[0].type).toBe("create_table");
    if (diffs[0].type === "create_table") {
      expect(diffs[0].table.tableName).toBe("users");
    }
    expect(diffs[1].type).toBe("create_table");
    if (diffs[1].type === "create_table") {
      expect(diffs[1].table.tableName).toBe("orders");
    }
    expect(diffs[2].type).toBe("create_index");
  });

  it("diffs against existing catalog to add columns and indexes", () => {
    const existingCatalog: ExistingTableCatalog[] = [
      {
        name: "users",
        columns: [
          { name: "id", type: "text", notNull: true, primaryKey: true },
          { name: "email", type: "text", notNull: true },
        ],
      },
    ];

    const diffs = SchemaDiff.diff(existingCatalog, [users]);
    const addedColumns = diffs
      .filter((d): d is Extract<typeof d, { type: "add_column" }> => d.type === "add_column")
      .map((d) => d.column.name);

    expect(addedColumns).toContain("age");
    expect(addedColumns).toContain("is_admin");
    expect(addedColumns).toContain("metadata");
    expect(addedColumns).toContain("created_at");
  });

  it("generates dialect-specific SQL for OLTP (LibSQL / SQLite)", () => {
    const diffs = SchemaDiff.diff([], [users, orders]);
    const plan = MigrationGenerator.generatePlan("initial_setup", diffs, "oltp");

    expect(plan.steps).toHaveLength(3); // create users, create orders, create index
    const createUsersSql = plan.steps[0].sql;
    expect(createUsersSql).toContain('CREATE TABLE IF NOT EXISTS "users"');
    expect(createUsersSql).toContain('"id" TEXT PRIMARY KEY');
    expect(createUsersSql).toContain('"email" TEXT NOT NULL UNIQUE');
    expect(createUsersSql).toContain('"is_admin" INTEGER DEFAULT 0');

    const createIndexSql = plan.steps[2].sql;
    expect(createIndexSql).toContain('CREATE INDEX IF NOT EXISTS "idx_orders_user_id" ON "orders" ("user_id")');
  });

  it("generates dialect-specific SQL for OLAP (DuckLake / DuckDB)", () => {
    const diffs = SchemaDiff.diff([], [users, orders], "olap");
    const plan = MigrationGenerator.generatePlan("initial_setup", diffs, "olap");

    const createUsersSql = plan.steps[0].sql;
    expect(createUsersSql).toContain('CREATE TABLE IF NOT EXISTS "users"');
    expect(createUsersSql).toContain('"id" VARCHAR PRIMARY KEY');
    expect(createUsersSql).toContain('"is_admin" BOOLEAN DEFAULT false');
    expect(createUsersSql).toContain('"metadata" JSON');
  });

  it("executes migration plan using runner and writes to migration history table", async () => {
    const executedQueries: string[] = [];
    const mockDbClient: any = Object.assign(
      (tableName: string) => ({
        where: () => ({
          execute: async () => ({ data: [] }),
        }),
        insert: (data: any) => ({
          execute: async () => {
            executedQueries.push(`INSERT: ${JSON.stringify(data)}`);
            return { data: [data] };
          },
        }),
      }),
      {
        executeSQL: async (sql: string) => {
          executedQueries.push(sql);
          return { data: [] };
        },
      }
    );

    const runner = new MigrationRunner(mockDbClient, "oltp");
    const result = await runner.migrate("initial_users", [users], []);

    expect(result.appliedCount).toBe(1);
    expect(executedQueries.some((q) => q.includes('CREATE TABLE IF NOT EXISTS "__swiftbase_migrations"'))).toBe(true);
    expect(executedQueries.some((q) => q.includes('CREATE TABLE IF NOT EXISTS "users"'))).toBe(true);
    expect(executedQueries.some((q) => q.includes('INSERT:'))).toBe(true);
  });
});
