import {
  BadRequestException,
  type ArgumentMetadata,
  type PipeTransform,
} from "@nestjs/common";

interface SchemaIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/**
 * The part of a zod schema this pipe relies on. It is typed structurally
 * because the schemas come from `@example/contracts`, so the gateway does not
 * need a `zod` dependency of its own.
 */
export interface SafeParseSchema<T> {
  safeParse(
    value: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: readonly SchemaIssue[] } };
}

/** Validates and parses a value with a shared schema, or responds 400. */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: SafeParseSchema<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    // Issues on the value itself have an empty path, so they are labelled with
    // what was validated instead ("body", or the header name).
    const subject = metadata.data ?? metadata.type;
    const message = result.error.issues
      .map((issue) => {
        const field = issue.path.length
          ? issue.path.map(String).join(".")
          : subject;
        return `${field}: ${issue.message}`;
      })
      .join("; ");
    throw new BadRequestException(message);
  }
}
