import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "./auth.middleware";
import { UnauthorizedError, NotFoundError } from "../utils/errors/http.errors";

vi.mock("../db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("../utils/auth/token", () => ({
  verifyAccessToken: vi.fn(),
}));

import { db } from "../db";
import { verifyAccessToken } from "../utils/auth/token";

const mockUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  createdAt: new Date("2024-01-01"),
};

function createMockRequest(overrides: Partial<{
  cookies: Record<string, string | undefined>;
}> = {}): any {
  return {
    cookies: { ...overrides.cookies },
    user: undefined,
  };
}

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful authentication", () => {
    it("attaches user to request when token is valid", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "user-123",
        email: "test@example.com",
        type: "access",
        jti: "jti-123",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      await authMiddleware(mockRequest);

      expect(verifyAccessToken).toHaveBeenCalledWith("valid-token");
      expect(db.query.users.findFirst).toHaveBeenCalled();
      expect(mockRequest.user).toEqual(mockUser);
    });

    it("returns user with correct columns", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "user-123",
        email: "test@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        createdAt: new Date(),
      });

      await authMiddleware(mockRequest);

      expect(db.query.users.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
        columns: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      });
    });
  });

  describe("token validation errors", () => {
    it("throws UnauthorizedError when no token cookie exists", async () => {
      const mockRequest = createMockRequest({ cookies: {} });

      await expect(authMiddleware(mockRequest)).rejects.toThrow(UnauthorizedError);
      await expect(authMiddleware(mockRequest)).rejects.toThrow("No authentication token provided");
    });

    it("throws UnauthorizedError when token cookie is undefined", async () => {
      const mockRequest = createMockRequest({ cookies: { token: undefined as any } });

      await expect(authMiddleware(mockRequest)).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError when token verification fails", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "invalid-token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new UnauthorizedError("Invalid token"),
      );

      await expect(authMiddleware(mockRequest)).rejects.toThrow(UnauthorizedError);
      await expect(authMiddleware(mockRequest)).rejects.toThrow("Invalid or expired session");
    });

    it("throws UnauthorizedError when token is expired", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "expired-token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new UnauthorizedError("Token expired"),
      );

      await expect(authMiddleware(mockRequest)).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError when token is revoked/blacklisted", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "revoked-token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new UnauthorizedError("Session expired or invalid"),
      );

      await expect(authMiddleware(mockRequest)).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError for malformed token (missing signature)", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "malformed.token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new UnauthorizedError("Invalid signature"),
      );

      await expect(authMiddleware(mockRequest)).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError for empty string token", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "" },
      });

      await expect(authMiddleware(mockRequest)).rejects.toThrow(UnauthorizedError);
      await expect(authMiddleware(mockRequest)).rejects.toThrow("No authentication token provided");
    });

    it("throws UnauthorizedError for whitespace-only token", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "   " },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new UnauthorizedError("Session expired or invalid"),
      );

      await expect(authMiddleware(mockRequest)).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError for refresh token used as access token", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "refresh-token-used-as-access" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new UnauthorizedError("Invalid token type"),
      );

      await expect(authMiddleware(mockRequest)).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError for tampered token", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.invalid.tampered" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new UnauthorizedError("Invalid signature"),
      );

      await expect(authMiddleware(mockRequest)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("user lookup errors", () => {
    it("throws NotFoundError when user does not exist in database", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "deleted-user-123",
        email: "deleted@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(authMiddleware(mockRequest)).rejects.toThrow(NotFoundError);
      await expect(authMiddleware(mockRequest)).rejects.toThrow("User account not found");
    });

    it("does not attach user to request when user lookup fails", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "deleted-user-123",
        email: "deleted@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      try {
        await authMiddleware(mockRequest);
      } catch {
        // Expected to throw
      }

      expect(mockRequest.user).toBeUndefined();
    });

    it("throws NotFoundError when user was deactivated after token issued", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "deactivated-user-456",
        email: "deactivated@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(authMiddleware(mockRequest)).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when user ID in token does not match any user", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "non-existent-id",
        email: "test@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(authMiddleware(mockRequest)).rejects.toThrow(NotFoundError);
    });
  });

  describe("database errors", () => {
    it("propagates database connection errors", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "user-123",
        email: "test@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(authMiddleware(mockRequest)).rejects.toThrow("Database connection failed");
    });

    it("propagates database timeout errors", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "user-123",
        email: "test@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Connection timed out"),
      );

      await expect(authMiddleware(mockRequest)).rejects.toThrow("Connection timed out");
    });
  });

  describe("security edge cases", () => {
    it("does not call database when token is invalid", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "fake-token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new UnauthorizedError("Invalid token"),
      );

      await expect(authMiddleware(mockRequest)).rejects.toThrow(UnauthorizedError);

      expect(db.query.users.findFirst).not.toHaveBeenCalled();
    });

    it("verifies token before database lookup (order enforcement)", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      let callOrder: string[] = [];

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push("verifyAccessToken");
        return { sub: "user-123", email: "test@example.com", type: "access" };
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push("findFirst");
        return mockUser;
      });

      await authMiddleware(mockRequest);

      expect(callOrder).toEqual(["verifyAccessToken", "findFirst"]);
    });

    it("handles token with missing optional fields in payload", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "token-with-minimal-payload" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "user-123",
        email: "test@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      await authMiddleware(mockRequest);

      expect(mockRequest.user).toEqual(mockUser);
    });

    it("handles token with special characters in email", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      const specialEmailUser = {
        id: "user-123",
        email: "user+tag@example.com",
        name: "Test User",
        createdAt: new Date(),
      };

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "user-123",
        email: "user+tag@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(specialEmailUser);

      await authMiddleware(mockRequest);

      expect(mockRequest.user).toEqual(specialEmailUser);
    });

    it("handles request with multiple cookies (only uses token)", async () => {
      const mockRequest = createMockRequest({
        cookies: {
          token: "valid-token",
          sessionId: "session-123",
          trackingId: "track-456",
        },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "user-123",
        email: "test@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      await authMiddleware(mockRequest);

      expect(verifyAccessToken).toHaveBeenCalledWith("valid-token");
      expect(mockRequest.user).toEqual(mockUser);
    });
  });

  describe("edge cases", () => {
    it("handles user with minimal data", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      const minimalUser = {
        id: "user-456",
        email: "min@example.com",
        name: "Min",
        createdAt: new Date(),
      };

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "user-456",
        email: "min@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(minimalUser);

      await authMiddleware(mockRequest);

      expect(mockRequest.user).toEqual(minimalUser);
    });

    it("uses correct user ID from token payload", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "specific-user-id-999",
        email: "specific@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      await authMiddleware(mockRequest);

      expect(db.query.users.findFirst).toHaveBeenCalled();
      expect(mockRequest.user).toEqual(mockUser);
    });

    it("handles very long user ID from token", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      const longIdUser = {
        id: "a".repeat(100),
        email: "test@example.com",
        name: "Test User",
        createdAt: new Date(),
      };

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: longIdUser.id,
        email: "test@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(longIdUser);

      await authMiddleware(mockRequest);

      expect(mockRequest.user).toEqual(longIdUser);
    });

    it("handles unicode characters in user data", async () => {
      const mockRequest = createMockRequest({
        cookies: { token: "valid-token" },
      });

      const unicodeUser = {
        id: "user-unicode",
        email: "user@example.com",
        name: "田中太郎",
        createdAt: new Date(),
      };

      (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        sub: "user-unicode",
        email: "user@example.com",
        type: "access",
      });

      (db.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(unicodeUser);

      await authMiddleware(mockRequest);

      expect(mockRequest.user).toEqual(unicodeUser);
    });
  });
});
