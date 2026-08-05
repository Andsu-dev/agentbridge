import { ZodError } from "zod";

export type ToolErrorCode =
  | "UNKNOWN_TOOL"
  | "VALIDATION_ERROR"
  | "TENANT_LEAK"
  | "RATE_LIMITED"
  | "APPROVAL_REQUIRED"
  | "APPROVAL_REJECTED"
  | "HANDLER_ERROR";

export type ToolErrorOptions = ErrorOptions & { retryable?: boolean; retryAfterMs?: number };

function defaultRetryable(code: ToolErrorCode): boolean {
  return code === "RATE_LIMITED" || code === "HANDLER_ERROR";
}

export class ToolError extends Error {
  code: ToolErrorCode;
  retryable: boolean;
  retryAfterMs?: number;

  constructor(code: ToolErrorCode, message: string, options?: ToolErrorOptions) {
    super(message, options);
    this.name = "ToolError";
    this.code = code;
    this.retryable = options?.retryable ?? defaultRetryable(code);
    this.retryAfterMs = options?.retryAfterMs;
  }
}

export function toToolError(error: unknown): ToolError {
  if (error instanceof ToolError) return error;

  if (error instanceof ZodError) {
    return new ToolError("VALIDATION_ERROR", error.issues.map((issue) => issue.message).join(", "), {
      cause: error,
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new ToolError("HANDLER_ERROR", message, { cause: error instanceof Error ? error : undefined });
}
