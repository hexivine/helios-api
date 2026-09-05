export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ── [BUG] Error boundary swallows the original stack; debugging production
//     failures becomes guesswork because the root cause is never logged.
export function toSafeError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  return new AppError(500, 'Internal server error', 'internal');
}