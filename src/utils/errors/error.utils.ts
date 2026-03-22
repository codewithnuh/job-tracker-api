import { AppError } from "./base.error";
import { NormalizedError, ErrorDetails } from "./error.types";

export function normalizeError(err: unknown): NormalizedError {
  // ✅ Our own errors
  if (err instanceof AppError) {
    return {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      details: err.details as ErrorDetails,
    };
  }

  // ✅ Native JS errors
  if (err instanceof Error) {
    return {
      message: err.message,
      code: "INTERNAL_SERVER_ERROR",
      statusCode: 500,
      details: err.message,
    };
  }

  // ✅ Unknown (non-error)
  return {
    message: "Unknown error",
    code: "UNKNOWN_ERROR",
    statusCode: 500,
    details: "Unexpected failure",
  };
}
