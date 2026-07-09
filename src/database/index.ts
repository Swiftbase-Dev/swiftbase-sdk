import { app } from "../common/app";
import { getAccessToken } from "../auth";
import { makeRequest, HTTPMethod } from "../common/makerequest";
import { v4 as uuidv4 } from "uuid";

export interface QueryPayload {
  database: string;
  table: string;
  select?: string[];
  where?: Array<{ column: string; operator: string; value: any }>;
  limit?: number;
  offset?: number;
  insert?: any;
  update?: any;
  delete?: boolean;
}

export class DatabaseSocketManager {
  private static instance: DatabaseSocketManager | null = null;
  private socket: any = null;
  private connectionPromise: Promise<void> | null = null;
  private pendingQueries = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private activeSubscriptions = new Map<string, Set<(change: any) => void>>();

  private constructor() {}

  public static getInstance(): DatabaseSocketManager {
    if (!DatabaseSocketManager.instance) {
      DatabaseSocketManager.instance = new DatabaseSocketManager();
    }
    return DatabaseSocketManager.instance;
  }

  public isWebSocketAvailable(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    return this.socket !== null && this.socket.readyState === 1;
  }

  private getWebSocketUrl(baseUrl: string, token: string | null): string {
    let wsUrl = baseUrl.replace(/^http/, "ws");
    wsUrl = wsUrl.endsWith("/") ? wsUrl.slice(0, -1) : wsUrl;
    wsUrl = `${wsUrl}/ws`;
    if (token) {
      wsUrl = `${wsUrl}?token=${encodeURIComponent(token)}`;
    }
    return wsUrl;
  }

  public async ensureConnected(): Promise<void> {
    if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      const token = await getAccessToken();
      const wsUrl = this.getWebSocketUrl(app.baseUrl, token);

      let WS = typeof WebSocket !== "undefined" ? WebSocket : (globalThis as any).WebSocket;
      if (!WS) {
        try {
          // @ts-ignore
          const wsModule = await import("ws");
          WS = wsModule.default || wsModule;
        } catch (err) {
          this.connectionPromise = null;
          throw new Error(
            "WebSocket constructor not found. Please install the 'ws' package or run in an environment with global WebSocket support."
          );
        }
      }

      return new Promise<void>((resolve, reject) => {
        try {
          const socket = new WS(wsUrl);
          this.socket = socket;

          socket.onopen = () => {
            this.connectionPromise = null;
            resolve();
            this.resubscribeAll().catch((err) => {
              console.error("[DatabaseSocketManager] Re-subscription failed:", err);
            });
          };

          socket.onerror = (err: any) => {
            this.connectionPromise = null;
            reject(err);
          };

          socket.onclose = () => {
            this.socket = null;
            this.connectionPromise = null;
            for (const [_, { reject: rejectQuery }] of this.pendingQueries.entries()) {
              rejectQuery(new Error("WebSocket disconnected"));
            }
            this.pendingQueries.clear();
          };

          socket.onmessage = (event: any) => {
            this.handleMessage(event);
          };
        } catch (err) {
          this.connectionPromise = null;
          reject(err);
        }
      });
    })();

    return this.connectionPromise;
  }

  private async resubscribeAll(): Promise<void> {
    for (const key of this.activeSubscriptions.keys()) {
      const [database, table] = key.split(":");
      await this.sendListenRequest(database, table);
    }
  }

  private async sendListenRequest(database: string, table: string): Promise<void> {
    if (!this.socket || this.socket.readyState !== 1) {
      throw new Error("WebSocket not open");
    }
    const id = uuidv4();
    this.socket.send(JSON.stringify({
      id,
      action: "listen",
      payload: { database, table }
    }));

    return new Promise<void>((resolve, reject) => {
      this.pendingQueries.set(id, { resolve: () => resolve(), reject });
    });
  }

  private handleMessage(event: any): void {
    try {
      const msg = JSON.parse(event.data.toString());
      if (msg.action === "change") {
        const { database, table, event: changeEvent, data } = msg.payload;
        const key = `${database}:${table}`;
        const callbacks = this.activeSubscriptions.get(key);
        if (callbacks) {
          for (const cb of callbacks) {
            try {
              cb({ event: changeEvent, data });
            } catch (err) {
              console.error("[DatabaseSocketManager] Callback error:", err);
            }
          }
        }
      } else if (msg.id && this.pendingQueries.has(msg.id)) {
        const { resolve, reject } = this.pendingQueries.get(msg.id)!;
        this.pendingQueries.delete(msg.id);
        if (msg.status === "success") {
          resolve(msg.data);
        } else {
          reject(new Error(msg.message || "Query failed over WebSocket"));
        }
      }
    } catch (err) {
      console.error("[DatabaseSocketManager] Message handling error:", err);
    }
  }

  public async executeQuery(payload: QueryPayload): Promise<any> {
    await this.ensureConnected();
    const id = uuidv4();
    this.socket.send(JSON.stringify({
      id,
      action: "query",
      payload
    }));

    return new Promise((resolve, reject) => {
      this.pendingQueries.set(id, { resolve, reject });
    });
  }

  public async subscribe(
    database: string,
    table: string,
    callback: (change: any) => void
  ): Promise<() => void> {
    const key = `${database}:${table}`;
    let cbs = this.activeSubscriptions.get(key);
    const isNewTable = !cbs || cbs.size === 0;
    if (!cbs) {
      cbs = new Set();
      this.activeSubscriptions.set(key, cbs);
    }
    cbs.add(callback);

    await this.ensureConnected();

    if (isNewTable) {
      try {
        await this.sendListenRequest(database, table);
      } catch (err) {
        cbs.delete(callback);
        if (cbs.size === 0) {
          this.activeSubscriptions.delete(key);
        }
        throw err;
      }
    }

    return () => {
      const currentCbs = this.activeSubscriptions.get(key);
      if (currentCbs) {
        currentCbs.delete(callback);
        if (currentCbs.size === 0) {
          this.activeSubscriptions.delete(key);
        }
      }
    };
  }
}

export class QueryBuilder implements PromiseLike<any> {
  private dbName: string;
  private tableName: string;
  private payload: QueryPayload;

  constructor(dbName: string, tableName: string) {
    this.dbName = dbName;
    this.tableName = tableName;
    this.payload = {
      database: dbName,
      table: tableName
    };
  }

  select(...columns: Array<string | string[]>): this {
    const flatColumns = columns.flat();
    if (flatColumns.length > 0) {
      if (!this.payload.select) {
        this.payload.select = [];
      }
      this.payload.select.push(...flatColumns);
    }
    return this;
  }

  where(column: string, value: any): this;
  where(column: string, operator: string, value: any): this;
  where(obj: Record<string, any>): this;
  where(columnOrObj: string | Record<string, any>, operatorOrValue?: any, value?: any): this {
    if (!this.payload.where) {
      this.payload.where = [];
    }

    if (typeof columnOrObj === "string") {
      if (value !== undefined) {
        this.payload.where.push({
          column: columnOrObj,
          operator: operatorOrValue,
          value: value
        });
      } else if (operatorOrValue !== undefined) {
        this.payload.where.push({
          column: columnOrObj,
          operator: "=",
          value: operatorOrValue
        });
      }
    } else if (columnOrObj && typeof columnOrObj === "object") {
      for (const [k, v] of Object.entries(columnOrObj)) {
        this.payload.where.push({
          column: k,
          operator: "=",
          value: v
        });
      }
    }
    return this;
  }

  limit(value: number): this {
    this.payload.limit = value;
    return this;
  }

  offset(value: number): this {
    this.payload.offset = value;
    return this;
  }

  insert(data: any): this {
    this.payload.insert = data;
    return this;
  }

  update(data: any): this {
    this.payload.update = data;
    return this;
  }

  delete(): this {
    this.payload.delete = true;
    return this;
  }

  listen(callback: (change: { event: 'insert' | 'update' | 'delete'; data: any }) => void): () => void {
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

  async execute(): Promise<{ data: any[]; columns: string[]; count: number }> {
    const socketManager = DatabaseSocketManager.getInstance();

    if (socketManager.isWebSocketAvailable()) {
      try {
        return await socketManager.executeQuery(this.payload);
      } catch (err) {
        console.warn("[QueryBuilder] WebSocket execution failed, falling back to REST:", err);
      }
    } else if (typeof window !== "undefined") {
      // Connect in the background asynchronously so we don't delay the page load (browser only)
      socketManager.ensureConnected().catch((err) => {
        console.warn("[QueryBuilder] Background WebSocket connection failed:", err);
      });
    }

    return await makeRequest(HTTPMethod.POST, "/api/db/query", undefined, this.payload);
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export function db(dbName: string) {
  return function (tableName: string) {
    return new QueryBuilder(dbName, tableName);
  };
}
