import { resumeSchema, type Resume } from "../schema";

import { InvalidVariantDataError, flattenIssues } from "./errors";

/**
 * `value` checked against the resume schema, as the variant `name`: the parsed
 * document, or an InvalidVariantDataError carrying the flattened issues. Every
 * adapter runs it on what it stores and on what it reads back.
 */
export function validatedResume(name: string, value: unknown): Resume {
  const result = resumeSchema.safeParse(value);
  if (!result.success) {
    throw new InvalidVariantDataError(name, flattenIssues(result.error.issues));
  }
  return result.data;
}
