/**
 * Validation helpers — thin wrappers around Zod that throw NextResponse on failure.
 * Route catch blocks check error.message for validation errors and return the proper response.
 */
import { z } from 'zod';
import { NextResponse } from 'next/server';

/** Zod validation error that carries 400 status for route catch blocks */
export class ValidationError extends Error {
  constructor(
    public readonly issues: z.ZodIssue[],
    public override readonly message: string
  ) {
    super(message);
  }
}

/** Formats Zod issues into a flat list of error messages */
function formatZodIssues(issues: z.ZodIssue[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? `[${issue.path.join('.')}] ` : '';
    return `${path}${issue.message}`;
  });
}

/**
 * Validates and parses a request body (JSON).
 * Throws NextResponse 400 on failure — safe to use directly in route handlers.
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const messages = formatZodIssues(result.error.issues);
    throw NextResponse.json(
      { error: messages[0], errors: messages },
      { status: 400 }
    );
  }
  return result.data;
}

/**
 * Validates and parses query string parameters.
 * Throws NextResponse 400 on failure.
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  query: URLSearchParams
): T {
  const raw = Object.fromEntries(query.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    const messages = formatZodIssues(result.error.issues);
    throw NextResponse.json(
      { error: messages[0], errors: messages },
      { status: 400 }
    );
  }
  return result.data;
}

/**
 * Validates and parses route params (from context.params).
 * Throws NextResponse 400 on failure.
 */
export function validateParams<T>(
  schema: z.ZodSchema<T>,
  params: Record<string, string | string[]>
): T {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    flat[key] = Array.isArray(value) ? (value[0] ?? '') : value;
  }
  const result = schema.safeParse(flat);
  if (!result.success) {
    const messages = formatZodIssues(result.error.issues);
    throw NextResponse.json(
      { error: messages[0], errors: messages },
      { status: 400 }
    );
  }
  return result.data;
}

export * from './schemas';
