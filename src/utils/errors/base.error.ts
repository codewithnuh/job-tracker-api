export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details: unknown;

  constructor(
    message: string,
    code = "INTERNAL_SERVER_ERROR",
    statusCode = 500,
    details: unknown = message,
  ) {
    super(message);

    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
