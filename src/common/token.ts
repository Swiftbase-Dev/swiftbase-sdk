export default class Token {
  #token: string;
  #type: string;
  #expiration: number;

  constructor(token: string, type: string, expiration?: number) {
    this.#token = token;
    this.#type = type;
    if (expiration) {
      this.#expiration = expiration;
    } else {
      this.#expiration = this.decodeExpiration(token);
    }
  }

  private decodeExpiration(token: string): number {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp * 1000;
    } catch (e) {
      // If decoding fails, the token is invalid
      return 0;
    }
  }

  /**
   * Getter for the raw token
   *
   * @returns {string} The token
   */
  value() {
    return this.#token;
  }

  /**
   * Checks if the token is valid
   *
   * @returns {boolean} True if the API key is valid, false otherwise
   */
  isValid() {
    return this.#expiration > Date.now();
  }

  /**
   * Checks if the API key is a secret key
   *
   * @returns {boolean} True if the API key is a secret key, false otherwise
   */
  isAccessToken() {
    return this.#type === "access";
  }

  /**
   * Checks if the API key is a public key
   *
   * @returns {boolean} True if the API key is a public key, false otherwise
   */
  isRefreshToken() {
    return this.#type === "refresh";
  }
}
