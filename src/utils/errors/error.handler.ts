import { normalizeError } from "./error.utils";
import { createErrorResponse } from "../../lib/response";

export function handleError(err: unknown) {
  const normalized = normalizeError(err);

  return createErrorResponse({
    status_code: normalized.statusCode,
    message: normalized.message,
    code: normalized.code,
    details: normalized.details,
  });
}
