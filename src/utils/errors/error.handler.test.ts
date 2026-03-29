import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleError } from "./error.handler";
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  InternalServerError,
} from "./http.errors";

vi.mock("../../lib/response", () => ({
  createErrorResponse: vi.fn(({ status_code, message, code, details }) => ({
    status_code,
    success: false,
    message,
    data: null,
    meta: null,
    error: {
      code,
      details,
    },
  })),
}));

describe("handleError", () => {
  describe("AppError subclasses", () => {
    it("handles BadRequestError", () => {
      const error = new BadRequestError("Invalid input");
      const result = handleError(error);

      expect(result.normalized.statusCode).toBe(400);
      expect(result.normalized.message).toBe("Invalid input");
      expect(result.normalized.code).toBe("BAD_REQUEST");
    });

    it("handles UnauthorizedError", () => {
      const error = new UnauthorizedError("Not authorized");
      const result = handleError(error);

      expect(result.normalized.statusCode).toBe(401);
      expect(result.normalized.message).toBe("Not authorized");
      expect(result.normalized.code).toBe("UNAUTHORIZED");
    });

    it("handles NotFoundError", () => {
      const error = new NotFoundError("Resource not found");
      const result = handleError(error);

      expect(result.normalized.statusCode).toBe(404);
      expect(result.normalized.message).toBe("Resource not found");
      expect(result.normalized.code).toBe("NOT_FOUND");
    });

    it("handles ForbiddenError", () => {
      const error = new ForbiddenError("Access denied");
      const result = handleError(error);

      expect(result.normalized.statusCode).toBe(403);
      expect(result.normalized.message).toBe("Access denied");
      expect(result.normalized.code).toBe("FORBIDDEN");
    });

    it("handles ConflictError", () => {
      const error = new ConflictError("Resource already exists");
      const result = handleError(error);

      expect(result.normalized.statusCode).toBe(409);
      expect(result.normalized.message).toBe("Resource already exists");
      expect(result.normalized.code).toBe("CONFLICT");
    });

    it("handles InternalServerError", () => {
      const error = new InternalServerError("Something went wrong");
      const result = handleError(error);

      expect(result.normalized.statusCode).toBe(500);
      expect(result.normalized.message).toBe("Something went wrong");
      expect(result.normalized.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });

  describe("generic Error", () => {
    it("handles generic Error with masked internal message", () => {
      const error = new Error("Database connection failed");
      const result = handleError(error);

      expect(result.normalized.statusCode).toBe(500);
      expect(result.normalized.message).toBe("An internal server error occurred");
      expect(result.normalized.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("stores original error details for logging", () => {
      const error = new Error("Original message");
      const result = handleError(error);

      expect(result.normalized.details).toBe("Original message");
    });

    it("handles null", () => {
      const result = handleError(null);

      expect(result.normalized.statusCode).toBe(500);
      expect(result.normalized.message).toBe("Unknown error");
    });

    it("handles undefined", () => {
      const result = handleError(undefined);

      expect(result.normalized.statusCode).toBe(500);
      expect(result.normalized.message).toBe("Unknown error");
    });
  });

  describe("response format", () => {
    it("returns normalized error and clean response", () => {
      const error = new BadRequestError("Test error");
      const result = handleError(error);

      expect(result).toHaveProperty("normalized");
      expect(result).toHaveProperty("response");
      expect(result.response.status_code).toBe(400);
    });

    it("masks details in response for security", () => {
      const error = new BadRequestError("Test", { sensitive: "data" });
      const result = handleError(error);

      expect(result.response.error.details).toBe(
        "Check server logs for detailed trace",
      );
    });
  });
});

import { normalizeError } from "./error.utils";

describe("normalizeError", () => {
  describe("edge cases", () => {
    it("handles error with custom code", () => {
      const error = new Error("Custom error");
      (error as any).code = "CUSTOM_CODE";

      const result = normalizeError(error);

      expect(result.code).toBe("CUSTOM_CODE");
    });
  });
});
