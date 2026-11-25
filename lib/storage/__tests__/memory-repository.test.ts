import { describe, expect, it } from "vitest";

import { InvalidVariantDataError } from "../errors";
import { createMemoryRepository } from "../memory-repository";

import { describeRepositoryContract, seedResume } from "./repository.contract";

describeRepositoryContract("memory", () => createMemoryRepository());

describe("createMemoryRepository", () => {
  it("can start from existing variants", async () => {
    const repo = createMemoryRepository({ default: seedResume("Ada") });

    expect(await repo.list()).toEqual(["default"]);
    expect(await repo.read("default")).toEqual(seedResume("Ada"));
  });

  it("reports a stored document the schema rejects", async () => {
    const repo = createMemoryRepository({ broken: { header: { name: 42 } } });

    const failure = repo.read("broken");
    await expect(failure).rejects.toBeInstanceOf(InvalidVariantDataError);
    await expect(failure).rejects.toMatchObject({
      variant: "broken",
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "header.name" }),
      ]),
    });
  });
});
