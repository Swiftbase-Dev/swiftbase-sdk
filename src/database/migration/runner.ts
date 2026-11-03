/**
 * Swiftbase Migration Runner
 *
 * Automatically provisions migration history tracking in '__swiftbase_migrations'
 * and executes migration plans against the remote database via DbClient.
 */

import { MigrationPlan } from "./generator";
import { SchemaDiff, ExistingTableCatalog } from "./diff";
import { MigrationGenerator } from "./generator";
import { TableDefinition } from "../schema/table";
import { DatabaseEngine } from "../schema/dialect";

export interface MigrationResult {
  appliedCount: number;
  durationMs: number;
  steps: string[];
}

export class MigrationRunner {
  private dbClient: any;
  private engine: DatabaseEngine;

  constructor(dbClient: any, engine: DatabaseEngine = "oltp") {
    this.dbClient = dbClient;
    this.engine = engine;
  }

  /**
   * Ensures the migrations table exists to track applied schema versions.
   */
  public async ensureMigrationsTable(): Promise<void> {
    const createTableSql =
      this.engine === "olap"
        ? `CREATE TABLE IF NOT EXISTS "__swiftbase_migrations" (
             id VARCHAR PRIMARY KEY,
             name VARCHAR NOT NULL,
             applied_at TIMESTAMP DEFAULT current_timestamp,
             execution_time_ms INTEGER
           );`
        : `CREATE TABLE IF NOT EXISTS "__swiftbase_migrations" (
             id TEXT PRIMARY KEY,
             name TEXT NOT NULL,
             applied_at TEXT DEFAULT (datetime('now')),
             execution_time_ms INTEGER
           );`;

    await this.dbClient.executeSQL(createTableSql);
  }

  /**
   * Applies a generated migration plan sequentially.
   */
  public async applyPlan(plan: MigrationPlan): Promise<MigrationResult> {
    await this.ensureMigrationsTable();
    const startTime = Date.now();
    const executedDescriptions: string[] = [];

    // Check if this migration was already applied
    const existing = await this.dbClient("__swiftbase_migrations")
      .where("id", plan.id)
      .execute()
      .catch(() => ({ data: [] }));

    if (existing && existing.data && existing.data.length > 0) {
      return {
        appliedCount: 0,
        durationMs: 0,
        steps: [`Migration ${plan.id} already applied`],
      };
    }

    // Execute each DDL step
    for (const step of plan.steps) {
      await this.dbClient.executeSQL(step.sql);
      executedDescriptions.push(step.description);
    }

    const durationMs = Date.now() - startTime;

    // Record migration in history table
    await this.dbClient("__swiftbase_migrations").insert({
      id: plan.id,
      name: plan.name,
      execution_time_ms: durationMs,
    }).execute();

    return {
      appliedCount: plan.steps.length,
      durationMs,
      steps: executedDescriptions,
    };
  }

  /**
   * One-step declarative synchronization: Inspects existing tables,
   * computes diffs against target schemas, generates a plan, and applies it.
   */
  public async migrate(
    name: string,
    targetTables: Array<TableDefinition<any>>,
    existingTables: ExistingTableCatalog[] = []
  ): Promise<MigrationResult> {
    const operations = SchemaDiff.diff(existingTables, targetTables, this.engine);
    if (operations.length === 0) {
      return { appliedCount: 0, durationMs: 0, steps: ["Schema is up to date"] };
    }

    const plan = MigrationGenerator.generatePlan(name, operations, this.engine);
    return await this.applyPlan(plan);
  }
}
