import { describe, expect, it } from "vitest";

import { toPlainText } from "@/lib/plain-text";
import { resumeSchema, type Resume } from "@/lib/schema";

function makeResume(overrides: Partial<Resume> = {}): Resume {
  return resumeSchema.parse({
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
            bullets: ["Cut checkout latency.", "Led the schema migration."],
          },
          {
            id: "e2",
            visible: true,
            org: "Harbor Point Systems",
            location: "",
            role: "",
            period: "",
            bullets: [],
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
            id: "e3",
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
            id: "e4",
            visible: true,
            label: "Backend & Cloud",
            items: ["Node.js", "Azure", "SQL"],
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
            id: "e5",
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
    ...overrides,
  });
}

describe("toPlainText", () => {
  it("renders the header, then every section in order", () => {
    expect(toPlainText(makeResume())).toBe(
      [
        "John Doe",
        "Austin, TX",
        "LinkedIn: https://www.linkedin.com/in/johndoe | +1 (555) 010-4477 | john.doe@example.com",
        "",
        "Professional experience",
        "Meridian Logistics | Remote",
        "Senior Software Engineer | 2025 - Present",
        "- Cut checkout latency.",
        "- Led the schema migration.",
        "",
        "Harbor Point Systems",
        "",
        "Achievements",
        "Meridian Internal Hackathon | Austin, TX",
        "1st Place, Company-wide. | 2023",
        "",
        "Technical skills",
        "Backend & Cloud: Node.js, Azure, SQL",
        "",
        "Related skills",
        "AWS Certified Solutions Architect, Associate | Issued by Amazon Web Services",
        "Credential ID EXAMPLE-0000 | Mar. 14, 2023",
        "Digital Certificate: https://example.com/certificate",
      ].join("\n"),
    );
  });

  it("keeps the DOM reading order org, location, role, period, bullets", () => {
    const text = toPlainText(makeResume());
    const org = text.indexOf("Meridian Logistics");
    const location = text.indexOf("Remote", org);
    const role = text.indexOf("Senior Software Engineer");
    const period = text.indexOf("2025 - Present");
    const bullet = text.indexOf("- Cut checkout latency.");

    expect(org).toBeLessThan(location);
    expect(location).toBeLessThan(role);
    expect(role).toBeLessThan(period);
    expect(period).toBeLessThan(bullet);
  });

  it("excludes hidden sections", () => {
    const resume = makeResume();
    resume.sections[1].visible = false;

    const text = toPlainText(resume);

    expect(text).not.toContain("Achievements");
    expect(text).not.toContain("Meridian Internal Hackathon");
    expect(text).toContain("Technical skills");
  });

  it("excludes hidden entries but keeps their section", () => {
    const resume = makeResume();
    const section = resume.sections[0];
    if (section.type !== "entries") throw new Error("expected an entries section");
    section.entries[0].visible = false;

    const text = toPlainText(resume);

    expect(text).toContain("Professional experience");
    expect(text).not.toContain("Meridian Logistics");
    expect(text).toContain("Harbor Point Systems");
  });

  it("omits empty header fields and empty link labels", () => {
    const resume = makeResume();
    resume.header.location = "";
    resume.header.phone = "";
    resume.header.links = [{ label: "", url: "https://example.com" }];

    const text = toPlainText(resume);
    const lines = text.split("\n");

    expect(lines[0]).toBe("John Doe");
    expect(lines[1]).toBe("https://example.com | john.doe@example.com");
  });

  it("applies the en dash setting to period ranges", () => {
    const resume = makeResume();
    resume.settings.dateSeparator = "endash";

    expect(toPlainText(resume)).toContain("Senior Software Engineer | 2025 – Present");
  });

  it("keeps skill lines contiguous, mirroring the rendered block", () => {
    const resume = resumeSchema.parse({
      header: {},
      sections: [
        {
          id: "s1",
          title: "Technical skills",
          type: "skills",
          entries: [
            { id: "e1", label: "Frontend", items: ["React.js"] },
            { id: "e2", label: "Backend", items: ["Node.js"] },
          ],
        },
      ],
    });

    expect(toPlainText(resume)).toBe(
      ["Technical skills", "Frontend: React.js", "Backend: Node.js"].join("\n"),
    );
  });

  it("returns an empty string for a resume with no content", () => {
    const resume = resumeSchema.parse({ header: {}, sections: [] });

    expect(toPlainText(resume)).toBe("");
  });
});
