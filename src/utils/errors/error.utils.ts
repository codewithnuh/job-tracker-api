import { ZodError } from "zod";
import { AppError } from "./base.error";
import { NormalizedError, ErrorDetails } from "./error.types";
import { UnauthorizedError } from "./http.errors";

/**
 * Normalizes an unknown error into a consistent structure for logging and responses.
 */
export function normalizeError(err: unknown): NormalizedError {
  // ✅ 1. Standard HTTP errors (Conflicts, Unauthorized, etc.)
  if (err instanceof AppError) {
    return {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      details: err.details as ErrorDetails,
    };
  }
  if (err instanceof UnauthorizedError) {
    return {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      details: err.details as ErrorDetails,
    };
  }

  // ✅ 2. Validation Errors (ZodError)
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join(".") || "body",
      message: issue.message,
    }));

    return {
      message: "Validation failed", // Generic message for the client
      code: "VALIDATION_ERROR",
      statusCode: 400,
      details, // specific field errors for the logger
    };
  }

  // ✅ 3. Native JS errors (Masking internal details)
  if (err instanceof Error) {
    return {
      message: "An internal server error occurred",
      code: (err as any).code || "INTERNAL_SERVER_ERROR",
      statusCode: 500,
      details: err.message, // Full message and stack info for the logger
    };
  }

  return {
    message: "Unknown error",
    code: "UNKNOWN_ERROR",
    statusCode: 500,
    details: "Unexpected failure",
  };
}
