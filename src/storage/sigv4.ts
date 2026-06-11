// S3 Signature Version 4 helper using Web Crypto API (supported in browser and Node.js)

function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getCryptoObj(): Promise<Crypto> {
  if (typeof globalThis.crypto !== 'undefined') {
    return globalThis.crypto;
  }
  // Node.js fallback
  const cryptoModule = await import('crypto');
  return cryptoModule.webcrypto as unknown as Crypto;
}

async function sha256(data: string | Uint8Array): Promise<ArrayBuffer> {
  const cryptoObj = await getCryptoObj();
  const dataArr = typeof data === 'string' ? stringToUint8Array(data) : data;
  return await cryptoObj.subtle.digest('SHA-256', dataArr);
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string | Uint8Array): Promise<ArrayBuffer> {
  const cryptoObj = await getCryptoObj();
  const cryptoKey = await cryptoObj.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const dataArr = typeof data === 'string' ? stringToUint8Array(data) : data;
  return await cryptoObj.subtle.sign('HMAC', cryptoKey, dataArr);
}

async function getSigningKey(secretKey: string, date: string, region: string, service: string): Promise<Uint8Array> {
  const kDate = await hmac(stringToUint8Array('AWS4' + secretKey), date);
  const kRegion = await hmac(new Uint8Array(kDate), region);
  const kService = await hmac(new Uint8Array(kRegion), service);
  const kSigning = await hmac(new Uint8Array(kService), 'aws4_request');
  return new Uint8Array(kSigning);
}

export async function signS3Request(options: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string | Uint8Array;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}): Promise<Record<string, string>> {
  const { method, url, headers, body = '', accessKeyId, secretAccessKey, region } = options;

  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  
  // Format dates
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z'; // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.substring(0, 8); // YYYYMMDD

  // Prepare standard headers for signing
  const headersToSign: Record<string, string> = {};

  headersToSign['host'] = host;
  headersToSign['x-amz-date'] = amzDate;

  // Add payload hash header
  const payloadHash = bufferToHex(await sha256(body));
  headersToSign['x-amz-content-sha256'] = payloadHash;

  // Merge other custom headers (lowercased)
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== 'authorization' && lowerKey !== 'host' && lowerKey !== 'x-amz-date' && lowerKey !== 'x-amz-content-sha256') {
      headersToSign[lowerKey] = value.trim().replace(/\s+/g, ' ');
    }
  }

  // Sort headers for signing
  const sortedHeaderKeys = Object.keys(headersToSign).sort();
  let canonicalHeaders = '';
  for (const key of sortedHeaderKeys) {
    canonicalHeaders += `${key}:${headersToSign[key]}\n`;
  }
  const signedHeaders = sortedHeaderKeys.join(';');

  // Canonical Query String
  const queryParams: { key: string; value: string }[] = [];
  parsedUrl.searchParams.forEach((value, key) => {
    queryParams.push({ key, value });
  });
  queryParams.sort((a, b) => a.key.localeCompare(b.key));
  const rfc3986Encode = (str: string) => encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const canonicalQueryString = queryParams.map(p => `${rfc3986Encode(p.key)}=${rfc3986Encode(p.value)}`).join('&');

  // Canonical URI
  const canonicalUri = parsedUrl.pathname || '/';

  // Canonical Request
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const canonicalRequestHash = bufferToHex(await sha256(canonicalRequest));

  // String to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join('\n');

  // Derive signing key
  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, 's3');
  const signature = bufferToHex(await hmac(signingKey, stringToSign));

  // Build Authorization header
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Return new headers (keep capitalization of input headers except Host, x-amz-date, x-amz-content-sha256, Authorization)
  const resultHeaders = { ...headers };
  resultHeaders['Host'] = host;
  resultHeaders['x-amz-date'] = amzDate;
  resultHeaders['x-amz-content-sha256'] = payloadHash;
  resultHeaders['Authorization'] = authorizationHeader;

  return resultHeaders;
}
