import { app, setAccessToken } from "../common/app";

/**
 * Login as a service using OAuth2 Client Credentials
 *
 * @param {string} serviceIdOrProjectId The service ID (or project ID if 3 args passed)
 * @param {string} serviceIdOrSecret The service secret key (or service ID if 3 args passed)
 * @param {string} [secretKey] The service secret key if 3 args passed
 *
 * @returns {Promise<any>} The login response
 */
export const loginService = async (
  serviceIdOrProjectId: string,
  serviceIdOrSecret: string,
  secretKey?: string
): Promise<any> => {
  const actualServiceId = secretKey ? serviceIdOrSecret : serviceIdOrProjectId;
  const actualSecretKey = secretKey ? secretKey : serviceIdOrSecret;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: actualServiceId,
    client_secret: actualSecretKey,
    scope: 'all'
  });

  const response = await fetch(`${app.baseUrl}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    throw new Error("Service login failed");
  }

  const data = await response.json();
  
  if (data.access_token) {
    setAccessToken(data.access_token);
  }
  
  return data;
};
