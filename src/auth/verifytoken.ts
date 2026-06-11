import { makeRequest, HTTPMethod } from "../common/makerequest";
import { app } from "../common/app";
import { Profile } from "../profile/types";

/**
 * Verify a user token
 *
 * @param {string} token The token to verify
 * @param {string} projectId The project ID (optional, defaults to SDK initialized project)
 *
 * @returns {Promise<Profile>} The user profile if valid
 */
export const verifyToken = async (token: string, projectId?: string): Promise<Profile> => {
  // To verify a user token via REST, we call /api/me with the token in the header
  const url = `${app.baseUrl}/api/me`;
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Invalid token");
  }

  return await response.json();
};

/**
 * Verify a service token
 *
 * @param {string} token The token to verify
 * @param {string} projectId The project ID (optional, defaults to SDK initialized project)
 * @param {string} scope The scope to check (optional)
 *
 * @returns {Promise<any>} The service info if valid
 */
export const verifyServiceToken = async (token: string, projectId?: string, scope?: string): Promise<any> => {
  return await makeRequest(HTTPMethod.POST, "/api/verify-service-token", undefined, { 
    token, 
    scope 
  });
};
