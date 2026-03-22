import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { userService } from "./auth.service";
import { db } from "../../db/index";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { UnauthorizedError } from "../../utils/errors/http.errors";

// runs once before all tests — clean the users table
beforeAll(async () => {
  await db.delete(users);
});

// runs once after all tests — clean up again
afterAll(async () => {
  await db.delete(users);
});

describe("registerUser", () => {
  it("creates a new user and returns id, name, email, createdAt", async () => {
    const result = await userService.registerUser({
      name: "Noor Hassan",
      email: "noor@example.com",
      password: "password123",
    });

    expect(result.user.id).toBeDefined();
    expect(result.user.name).toBe("Noor Hassan");
    expect(result.user.email).toBe("noor@example.com");
    expect(result.user.createdAt).toBeDefined();
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
    ).rejects.toThrow();
  });
});

describe("loginUser", () => {
  it("logs in successfully with correct email and password", async () => {
    // Arrange — create user first
    await userService.registerUser({
      name: "Login User",
      email: "login@example.com",
      password: "password123",
    });

    // Act
    const result = await userService.loginUser({
      email: "login@example.com",
      password: "password123",
    });

    // Assert
    expect(result.user.id).toBeDefined();
    expect(result.user.email).toBe("login@example.com");
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("throws if email does not exist", async () => {
    await expect(
      userService.loginUser({
        email: "notfound@example.com",
        password: "password123",
      }),
    ).rejects.toThrow();
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
