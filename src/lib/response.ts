// Common base
interface BaseResponse {
  status_code: number;
  success: boolean;
  message: string;
  meta?: Record<string, any> | null;
}

// Success Response
export interface SuccessResponse<T = unknown> extends BaseResponse {
  success: true;
  data: T | null;
  error?: null;
}

// Error Details
export interface FieldError {
  field: string;
  message: string;
}

export type ErrorDetails = string | FieldError[];

// Error Object
export interface ErrorObject {
  code: string;
  details: ErrorDetails;
}

// Error Response
export interface ErrorResponse extends BaseResponse {
  success: false;
  data: Record<string, any> | null;
  error: ErrorObject;
}

// Union Type
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;
export function createSuccessResponse<T>(
  params: {
    status_code?: number;
    message?: string;
    data?: T | null;
    meta?: Record<string, any> | null;
  } = {},
): SuccessResponse<T> {
  return {
    status_code: params.status_code ?? 200,
    success: true,
    message: params.message ?? "Request successful",
    data: params.data ?? null,
    meta: params.meta ?? null,
    error: null,
  };
}
export function createErrorResponse(params: {
  status_code?: number;
  message?: string;
  code: string;
  details: ErrorDetails;
  data?: Record<string, any> | null;
  meta?: Record<string, any> | null;
}): ErrorResponse {
  return {
    status_code: params.status_code ?? 500,
    success: false,
    message: params.message ?? "Something went wrong",
    data: params.data ?? null,
    meta: params.meta ?? null,
    error: {
      code: params.code,
      details: params.details,
    },
  };
}
