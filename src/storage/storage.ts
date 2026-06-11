import { app } from "../common/app";
import { getAccessToken } from "../auth/getaccesstoken";
import { signS3Request } from "./sigv4";

export interface StorageOptions {
  bucket: string;
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface BucketInfo {
  name: string;
  creationDate?: string;
}

export interface S3Object {
  key: string;
  lastModified?: string;
  etag?: string;
  size: number;
}

export interface ListObjectsResult {
  name: string;
  prefix: string;
  maxKeys: number;
  isTruncated: boolean;
  contents: S3Object[];
  commonPrefixes: string[];
}

function getDefaultEndpoint(): string {
  const base = app.baseUrl || "https://api.swiftbase.io";
  if (base.includes("localhost") || base.includes("127.0.0.1")) {
    return "http://localhost:3006";
  }
  return base.replace("api.swiftbase", "storage.swiftbase");
}

function parseListBuckets(xml: string): BucketInfo[] {
  const buckets: BucketInfo[] = [];
  const bucketMatches = xml.matchAll(/<Bucket>([\s\S]*?)<\/Bucket>/g);
  for (const match of bucketMatches) {
    const bucketContent = match[1];
    const nameMatch = bucketContent.match(/<Name>(.*?)<\/Name>/);
    const dateMatch = bucketContent.match(/<CreationDate>(.*?)<\/CreationDate>/);
    if (nameMatch) {
      buckets.push({
        name: nameMatch[1],
        creationDate: dateMatch ? dateMatch[1] : undefined
      });
    }
  }
  return buckets;
}

function parseListObjects(xml: string): ListObjectsResult {
  const nameMatch = xml.match(/<Name>(.*?)<\/Name>/);
  const prefixMatch = xml.match(/<Prefix>(.*?)<\/Prefix>/);
  const maxKeysMatch = xml.match(/<MaxKeys>(.*?)<\/MaxKeys>/);
  const isTruncatedMatch = xml.match(/<IsTruncated>(.*?)<\/IsTruncated>/);

  const contents: S3Object[] = [];
  const contentMatches = xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g);
  for (const match of contentMatches) {
    const content = match[1];
    const keyMatch = content.match(/<Key>(.*?)<\/Key>/);
    const lmMatch = content.match(/<LastModified>(.*?)<\/LastModified>/);
    const etagMatch = content.match(/<ETag>(.*?)<\/ETag>/);
    const sizeMatch = content.match(/<Size>(.*?)<\/Size>/);

    if (keyMatch) {
      contents.push({
        key: keyMatch[1],
        lastModified: lmMatch ? lmMatch[1] : undefined,
        etag: etagMatch ? etagMatch[1].replace(/"/g, '') : undefined,
        size: sizeMatch ? parseInt(sizeMatch[1]) : 0
      });
    }
  }

  const commonPrefixes: string[] = [];
  const cpMatches = xml.matchAll(/<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g);
  for (const match of cpMatches) {
    const prefixMatch = match[1].match(/<Prefix>(.*?)<\/Prefix>/);
    if (prefixMatch) {
      commonPrefixes.push(prefixMatch[1]);
    }
  }

  return {
    name: nameMatch ? nameMatch[1] : '',
    prefix: prefixMatch ? prefixMatch[1] : '',
    maxKeys: maxKeysMatch ? parseInt(maxKeysMatch[1]) : 1000,
    isTruncated: isTruncatedMatch ? isTruncatedMatch[1] === 'true' : false,
    contents,
    commonPrefixes
  };
}

function parseErrorXml(xml: string): string {
  const codeMatch = xml.match(/<Code>(.*?)<\/Code>/);
  const messageMatch = xml.match(/<Message>(.*?)<\/Message>/);
  if (codeMatch && messageMatch) {
    return `${codeMatch[1]}: ${messageMatch[1]}`;
  }
  return xml;
}

export class Storage {
  private bucket: string;
  private endpoint: string;
  private region: string;
  private accessKeyId?: string;
  private secretAccessKey?: string;

  constructor(options: StorageOptions) {
    this.bucket = options.bucket;
    this.endpoint = options.endpoint || getDefaultEndpoint();
    this.region = options.region || "us-east-1";
    this.accessKeyId = options.accessKeyId;
    this.secretAccessKey = options.secretAccessKey;
  }

  private async getHeaders(
    method: string, 
    url: string, 
    body?: string | Uint8Array, 
    customHeaders: Record<string, string> = {}
  ): Promise<Record<string, string>> {
    let headers: Record<string, string> = { ...customHeaders };

    if (this.accessKeyId && this.secretAccessKey) {
      headers = await signS3Request({
        method,
        url,
        headers,
        body,
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        region: this.region
      });
    } else {
      const token = await getAccessToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  async listBuckets(): Promise<BucketInfo[]> {
    const method = "GET";
    const url = `${this.endpoint.replace(/\/$/, "")}/`;

    const headers = await this.getHeaders(method, url);
    const response = await fetch(url, { method, headers });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(parseErrorXml(text) || `Failed to list buckets: ${response.statusText}`);
    }
    return parseListBuckets(text);
  }

  async listObjects(options?: { prefix?: string; delimiter?: string; maxKeys?: number }): Promise<ListObjectsResult> {
    const method = "GET";
    const query = new URLSearchParams();
    if (options?.prefix) query.append("prefix", options.prefix);
    if (options?.delimiter) query.append("delimiter", options.delimiter);
    if (options?.maxKeys) query.append("max-keys", String(options.maxKeys));

    const queryString = query.toString();
    const url = `${this.endpoint.replace(/\/$/, "")}/${this.bucket}${queryString ? "?" + queryString : ""}`;

    const headers = await this.getHeaders(method, url);
    const response = await fetch(url, { method, headers });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(parseErrorXml(text) || `Failed to list objects: ${response.statusText}`);
    }
    return parseListObjects(text);
  }

  async getObject(key: string): Promise<Response> {
    const method = "GET";
    const cleanKey = key.startsWith("/") ? key : "/" + key;
    const url = `${this.endpoint.replace(/\/$/, "")}/${this.bucket}${cleanKey}`;

    const headers = await this.getHeaders(method, url);
    const response = await fetch(url, { method, headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseErrorXml(text) || `Failed to get object: ${response.statusText}`);
    }
    return response;
  }

  async getObjectAsText(key: string): Promise<string> {
    const res = await this.getObject(key);
    return await res.text();
  }

  async getObjectAsJson<T = any>(key: string): Promise<T> {
    const res = await this.getObject(key);
    return await res.json();
  }

  async getObjectAsArrayBuffer(key: string): Promise<ArrayBuffer> {
    const res = await this.getObject(key);
    return await res.arrayBuffer();
  }

  async putObject(
    key: string, 
    body: Uint8Array | ArrayBuffer | string | Blob, 
    options?: { contentType?: string }
  ): Promise<void> {
    const method = "PUT";
    const cleanKey = key.startsWith("/") ? key : "/" + key;
    const url = `${this.endpoint.replace(/\/$/, "")}/${this.bucket}${cleanKey}`;

    let bodyData: Uint8Array;
    if (typeof body === "string") {
      bodyData = new TextEncoder().encode(body);
    } else if (body instanceof ArrayBuffer) {
      bodyData = new Uint8Array(body);
    } else if (body instanceof Uint8Array) {
      bodyData = body;
    } else if (typeof Blob !== "undefined" && body instanceof Blob) {
      bodyData = new Uint8Array(await body.arrayBuffer());
    } else {
      throw new Error("Unsupported body type. Must be string, ArrayBuffer, Uint8Array, or Blob.");
    }

    const customHeaders: Record<string, string> = {};
    if (options?.contentType) {
      customHeaders["Content-Type"] = options.contentType;
    }

    const headers = await this.getHeaders(method, url, bodyData, customHeaders);
    const response = await fetch(url, {
      method,
      headers,
      body: bodyData
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseErrorXml(text) || `Failed to put object: ${response.statusText}`);
    }
  }

  async deleteObject(key: string): Promise<void> {
    const method = "DELETE";
    const cleanKey = key.startsWith("/") ? key : "/" + key;
    const url = `${this.endpoint.replace(/\/$/, "")}/${this.bucket}${cleanKey}`;

    const headers = await this.getHeaders(method, url);
    const response = await fetch(url, { method, headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseErrorXml(text) || `Failed to delete object: ${response.statusText}`);
    }
  }
}
