import { describe, expect, it, vi } from "vitest";

import { StorageError } from "../errors";
import { createHttpRepository } from "../http-repository.web";

import { seedResume } from "./repository.contract";

/**
 * The web build's stand-in for the HTTP adapter: it must never send a
 * request (a static host has no API), and must fail in a way the start-up
 * treats as storage that is not there.
 */
describe("createHttpRepository in the web build", () => {
  it("rejects every call as unavailable without sending a request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const repo = createHttpRepository();

    for (const call of [
      repo.list(),
      repo.read("default"),
      repo.write("default", seedResume()),
      repo.create("default", seedResume()),
      repo.duplicate("default", "copy"),
    ]) {
      await expect(call).rejects.toBeInstanceOf(StorageError);
      await expect(call).rejects.toMatchObject({ reason: "unavailable" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
