/**
 * Swiftbase Migration Plan Generator
 *
 * Compiles high-level MigrationOperations into an executable DDL migration plan.
 */

import { MigrationOperation } from "./diff";
import { DialectAdapter, DatabaseEngine } from "../schema/dialect";

export interface MigrationStep {
  description: string;
  sql: string;
}

export interface MigrationPlan {
  id: string;
  name: string;
  engine: DatabaseEngine;
  steps: MigrationStep[];
}

export class MigrationGenerator {
  public static generatePlan(
    name: string,
    operations: MigrationOperation[],
    engine: DatabaseEngine = "oltp"
  ): MigrationPlan {
    const id = `mig_${Date.now()}_${name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;
    const steps: MigrationStep[] = [];

    for (const op of operations) {
      switch (op.type) {
        case "create_table": {
          steps.push({
            description: `Create table "${op.table.tableName}"`,
            sql: op.table.toCreateSQL(engine),
          });
          break;
        }
        case "add_column": {
          const colSql = DialectAdapter.mapColumnToSql(op.column, engine);
          steps.push({
            description: `Add column "${op.column.name}" to table "${op.tableName}"`,
            sql: `ALTER TABLE "${op.tableName}" ADD COLUMN ${colSql};`,
          });
          break;
        }
        case "create_index": {
          const unique = op.unique ? "UNIQUE " : "";
          const cols = op.columns.map((c) => `"${c}"`).join(", ");
          steps.push({
            description: `Create index "${op.indexName}" on "${op.tableName}"`,
            sql: `CREATE ${unique}INDEX IF NOT EXISTS "${op.indexName}" ON "${op.tableName}" (${cols});`,
          });
          break;
        }
        case "drop_column": {
          steps.push({
            description: `Drop column "${op.columnName}" from "${op.tableName}"`,
            sql: `ALTER TABLE "${op.tableName}" DROP COLUMN "${op.columnName}";`,
          });
          break;
        }
        case "drop_table": {
          steps.push({
            description: `Drop table "${op.tableName}"`,
            sql: `DROP TABLE IF EXISTS "${op.tableName}";`,
          });
          break;
        }
      }
    }

    return {
      id,
      name,
      engine,
      steps,
    };
  }
}
