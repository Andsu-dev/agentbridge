import { ZodError } from "zod";

export type ToolErrorCode =
	| "UNKNOWN_TOOL"
	| "VALIDATION_ERROR"
	| "TENANT_LEAK"
	| "RATE_LIMITED"
	| "APPROVAL_REQUIRED"
	| "APPROVAL_REJECTED"
	| "HANDLER_ERROR";

export class ToolError extends Error {
	code: ToolErrorCode;

	constructor(code: ToolErrorCode, message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "ToolError";
		this.code = code;
	}
}

export function toToolError(error: unknown): ToolError {
	if (error instanceof ToolError) return error;

	if (error instanceof ZodError) {
		return new ToolError(
			"VALIDATION_ERROR",
			error.issues.map((issue) => issue.message).join(", "),
			{
				cause: error,
			},
		);
	}

	const message = error instanceof Error ? error.message : String(error);
	return new ToolError("HANDLER_ERROR", message, {
		cause: error instanceof Error ? error : undefined,
	});
}
