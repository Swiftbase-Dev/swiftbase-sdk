import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import { Storage } from "../src/storage/storage";
import { app } from "../src/common/app";

describe("Storage sub-module functions", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    app.baseUrl = "https://api.swiftbase.io";
    app.accessToken = {
      value: () => "mock-token",
      isValid: () => true,
      isAccessToken: () => true,
      isRefreshToken: () => false,
    } as any;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("Storage constructor should configure bucket and default endpoint", () => {
    const s = new Storage({ bucket: "my-bucket" });
    expect((s as any).bucket).toBe("my-bucket");
    expect((s as any).endpoint).toBe("https://storage.swiftbase.io");

    // test local endpoint
    app.baseUrl = "http://localhost:3000";
    const sLocal = new Storage({ bucket: "local-bucket" });
    expect((sLocal as any).endpoint).toBe("http://localhost:3006");
  });

  test("listBuckets should parse bucket list XML response", async () => {
    const mockXml = `
      <ListAllMyBucketsResult>
        <Buckets>
          <Bucket>
            <Name>bucket-one</Name>
            <CreationDate>2026-06-11T00:00:00.000Z</CreationDate>
          </Bucket>
          <Bucket>
            <Name>bucket-two</Name>
          </Bucket>
        </Buckets>
      </ListAllMyBucketsResult>
    `;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockXml,
    });
    global.fetch = mockFetch;

    const s = new Storage({ bucket: "test" });
    const buckets = await s.listBuckets();

    expect(mockFetch).toHaveBeenCalledWith("https://storage.swiftbase.io/", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({
        Authorization: "Bearer mock-token",
      }),
    }));

    expect(buckets).toEqual([
      { name: "bucket-one", creationDate: "2026-06-11T00:00:00.000Z" },
      { name: "bucket-two", creationDate: undefined },
    ]);
  });

  test("listBuckets should throw error with parseErrorXml if not ok", async () => {
    const mockErrorXml = `
      <Error>
        <Code>AccessDenied</Code>
        <Message>Access Denied message</Message>
      </Error>
    `;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Forbidden",
      text: async () => mockErrorXml,
    });
    global.fetch = mockFetch;

    const s = new Storage({ bucket: "test" });
    await expect(s.listBuckets()).rejects.toThrow("AccessDenied: Access Denied message");
  });

  test("listObjects should parse contents and prefixes XML response", async () => {
    const mockXml = `
      <ListBucketResult>
        <Name>test-bucket</Name>
        <Prefix>images/</Prefix>
        <MaxKeys>100</MaxKeys>
        <IsTruncated>true</IsTruncated>
        <Contents>
          <Key>images/pic.png</Key>
          <LastModified>2026-06-11</LastModified>
          <ETag>"abc"</ETag>
          <Size>1234</Size>
        </Contents>
        <CommonPrefixes>
          <Prefix>images/sub/</Prefix>
        </CommonPrefixes>
      </ListBucketResult>
    `;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockXml,
    });
    global.fetch = mockFetch;

    const s = new Storage({ bucket: "test-bucket" });
    const result = await s.listObjects({ prefix: "images/", delimiter: "/", maxKeys: 100 });

    expect(mockFetch).toHaveBeenCalledWith("https://storage.swiftbase.io/test-bucket?prefix=images%2F&delimiter=%2F&max-keys=100", expect.any(Object));
    expect(result).toEqual({
      name: "test-bucket",
      prefix: "images/",
      maxKeys: 100,
      isTruncated: true,
      contents: [{ key: "images/pic.png", lastModified: "2026-06-11", etag: "abc", size: 1234 }],
      commonPrefixes: ["images/sub/"],
    });
  });

  test("getObject, getObjectAsText, getObjectAsJson, getObjectAsArrayBuffer helpers", async () => {
    const mockResponseText = "hello world";
    const mockResponseJson = { hello: "world" };
    const mockResponseBuffer = new TextEncoder().encode("hello world").buffer;

    const mockResponseObj = {
      ok: true,
      text: async () => mockResponseText,
      json: async () => mockResponseJson,
      arrayBuffer: async () => mockResponseBuffer,
    };

    const mockFetch = vi.fn().mockResolvedValue(mockResponseObj);
    global.fetch = mockFetch;

    const s = new Storage({ bucket: "test" });
    const response = await s.getObject("file.txt");
    expect(response).toBe(mockResponseObj);
    expect(mockFetch).toHaveBeenCalledWith("https://storage.swiftbase.io/test/file.txt", expect.any(Object));

    const text = await s.getObjectAsText("file.txt");
    expect(text).toBe(mockResponseText);

    const json = await s.getObjectAsJson("file.json");
    expect(json).toEqual(mockResponseJson);

    const buffer = await s.getObjectAsArrayBuffer("file.bin");
    expect(buffer).toBe(mockResponseBuffer);
  });

  test("putObject should handle string, ArrayBuffer, Uint8Array and call fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const s = new Storage({ bucket: "test" });

    // String
    await s.putObject("test.txt", "my data", { contentType: "text/plain" });
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://storage.swiftbase.io/test/test.txt",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "Content-Type": "text/plain",
        }),
        body: new TextEncoder().encode("my data"),
      })
    );

    // ArrayBuffer
    const buffer = new TextEncoder().encode("buf").buffer;
    await s.putObject("test.bin", buffer);
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://storage.swiftbase.io/test/test.bin",
      expect.objectContaining({
        body: new Uint8Array(buffer),
      })
    );

    // Uint8Array
    const uint8 = new Uint8Array([1, 2, 3]);
    await s.putObject("test.bin2", uint8);
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://storage.swiftbase.io/test/test.bin2",
      expect.objectContaining({
        body: uint8,
      })
    );
  });

  test("deleteObject should call fetch with DELETE", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const s = new Storage({ bucket: "test" });
    await s.deleteObject("file.txt");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://storage.swiftbase.io/test/file.txt",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  test("Storage should signS3Request if credentials are provided in options", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const s = new Storage({
      bucket: "test",
      accessKeyId: "my-access-key-id",
      secretAccessKey: "my-secret-access-key",
      region: "us-east-1",
    });

    await s.deleteObject("file.txt");

    expect(mockFetch).toHaveBeenCalled();
    const lastCallHeaders = mockFetch.mock.calls[0][1].headers;
    expect(lastCallHeaders.Authorization).toContain("AWS4-HMAC-SHA256");
    expect(lastCallHeaders["x-amz-date"]).toBeDefined();
    expect(lastCallHeaders["x-amz-content-sha256"]).toBeDefined();
  });
});
