import { monotonicFactory } from "ulid";

const monotonicUlid = monotonicFactory();

/**
 * Generates a sequential, lowercase, 26-character time-sortable database ID (monotonic ULID).
 * 
 * Features:
 * - Sequential / Time-Sortable: Preserves B-Tree index locality in OLTP (libSQL/SQLite)
 *   and chronological row-group ordering in OLAP (DuckDB/Parquet).
 * - Monotonicity: Guarantees strict lexicographical ordering (`id_a < id_b`) even when
 *   multiple IDs are generated within the exact same millisecond.
 * - Minimal Byte Footprint: Encoded as a compact 26-character Base32 string (only 26 bytes,
 *   saving 10 bytes per ID compared to 36-byte UUID strings).
 * - Lowercase: Uses Crockford's Base32 alphabet rendered strictly in lowercase
 *   (`0-9`, `a-z` excluding ambiguous characters `i`, `l`, `o`, `u`).
 * 
 * @returns A 26-character sequential lowercase database ID.
 */
export function generateId(): string {
  return monotonicUlid().toLowerCase();
}

export default generateId;
