/**
 * Swiftbase QueryBuilder
 *
 * Full-featured, Knex-compatible fluent query builder that supports both
 * realtime WebSocket execution and REST failover, with full coverage of
 * filtering, grouping, joining, aggregations, mutations, and upserts.
 */

import { makeRequest, HTTPMethod } from "../../common/makerequest";
import { generateId } from "../../common/id";
import { DatabaseSocketManager } from "../socket";
import { SQLCompiler } from "./compiler";
import {
  QueryPayload,
  WhereCondition,
  JoinClause,
  JoinType,
  OrderByClause,
  AggregateClause,
  CompiledSQL,
} from "../types";

export class QueryBuilder implements PromiseLike<any> {
  protected dbName: string;
  protected tableName: string;
  protected payload: QueryPayload;

  constructor(dbNameOrTable: string, tableName?: string) {
    if (tableName === undefined) {
      this.dbName = "";
      this.tableName = dbNameOrTable;
    } else {
      this.dbName = dbNameOrTable;
      this.tableName = tableName;
    }
    this.payload = {
      database: this.dbName,
      table: this.tableName,
    };
  }

  // ==========================================
  // SELECT & PROJECTION
  // ==========================================

  /**
   * Specify columns to select in the result set.
   * Accepts string column names or arrays of column names.
   */
  public select(...columns: Array<string | string[]>): this {
    const flat = columns.flat();
    if (flat.length > 0) {
      if (!this.payload.select) {
        this.payload.select = [];
      }
      this.payload.select.push(...flat);
    }
    return this;
  }

  /**
   * Applies DISTINCT to the query projection.
   */
  public distinct(): this {
    this.payload.distinct = true;
    return this;
  }

  /**
   * Alias for select().
   */
  public columns(...cols: Array<string | string[]>): this {
    return this.select(...cols);
  }

  // ==========================================
  // WHERE & FILTERING (Knex-compatible)
  // ==========================================

  private addWhere(
    columnOrObj: string | Record<string, any>,
    operatorOrValue?: any,
    value?: any,
    bool: "AND" | "OR" = "AND",
    negate = false
  ): this {
    if (!this.payload.where) {
      this.payload.where = [];
    }

    if (typeof columnOrObj === "string") {
      let operator = "=";
      let val = operatorOrValue;

      if (value !== undefined) {
        operator = String(operatorOrValue);
        val = value;
      }

      if (negate) {
        if (operator === "=") operator = "!=";
        else if (operator === "IN") operator = "NOT IN";
        else if (operator === "LIKE") operator = "NOT LIKE";
        else if (operator === "ILIKE") operator = "NOT ILIKE";
        else if (operator === "BETWEEN") operator = "NOT BETWEEN";
      }

      const condition: WhereCondition = {
        column: columnOrObj,
        operator,
        value: val,
      };
      if (bool === "OR") {
        condition.bool = "OR";
      }

      this.payload.where.push(condition);
    } else if (columnOrObj && typeof columnOrObj === "object") {
      for (const [k, v] of Object.entries(columnOrObj)) {
        const condition: WhereCondition = {
          column: k,
          operator: negate ? "!=" : "=",
          value: v,
        };
        if (bool === "OR") {
          condition.bool = "OR";
        }
        this.payload.where.push(condition);
      }
    }
    return this;
  }

  public where(column: string, value: any): this;
  public where(column: string, operator: string, value: any): this;
  public where(obj: Record<string, any>): this;
  public where(columnOrObj: string | Record<string, any>, operatorOrValue?: any, value?: any): this {
    return this.addWhere(columnOrObj, operatorOrValue, value, "AND", false);
  }

  public andWhere(column: string, value: any): this;
  public andWhere(column: string, operator: string, value: any): this;
  public andWhere(obj: Record<string, any>): this;
  public andWhere(columnOrObj: string | Record<string, any>, operatorOrValue?: any, value?: any): this {
    return this.addWhere(columnOrObj, operatorOrValue, value, "AND", false);
  }

  public orWhere(column: string, value: any): this;
  public orWhere(column: string, operator: string, value: any): this;
  public orWhere(obj: Record<string, any>): this;
  public orWhere(columnOrObj: string | Record<string, any>, operatorOrValue?: any, value?: any): this {
    return this.addWhere(columnOrObj, operatorOrValue, value, "OR", false);
  }

  public whereNot(column: string, value: any): this;
  public whereNot(column: string, operator: string, value: any): this;
  public whereNot(obj: Record<string, any>): this;
  public whereNot(columnOrObj: string | Record<string, any>, operatorOrValue?: any, value?: any): this {
    return this.addWhere(columnOrObj, operatorOrValue, value, "AND", true);
  }

  public orWhereNot(column: string, value: any): this;
  public orWhereNot(column: string, operator: string, value: any): this;
  public orWhereNot(obj: Record<string, any>): this;
  public orWhereNot(columnOrObj: string | Record<string, any>, operatorOrValue?: any, value?: any): this {
    return this.addWhere(columnOrObj, operatorOrValue, value, "OR", true);
  }

  public whereIn(column: string, values: any[]): this {
    return this.addWhere(column, "IN", values, "AND");
  }

  public orWhereIn(column: string, values: any[]): this {
    return this.addWhere(column, "IN", values, "OR");
  }

  public whereNotIn(column: string, values: any[]): this {
    return this.addWhere(column, "NOT IN", values, "AND");
  }

  public orWhereNotIn(column: string, values: any[]): this {
    return this.addWhere(column, "NOT IN", values, "OR");
  }

  public whereNull(column: string): this {
    return this.addWhere(column, "IS", null, "AND");
  }

  public orWhereNull(column: string): this {
    return this.addWhere(column, "IS", null, "OR");
  }

  public whereNotNull(column: string): this {
    return this.addWhere(column, "IS NOT", null, "AND");
  }

  public orWhereNotNull(column: string): this {
    return this.addWhere(column, "IS NOT", null, "OR");
  }

  public whereBetween(column: string, range: [any, any]): this {
    return this.addWhere(column, "BETWEEN", range, "AND");
  }

  public orWhereBetween(column: string, range: [any, any]): this {
    return this.addWhere(column, "BETWEEN", range, "OR");
  }

  public whereNotBetween(column: string, range: [any, any]): this {
    return this.addWhere(column, "NOT BETWEEN", range, "AND");
  }

  public orWhereNotBetween(column: string, range: [any, any]): this {
    return this.addWhere(column, "NOT BETWEEN", range, "OR");
  }

  public whereLike(column: string, pattern: string): this {
    return this.addWhere(column, "LIKE", pattern, "AND");
  }

  public whereILike(column: string, pattern: string): this {
    return this.addWhere(column, "ILIKE", pattern, "AND");
  }

  public whereRaw(rawSql: string): this {
    if (!this.payload.where) this.payload.where = [];
    this.payload.where.push({
      column: rawSql,
      operator: "",
      value: null,
      bool: "AND",
      isRaw: true,
    });
    return this;
  }

  // ==========================================
  // JOINS
  // ==========================================

  public join(table: string, firstColumn: string, operatorOrSecond: string, secondColumn?: string): this {
    return this.addJoin("inner", table, firstColumn, operatorOrSecond, secondColumn);
  }

  public innerJoin(table: string, firstColumn: string, operatorOrSecond: string, secondColumn?: string): this {
    return this.addJoin("inner", table, firstColumn, operatorOrSecond, secondColumn);
  }

  public leftJoin(table: string, firstColumn: string, operatorOrSecond: string, secondColumn?: string): this {
    return this.addJoin("left", table, firstColumn, operatorOrSecond, secondColumn);
  }

  public rightJoin(table: string, firstColumn: string, operatorOrSecond: string, secondColumn?: string): this {
    return this.addJoin("right", table, firstColumn, operatorOrSecond, secondColumn);
  }

  public fullOuterJoin(table: string, firstColumn: string, operatorOrSecond: string, secondColumn?: string): this {
    return this.addJoin("full", table, firstColumn, operatorOrSecond, secondColumn);
  }

  public crossJoin(table: string): this {
    if (!this.payload.joins) this.payload.joins = [];
    this.payload.joins.push({
      type: "cross",
      table,
      firstColumn: "",
      operator: "",
      secondColumn: "",
    });
    return this;
  }

  private addJoin(
    type: JoinType,
    table: string,
    firstColumn: string,
    operatorOrSecond: string,
    secondColumn?: string
  ): this {
    if (!this.payload.joins) this.payload.joins = [];
    let op = "=";
    let col2 = operatorOrSecond;
    if (secondColumn !== undefined) {
      op = operatorOrSecond;
      col2 = secondColumn;
    }
    this.payload.joins.push({
      type,
      table,
      firstColumn,
      operator: op,
      secondColumn: col2,
    });
    return this;
  }

  // ==========================================
  // GROUPING, AGGREGATES & HAVING
  // ==========================================

  public groupBy(...columns: Array<string | string[]>): this {
    const flat = columns.flat();
    if (!this.payload.groupBy) this.payload.groupBy = [];
    this.payload.groupBy.push(...flat);
    return this;
  }

  public having(column: string, operator: string, value: any): this {
    if (!this.payload.having) this.payload.having = [];
    this.payload.having.push({
      column,
      operator,
      value,
      bool: "AND",
    });
    return this;
  }

  public count(column = "*", optionsOrAs?: string | { as?: string; distinct?: boolean }): this {
    const as = typeof optionsOrAs === "string" ? optionsOrAs : optionsOrAs?.as || "count";
    const distinct = typeof optionsOrAs === "object" ? optionsOrAs?.distinct : undefined;
    return this.addAggregate("count", column, as, distinct);
  }

  public min(column: string, optionsOrAs?: string | { as?: string }): this {
    const as = typeof optionsOrAs === "string" ? optionsOrAs : optionsOrAs?.as || "min";
    return this.addAggregate("min", column, as);
  }

  public max(column: string, optionsOrAs?: string | { as?: string }): this {
    const as = typeof optionsOrAs === "string" ? optionsOrAs : optionsOrAs?.as || "max";
    return this.addAggregate("max", column, as);
  }

  public sum(column: string, optionsOrAs?: string | { as?: string; distinct?: boolean }): this {
    const as = typeof optionsOrAs === "string" ? optionsOrAs : optionsOrAs?.as || "sum";
    const distinct = typeof optionsOrAs === "object" ? optionsOrAs?.distinct : undefined;
    return this.addAggregate("sum", column, as, distinct);
  }

  public avg(column: string, optionsOrAs?: string | { as?: string; distinct?: boolean }): this {
    const as = typeof optionsOrAs === "string" ? optionsOrAs : optionsOrAs?.as || "avg";
    const distinct = typeof optionsOrAs === "object" ? optionsOrAs?.distinct : undefined;
    return this.addAggregate("avg", column, as, distinct);
  }

  private addAggregate(
    fn: "count" | "min" | "max" | "sum" | "avg",
    column: string,
    asName?: string,
    distinct?: boolean
  ): this {
    if (!this.payload.aggregates) this.payload.aggregates = [];
    this.payload.aggregates.push({
      fn,
      column,
      as: asName,
      distinct,
    });
    return this;
  }

  // ==========================================
  // ORDERING & PAGINATION
  // ==========================================

  public orderBy(column: string, order: "asc" | "desc" = "asc", nulls?: "first" | "last"): this {
    if (!this.payload.orderBy) this.payload.orderBy = [];
    this.payload.orderBy.push({
      column,
      order: order.toLowerCase() as "asc" | "desc",
      nulls,
    });
    return this;
  }

  public limit(value: number): this {
    this.payload.limit = value;
    return this;
  }

  public offset(value: number): this {
    this.payload.offset = value;
    return this;
  }

  /**
   * Limits results to 1 and unpacks the first row automatically on execution.
   */
  public first(...columns: Array<string | string[]>): Promise<any> {
    if (columns.length > 0) {
      this.select(...columns);
    }
    this.limit(1);
    return this.execute().then((res) => {
      const rows = res.data || [];
      return rows.length > 0 ? rows[0] : null;
    });
  }

  // ==========================================
  // MUTATIONS (INSERT, UPDATE, DELETE, UPSERT)
  // ==========================================

  public insert(data: any): this {
    this.payload.insert = data;
    return this;
  }

  public update(data: any): this {
    this.payload.update = data;
    return this;
  }

  public delete(): this {
    this.payload.delete = true;
    return this;
  }

  /**
   * Increments a numeric column by an amount (default: 1).
   */
  public increment(column: string, amount = 1): this {
    return this.update({ [column]: `__SWIFTBASE_INC_${amount}` });
  }

  /**
   * Decrements a numeric column by an amount (default: 1).
   */
  public decrement(column: string, amount = 1): this {
    return this.update({ [column]: `__SWIFTBASE_DEC_${amount}` });
  }

  /**
   * Specify RETURNING clause for mutations.
   */
  public returning(...columns: Array<string | string[]>): this {
    const flat = columns.flat();
    this.payload.returning = flat;
    return this;
  }

  /**
   * Configure ON CONFLICT clause for upserts.
   */
  public onConflict(columns: string | string[]): {
    ignore: () => QueryBuilder;
    merge: (updateFields?: Record<string, any>) => QueryBuilder;
  } {
    const conflictCols = Array.isArray(columns) ? columns : [columns];
    this.payload.onConflict = {
      columns: conflictCols,
      merge: false,
    };

    return {
      ignore: () => {
        this.payload.onConflict!.merge = false;
        return this;
      },
      merge: (updateFields?: Record<string, any>) => {
        this.payload.onConflict!.merge = true;
        this.payload.onConflict!.update = updateFields;
        return this;
      },
    };
  }

  // ==========================================
  // REALTIME & STREAMING
  // ==========================================

  /**
   * Listen for real-time table modifications via persistent WebSocket.
   */
  public listen(callback: (change: { event: "insert" | "update" | "delete"; data: any }) => void): () => void {
    let unsubscribed = false;
    let unsub: (() => void) | null = null;

    DatabaseSocketManager.getInstance()
      .subscribe(this.dbName, this.tableName, callback)
      .then((u) => {
        if (unsubscribed) {
          u();
        } else {
          unsub = u;
        }
      })
      .catch((err) => {
        console.error("[QueryBuilder] Subscription failed:", err);
      });

    return () => {
      unsubscribed = true;
      if (unsub) {
        unsub();
      }
    };
  }

  /**
   * Stream large query result sets page-by-page.
   */
  public async *stream(options: { batchSize?: number } = {}): AsyncGenerator<{ data: any[]; count: number }> {
    const batchSize = options.batchSize || 1000;
    let offset = this.payload.offset || 0;
    const maxLimit = this.payload.limit;

    while (true) {
      const currentBatchLimit = maxLimit ? Math.min(batchSize, maxLimit - offset) : batchSize;
      if (currentBatchLimit <= 0) break;

      const pagePayload = {
        ...this.payload,
        limit: currentBatchLimit,
        offset,
      };

      const result = await makeRequest(HTTPMethod.POST, "/api/db/query", undefined, pagePayload);
      const rows = result.data || [];
      if (rows.length === 0) break;

      yield { data: rows, count: rows.length };

      offset += rows.length;
      if (rows.length < currentBatchLimit) break;
      if (maxLimit && offset >= maxLimit) break;
    }
  }

  // ==========================================
  // COMPILATION & EXECUTION
  // ==========================================

  /**
   * Returns parameterized SQL representation and bindings.
   */
  public toSQL(): CompiledSQL {
    const compiler = new SQLCompiler(this.payload);
    return compiler.toSQL();
  }

  /**
   * Returns human-readable SQL with interpolated literals.
   */
  public toString(): string {
    const compiler = new SQLCompiler(this.payload);
    return compiler.toString();
  }

  public getPayload(): QueryPayload {
    return { ...this.payload };
  }

  public toPayload(): QueryPayload {
    return { ...this.payload };
  }

  public async execute(): Promise<{ data: any[]; columns: string[]; count: number }> {
    const socketManager = DatabaseSocketManager.getInstance();

    if (socketManager.isWebSocketAvailable()) {
      try {
        return await socketManager.executeQuery(this.payload);
      } catch (err) {
        console.warn("[QueryBuilder] WebSocket execution failed, falling back to REST:", err);
      }
    } else if (typeof window !== "undefined") {
      socketManager.ensureConnected().catch((err) => {
        console.warn("[QueryBuilder] Background WebSocket connection failed:", err);
      });
    }

    return await makeRequest(HTTPMethod.POST, "/api/db/query", undefined, this.payload);
  }

  public then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  public generateId(): string {
    return generateId();
  }

  public id(): string {
    return generateId();
  }
}
