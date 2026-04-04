import { extend } from "zod/mini";
import { AppError } from "./base.error.js";

export class BadRequestError extends AppError {
  constructor(message = "Bad Request", details?: unknown) {
    super(message, "BAD_REQUEST", 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ValidationError extends AppError {
  constructor(details: { field: string; message: string }[]) {
    super("Validation failed", "VALIDATION_ERROR", 400, details);
  }
}
export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, "CONFLICT", 409);
  }
}
export class InternalServerError extends AppError {
  constructor(message = "Internal Server Error") {
    super(message, "INTERNAL_SERVER_ERROR", 500);
  }
}
