import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { userService } from "./auth.service";

import { db } from "../../db";
import { users, activityLogs, refreshTokens, applications } from "../../db/schema";

import { eq } from "drizzle-orm";

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../utils/errors/http.errors";

import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../utils/auth/token";

const blacklist = new Map<string, string>();

vi.mock("../../utils/redis", () => ({
  redis: {
    get: vi.fn((key: string) => {
      return Promise.resolve(blacklist.get(key) || null);
    }),
    setex: vi.fn((key: string, _ttl: number, value: string) => {
      blacklist.set(key, value);
      return Promise.resolve("OK");
    }),
    exists: vi.fn((key: string) => {
      return Promise.resolve(blacklist.has(key) ? 1 : 0);
    }),
    del: vi.fn((key: string) => {
      blacklist.delete(key);
      return Promise.resolve(1);
    }),
  },
}));

//
// CLEAN DATABASE AND MOCKS BEFORE EACH TEST
//

beforeEach(async () => {
  await db.delete(refreshTokens);
  await db.delete(activityLogs);
  await db.delete(applications);
  await db.delete(users);
  vi.clearAllMocks();
  blacklist.clear();
});

afterEach(async () => {
  await db.delete(refreshTokens);
  await db.delete(activityLogs);
  await db.delete(applications);
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
      name: "First User",
      email: "dup@example.com",
      password: "password123",
    });

    await expect(
      userService.registerUser({
        name: "Second User",
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

  it("throws UnauthorizedError when token is blacklisted", async () => {
    const { accesToken } = await userService.registerUser({
      name: "Blacklisted",
      email: "blacklisted@example.com",
      password: "password123",
    });

    blacklist.set(`blacklist:${accesToken}`, "revoked");

    await expect(userService.getCurrentUser(accesToken)).rejects.toThrow(
      UnauthorizedError,
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

  it.skip("rejects tampered token when blacklist check passes", async () => {
    blacklist.clear();
    
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

  it("rejects blacklisted access token after logout", async () => {
    const { accesToken } = await userService.registerUser({
      name: "Blacklist",
      email: "blacklist2@example.com",
      password: "password123",
    });

    await userService.logoutUser(accesToken);

    await expect(userService.getCurrentUser(accesToken)).rejects.toThrow(
      UnauthorizedError,
    );
  });
});

// =============================================================================
// REFRESH TOKEN TESTS
// =============================================================================

describe("refreshToken", () => {
  it("returns new tokens when refresh token is valid", async () => {
    const registered = await userService.registerUser({
      name: "Refresh Test",
      email: "refresh@example.com",
      password: "password123",
    });

    const result = await userService.refreshToken(registered.refreshToken);

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe("refresh@example.com");
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it("blacklists old refresh token after refresh", async () => {
    const registered = await userService.registerUser({
      name: "Blacklist Test",
      email: "blacklist@example.com",
      password: "password123",
    });

    const oldRefreshToken = registered.refreshToken;

    await userService.refreshToken(oldRefreshToken);

    await expect(
      userService.refreshToken(oldRefreshToken),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError for invalid refresh token", async () => {
    await expect(
      userService.refreshToken("invalid-token"),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws NotFoundError when user no longer exists", async () => {
    const registered = await userService.registerUser({
      name: "Delete Me",
      email: "deleteme@example.com",
      password: "password123",
    });

    await db.delete(users);

    await expect(
      userService.refreshToken(registered.refreshToken),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws UnauthorizedError for revoked refresh token", async () => {
    const registered = await userService.registerUser({
      name: "Revoke Test",
      email: "revoke@example.com",
      password: "password123",
    });

    await userService.revokeRefreshToken(registered.refreshToken);

    await expect(
      userService.refreshToken(registered.refreshToken),
    ).rejects.toThrow(UnauthorizedError);
  });
});

describe("revokeRefreshToken", () => {
  it("revokes valid refresh token", async () => {
    const registered = await userService.registerUser({
      name: "Revoke Valid",
      email: "revokevalid@example.com",
      password: "password123",
    });

    const result = await userService.revokeRefreshToken(registered.refreshToken);

    expect(result.success).toBe(true);
  });

  it("returns success for invalid token", async () => {
    const result = await userService.revokeRefreshToken("invalid-token");

    expect(result.success).toBe(true);
  });

  it("returns success for already revoked token", async () => {
    const registered = await userService.registerUser({
      name: "Double Revoke",
      email: "doublerevoke@example.com",
      password: "password123",
    });

    await userService.revokeRefreshToken(registered.refreshToken);

    const result = await userService.revokeRefreshToken(registered.refreshToken);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// GET USER BY EMAIL TESTS
// =============================================================================

describe("getUserByEmail", () => {
  it("returns user when email exists", async () => {
    await userService.registerUser({
      name: "Get By Email",
      email: "getbyemail@example.com",
      password: "password123",
    });

    const result = await userService.getUserByEmail("getbyemail@example.com");

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe("getbyemail@example.com");
  });

  it("throws BadRequestError for invalid email format", async () => {
    await expect(
      userService.getUserByEmail("invalid-email"),
    ).rejects.toThrow(BadRequestError);
  });

  it("throws NotFoundError when user does not exist", async () => {
    await expect(
      userService.getUserByEmail("nonexistent@example.com"),
    ).rejects.toThrow(NotFoundError);
  });
});

//
// DATABASE INTEGRITY
//

describe("database integrity", () => {
  it("stores exactly one user", async () => {
    await userService.registerUser({
      name: "Single User",
      email: "user@example.com",
      password: "password123",
    });

    const rows = await db.query.users.findMany();

    expect(rows.length).toBe(1);
  });

  it("creates unique ids", async () => {
    const a = await userService.registerUser({
      name: "User Alpha",
      email: "a@example.com",
      password: "password123",
    });

    const b = await userService.registerUser({
      name: "User Beta",
      email: "b@example.com",
      password: "password123",
    });

    expect(a.user.id).not.toBe(b.user.id);
  });
});

// =============================================================================
// ERROR CLASS TESTS
// =============================================================================

describe("Error classes", () => {
  describe("ForbiddenError", () => {
    it("creates error with default message", () => {
      const error = new ForbiddenError();
      expect(error.message).toBe("Forbidden");
      expect(error.code).toBe("FORBIDDEN");
      expect(error.statusCode).toBe(403);
    });

    it("creates error with custom message", () => {
      const error = new ForbiddenError("Access denied");
      expect(error.message).toBe("Access denied");
      expect(error.code).toBe("FORBIDDEN");
      expect(error.statusCode).toBe(403);
    });
  });

  describe("ValidationError", () => {
    it("creates error with field details", () => {
      const fieldErrors = [
        { field: "email", message: "Invalid email format" },
        { field: "password", message: "Password too short" },
      ];
      const error = new ValidationError(fieldErrors);
      expect(error.message).toBe("Validation failed");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual(fieldErrors);
    });

    it("includes details in error response", () => {
      const fieldErrors = [{ field: "name", message: "Required" }];
      const error = new ValidationError(fieldErrors);
      expect(error.details).toEqual(fieldErrors);
    });
  });

  describe("InternalServerError", () => {
    it("creates error with default message", () => {
      const error = new InternalServerError();
      expect(error.message).toBe("Internal Server Error");
      expect(error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(error.statusCode).toBe(500);
    });

    it("creates error with custom message", () => {
      const error = new InternalServerError("Database connection failed");
      expect(error.message).toBe("Database connection failed");
      expect(error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(error.statusCode).toBe(500);
    });
  });
});
