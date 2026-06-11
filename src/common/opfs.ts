/**
 * Utility for Origin Private File System (OPFS) operations.
 */

/**
 * Check if the current environment supports OPFS.
 * @returns {boolean} True if OPFS is supported.
 */
export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== "undefined" && !!navigator.storage && !!navigator.storage.getDirectory
  );
}

/**
 * Get a cached article from OPFS.
 *
 * @param {string} id The article id
 * @returns {Promise<any | null>} The article object or null if not found
 */
export async function getCachedArticle(id: string): Promise<any | null> {
  if (!isOpfsSupported()) return null;

  try {
    const root = await navigator.storage.getDirectory();
    const articlesDir = await root.getDirectoryHandle("articles", { create: true });
    const fileHandle = await articlesDir.getFileHandle(`${id}.json`);
    const file = await fileHandle.getFile();
    const content = await file.text();
    return JSON.parse(content);
  } catch (e) {
    // File not found or other error
    return null;
  }
}

/**
 * Cache an article in OPFS.
 *
 * @param {string} id The article id
 * @param {any} article The article object to cache
 */
export async function cacheArticle(id: string, article: any): Promise<void> {
  if (!isOpfsSupported()) return;

  try {
    const root = await navigator.storage.getDirectory();
    const articlesDir = await root.getDirectoryHandle("articles", { create: true });
    const fileHandle = await articlesDir.getFileHandle(`${id}.json`, { create: true });

    // Use the sync access handle if available or the writable stream
    // For simplicity and common compatibility in workers/main thread, we use createWritable
    // @ts-ignore - createWritable might not be in the standard TS types yet
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(article));
    await writable.close();
  } catch (e) {
    console.error("Failed to cache article in OPFS", e);
  }
}
