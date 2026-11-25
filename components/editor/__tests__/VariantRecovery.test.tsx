// @vitest-environment happy-dom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PlatformProvider,
  browserStorage,
  type Platform,
} from "@/components/platform/PlatformProvider";
import { emptyResume } from "@/lib/schema";
import { createMemoryRepository } from "@/lib/storage/memory-repository";
import type { ResumeRepository } from "@/lib/storage/port";

import { VariantRecovery } from "../VariantRecovery";

/**
 * The screen shown instead of the editor for a variant that cannot be read.
 * What it says depends on where variants live: a local user is pointed at the
 * file and its backup, a web visitor never hears about a data/ folder.
 */

const ISSUES = [{ path: "header.name", message: "Expected string" }];

function renderRecovery(platform?: Platform, reload = vi.fn()) {
  const view = (
    <VariantRecovery
      variant="default"
      variants={["default", "frontend"]}
      reason='Variant "default" does not match the resume schema.'
      issues={ISSUES}
      reload={reload}
    />
  );
  render(
    platform ? <PlatformProvider value={platform}>{view}</PlatformProvider> : view,
  );
  return reload;
}

function webPlatform(repository: ResumeRepository): Platform {
  return { repository, pdf: "print", storage: browserStorage };
}

async function pickFile(contents: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File([contents], "backup.json", { type: "application/json" });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
  // Lets the file read and the write settle.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  window.confirm = vi.fn(() => true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("VariantRecovery", () => {
  it("names the file and its backup in local mode", () => {
    renderRecovery();

    const text = document.body.textContent ?? "";
    expect(text).toContain("data/default.json");
    expect(text).toContain("data/default.json.bak");
    expect(text).toContain("header.name: Expected string");
  });

  it("talks about this browser, not files, in the web build", () => {
    renderRecovery(webPlatform(createMemoryRepository()));

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("data/");
    expect(text).not.toContain(".bak");
    expect(text).toContain("this browser");
    expect(text).toContain("header.name: Expected string");
  });

  it("opens another variant through ?variant=", () => {
    renderRecovery(webPlatform(createMemoryRepository()));

    const form = document.querySelector("form")!;
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/");
    expect(
      (form.querySelector('select[name="variant"]') as HTMLSelectElement).value,
    ).toBe("frontend");
  });

  it("replaces the broken variant through the repository, then reloads", async () => {
    const repository = createMemoryRepository({ default: { broken: true } });
    const reload = renderRecovery(webPlatform(repository));

    await pickFile(JSON.stringify(emptyResume()));

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('the "default" variant saved in this browser'),
    );
    expect(await repository.read("default")).toEqual(emptyResume());
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("leaves the variant alone when the replacement is cancelled", async () => {
    window.confirm = vi.fn(() => false);
    const repository = createMemoryRepository({ default: emptyResume() });
    const write = vi.spyOn(repository, "write");
    const reload = renderRecovery(webPlatform(repository));

    await pickFile(JSON.stringify(emptyResume()));

    expect(write).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("shows why a replacement could not be written", async () => {
    const repository = createMemoryRepository({ default: emptyResume() });
    vi.spyOn(repository, "write").mockRejectedValue(new Error("disk on fire"));
    const reload = renderRecovery(webPlatform(repository));

    await pickFile(JSON.stringify(emptyResume()));

    expect(screen.getByRole("alert").textContent).toBe(
      'Could not write "default": disk on fire',
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it("refuses a file that is not a resume without writing", async () => {
    const repository = createMemoryRepository({ default: emptyResume() });
    const write = vi.spyOn(repository, "write");
    renderRecovery(webPlatform(repository));

    await pickFile("not json");

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(write).not.toHaveBeenCalled();
  });
});
