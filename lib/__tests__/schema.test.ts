import { describe, expect, it } from "vitest";

import {
  emptyResume,
  newId,
  resumeSchema,
  sectionSchema,
} from "@/lib/schema";

const validResume = {
  header: {
    name: "John Doe",
    location: "Austin, TX",
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/johndoe" }],
    phone: "+1 (555) 010-4477",
    email: "john.doe@example.com",
  },
  sections: [
    {
      id: "s1",
      title: "Professional experience",
      type: "entries",
      visible: true,
      entries: [
        {
          id: "e1",
          visible: true,
          org: "Meridian Logistics",
          location: "Remote",
          role: "Senior Software Engineer",
          period: "2025 - Present",
          bullets: ["Did a thing."],
        },
      ],
    },
    {
      id: "s2",
      title: "Achievements",
      type: "achievements",
      visible: true,
      entries: [
        {
          id: "e2",
          visible: true,
          title: "Meridian Internal Hackathon",
          location: "Austin, TX",
          description: "1st Place, Company-wide.",
          year: "2023",
        },
      ],
    },
    {
      id: "s3",
      title: "Technical skills",
      type: "skills",
      visible: true,
      entries: [
        {
          id: "e3",
          visible: true,
          label: "Backend & Cloud",
          items: ["Node.js", "Azure"],
        },
      ],
    },
    {
      id: "s4",
      title: "Related skills",
      type: "certifications",
      visible: true,
      entries: [
        {
          id: "e4",
          visible: true,
          name: "AWS Certified Solutions Architect, Associate",
          issuer: "Issued by Amazon Web Services",
          detail: "Credential ID EXAMPLE-0000",
          date: "Mar. 14, 2023",
          linkLabel: "Digital Certificate",
          url: "https://example.com/certificate",
        },
      ],
    },
  ],
  settings: {
    pageSize: "a4",
    dateSeparator: "endash",
  },
};

describe("resumeSchema", () => {
  it("parses a fully populated resume and keeps every value", () => {
    const parsed = resumeSchema.parse(validResume);

    expect(parsed.header.name).toBe("John Doe");
    expect(parsed.header.links).toEqual([
      { label: "LinkedIn", url: "https://www.linkedin.com/in/johndoe" },
    ]);
    expect(parsed.sections.map((section) => section.type)).toEqual([
      "entries",
      "achievements",
      "skills",
      "certifications",
    ]);
    expect(parsed.settings).toEqual({ pageSize: "a4", dateSeparator: "endash" });
  });

  it("applies default settings when they are missing", () => {
    const parsed = resumeSchema.parse({
      header: validResume.header,
      sections: validResume.sections,
    });

    expect(parsed.settings).toEqual({
      pageSize: "letter",
      dateSeparator: "hyphen",
    });
  });

  it("defaults header fields, section visibility and entry collections", () => {
    const parsed = resumeSchema.parse({
      header: { name: "John" },
      sections: [
        { id: "s1", title: "Professional experience", type: "entries" },
      ],
    });

    expect(parsed.header).toEqual({
      name: "John",
      location: "",
      links: [],
      phone: "",
      email: "",
    });
    expect(parsed.sections[0]).toEqual({
      id: "s1",
      title: "Professional experience",
      type: "entries",
      visible: true,
      entries: [],
    });
  });

  it("defaults entry visibility and bullets", () => {
    const parsed = sectionSchema.parse({
      id: "s1",
      title: "Professional experience",
      type: "entries",
      entries: [{ id: "e1", org: "Harbor Point Systems" }],
    });

    expect(parsed.type).toBe("entries");
    if (parsed.type !== "entries") throw new Error("expected an entries section");
    expect(parsed.entries[0]).toEqual({
      id: "e1",
      visible: true,
      org: "Harbor Point Systems",
      location: "",
      role: "",
      period: "",
      bullets: [],
    });
  });

  it("rejects an unknown section type", () => {
    const result = resumeSchema.safeParse({
      header: { name: "John" },
      sections: [{ id: "s1", title: "Hobbies", type: "hobbies", entries: [] }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.length).toBeGreaterThan(0);
  });

  it("rejects entries that do not match their section type", () => {
    const result = resumeSchema.safeParse({
      header: { name: "John" },
      sections: [
        {
          id: "s1",
          title: "Technical skills",
          type: "skills",
          entries: [{ id: "e1", items: "Node.js" }],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing header and a non-array sections value", () => {
    expect(resumeSchema.safeParse({ sections: [] }).success).toBe(false);
    expect(
      resumeSchema.safeParse({ header: { name: "John" }, sections: {} }).success,
    ).toBe(false);
  });

  it("rejects non-string ids", () => {
    const result = resumeSchema.safeParse({
      header: { name: "John" },
      sections: [{ id: 1, title: "Experience", type: "entries", entries: [] }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unknown page size", () => {
    const result = resumeSchema.safeParse({
      ...validResume,
      settings: { pageSize: "legal", dateSeparator: "hyphen" },
    });

    expect(result.success).toBe(false);
  });
});

describe("newId", () => {
  it("returns distinct non-empty strings", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));

    expect(ids.size).toBe(50);
    for (const id of ids) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });
});

describe("emptyResume", () => {
  it("produces a value that satisfies the schema", () => {
    expect(resumeSchema.safeParse(emptyResume()).success).toBe(true);
  });
});
