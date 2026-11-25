import { resumeSchema, type Resume } from "./schema";

/** The variant "Load example" creates, or opens when it is already there. */
export const EXAMPLE_VARIANT = "example";

/**
 * The placeholder resume in examples/john-doe.json, validated. Imported on
 * demand, so it is fetched only when someone asks for it and never weighs on
 * the editor's first load.
 *
 * This is the one runtime module allowed to reference examples/ (see
 * lib/__tests__/fresh-clone.test.ts): the app reads the placeholder only to
 * create a variant from it, and never treats it as a variant itself.
 */
export async function loadExampleResume(): Promise<Resume> {
  const { default: example } = await import("@/examples/john-doe.json");
  // A parse builds a new object, so each caller gets its own copy.
  return resumeSchema.parse(example);
}
