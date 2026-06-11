import { app, setAccessToken } from "../common/app";

/**
 * Login as a service
 *
 * @param {string} projectId The project ID
 * @param {string} serviceId The service ID
 * @param {string} secretKey The service secret key
 *
 * @returns {Promise<any>} The login response
 */
export const loginService = async (projectId: string, serviceId: string, secretKey: string): Promise<any> => {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: serviceId,
    client_secret: secretKey,
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
