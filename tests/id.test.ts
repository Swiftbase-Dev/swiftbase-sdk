import { describe, it, expect } from "vitest";
import { generateId, db } from "../src/index";

describe("Database ID Generator (SDK)", () => {
  it("should generate a 26-character lowercase string via top-level generateId", () => {
    const id = generateId();
    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9a-z]{26}$/);
    expect(id).toBe(id.toLowerCase());
  });

  it("should generate IDs via db.generateId() and db.id() helpers", () => {
    const id1 = db.generateId();
    const id2 = db.id();
    expect(id1).toHaveLength(26);
    expect(id2).toHaveLength(26);
    expect(id1).toMatch(/^[0-9a-z]{26}$/);
    expect(id2).toMatch(/^[0-9a-z]{26}$/);
  });

  it("should generate IDs via db instance and table QueryBuilder helpers", () => {
    const myDb = db("my_database");
    const idFromDb = myDb.generateId();
    const idAliasFromDb = myDb.id();
    expect(idFromDb).toHaveLength(26);
    expect(idAliasFromDb).toHaveLength(26);

    const tableQuery = myDb("users");
    const idFromTable = tableQuery.generateId();
    const idAliasFromTable = tableQuery.id();
    expect(idFromTable).toHaveLength(26);
    expect(idAliasFromTable).toHaveLength(26);
  });

  it("should generate strictly sequential monotonic IDs", () => {
    const count = 500;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(db.generateId());
    }

    const unique = new Set(ids);
    expect(unique.size).toBe(count);

    for (let i = 1; i < count; i++) {
      expect(ids[i] > ids[i - 1]).toBe(true);
    }
  });
});
