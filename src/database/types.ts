/**
 * Swiftbase SDK Database Types & Interfaces
 *
 * Defines the core AST and payload representations for query building,
 * batching, realtime events, and dialect-specific execution.
 */

export type LogicalOperator = "AND" | "OR";

export type ComparisonOperator =
  | "="
  | "!="
  | "<>"
  | ">"
  | ">="
  | "<"
  | "<="
  | "LIKE"
  | "NOT LIKE"
  | "ILIKE"
  | "NOT ILIKE"
  | "IN"
  | "NOT IN"
  | "IS"
  | "IS NOT"
  | "BETWEEN"
  | "NOT BETWEEN";

export interface WhereCondition {
  column: string;
  operator: ComparisonOperator | string;
  value: any;
  bool?: LogicalOperator; // Default: "AND"
  isRaw?: boolean;
}

export type JoinType = "inner" | "left" | "right" | "full" | "cross";

export interface JoinClause {
  type: JoinType;
  table: string;
  firstColumn: string;
  operator: string;
  secondColumn: string;
}

export interface OrderByClause {
  column: string;
  order: "asc" | "desc";
  nulls?: "first" | "last";
}

export interface AggregateClause {
  fn: "count" | "min" | "max" | "sum" | "avg";
  column: string;
  as?: string;
  distinct?: boolean;
}

export interface QueryPayload {
  database: string;
  table: string;
  select?: string[];
  distinct?: boolean;
  where?: WhereCondition[];
  joins?: JoinClause[];
  groupBy?: string[];
  having?: WhereCondition[];
  orderBy?: OrderByClause[];
  aggregates?: AggregateClause[];
  limit?: number;
  offset?: number;
  insert?: any;
  update?: any;
  delete?: boolean;
  onConflict?: {
    columns: string[];
    merge?: boolean;
    update?: Record<string, any>;
  };
  returning?: string[];
}

export interface BatchQueryResult {
  data: any[];
  columns: string[];
  count: number;
  rowCount: number;
  rowsAffected?: number;
  rowsJSON?: string;
  executionTimeMs?: number;
}

export interface CompiledSQL {
  sql: string;
  bindings: any[];
}
