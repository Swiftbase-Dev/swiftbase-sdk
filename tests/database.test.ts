import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import { db, QueryBuilder, DatabaseSocketManager } from "../src/database";
import * as makeRequestModule from "../src/common/makerequest";

vi.mock("../src/common/makerequest", () => ({
  makeRequest: vi.fn(),
  HTTPMethod: {
    GET: "get",
    POST: "post",
    PUT: "put",
    PATCH: "patch",
    DELETE: "delete",
  },
}));

describe("Database sub-module functions", () => {
  const originalWebSocket = (globalThis as any).WebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance or modify properties for clean tests
    const manager = DatabaseSocketManager.getInstance();
    (manager as any).socket = null;
    (manager as any).connectionPromise = null;
    (manager as any).pendingQueries.clear();
    (manager as any).activeSubscriptions.clear();
  });

  afterEach(() => {
    (globalThis as any).WebSocket = originalWebSocket;
  });

  test("db should return a QueryBuilder", () => {
    const builder = db("my_db")("my_table");
    expect(builder).toBeInstanceOf(QueryBuilder);
  });

  test("QueryBuilder should chain query parameters correctly", () => {
    const builder = db("my_db")("my_table")
      .select("col1", "col2")
      .select(["col3"])
      .where("col1", "val1")
      .where("col2", ">", 10)
      .where({ col3: "val3" })
      .limit(5)
      .offset(2);

    const payload = (builder as any).payload;
    expect(payload.database).toBe("my_db");
    expect(payload.table).toBe("my_table");
    expect(payload.select).toEqual(["col1", "col2", "col3"]);
    expect(payload.where).toEqual([
      { column: "col1", operator: "=", value: "val1" },
      { column: "col2", operator: ">", value: 10 },
      { column: "col3", operator: "=", value: "val3" },
    ]);
    expect(payload.limit).toBe(5);
    expect(payload.offset).toBe(2);
  });

  test("QueryBuilder should support insert, update, delete payloads", () => {
    const insertBuilder = db("my_db")("my_table").insert({ name: "test" });
    expect((insertBuilder as any).payload.insert).toEqual({ name: "test" });

    const updateBuilder = db("my_db")("my_table").update({ name: "updated" });
    expect((updateBuilder as any).payload.update).toEqual({ name: "updated" });

    const deleteBuilder = db("my_db")("my_table").delete();
    expect((deleteBuilder as any).payload.delete).toBe(true);
  });

  test("QueryBuilder.execute should fall back to REST makeRequest if WebSocket is not available", async () => {
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue({
      data: [{ id: 1 }],
      columns: ["id"],
      count: 1,
    });

    const res = await db("my_db")("my_table").select("id").execute();

    expect(makeRequestModule.makeRequest).toHaveBeenCalledWith(
      makeRequestModule.HTTPMethod.POST,
      "/api/db/query",
      undefined,
      expect.objectContaining({
        database: "my_db",
        table: "my_table",
        select: ["id"],
      })
    );
    expect(res).toEqual({
      data: [{ id: 1 }],
      columns: ["id"],
      count: 1,
    });
  });

  test("QueryBuilder should support then() / Promise-like execution", async () => {
    vi.mocked(makeRequestModule.makeRequest).mockResolvedValue({
      data: [{ id: 1 }],
    });

    const result = await db("my_db")("my_table").select("id");
    expect(result).toEqual({ data: [{ id: 1 }] });
  });

  test("DatabaseSocketManager should connect, execute queries and support subscription via mock WebSocket", async () => {
    let socketInstance: any = null;

    class MockWebSocket {
      url: string;
      onopen?: () => void;
      onclose?: () => void;
      onerror?: (err: any) => void;
      onmessage?: (event: any) => void;
      readyState = 0; // CONNECTING
      send = vi.fn();

      constructor(url: string) {
        this.url = url;
        socketInstance = this;
        setTimeout(() => {
          this.readyState = 1; // OPEN
          if (this.onopen) this.onopen();
        }, 0);
      }
    }

    (globalThis as any).WebSocket = MockWebSocket;

    const manager = DatabaseSocketManager.getInstance();

    // Trigger ensureConnected
    const connPromise = manager.ensureConnected();
    await connPromise;

    expect(manager.isWebSocketAvailable()).toBe(true);

    // Test executeQuery
    const queryPromise = manager.executeQuery({ database: "d", table: "t" });
    
    // Wait for the async execution of executeQuery
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(socketInstance.send).toHaveBeenCalled();
    const sentData = JSON.parse(socketInstance.send.mock.calls[0][0]);
    expect(sentData.action).toBe("query");

    socketInstance.onmessage({
      data: {
        toString: () => JSON.stringify({
          id: sentData.id,
          status: "success",
          data: { result: "ok" },
        }),
      },
    });

    const queryResult = await queryPromise;
    expect(queryResult).toEqual({ result: "ok" });

    // Test subscribe
    const mockCallback = vi.fn();
    const subscribePromise = manager.subscribe("d", "t", mockCallback);

    // Wait for the subscribe/listen message to be sent
    await new Promise((resolve) => setTimeout(resolve, 10));

    // The second call to send should be for "listen"
    const listenData = JSON.parse(socketInstance.send.mock.calls[1][0]);
    expect(listenData.action).toBe("listen");

    // Resolve the listen request
    socketInstance.onmessage({
      data: {
        toString: () => JSON.stringify({
          id: listenData.id,
          status: "success",
        }),
      },
    });

    const unsubscribe = await subscribePromise;

    // Simulate change message
    socketInstance.onmessage({
      data: {
        toString: () => JSON.stringify({
          action: "change",
          payload: {
            database: "d",
            table: "t",
            event: "insert",
            data: { id: "new" },
          },
        }),
      },
    });

    expect(mockCallback).toHaveBeenCalledWith({
      event: "insert",
      data: { id: "new" },
    });

    unsubscribe();
  });
});
