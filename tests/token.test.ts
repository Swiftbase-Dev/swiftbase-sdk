import { expect, test, describe } from "vitest";
import Token from "../src/common/token";

describe("Token", () => {
  test("should be valid if expiration is in the future", () => {
    const expiration = Date.now() + 10000;
    const token = new Token("some-token", "access", expiration);
    expect(token.isValid()).toBe(true);
    expect(token.isAccessToken()).toBe(true);
    expect(token.isRefreshToken()).toBe(false);
    expect(token.value()).toBe("some-token");
  });

  test("should be invalid if expiration is in the past", () => {
    const expiration = Date.now() - 10000;
    const token = new Token("some-token", "access", expiration);
    expect(token.isValid()).toBe(false);
  });

  test("should correctly identify refresh tokens", () => {
    const expiration = Date.now() + 10000;
    const token = new Token("some-token", "refresh", expiration);
    expect(token.isAccessToken()).toBe(false);
    expect(token.isRefreshToken()).toBe(true);
  });
});
