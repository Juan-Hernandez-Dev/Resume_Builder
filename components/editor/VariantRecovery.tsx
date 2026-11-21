"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { describeFailure, messageOf } from "@/lib/api-response";
import { readResumeFile } from "@/lib/import-file";

import { Button } from "./ui/Button";
import { INPUT_CLASS } from "./ui/TextInput";

/**
 * Shown instead of the editor when the variant the page tried to open cannot
 * be read: malformed JSON, a document that no longer matches the schema, or a
 * file the operating system refused.
 *
 * The point is that one bad file never makes the app unloadable. Everything
 * needed to get out of the state is here: which file is at fault, exactly what
 * is wrong with it, a way to open any other variant, and a way to overwrite
 * the broken file with a known-good export. The broken file itself is left
 * untouched until the user explicitly replaces it.
 */
export function VariantRecovery({
  variant,
  variants,
  reason,
  issues,
}: {
  variant: string;
  variants: string[];
  reason: string;
  issues: readonly { path: string; message: string }[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const others = variants.filter((name) => name !== variant);

  async function replaceWith(file: File) {
    setStatus(null);

    const imported = await readResumeFile(file);
    if (!imported.ok) {
      setStatus(imported.error);
      return;
    }

    if (
      !window.confirm(
        `Replace the contents of data/${variant}.json with ${file.name}? The current file cannot be recovered from the app afterwards.`,
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/variants/${encodeURIComponent(variant)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(imported.resume),
      });
      if (!response.ok) {
        setStatus(
          await describeFailure(response, `Could not write "${variant}".`),
        );
        return;
      }
      window.location.reload();
    } catch (cause) {
      setStatus(`Could not write "${variant}": ${messageOf(cause)}`);
    } finally {
      setBusy(false);
    }
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so picking the same file twice fires change again.
    event.target.value = "";
    if (file) void replaceWith(file);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8 text-sm">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">
          Could not open the variant &ldquo;{variant}&rdquo;
        </h1>
        <p className="mt-2 text-neutral-700">{reason}</p>
        <p className="mt-2 text-neutral-500">
          The file is <code>data/{variant}.json</code>. It has not been changed.
          Fixing it in an editor and reloading is enough; a{" "}
          <code>data/{variant}.json.bak</code> next to it holds the content from
          before the last save.
        </p>
      </div>

      {issues.length === 0 ? null : (
        <div>
          <h2 className="font-medium text-neutral-900">What does not match</h2>
          <ul className="mt-2 space-y-1 font-mono text-xs text-red-900">
            {issues.map((issue, index) => (
              <li key={`${issue.path}-${index}`}>
                {issue.path === "" ? "(document)" : issue.path}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {others.length === 0 ? null : (
        <form action="/" method="get" className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
              Variant
            </span>
            <select
              name="variant"
              defaultValue={others[0]}
              className={`${INPUT_CLASS} w-auto py-1 text-xs`}
            >
              {others.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <Button primary type="submit">
            Open
          </Button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy} onClick={() => fileRef.current?.click()}>
          Replace with a JSON file…
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          className="hidden"
        />
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>

      {status === null ? null : (
        <p role="alert" className="text-xs text-red-900">
          {status}
        </p>
      )}
    </main>
  );
}
