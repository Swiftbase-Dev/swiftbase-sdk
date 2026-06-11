/**
 * A simple LRU (Least Recently Used) cache that persists to sessionStorage.
 */
export class LRUCache<T> {
  private capacity: number;
  private cache: Map<string, T>;
  private storageKey: string;

  /**
   * @param {number} capacity Maximum number of items to keep in the cache
   * @param {string} storageKey The key to use for sessionStorage persistence
   */
  constructor(capacity: number, storageKey: string) {
    this.capacity = capacity;
    this.storageKey = storageKey;
    this.cache = new Map<string, T>();
    this.loadFromStorage();
  }

  /**
   * Load the cache from sessionStorage
   */
  private loadFromStorage() {
    if (typeof sessionStorage === "undefined") return;
    const stored = sessionStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const entries = JSON.parse(stored);
        this.cache = new Map(entries);
      } catch (e) {
        console.error(`Failed to parse LRU cache [${this.storageKey}] from sessionStorage`, e);
      }
    }
  }

  /**
   * Save the cache to sessionStorage
   */
  private saveToStorage() {
    if (typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(Array.from(this.cache.entries())));
    } catch (e) {
      console.warn(
        `Failed to save LRU cache [${this.storageKey}] to sessionStorage (likely quota exceeded)`,
      );
    }
  }

  /**
   * Get an item from the cache
   *
   * @param {string} key The key to look up
   * @returns {T | undefined} The item if found, otherwise undefined
   */
  get(key: string): T | undefined {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    this.saveToStorage();
    return value;
  }

  /**
   * Set an item in the cache
   *
   * @param {string} key The key to set
   * @param {T} value The value to set
   */
  set(key: string, value: T) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove oldest (first) item
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, value);
    this.saveToStorage();
  }

  /**
   * Clear the cache
   */
  clear() {
    this.cache.clear();
    this.saveToStorage();
  }
}
