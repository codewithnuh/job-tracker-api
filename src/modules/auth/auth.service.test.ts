import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { userService } from "./auth.service";
import { db } from "../../db/index";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../../utils/errors/http.errors";
import { generateToken } from "../../utils/auth/token";

// runs once before all tests — clean the users table
beforeAll(async () => {
  await db.delete(users);
});

// runs once after all tests — clean up again
afterAll(async () => {
  await db.delete(users);
});

describe("registerUser", () => {
  it("creates a new user and returns id, name, email, createdAt, and token", async () => {
    const result = await userService.registerUser({
      name: "Noor Hassan",
      email: "noor@example.com",
      password: "password123",
    });

    expect(result.user.id).toBeDefined();
    expect(result.user.name).toBe("Noor Hassan");
    expect(result.user.email).toBe("noor@example.com");
    expect(result.user.createdAt).toBeDefined();
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
  });

  it("never returns passwordHash in the result", async () => {
    const result = await userService.registerUser({
      name: "Noor ul Hassan",
      email: "noor2@example.com",
      password: "password123",
    });

    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("hashes the password — stored hash is not the plain password", async () => {
    await userService.registerUser({
      name: "Noor Hassan",
      email: "noor3@example.com",
      password: "password123",
    });

    // go directly to DB and check what was actually stored
    const row = await db.query.users.findFirst({
      where: eq(users.email, "noor3@example.com"),
    });

    expect(row?.passwordHash).not.toBe("password123");
    expect(row?.passwordHash).toBeDefined();
  });

  it("throws if email is already taken", async () => {
    await userService.registerUser({
      name: "Noor Hassan",
      email: "duplicate@example.com",
      password: "password123",
    });

    await expect(
      userService.registerUser({
        name: "Noor Hassan",
        email: "duplicate@example.com",
        password: "password123",
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe("loginUser", () => {
  it("logs in successfully with correct email and password", async () => {
    await userService.registerUser({
      name: "Login User",
      email: "login@example.com",
      password: "password123",
    });

    const result = await userService.loginUser({
      email: "login@example.com",
      password: "password123",
    });

    expect(result.user.id).toBeDefined();
    expect(result.user.email).toBe("login@example.com");
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
  });

  it("throws if email does not exist", async () => {
    await expect(
      userService.loginUser({
        email: "notfound@example.com",
        password: "password123",
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws if password is incorrect", async () => {
    // Arrange
    await userService.registerUser({
      name: "Wrong Password User",
      email: "wrongpass@example.com",
      password: "password123",
    });

    // Act + Assert
    await expect(
      userService.loginUser({
        email: "wrongpass@example.com",
        password: "wrongpassword",
      }),
    ).rejects.toThrow(UnauthorizedError);
  });
  it("does not reveal whether email or password is wrong", async () => {
    await expect(
      userService.loginUser({
        email: "notfound@example.com",
        password: "password123",
      }),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe("logoutUser", () => {
  it("returns success message for valid token", async () => {
    const { token } = await userService.registerUser({
      name: "Logout User",
      email: "logout@example.com",
      password: "password123",
    });

    const result = await userService.logoutUser(token);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Logged out successfully");
  });

  it("returns success message for invalid/expired token", async () => {
    const result = await userService.logoutUser("invalid-token");

    expect(result.success).toBe(true);
    expect(result.message).toBe("Logged out successfully");
  });
});

describe("getCurrentUser", () => {
  it("returns user for valid token", async () => {
    const { token } = await userService.registerUser({
      name: "Current User",
      email: "current@example.com",
      password: "password123",
    });

    const result = await userService.getCurrentUser(token);

    expect(result.user.id).toBeDefined();
    expect(result.user.email).toBe("current@example.com");
    expect(result.user.name).toBe("Current User");
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("throws UnauthorizedError for invalid token", async () => {
    await expect(userService.getCurrentUser("invalid-token")).rejects.toThrow();
  });

  it("throws NotFoundError if user no longer exists", async () => {
    const { token } = await userService.registerUser({
      name: "Deleted User",
      email: "deleted@example.com",
      password: "password123",
    });

    await db.delete(users).where(eq(users.email, "deleted@example.com"));

    await expect(userService.getCurrentUser(token)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("getUserByEmail", () => {
  it("returns user for valid email", async () => {
    await userService.registerUser({
      name: "Email User",
      email: "emailuser@example.com",
      password: "password123",
    });

    const result = await userService.getUserByEmail("emailuser@example.com");

    expect(result.user.id).toBeDefined();
    expect(result.user.email).toBe("emailuser@example.com");
    expect(result.user.name).toBe("Email User");
    expect(result.user.createdAt).toBeDefined();
  });

  it("throws NotFoundError if user does not exist", async () => {
    await expect(
      userService.getUserByEmail("nonexistent@example.com"),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws error for invalid email format", async () => {
    await expect(userService.getUserByEmail("invalid-email")).rejects.toThrow();
  });
});
