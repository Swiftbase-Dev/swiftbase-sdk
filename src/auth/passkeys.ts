import { app, setAccessToken } from "../common/app";
import { makeRequest, HTTPMethod } from "../common/makerequest";
import type { Profile } from "../profile/types";
import type { PasskeyCredential, PasskeyRegistrationOptions, PasskeyLoginOptions } from "./types";

/**
 * Passkeys (WebAuthn)
 *
 * Two ceremony modes are supported:
 *  - embedded (default): the WebAuthn prompt runs on the page that calls the SDK. The passkey is bound to
 *    that page's hostname (RP ID), so the page's origin must be one of the project's allowed origins
 *    (its redirect URIs / domain). Use this when you build your own login UI.
 *  - hosted: the ceremony runs on the Swiftbase universal login page (RP ID identity.swiftbase.io).
 *    Sign in with `loginWithRedirect()` (the login page offers "Sign in with Passkey"); enroll with
 *    `registerPasskey({ hosted: true })`, which opens the login page in a popup.
 *
 * A passkey only works for the RP ID it was created for, so `PasskeyCredential.rpId` is exposed.
 */

const b64urlToBytes = (value: string): ArrayBuffer => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const bytesToB64url = (buffer: ArrayBuffer | null | undefined): string | undefined => {
  if (!buffer) return undefined;
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Whether the current environment can run a WebAuthn ceremony. */
export const isPasskeySupported = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.PublicKeyCredential !== "undefined" &&
  typeof navigator !== "undefined" &&
  !!navigator.credentials;

const assertSupported = () => {
  if (!isPasskeySupported()) {
    throw new Error("Passkeys are not supported in this environment");
  }
};

const toCreationOptions = (json: any): PublicKeyCredentialCreationOptions => ({
  ...json,
  challenge: b64urlToBytes(json.challenge),
  user: { ...json.user, id: b64urlToBytes(json.user.id) },
  excludeCredentials: (json.excludeCredentials || []).map((c: any) => ({ ...c, id: b64urlToBytes(c.id) })),
});

const toRequestOptions = (json: any): PublicKeyCredentialRequestOptions => ({
  ...json,
  challenge: b64urlToBytes(json.challenge),
  allowCredentials: (json.allowCredentials || []).map((c: any) => ({ ...c, id: b64urlToBytes(c.id) })),
});

const serializeRegistration = (credential: PublicKeyCredential) => {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bytesToB64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: (credential as any).authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: bytesToB64url(response.clientDataJSON),
      attestationObject: bytesToB64url(response.attestationObject),
      transports: typeof response.getTransports === "function" ? response.getTransports() : [],
    },
  };
};

const serializeAuthentication = (credential: PublicKeyCredential) => {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bytesToB64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: (credential as any).authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: bytesToB64url(response.clientDataJSON),
      authenticatorData: bytesToB64url(response.authenticatorData),
      signature: bytesToB64url(response.signature),
      userHandle: bytesToB64url(response.userHandle),
    },
  };
};

const HOSTED_MESSAGE_SUCCESS = "swiftbase:passkey-registered";
const HOSTED_MESSAGE_ERROR = "swiftbase:passkey-error";

const registerHosted = (name?: string): Promise<PasskeyCredential> => {
  const token = app.accessToken?.value();
  if (!token) throw new Error("You must be signed in to register a passkey");
  if (typeof window === "undefined") throw new Error("Hosted passkey registration requires a browser");

  const authWebUrl = new URL(app.authWebUrl);
  const url = new URL("/passkeys/register", authWebUrl);
  url.searchParams.set("projectId", app.projectId);
  url.searchParams.set("origin", window.location.origin);
  if (name) url.searchParams.set("name", name);
  // The access token travels in the URL fragment so it is never sent to a server or logged in access logs.
  url.hash = `token=${encodeURIComponent(token)}`;

  const popup = window.open(url.toString(), "swiftbase-passkey", "popup,width=480,height=640");
  if (!popup) throw new Error("Unable to open the passkey registration window (popup blocked?)");

  return new Promise<PasskeyCredential>((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(closedPoll);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== authWebUrl.origin) return;
      if (event.data?.type === HOSTED_MESSAGE_SUCCESS) {
        cleanup();
        resolve(event.data.passkey as PasskeyCredential);
      } else if (event.data?.type === HOSTED_MESSAGE_ERROR) {
        cleanup();
        reject(new Error(event.data.message || "Passkey registration failed"));
      }
    };
    const closedPoll = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Passkey registration was cancelled"));
      }
    }, 500);
    window.addEventListener("message", onMessage);
  });
};

/**
 * Register a passkey for the signed-in user.
 *
 * @param {PasskeyRegistrationOptions} options `name` labels the passkey; `hosted` runs the ceremony on the universal login page
 * @returns {Promise<PasskeyCredential>} The registered passkey
 */
export const registerPasskey = async (options: PasskeyRegistrationOptions = {}): Promise<PasskeyCredential> => {
  if (options.hosted) {
    return registerHosted(options.name);
  }

  assertSupported();
  const { challengeId, options: creationOptions } = await makeRequest(
    HTTPMethod.POST,
    "/api/passkeys/register/options",
    undefined,
    { projectId: app.projectId },
  );

  const credential = (await navigator.credentials.create({
    publicKey: toCreationOptions(creationOptions),
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Passkey registration was cancelled");

  return await makeRequest(HTTPMethod.POST, "/api/passkeys/register/verify", undefined, {
    challengeId,
    name: options.name,
    response: serializeRegistration(credential),
  });
};

/**
 * Sign in with a passkey using the embedded ceremony on the current page.
 * For the hosted flow use `loginWithRedirect()` instead.
 *
 * @param {PasskeyLoginOptions} options Optional `email` hint to narrow the credentials offered
 * @returns {Promise<Profile>} The user profile
 */
export const loginWithPasskey = async (options: PasskeyLoginOptions = {}): Promise<Profile> => {
  assertSupported();
  const { challengeId, options: requestOptions } = await makeRequest(
    HTTPMethod.POST,
    "/api/passkeys/authenticate/options",
    undefined,
    { projectId: app.projectId, email: options.email },
  );

  const credential = (await navigator.credentials.get({
    publicKey: toRequestOptions(requestOptions),
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Passkey sign-in was cancelled");

  const data = await makeRequest(HTTPMethod.POST, "/api/passkeys/authenticate/verify", undefined, {
    challengeId,
    response: serializeAuthentication(credential),
  });

  const { token, user } = data;
  setAccessToken(token);
  return user as Profile;
};

/** List the signed-in user's passkeys for this project. */
export const listPasskeys = async (): Promise<PasskeyCredential[]> => {
  return await makeRequest(HTTPMethod.GET, "/api/passkeys");
};

/** Remove one of the signed-in user's passkeys. */
export const deletePasskey = async (id: string): Promise<void> => {
  await makeRequest(HTTPMethod.DELETE, `/api/passkeys/${encodeURIComponent(id)}`);
};
