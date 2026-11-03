/**
 * Swiftbase SDK Database Client & Query Module
 *
 * Provides a Knex-compatible fluent query builder, real-time WebSocket subscriptions,
 * batching execution, type-safe schema definition, and zero-SQL declarative migrations.
 */

import { generateId } from "../common/id";
import { makeRequest, HTTPMethod } from "../common/makerequest";
import { QueryBuilder } from "./builder/query-builder";
import { DatabaseSocketManager } from "./socket";
import { TableDefinition } from "./schema/table";
import { MigrationRunner } from "./migration/runner";
import { DatabaseEngine } from "./schema/dialect";
import {
  QueryPayload,
  WhereCondition,
  JoinClause,
  JoinType,
  OrderByClause,
  AggregateClause,
  BatchQueryResult,
  CompiledSQL,
} from "./types";

export interface DbClient {
  (tableName: string): QueryBuilder;
  generateId: () => string;
  id: () => string;
  batch: (queries: Array<QueryBuilder | string>) => Promise<BatchQueryResult[]>;
  executeBatch: (sqlStatements: string[]) => Promise<BatchQueryResult[]>;
  executeSQL: (sql: string) => Promise<any>;
  executeBatchSQL: (sqlStatements: string[] | string) => Promise<BatchQueryResult[]>;
  migrate: (
    name: string,
    tables: Array<TableDefinition<any>>,
    options?: { engine?: DatabaseEngine; existingCatalog?: any[] }
  ) => Promise<any>;
}

export interface DbInterface {
  (dbName: string): DbClient;
  generateId: () => string;
  id: () => string;
}

export const db: DbInterface = Object.assign(
  function (dbName: string): DbClient {
    const dbClient = function (tableName: string) {
      return new QueryBuilder(dbName, tableName);
    } as any;

    /**
     * Generates a sequential, lowercase, 26-character time-sortable database ID (monotonic ULID).
     */
    dbClient.generateId = generateId;
    dbClient.id = generateId;

    /**
     * Execute multiple QueryBuilder instances or raw SQL queries in a single atomic batch request
     */
    dbClient.batch = async function (
      queries: Array<QueryBuilder | string>
    ): Promise<BatchQueryResult[]> {
      if (!queries || queries.length === 0) return [];

      const statementsOrQueries = queries.map((q) => {
        if (typeof q === "string") return q;
        if (q instanceof QueryBuilder) {
          return q.toString();
        }
        return String(q);
      });

      const res = await makeRequest(HTTPMethod.POST, "/api/sql", undefined, {
        database: dbName,
        databaseId: dbName,
        batch: statementsOrQueries,
      });

      if (res && res.isBatch && Array.isArray(res.results)) {
        return res.results;
      }
      return [res];
    };

    /**
     * Execute multiple raw SQL statements in a batch and receive multiple distinct result sets
     */
    dbClient.executeBatch = async function (sqlStatements: string[]): Promise<BatchQueryResult[]> {
      const res = await makeRequest(HTTPMethod.POST, "/api/sql", undefined, {
        database: dbName,
        databaseId: dbName,
        batch: sqlStatements,
      });

      if (res && res.isBatch && Array.isArray(res.results)) {
        return res.results;
      }
      return [res];
    };

    /**
     * Execute a raw SQL query
     */
    dbClient.executeSQL = async function (sql: string): Promise<any> {
      return await makeRequest(HTTPMethod.POST, "/api/sql", undefined, {
        database: dbName,
        databaseId: dbName,
        sql,
      });
    };

    /**
     * Execute multiple raw SQL statements in a batch (alias for executeBatch)
     */
    dbClient.executeBatchSQL = async function (
      sqlStatements: string[] | string
    ): Promise<BatchQueryResult[]> {
      const payload =
        typeof sqlStatements === "string"
          ? { database: dbName, databaseId: dbName, sql: sqlStatements }
          : { database: dbName, databaseId: dbName, batch: sqlStatements };
      const res = await makeRequest(HTTPMethod.POST, "/api/sql", undefined, payload);
      if (res && res.isBatch && Array.isArray(res.results)) {
        return res.results;
      }
      return [res];
    };

    /**
     * Apply declarative schema migrations without writing raw SQL.
     */
    dbClient.migrate = async function (
      name: string,
      tables: Array<TableDefinition<any>>,
      options?: { engine?: DatabaseEngine; existingCatalog?: any[] }
    ) {
      const runner = new MigrationRunner(dbClient, options?.engine || "oltp");
      return await runner.migrate(name, tables, options?.existingCatalog || []);
    };

    return dbClient as DbClient;
  },
  {
    generateId,
    id: generateId,
  }
);

// Re-export query builder, sockets, schemas, and migrations
export { QueryBuilder } from "./builder/query-builder";
export { SQLCompiler } from "./builder/compiler";
export { DatabaseSocketManager } from "./socket";
export * from "./schema";
export * from "./migration";
export { generateId };
export type {
  QueryPayload,
  WhereCondition,
  JoinClause,
  JoinType,
  OrderByClause,
  AggregateClause,
  BatchQueryResult,
  CompiledSQL,
};
