/**
 * Swiftbase Dialect Mappings
 *
 * Maps abstract column data types into physical SQL column definitions
 * tailored for OLTP (LibSQL / SQLite) and OLAP (DuckLake / DuckDB).
 */

import { ColumnDefinitionOptions } from "./columns";

export type DatabaseEngine = "oltp" | "olap";

export class DialectAdapter {
  public static mapColumnToSql(col: ColumnDefinitionOptions, engine: DatabaseEngine = "oltp"): string {
    const colName = `"${col.name}"`;
    let typeSql = "";

    if (engine === "olap") {
      // DuckDB / DuckLake SQL Types
      switch (col.dataType) {
        case "text":
        case "varchar":
        case "uuid":
          typeSql = col.length ? `VARCHAR(${col.length})` : "VARCHAR";
          break;
        case "integer":
          typeSql = "INTEGER";
          break;
        case "bigint":
          typeSql = "BIGINT";
          break;
        case "real":
          typeSql = "FLOAT";
          break;
        case "double":
          typeSql = "DOUBLE";
          break;
        case "boolean":
          typeSql = "BOOLEAN";
          break;
        case "timestamp":
          typeSql = "TIMESTAMP";
          break;
        case "json":
          typeSql = "JSON";
          break;
        case "blob":
          typeSql = "BLOB";
          break;
        default:
          typeSql = "VARCHAR";
      }
    } else {
      // LibSQL / SQLite OLTP Types
      switch (col.dataType) {
        case "text":
        case "varchar":
        case "uuid":
        case "json":
        case "timestamp":
          typeSql = "TEXT";
          break;
        case "integer":
        case "bigint":
        case "boolean":
          typeSql = "INTEGER";
          break;
        case "real":
        case "double":
          typeSql = "REAL";
          break;
        case "blob":
          typeSql = "BLOB";
          break;
        default:
          typeSql = "TEXT";
      }
    }

    const constraints: string[] = [];
    if (col.isPrimaryKey) {
      constraints.push("PRIMARY KEY");
    }
    if (col.isNotNull && !col.isPrimaryKey) {
      constraints.push("NOT NULL");
    }
    if (col.isUnique && !col.isPrimaryKey) {
      constraints.push("UNIQUE");
    }
    if (col.defaultValue !== undefined) {
      if (typeof col.defaultValue === "string" && col.defaultValue.toUpperCase() === "NOW") {
        constraints.push(engine === "olap" ? "DEFAULT current_timestamp" : "DEFAULT (datetime('now'))");
      } else if (typeof col.defaultValue === "string") {
        constraints.push(`DEFAULT '${col.defaultValue.replace(/'/g, "''")}'`);
      } else if (typeof col.defaultValue === "boolean") {
        constraints.push(engine === "olap" ? `DEFAULT ${col.defaultValue}` : `DEFAULT ${col.defaultValue ? 1 : 0}`);
      } else {
        constraints.push(`DEFAULT ${col.defaultValue}`);
      }
    }

    const constraintSql = constraints.length > 0 ? ` ${constraints.join(" ")}` : "";
    return `${colName} ${typeSql}${constraintSql}`;
  }
}
