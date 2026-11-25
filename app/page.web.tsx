import { WebEditorRoot } from "@/components/web/WebEditorRoot";

/**
 * The web build's only page (see next.config.ts for how the build picks it).
 *
 * It is exported as static HTML, so this Server Component runs once, at build
 * time, and knows nothing about the visitor: no searchParams, no storage. All
 * of that happens in WebEditorRoot, in the browser, against IndexedDB.
 */
export default function Home() {
  return <WebEditorRoot />;
}
