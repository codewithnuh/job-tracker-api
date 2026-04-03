import { normalizeError } from "./error.utils";
import { createErrorResponse } from "../../lib/response";

/**
 * Handle errors by normalizing them and generating a clean, user-facing response.
 * Returns both the normalized (full) error for logging and the clean response for the client.
 */
export function handleError(err: unknown) {
  const normalized = normalizeError(err);

  // We generate a clean response that masks the 'details' field if it contains sensitive info
  // Especially for validation errors or database errors.
  const cleanResponse = createErrorResponse({
    status_code: normalized.statusCode,
    message: normalized.message,
    code: normalized.code,
    // We mask the details for security. The full details are returned in 'normalized' for the logger.
    details: "Something went wrong",
  });

  return {
    normalized,
    response: cleanResponse,
  };
}
