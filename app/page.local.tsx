import { EditorShell } from "@/components/editor/EditorShell";
import { VariantRecovery } from "@/components/editor/VariantRecovery";
import { openInitial } from "@/lib/storage/bootstrap";
import { fsRepository } from "@/lib/storage/fs-repository";

/** The JSON files are read on every request, so edits show up on reload. */
export const dynamic = "force-dynamic";

/**
 * Reads the variant list and the starting document on the server, then hands
 * both to the client editor. This and the API routes are the only places the
 * files under data/ are touched.
 *
 * `openInitial` (lib/storage/bootstrap.ts) does the deciding, the same use
 * case the web build runs against IndexedDB: seed a first variant on a fresh
 * clone, open the one `?variant=<name>` asks for, or fall back to the recovery
 * screen when the storage or the variant cannot be read. The editor's own
 * dropdown switches variants over the API without reloading; the query
 * parameter exists so the recovery screen can still get to another variant
 * when the current one is the broken file.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { variant: requested } = await searchParams;
  const view = await openInitial(fsRepository, requested);

  if (view.kind === "recovery") {
    return (
      <VariantRecovery
        variant={view.variant}
        variants={view.variants}
        reason={view.reason}
        issues={view.issues}
      />
    );
  }

  return (
    <EditorShell
      initialVariant={view.variant}
      initialResume={view.resume}
      variants={view.variants}
    />
  );
}
