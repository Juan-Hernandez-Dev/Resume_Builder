"use client";

import { Header } from "./Header";
import { Section } from "./Section";
import { useInlineEditing } from "./inline-edit";

import type { Resume } from "@/lib/schema";

/**
 * The white page box at real physical size (Letter or A4, driven by the
 * data-page-size attribute). Page margins are this element's own padding, so
 * printing can use @page { margin: 0 }.
 *
 * Purely presentational: it renders the visible sections in order and nothing
 * else. Every layout rule lives in app/resume.css.
 *
 * `resume-page--editing` is the single hook every edit affordance hangs off, so
 * none of that chrome can reach a page that is only being displayed.
 */
export function ResumePage({ resume }: { resume: Resume }) {
  const editing = useInlineEditing();

  return (
    <article
      className={editing ? "resume-page resume-page--editing" : "resume-page"}
      data-page-size={resume.settings.pageSize}
    >
      <Header header={resume.header} />
      {resume.sections
        .filter((section) => section.visible)
        .map((section) => (
          <Section key={section.id} section={section} settings={resume.settings} />
        ))}
    </article>
  );
}
