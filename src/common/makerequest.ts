import { app } from "./app";
import { getAccessToken } from "../auth/getaccesstoken";

export enum HTTPMethod {
  GET = "get",
  POST = "post",
  PUT = "put",
  PATCH = "patch",
  DELETE = "delete",
}

export class Unauthorized extends Error {
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, Unauthorized.prototype);
  }
}

export class Forbidden extends Error {
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, Forbidden.prototype);
  }
}

export class BadRequest extends Error {
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, BadRequest.prototype);
  }
}

export class TooManyRequests extends Error {
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, TooManyRequests.prototype);
  }
}

const handleRequestError = (status: number) => {
  if (status === 401) {
    throw new Unauthorized("Unauthorized");
  } else if (status === 403) {
    throw new Forbidden("Forbidden");
  } else if (status === 400) {
    throw new BadRequest("Bad Request");
  } else if (status === 429) {
    throw new TooManyRequests("Too Many Requests");
  } else {
    throw new Error("Unexpected error");
  }
};

interface RESTPaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    next: string | null;
    back: string | null;
  };
}

export class PaginatedResponse<T> {
  #data: T[] = [];
  #meta: RESTPaginatedResponse<T>["meta"];

  constructor(response: RESTPaginatedResponse<T>) {
    this.#data = response.data;
    this.#meta = response.meta;
  }

  get items() {
    return this.#data;
  }

  get total() {
    return this.#meta.total;
  }

  get page() {
    return this.#meta.page;
  }

  get limit() {
    return this.#meta.limit;
  }

  get hasNext() {
    return !!this.#meta.next;
  }

  get hasBack() {
    return !!this.#meta.back;
  }

  async next(): Promise<PaginatedResponse<T> | null> {
    if (!this.#meta.next) return null;
    return await makeRequest(HTTPMethod.GET, this.#meta.next);
  }

  async back(): Promise<PaginatedResponse<T> | null> {
    if (!this.#meta.back) return null;
    return await makeRequest(HTTPMethod.GET, this.#meta.back);
  }
}

export const makeRequest = async (
  method: HTTPMethod,
  path: string,
  params?: object | undefined,
  body?: object | undefined,
) => {
  // Get a valid access token (includes auto-refresh logic)
  const token = await getAccessToken();

  // Construct url
  let url = path.startsWith("http") ? path : `${app.baseUrl}${!path.startsWith("/") ? "/" : ""}${path}`;
  
  // Append query params if provided
  if (params) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.append(key, String(value));
    }
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      handleRequestError(response.status);
    }
    const data = await response.json();
    
    // Check if response is paginated (new REST format)
    if (data.data !== undefined && data.meta !== undefined) {
      return new PaginatedResponse(data);
    } else {
      return data;
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const sendFile = async (path: string, file: File) => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Invalid access token");
  }
  const url = `${app.baseUrl}${path}`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`
  };
  const formData = new FormData();
  formData.append("file", file);
  const options: RequestInit = {
    method: HTTPMethod.POST,
    headers,
    body: formData,
  };
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      handleRequestError(response.status);
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
};
