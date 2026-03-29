import { describe, it, expect, beforeEach } from "vitest";

import { userService } from "./auth.service";

import { db } from "../../db";
import { users } from "../../db/schema";

import { eq } from "drizzle-orm";

import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../../utils/errors/http.errors";

import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../utils/auth/token";

//
// CLEAN DATABASE BEFORE EACH TEST
//

beforeEach(async () => {
  await db.delete(users);
});

//
// REGISTER USER
//

describe("registerUser", () => {
  it("creates user and returns safe fields", async () => {
    const result = await userService.registerUser({
      name: "Noor Hassan",
      email: "noor@example.com",
      password: "password123",
    });

    expect(result.user.id).toBeDefined();
    expect(result.user.email).toBe("noor@example.com");
    expect(result.user.createdAt).toBeDefined();

    expect(result.user).not.toHaveProperty("passwordHash");

    expect(result.accesToken, result.refreshToken).toBeDefined();
  });

  it("stores hashed password", async () => {
    await userService.registerUser({
      name: "Hash User",
      email: "hash@example.com",
      password: "password123",
    });

    const row = await db.query.users.findFirst({
      where: eq(users.email, "hash@example.com"),
    });

    expect(row?.passwordHash).toBeDefined();

    expect(row?.passwordHash).not.toBe("password123");
  });

  it("rejects duplicate email", async () => {
    await userService.registerUser({
      name: "User",
      email: "dup@example.com",
      password: "password123",
    });

    await expect(
      userService.registerUser({
        name: "User",
        email: "dup@example.com",
        password: "password123",
      }),
    ).rejects.toThrow(ConflictError);
  });
});

//
// LOGIN
//

describe("loginUser", () => {
  it("logs in with valid credentials", async () => {
    await userService.registerUser({
      name: "Login User",
      email: "login@example.com",
      password: "password123",
    });

    const result = await userService.loginUser({
      email: "login@example.com",
      password: "password123",
    });

    expect(result.user.email).toBe("login@example.com");

    expect(result.accessToken, result.refreshToken).toBeDefined();
  });

  it("fails for unknown email", async () => {
    await expect(
      userService.loginUser({
        email: "missing@example.com",
        password: "password123",
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("fails for wrong password", async () => {
    await userService.registerUser({
      name: "Wrong Password",
      email: "wrong@example.com",
      password: "password123",
    });

    await expect(
      userService.loginUser({
        email: "wrong@example.com",
        password: "wrongpass",
      }),
    ).rejects.toThrow(UnauthorizedError);
  });
});

//
// LOGOUT
//

describe("logoutUser", () => {
  it("always returns success", async () => {
    const { accesToken } = await userService.registerUser({
      name: "Logout",
      email: "logout@example.com",
      password: "password123",
    });

    const result = await userService.logoutUser(accesToken);

    expect(result.success).toBe(true);
  });

  it("returns success even for invalid token", async () => {
    const result = await userService.logoutUser("invalid-token");

    expect(result.success).toBe(true);
  });
});

//
// CURRENT USER
//

describe("getCurrentUser", () => {
  it("returns user for valid token", async () => {
    const { accesToken } = await userService.registerUser({
      name: "Current",
      email: "current@example.com",
      password: "password123",
    });

    const result = await userService.getCurrentUser(accesToken);

    expect(result.user.email).toBe("current@example.com");
  });

  it("throws for invalid token", async () => {
    await expect(userService.getCurrentUser("invalid-token")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("throws if user deleted", async () => {
    const { accesToken } = await userService.registerUser({
      name: "Deleted",
      email: "deleted@example.com",
      password: "password123",
    });

    await db.delete(users).where(eq(users.email, "deleted@example.com"));

    await expect(userService.getCurrentUser(accesToken)).rejects.toThrow(
      NotFoundError,
    );
  });
});

//
// TOKEN SECURITY TESTS
//

describe("JWT security", () => {
  it("verifies valid access token", async () => {
    const token = await generateAccessToken({
      id: "1",
      email: "test@example.com",
    });

    const payload = await verifyAccessToken(token);

    expect(payload.sub).toBe("1");
    expect(payload.type).toBe("access");
  });

  it("verifies valid refresh token", async () => {
    const token = await generateRefreshToken({
      id: "1",
      email: "test@example.com",
    });

    const payload = await verifyRefreshToken(token);

    expect(payload.type).toBe("refresh");
  });

  it("rejects tampered token", async () => {
    const token = await generateAccessToken({
      id: "1",
      email: "test@example.com",
    });

    const tampered = token.slice(0, -1) + "x";

    await expect(verifyAccessToken(tampered)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("rejects refresh token used as access token", async () => {
    const refresh = await generateRefreshToken({
      id: "1",
      email: "test@example.com",
    });

    await expect(verifyAccessToken(refresh)).rejects.toThrow(UnauthorizedError);
  });

  it("rejects access token used as refresh token", async () => {
    const access = await generateAccessToken({
      id: "1",
      email: "test@example.com",
    });

    await expect(verifyRefreshToken(access)).rejects.toThrow(UnauthorizedError);
  });
});

//
// DATABASE INTEGRITY
//

describe("database integrity", () => {
  it("stores exactly one user", async () => {
    await userService.registerUser({
      name: "User",
      email: "user@example.com",
      password: "password123",
    });

    const rows = await db.query.users.findMany();

    expect(rows.length).toBe(1);
  });

  it("creates unique ids", async () => {
    const a = await userService.registerUser({
      name: "A",
      email: "a@example.com",
      password: "password123",
    });

    const b = await userService.registerUser({
      name: "B",
      email: "b@example.com",
      password: "password123",
    });

    expect(a.user.id).not.toBe(b.user.id);
  });
});
