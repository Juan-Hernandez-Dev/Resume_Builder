/**
 * Turning a link's display label into the address it points at, for the
 * editor's "Use label as URL" button.
 *
 * A resume label is usually the address without its scheme
 * (`linkedin.com/in/johndoe`), because that is what reads well on paper. The
 * href still needs a scheme or the browser treats it as a relative path.
 */

/**
 * A scheme such as `https:` or `mailto:`. The colon must not be followed by a
 * digit, so `example.com:8080/cv` reads as a host and port, not as a scheme.
 */
const SCHEME = /^[a-z][a-z\d+.-]*:(?!\d)/i;

/**
 * `linkedin.com/in/x` -> `https://linkedin.com/in/x`, an email address ->
 * `mailto:...`, anything that already has a scheme is kept as is (so `http:`
 * is never upgraded behind the user's back). Blank in, empty string out.
 */
export function labelToUrl(label: string): string {
  const trimmed = label.trim();
  if (trimmed === "") return "";
  if (SCHEME.test(trimmed)) return trimmed;
  // An @ with no slash is an address; `medium.com/@handle` is a path.
  if (trimmed.includes("@") && !trimmed.includes("/")) {
    return `mailto:${trimmed}`;
  }
  return `https://${trimmed}`;
}
