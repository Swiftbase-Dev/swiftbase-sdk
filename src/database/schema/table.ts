/**
 * Swiftbase Declarative Table Definition
 *
 * Encapsulates a table schema structure with columns, indexes, and engine metadata.
 */

import { ColumnBuilder } from "./columns";
import { DialectAdapter, DatabaseEngine } from "./dialect";

export interface IndexDefinition {
  name?: string;
  columns: string[];
  unique?: boolean;
}

export interface TableOptions {
  engine?: DatabaseEngine;
  indexes?: IndexDefinition[];
}

export class TableDefinition<TColumns extends Record<string, ColumnBuilder<any>> = Record<string, ColumnBuilder<any>>> {
  public tableName: string;
  public columns: TColumns;
  public options: TableOptions;

  constructor(tableName: string, columns: TColumns, options: TableOptions = {}) {
    this.tableName = tableName;
    this.columns = columns;
    this.options = {
      engine: options.engine || "oltp",
      indexes: options.indexes || [],
    };
  }

  /**
   * Generates the CREATE TABLE DDL statement for the configured dialect.
   */
  public toCreateSQL(engine?: DatabaseEngine): string {
    const targetEngine = engine || this.options.engine || "oltp";
    const columnSqlList = Object.values(this.columns).map((col) =>
      DialectAdapter.mapColumnToSql(col.options, targetEngine)
    );

    return `CREATE TABLE IF NOT EXISTS "${this.tableName}" (\n  ${columnSqlList.join(",\n  ")}\n);`;
  }

  /**
   * Generates CREATE INDEX statements for any defined indexes.
   */
  public toIndexSQL(): string[] {
    const indexes = this.options.indexes || [];
    return indexes.map((idx) => {
      const idxName = idx.name || `idx_${this.tableName}_${idx.columns.join("_")}`;
      const unique = idx.unique ? "UNIQUE " : "";
      const cols = idx.columns.map((c) => `"${c}"`).join(", ");
      return `CREATE ${unique}INDEX IF NOT EXISTS "${idxName}" ON "${this.tableName}" (${cols});`;
    });
  }
}

/**
 * Define a type-safe database table schema.
 */
export function defineTable<TColumns extends Record<string, ColumnBuilder<any>>>(
  tableName: string,
  columns: TColumns,
  options?: TableOptions
): TableDefinition<TColumns> & TColumns {
  const table = new TableDefinition(tableName, columns, options);
  // Proxy table columns so users can access table.id, table.email directly
  return new Proxy(table, {
    get(target, prop, receiver) {
      if (prop in target.columns) {
        return target.columns[prop as keyof TColumns];
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as any;
}
