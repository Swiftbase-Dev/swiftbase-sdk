/**
 * Swiftbase SQL Compiler
 *
 * Translates a high-level QueryPayload AST into dialect-safe SQL queries
 * with parameterized bindings for both OLTP (SQLite/LibSQL) and OLAP (DuckDB).
 */

import { QueryPayload, CompiledSQL, WhereCondition } from "../types";

export class SQLCompiler {
  private payload: QueryPayload;

  constructor(payload: QueryPayload) {
    this.payload = payload;
  }

  private escapeIdentifier(identifier: string): string {
    if (!identifier) return '""';
    if (identifier === "*" || identifier.includes("(")) return identifier;
    if (identifier.includes(".")) {
      return identifier.split(".").map(part => part === "*" ? "*" : `"${part.replace(/"/g, '""')}"`).join(".");
    }
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private compileWhereClause(conditions: WhereCondition[], bindings: any[]): string {
    if (!conditions || conditions.length === 0) return "";

    const parts: string[] = [];
    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i];
      const boolOp = i === 0 ? "" : ` ${cond.bool || "AND"} `;

      if (cond.isRaw) {
        parts.push(`${boolOp}${cond.column}`);
        continue;
      }

      const escapedCol = this.escapeIdentifier(cond.column);
      const op = (cond.operator || "=").toUpperCase();

      if (op === "IS" || op === "IS NOT") {
        const valStr = cond.value === null ? "NULL" : String(cond.value);
        parts.push(`${boolOp}${escapedCol} ${op} ${valStr}`);
      } else if (op === "IN" || op === "NOT IN") {
        const list = Array.isArray(cond.value) ? cond.value : [cond.value];
        if (list.length === 0) {
          parts.push(op === "IN" ? `${boolOp}1 = 0` : `${boolOp}1 = 1`);
        } else {
          const placeholders = list.map(v => {
            bindings.push(v);
            return "?";
          }).join(", ");
          parts.push(`${boolOp}${escapedCol} ${op} (${placeholders})`);
        }
      } else if (op === "BETWEEN" || op === "NOT BETWEEN") {
        const [low, high] = cond.value;
        bindings.push(low, high);
        parts.push(`${boolOp}${escapedCol} ${op} ? AND ?`);
      } else {
        bindings.push(cond.value);
        parts.push(`${boolOp}${escapedCol} ${cond.operator} ?`);
      }
    }

    return parts.length > 0 ? ` WHERE ${parts.join("")}` : "";
  }

  public toSQL(): CompiledSQL {
    const bindings: any[] = [];
    const table = this.escapeIdentifier(this.payload.table);

    // 1. INSERT query
    if (this.payload.insert !== undefined) {
      const insertData = this.payload.insert;
      const records = Array.isArray(insertData) ? insertData : [insertData];
      if (records.length === 0) {
        return { sql: `INSERT INTO ${table} DEFAULT VALUES`, bindings: [] };
      }

      const columns = Object.keys(records[0]);
      const colNames = columns.map(c => this.escapeIdentifier(c)).join(", ");
      
      const rowsValuesSql: string[] = [];
      for (const row of records) {
        const rowPlaceholders = columns.map(c => {
          bindings.push(row[c]);
          return "?";
        }).join(", ");
        rowsValuesSql.push(`(${rowPlaceholders})`);
      }

      let sql = `INSERT INTO ${table} (${colNames}) VALUES ${rowsValuesSql.join(", ")}`;

      if (this.payload.onConflict) {
        const conflictCols = this.payload.onConflict.columns.map(c => this.escapeIdentifier(c)).join(", ");
        if (this.payload.onConflict.merge) {
          if (this.payload.onConflict.update) {
            const updates = Object.entries(this.payload.onConflict.update)
              .map(([col, val]) => {
                bindings.push(val);
                return `${this.escapeIdentifier(col)} = ?`;
              })
              .join(", ");
            sql += ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updates}`;
          } else {
            const updates = columns
              .filter(c => !this.payload.onConflict!.columns.includes(c))
              .map(c => `${this.escapeIdentifier(c)} = excluded.${this.escapeIdentifier(c)}`)
              .join(", ");
            sql += updates ? ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updates}` : ` ON CONFLICT (${conflictCols}) DO NOTHING`;
          }
        } else {
          sql += ` ON CONFLICT (${conflictCols}) DO NOTHING`;
        }
      }

      if (this.payload.returning && this.payload.returning.length > 0) {
        sql += ` RETURNING ${this.payload.returning.map(c => this.escapeIdentifier(c)).join(", ")}`;
      }

      return { sql, bindings };
    }

    // 2. UPDATE query
    if (this.payload.update !== undefined) {
      const updateData = this.payload.update;
      const setClauses: string[] = [];

      for (const [key, value] of Object.entries(updateData)) {
        const escapedCol = this.escapeIdentifier(key);
        if (typeof value === "string" && value.startsWith("__SWIFTBASE_INC_")) {
          const delta = Number(value.replace("__SWIFTBASE_INC_", "")) || 1;
          bindings.push(delta);
          setClauses.push(`${escapedCol} = ${escapedCol} + ?`);
        } else if (typeof value === "string" && value.startsWith("__SWIFTBASE_DEC_")) {
          const delta = Number(value.replace("__SWIFTBASE_DEC_", "")) || 1;
          bindings.push(delta);
          setClauses.push(`${escapedCol} = ${escapedCol} - ?`);
        } else {
          bindings.push(value);
          setClauses.push(`${escapedCol} = ?`);
        }
      }

      const setSql = setClauses.join(", ");
      const whereSql = this.compileWhereClause(this.payload.where || [], bindings);
      let sql = `UPDATE ${table} SET ${setSql}${whereSql}`;

      if (this.payload.returning && this.payload.returning.length > 0) {
        sql += ` RETURNING ${this.payload.returning.map(c => this.escapeIdentifier(c)).join(", ")}`;
      }

      return { sql, bindings };
    }

    // 3. DELETE query
    if (this.payload.delete) {
      const whereSql = this.compileWhereClause(this.payload.where || [], bindings);
      let sql = `DELETE FROM ${table}${whereSql}`;
      if (this.payload.returning && this.payload.returning.length > 0) {
        sql += ` RETURNING ${this.payload.returning.map(c => this.escapeIdentifier(c)).join(", ")}`;
      }
      return { sql, bindings };
    }

    // 4. SELECT / AGGREGATE query
    let selectCols = "*";
    const selectParts: string[] = [];

    if (this.payload.select && this.payload.select.length > 0) {
      for (const col of this.payload.select) {
        selectParts.push(this.escapeIdentifier(col));
      }
    }

    if (this.payload.aggregates && this.payload.aggregates.length > 0) {
      for (const agg of this.payload.aggregates) {
        const distinctPart = agg.distinct ? "DISTINCT " : "";
        const colPart = agg.column === "*" ? "*" : this.escapeIdentifier(agg.column);
        const asPart = agg.as ? ` AS ${this.escapeIdentifier(agg.as)}` : "";
        selectParts.push(`${agg.fn.toUpperCase()}(${distinctPart}${colPart})${asPart}`);
      }
    }

    if (selectParts.length > 0) {
      selectCols = selectParts.join(", ");
    }

    const distinct = this.payload.distinct ? "DISTINCT " : "";
    let sql = `SELECT ${distinct}${selectCols} FROM ${table}`;

    // Joins
    if (this.payload.joins && this.payload.joins.length > 0) {
      for (const j of this.payload.joins) {
        const joinType = j.type.toUpperCase();
        const joinTable = this.escapeIdentifier(j.table);
        const col1 = this.escapeIdentifier(j.firstColumn);
        const col2 = this.escapeIdentifier(j.secondColumn);
        sql += ` ${joinType} JOIN ${joinTable} ON ${col1} ${j.operator || "="} ${col2}`;
      }
    }

    // WHERE
    sql += this.compileWhereClause(this.payload.where || [], bindings);

    // GROUP BY
    if (this.payload.groupBy && this.payload.groupBy.length > 0) {
      sql += ` GROUP BY ${this.payload.groupBy.map(c => this.escapeIdentifier(c)).join(", ")}`;
    }

    // HAVING
    if (this.payload.having && this.payload.having.length > 0) {
      const havingSql = this.compileWhereClause(this.payload.having, bindings);
      sql += havingSql.replace(/^ WHERE /, " HAVING ");
    }

    // ORDER BY
    if (this.payload.orderBy && this.payload.orderBy.length > 0) {
      const orderParts = this.payload.orderBy.map(o => {
        const col = this.escapeIdentifier(o.column);
        const dir = o.order.toUpperCase();
        const nulls = o.nulls ? ` NULLS ${o.nulls.toUpperCase()}` : "";
        return `${col} ${dir}${nulls}`;
      });
      sql += ` ORDER BY ${orderParts.join(", ")}`;
    }

    // LIMIT & OFFSET
    if (this.payload.limit !== undefined) {
      sql += ` LIMIT ${this.payload.limit}`;
    }
    if (this.payload.offset !== undefined) {
      sql += ` OFFSET ${this.payload.offset}`;
    }

    return { sql, bindings };
  }

  public toString(): string {
    const { sql, bindings } = this.toSQL();
    let index = 0;
    return sql.replace(/\?/g, () => {
      const val = bindings[index++];
      if (val === null || val === undefined) return "NULL";
      if (typeof val === "number" || typeof val === "boolean") return String(val);
      return `'${String(val).replace(/'/g, "''")}'`;
    });
  }
}
