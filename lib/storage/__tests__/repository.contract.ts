import { describe, expect, it } from "vitest";

import { emptyResume, type Resume } from "@/lib/schema";
import { InvalidVariantNameError } from "@/lib/variant-name";

import {
  InvalidVariantDataError,
  VariantExistsError,
  VariantNotFoundError,
} from "../errors";
import type { ResumeRepository } from "../port";

/**
 * The behaviour every ResumeRepository adapter promises (see lib/storage/
 * port.ts). Each adapter's test file calls this with a factory that returns a
 * fresh, empty repository, so a test never sees another test's variants.
 */

export function seedResume(name = "Ada"): Resume {
  const resume = emptyResume();
  resume.header.name = name;
  resume.sections = [
    {
      id: "s1",
      title: "Experience",
      visible: true,
      type: "entries",
      entries: [
        {
          id: "e1",
          visible: true,
          org: "Acme",
          location: "Remote",
          role: "Engineer",
          period: "2024 - Present",
          bullets: ["Shipped things"],
        },
      ],
    },
  ];
  return resume;
}

export function describeRepositoryContract(
  adapter: string,
  factory: () => ResumeRepository | Promise<ResumeRepository>,
): void {
  describe(`${adapter} repository contract`, () => {
    it("starts empty", async () => {
      const repo = await factory();
      expect(await repo.list()).toEqual([]);
    });

    it("lists variants sorted by name", async () => {
      const repo = await factory();
      await repo.create("frontend", seedResume());
      await repo.create("backend", seedResume());
      await repo.create("default", seedResume());

      expect(await repo.list()).toEqual(["backend", "default", "frontend"]);
    });

    it("reads back what was created", async () => {
      const repo = await factory();
      const created = await repo.create("default", seedResume("Grace"));

      expect(created).toEqual(seedResume("Grace"));
      expect(await repo.read("default")).toEqual(seedResume("Grace"));
    });

    it("fills in schema defaults on the way in", async () => {
      const repo = await factory();
      const partial = seedResume();
      // A document from an older version of the app, before settings existed.
      delete (partial as Partial<Resume>).settings;

      const created = await repo.create("default", partial);

      expect(created.settings).toEqual(emptyResume().settings);
      expect((await repo.read("default")).settings).toEqual(
        emptyResume().settings,
      );
    });

    it("reports a missing variant on read", async () => {
      const repo = await factory();

      await expect(repo.read("nope")).rejects.toBeInstanceOf(
        VariantNotFoundError,
      );
      await expect(repo.read("nope")).rejects.toMatchObject({
        variant: "nope",
      });
    });

    it("replaces an existing variant on write", async () => {
      const repo = await factory();
      await repo.create("default", seedResume("Ada"));

      const written = await repo.write("default", seedResume("Grace"));

      expect(written).toEqual(seedResume("Grace"));
      expect(await repo.read("default")).toEqual(seedResume("Grace"));
    });

    it("never creates a variant on write", async () => {
      const repo = await factory();

      await expect(
        repo.write("ghost", seedResume()),
      ).rejects.toBeInstanceOf(VariantNotFoundError);
      expect(await repo.list()).toEqual([]);
    });

    it("refuses to create a variant twice, keeping the first", async () => {
      const repo = await factory();
      await repo.create("default", seedResume("Ada"));

      await expect(
        repo.create("default", seedResume("Grace")),
      ).rejects.toBeInstanceOf(VariantExistsError);
      expect(await repo.read("default")).toEqual(seedResume("Ada"));
    });

    it("refuses a document the schema rejects, storing nothing", async () => {
      const repo = await factory();
      const broken = { header: { name: 42 } } as unknown as Resume;

      await expect(repo.create("default", broken)).rejects.toBeInstanceOf(
        InvalidVariantDataError,
      );
      expect(await repo.list()).toEqual([]);

      await repo.create("default", seedResume());
      await expect(repo.write("default", broken)).rejects.toBeInstanceOf(
        InvalidVariantDataError,
      );
      expect(await repo.read("default")).toEqual(seedResume());
    });

    it("duplicates a variant into a new one", async () => {
      const repo = await factory();
      await repo.create("default", seedResume("Ada"));

      const copy = await repo.duplicate("default", "frontend");

      expect(copy).toEqual(seedResume("Ada"));
      expect(await repo.read("frontend")).toEqual(seedResume("Ada"));
      expect(await repo.list()).toEqual(["default", "frontend"]);
    });

    it("refuses to duplicate a missing variant", async () => {
      const repo = await factory();

      await expect(
        repo.duplicate("nope", "frontend"),
      ).rejects.toBeInstanceOf(VariantNotFoundError);
      expect(await repo.list()).toEqual([]);
    });

    it("refuses to duplicate onto an existing name, keeping it", async () => {
      const repo = await factory();
      await repo.create("default", seedResume("Ada"));
      await repo.create("frontend", seedResume("Grace"));

      await expect(
        repo.duplicate("default", "frontend"),
      ).rejects.toBeInstanceOf(VariantExistsError);
      expect(await repo.read("frontend")).toEqual(seedResume("Grace"));
    });

    it("rejects invalid names before touching storage", async () => {
      const repo = await factory();
      await repo.create("default", seedResume());

      for (const name of ["", "../evil", "Upper", "with space", "a/b"]) {
        await expect(repo.read(name), name).rejects.toBeInstanceOf(
          InvalidVariantNameError,
        );
        await expect(
          repo.write(name, seedResume()),
          name,
        ).rejects.toBeInstanceOf(InvalidVariantNameError);
        await expect(
          repo.create(name, seedResume()),
          name,
        ).rejects.toBeInstanceOf(InvalidVariantNameError);
        await expect(
          repo.duplicate("default", name),
          name,
        ).rejects.toBeInstanceOf(InvalidVariantNameError);
        await expect(
          repo.duplicate(name, "copy"),
          name,
        ).rejects.toBeInstanceOf(InvalidVariantNameError);
      }
      expect(await repo.list()).toEqual(["default"]);
    });

    it("hands out copies: changing a returned document changes nothing stored", async () => {
      const repo = await factory();
      const created = await repo.create("default", seedResume("Ada"));
      created.header.name = "Mutated";

      const read = await repo.read("default");
      read.header.name = "Mutated too";
      read.sections.length = 0;

      expect(await repo.read("default")).toEqual(seedResume("Ada"));
    });

    it("keeps its own copy: changing a document after handing it in changes nothing stored", async () => {
      const repo = await factory();
      const input = seedResume("Ada");
      await repo.create("default", input);
      input.header.name = "Mutated";

      const next = seedResume("Grace");
      await repo.write("default", next);
      next.sections.length = 0;

      expect(await repo.read("default")).toEqual(seedResume("Grace"));
    });
  });
}
