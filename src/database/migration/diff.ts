/**
 * Swiftbase Schema Diff Engine
 *
 * Compares an existing database schema catalog with target TableDefinition
 * structures and generates atomic, non-destructive migration operations.
 */

import { TableDefinition } from "../schema/table";
import { ColumnDefinitionOptions } from "../schema/columns";
import { DatabaseEngine } from "../schema/dialect";

export type MigrationOperation =
  | { type: "create_table"; table: TableDefinition<any> }
  | { type: "drop_table"; tableName: string }
  | { type: "add_column"; tableName: string; column: ColumnDefinitionOptions }
  | { type: "drop_column"; tableName: string; columnName: string }
  | { type: "create_index"; tableName: string; indexName: string; columns: string[]; unique?: boolean };

export interface ExistingTableCatalog {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    notNull?: boolean;
    primaryKey?: boolean;
    defaultValue?: any;
  }>;
}

export class SchemaDiff {
  public static diff(
    existingTables: ExistingTableCatalog[],
    targetTables: Array<TableDefinition<any>>,
    _engine: DatabaseEngine = "oltp"
  ): MigrationOperation[] {
    const operations: MigrationOperation[] = [];
    const existingMap = new Map<string, ExistingTableCatalog>();
    for (const t of existingTables) {
      existingMap.set(t.name.toLowerCase(), t);
    }

    const targetMap = new Map<string, TableDefinition<any>>();
    for (const t of targetTables) {
      targetMap.set(t.tableName.toLowerCase(), t);
    }

    // 1. Identify new tables to create or existing tables to alter
    for (const target of targetTables) {
      const existing = existingMap.get(target.tableName.toLowerCase());
      if (!existing) {
        operations.push({ type: "create_table", table: target });
        // Also add indexes for new table
        if (target.options.indexes) {
          for (const idx of target.options.indexes) {
            const idxName = idx.name || `idx_${target.tableName}_${idx.columns.join("_")}`;
            operations.push({
              type: "create_index",
              tableName: target.tableName,
              indexName: idxName,
              columns: idx.columns,
              unique: idx.unique,
            });
          }
        }
      } else {
        // Table exists, check for new columns to add
        const existingColNames = new Set(existing.columns.map((c) => c.name.toLowerCase()));
        for (const col of Object.values<any>(target.columns)) {
          if (!existingColNames.has(col.options.name.toLowerCase())) {
            operations.push({
              type: "add_column",
              tableName: target.tableName,
              column: col.options,
            });
          }
        }
      }
    }

    return operations;
  }
}
