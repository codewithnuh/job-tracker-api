export type ErrorDetails = string | { field: string; message: string }[];

export interface NormalizedError {
  message: string;
  code: string;
  statusCode: number;
  details: ErrorDetails;
}
