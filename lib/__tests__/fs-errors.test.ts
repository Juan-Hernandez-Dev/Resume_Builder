import path from "node:path";

import { describe, expect, it } from "vitest";

import { describeFsError, fsErrorStatus, isFsError } from "@/lib/fs-errors";

/** An fs error as Node throws it, path and all. */
function fsError(code: string, file = path.join("D:", "secret", "data", "x.json")) {
  return Object.assign(
    new Error(`${code}: operation failed, open '${file}'`),
    { code, path: file, syscall: "open", errno: -1 },
  );
}

describe("isFsError", () => {
  it("recognizes the codes it can explain", () => {
    for (const code of [
      "EACCES",
      "EPERM",
      "EBUSY",
      "ENOSPC",
      "EROFS",
      "EMFILE",
      "ENFILE",
      "EISDIR",
      "ENOTDIR",
      "EAGAIN",
    ]) {
      expect(isFsError(fsError(code))).toBe(true);
    }
  });

  it("does not claim an ordinary bug", () => {
    expect(isFsError(new Error("boom"))).toBe(false);
    expect(isFsError(new TypeError("x is not a function"))).toBe(false);
    expect(isFsError(fsError("ESOMETHINGNEW"))).toBe(false);
    expect(isFsError(null)).toBe(false);
    expect(isFsError(undefined)).toBe(false);
    expect(isFsError("EACCES")).toBe(false);
    expect(isFsError({ code: 42 })).toBe(false);
  });

  it("does not claim ENOENT, which the domain errors already cover", () => {
    expect(isFsError(fsError("ENOENT"))).toBe(false);
  });
});

describe("describeFsError", () => {
  it("returns null for anything it cannot explain, so the caller rethrows", () => {
    expect(describeFsError(new Error("boom"), "Could not save")).toBeNull();
    expect(describeFsError(fsError("ENOENT"), "Could not save")).toBeNull();
  });

  it("keeps the caller's description and adds the actionable reason", () => {
    const message = describeFsError(fsError("ENOSPC"), 'Could not save "cv"');
    expect(message).toContain('Could not save "cv"');
    expect(message?.toLowerCase()).toContain("disk");
  });

  it("tells disk-full apart from a permission problem", () => {
    const full = describeFsError(fsError("ENOSPC"), "Could not save");
    const denied = describeFsError(fsError("EACCES"), "Could not save");
    const locked = describeFsError(fsError("EBUSY"), "Could not save");
    expect(full).not.toBe(denied);
    expect(denied).not.toBe(locked);
    expect(full).not.toBe(locked);
  });

  it("says a locked file is worth retrying", () => {
    expect(describeFsError(fsError("EBUSY"), "Could not save")).toMatch(
      /again/i,
    );
    expect(describeFsError(fsError("EPERM"), "Could not save")).toMatch(
      /again/i,
    );
  });

  it("names the error code so the cause is still diagnosable", () => {
    expect(describeFsError(fsError("EROFS"), "Could not save")).toContain(
      "EROFS",
    );
  });

  it("never leaks the absolute path of the file", () => {
    const secret = path.join("D:", "Users", "johndoe", "data", "default.json");
    for (const code of ["EACCES", "EPERM", "EBUSY", "ENOSPC", "EROFS"]) {
      const message = describeFsError(fsError(code, secret), "Could not save");
      expect(message).not.toBeNull();
      expect(message).not.toContain(secret);
      expect(message).not.toContain("johndoe");
      expect(message).not.toContain("D:");
      expect(message).not.toContain("default.json");
    }
  });

  it("never leaks the original fs message, which carries the path", () => {
    const error = fsError("EACCES");
    expect(describeFsError(error, "Could not save")).not.toContain(error.message);
  });
});

describe("fsErrorStatus", () => {
  it("reports a transient lock as 503, so a retry is the right answer", () => {
    expect(fsErrorStatus(fsError("EBUSY"))).toBe(503);
    expect(fsErrorStatus(fsError("EPERM"))).toBe(503);
    expect(fsErrorStatus(fsError("EMFILE"))).toBe(503);
    expect(fsErrorStatus(fsError("ENFILE"))).toBe(503);
    expect(fsErrorStatus(fsError("EAGAIN"))).toBe(503);
  });

  it("reports a condition a retry cannot fix as 500", () => {
    expect(fsErrorStatus(fsError("EACCES"))).toBe(500);
    expect(fsErrorStatus(fsError("ENOSPC"))).toBe(500);
    expect(fsErrorStatus(fsError("EROFS"))).toBe(500);
    expect(fsErrorStatus(fsError("EISDIR"))).toBe(500);
    expect(fsErrorStatus(fsError("ENOTDIR"))).toBe(500);
  });

  it("falls back to 500 for anything unrecognized", () => {
    expect(fsErrorStatus(new Error("boom"))).toBe(500);
  });
});
