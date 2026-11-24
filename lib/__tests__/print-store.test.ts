import { describe, expect, it } from "vitest";

import {
  PRINT_JOB_TTL_MS,
  deletePrintJob,
  getPrintJob,
  putPrintJob,
} from "@/lib/print-store";
import { emptyResume, type Resume } from "@/lib/schema";

function resumeNamed(name: string): Resume {
  const resume = emptyResume();
  resume.header.name = name;
  return resume;
}

describe("print store", () => {
  it("hands back the document stored under a token", () => {
    const token = putPrintJob(resumeNamed("Ada"));
    expect(getPrintJob(token)?.header.name).toBe("Ada");
  });

  it("can be read more than once until it is deleted", () => {
    const token = putPrintJob(resumeNamed("Ada"));
    expect(getPrintJob(token)).not.toBeNull();
    expect(getPrintJob(token)).not.toBeNull();

    deletePrintJob(token);
    expect(getPrintJob(token)).toBeNull();
  });

  it("issues a different, unguessable token every time", () => {
    const first = putPrintJob(resumeNamed("Ada"));
    const second = putPrintJob(resumeNamed("Ada"));
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("knows nothing about a token it never issued", () => {
    expect(getPrintJob("not-a-token")).toBeNull();
    expect(getPrintJob(undefined)).toBeNull();
    expect(getPrintJob(["a", "b"])).toBeNull();
  });

  it("forgets a job once its time to live has passed", () => {
    const start = 1_000_000;
    const token = putPrintJob(resumeNamed("Ada"), start);

    expect(getPrintJob(token, start + PRINT_JOB_TTL_MS - 1)).not.toBeNull();
    expect(getPrintJob(token, start + PRINT_JOB_TTL_MS)).toBeNull();
    // Expiry removes it for good, not only for late readers.
    expect(getPrintJob(token, start)).toBeNull();
  });

  it("sweeps expired jobs when a new one is stored", () => {
    const start = 2_000_000;
    const stale = putPrintJob(resumeNamed("Old"), start);
    putPrintJob(resumeNamed("New"), start + PRINT_JOB_TTL_MS + 1);

    expect(getPrintJob(stale, start)).toBeNull();
  });

  it("keeps a copy, so later edits to the original do not leak in", () => {
    const resume = resumeNamed("Ada");
    const token = putPrintJob(resume);
    resume.header.name = "Changed";
    expect(getPrintJob(token)?.header.name).toBe("Ada");
  });
});
