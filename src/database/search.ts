import { makeRequest, HTTPMethod } from "../common/makerequest";

export async function search(indexId: string, query: string): Promise<any[]> {
  if (!indexId || !query) {
    throw new Error("indexId and query are required to perform a search");
  }

  const result = await makeRequest(
    HTTPMethod.POST,
    "/api/search/query",
    undefined,
    { indexId, query }
  );

  return result || [];
}
