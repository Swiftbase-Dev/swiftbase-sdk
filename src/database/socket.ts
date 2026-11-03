/**
 * Swiftbase SDK Database WebSocket Manager
 *
 * Handles persistent realtime WebSocket connections, automatic reconnection,
 * query execution, and realtime table change subscriptions.
 */

import { app } from "../common/app";
import { getAccessToken } from "../auth";
import { generateId } from "../common/id";
import { QueryPayload } from "./types";

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
    const id = generateId();
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
    const id = generateId();
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
