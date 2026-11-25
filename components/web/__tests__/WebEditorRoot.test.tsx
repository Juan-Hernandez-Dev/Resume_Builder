// @vitest-environment happy-dom

import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyResume } from "@/lib/schema";
import { createBrowserRepository } from "@/lib/storage/browser-repository";
import { createMemoryRepository } from "@/lib/storage/memory-repository";
import type { ResumeRepository } from "@/lib/storage/port";

import { WebEditorRoot } from "../WebEditorRoot";

/**
 * The web build's page: everything happens in the browser, after hydration,
 * against IndexedDB (fake-indexeddb here, a fresh database per test).
 */

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function renderRoot(repository: () => ResumeRepository) {
  render(<WebEditorRoot createRepository={repository} />);
  // Lets the start-up effect open the storage and read the variant.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function named(name: string) {
  const resume = emptyResume();
  resume.header.name = name;
  return resume;
}

describe("WebEditorRoot", () => {
  it("renders the same loading screen on the server as on the first client render", () => {
    const html = renderToString(
      <WebEditorRoot createRepository={() => createMemoryRepository()} />,
    );
    expect(html).toContain("Loading…");
  });

  it("seeds an empty default variant on a first visit and opens the editor", async () => {
    const idb = new IDBFactory();
    await renderRoot(() => createBrowserRepository({ idb }));

    expect(screen.queryByText("Loading…")).toBeNull();
    expect(screen.getByRole("button", { name: "Load example" })).toBeTruthy();
    expect(
      (screen.getByRole("combobox", { name: "Variant" }) as HTMLSelectElement)
        .value,
    ).toBe("default");
    expect(await createBrowserRepository({ idb }).list()).toEqual(["default"]);
  });

  it("says that resumes are kept only in this browser", async () => {
    await renderRoot(() => createMemoryRepository());

    expect(
      screen.getByText(
        "Your resumes are saved only in this browser. Export JSON to keep a backup.",
      ),
    ).toBeTruthy();
  });

  it("opens the variant named by ?variant=", async () => {
    window.history.replaceState(null, "", "/?variant=frontend");
    await renderRoot(() =>
      createMemoryRepository({ default: named("Ada"), frontend: named("Grace") }),
    );

    expect(
      (screen.getByRole("combobox", { name: "Variant" }) as HTMLSelectElement)
        .value,
    ).toBe("frontend");
  });

  it("shows the recovery screen, in browser terms, for stored data the schema rejects", async () => {
    await renderRoot(() =>
      createMemoryRepository({ default: { header: { name: 42 } } }),
    );

    expect(
      screen.getByRole("heading", { name: /Could not open the variant/ }),
    ).toBeTruthy();
    const text = document.body.textContent ?? "";
    expect(text).toContain("header.name");
    expect(text).not.toContain("data/");
  });

  it("falls back to memory, and says so, when the browser has no IndexedDB", async () => {
    await renderRoot(() => createBrowserRepository({ idb: undefined }));

    expect(screen.getByRole("button", { name: "Load example" })).toBeTruthy();
    expect(document.body.textContent).toContain(
      "nothing is saved when this tab closes",
    );
  });
});
