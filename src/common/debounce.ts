/**
 * Debounces a function that returns a Promise.
 * All overlapping calls that occur during the debounce period will be resolved or rejected
 * with the result of the final call that actually executes.
 *
 * @param {T} func The function to debounce
 * @param {number} wait The debounce timeout in milliseconds
 * @returns {(...args: Parameters<T>) => ReturnType<T>} The debounced function
 */
export function debounce<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number = 300,
): (...args: Parameters<T>) => ReturnType<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pendingPromises: { resolve: (value: any) => void; reject: (reason?: any) => void }[] = [];

  return (...args: Parameters<T>): ReturnType<T> => {
    if (timeout) {
      clearTimeout(timeout);
    }

    const promise = new Promise((resolve, reject) => {
      pendingPromises.push({ resolve, reject });
    }) as ReturnType<T>;

    timeout = setTimeout(async () => {
      const currentPromises = [...pendingPromises];
      pendingPromises = [];
      timeout = null;

      try {
        const result = await func(...args);
        currentPromises.forEach((p) => p.resolve(result));
      } catch (error) {
        currentPromises.forEach((p) => p.reject(error));
      }
    }, wait);

    return promise;
  };
}
