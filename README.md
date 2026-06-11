# Swiftbase TypeScript SDK

A robust, type-safe TypeScript SDK for integrating customer applications with the Swiftbase platform. Supports SDK initialization, authentication, user profiles, identity management, database queries (with real-time WebSocket subscriptions), and S3-compatible cloud storage.

## Installation

Install the package via npm:

```bash
npm install swiftbase-sdk
```

---

## Getting Started

### Initialize the SDK

Initialize the SDK at the entry point of your application:

```typescript
import { initializeSdk } from "swiftbase-sdk";

initializeSdk("your-project-id");
```

---

## Authentication

The SDK provides several authentication mechanisms, including credentials, redirect-based OAuth2/OIDC, and service logins.

### User Login (Email / Password)

```typescript
import { loginWithPassword } from "swiftbase-sdk";

const userProfile = await loginWithPassword({
  projectId: "your-project-id",
  email: "user@example.com",
  password: "password123",
});
console.log(`Welcome back, ${userProfile.firstName}!`);
```

### Password-less / Redirect OIDC Login (Browser Environment)

```typescript
import { loginWithRedirect, handleRedirectCallback } from "swiftbase-sdk";

// Trigger OIDC redirect flow
await loginWithRedirect({
  redirectUri: window.location.origin + "/callback",
  state: "secure-random-state",
});

// On the callback route:
const profile = await handleRedirectCallback();
```

### Service Login (Client Credentials)

```typescript
import { loginService } from "swiftbase-sdk";

const tokenResponse = await loginService(
  "your-project-id",
  "your-service-id",
  "your-service-secret",
);
```

### Manage Session

```typescript
import { isLoggedIn, logout, getAccessToken } from "swiftbase-sdk";

if (isLoggedIn()) {
  const token = await getAccessToken();
  console.log("Logged in token:", token);
}

await logout();
```

---

## User Profiles

Retrieve and manage user profile details:

```typescript
import { getProfile, updateProfile, changePassword } from "swiftbase-sdk";

// Get current profile
const profile = await getProfile();

// Update profile details
const updatedProfile = await updateProfile({
  firstName: "Jane",
  lastName: "Doe",
});

// Change Password
await changePassword({
  currentPassword: "old-password",
  newPassword: "new-password",
});
```

---

## Database (Real-time & REST Queries)

Query your Swiftbase databases using a fluent, type-safe builder. Query execution automatically utilizes WebSockets if available, otherwise it transparently falls back to REST.

```typescript
import { db } from "swiftbase-sdk";

// Initialize builder
const usersDb = db("my_database")("users");

// Fetch multiple rows
const results = await usersDb
  .select("id", "email", "firstName")
  .where("roles", "admin")
  .limit(10)
  .offset(0);

// Insert a row
await db("my_database")("users")
  .insert({ firstName: "Alice", email: "alice@example.com" })
  .execute();

// Update rows
await db("my_database")("users").where("id", "user-id").update({ firstName: "Bob" }).execute();

// Delete rows
await db("my_database")("users").where("id", "user-id").delete().execute();
```

### Real-time Subscriptions

Subscribe to database changes using WebSockets:

```typescript
const unsubscribe = db("my_database")("posts")
  .where("status", "published")
  .listen((change) => {
    console.log("Database event:", change.event); // 'insert' | 'update' | 'delete'
    console.log("Record data:", change.data);
  });

// To stop listening later:
unsubscribe();
```

---

## Object Storage (S3-Compatible)

Interface with your storage buckets using the S3-compatible `Storage` module.

```typescript
import { Storage } from "swiftbase-sdk";

const storage = new Storage({
  bucket: "my-bucket",
  // region: "us-east-1", (Optional, default is us-east-1)
  // accessKeyId: "key", (Optional: signs requests with SigV4; defaults to bearer token auth)
  // secretAccessKey: "secret"
});

// List files
const { contents } = await storage.listObjects({ prefix: "uploads/" });

// Upload a file
await storage.putObject("uploads/hello.txt", "Hello World!", {
  contentType: "text/plain",
});

// Get a file
const text = await storage.getObjectAsText("uploads/hello.txt");
const json = await storage.getObjectAsJson("uploads/data.json");

// Delete a file
await storage.deleteObject("uploads/hello.txt");
```

---

## Identity & Role Management (Admin only)

```typescript
import { getUsers, assignRole, unassignRole } from "swiftbase-sdk";

// List all users in a project
const allUsers = await getUsers("your-project-id");

// Assign a role
await assignRole("user-id", "admin");

// Revoke a role
await unassignRole("user-id", "admin");
```

---

## Running Tests

Run the test suite using Vitest:

```bash
npm run test
```
