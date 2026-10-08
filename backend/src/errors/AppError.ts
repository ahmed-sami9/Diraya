// An error we threw on purpose, with a known HTTP status and a stable code.
// Anything that is NOT an AppError is treated as an unexpected crash (500).

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}
