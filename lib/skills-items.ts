/**
 * Skills entries store their items as an array, but the editor exposes them as
 * one comma separated input because that is how people actually type a skill
 * list. These two functions are the whole translation layer.
 */

/** Splits user input into items, trimming each one and dropping the empties. */
export function parseItems(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

/**
 * Renders an item array back into the input. Deliberately does not trim or
 * filter: the stored array is shown exactly as it is, so a half-typed value is
 * never rewritten under the cursor.
 */
export function formatItems(items: string[]): string {
  return items.join(", ");
}
