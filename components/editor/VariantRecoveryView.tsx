"use client";

import { useRef, type ChangeEvent } from "react";

import type { StorageDescription } from "@/components/platform/PlatformProvider";

import { Button } from "./ui/Button";
import { INPUT_CLASS } from "./ui/TextInput";

/**
 * The recovery screen itself, with no storage behind it: what is wrong, a way
 * to open any other variant, and a way to replace the broken one with an
 * export. VariantRecovery is the container that does the replacing.
 *
 * Opening another variant is a plain GET form to `/?variant=<name>`, a full
 * page load on purpose: the page starts over from the stored data, which works
 * the same in the local app and in the static web build.
 */
export function VariantRecoveryView({
  variant,
  variants,
  reason,
  issues,
  storage,
  busy,
  status,
  onReplace,
  onReload,
}: {
  variant: string;
  variants: string[];
  reason: string;
  issues: readonly { path: string; message: string }[];
  storage: StorageDescription;
  busy: boolean;
  status: string | null;
  onReplace: (file: File) => void;
  onReload: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const others = variants.filter((name) => name !== variant);

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so picking the same file twice fires change again.
    event.target.value = "";
    if (file) onReplace(file);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8 text-sm">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">
          Could not open the variant &ldquo;{variant}&rdquo;
        </h1>
        <p className="mt-2 text-neutral-700">{reason}</p>
        {storage.kind === "filesystem" ? (
          <p className="mt-2 text-neutral-500">
            The file is <code>data/{variant}.json</code>. It has not been
            changed. Fixing it in an editor and reloading is enough; a{" "}
            <code>data/{variant}.json.bak</code> next to it holds the content
            from before the last save.
          </p>
        ) : (
          <p className="mt-2 text-neutral-500">
            It is saved in this browser and has not been changed. Open another
            variant, or replace this one with a JSON export.
          </p>
        )}
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
        <Button onClick={onReload}>Reload</Button>
      </div>

      {status === null ? null : (
        <p role="alert" className="text-xs text-red-900">
          {status}
        </p>
      )}
    </main>
  );
}
