"use client";

import { Fragment, type ReactNode } from "react";

import { Editable } from "./Editable";
import { useInlineEditing } from "./inline-edit";

import type { ResumeHeader } from "@/lib/schema";

/**
 * Centred document header. The contact line is real text joined with " | ",
 * never generated content, so an ATS reads exactly what the reader sees.
 *
 * While the page is being edited, every field is rendered even when it is
 * empty — an empty field that is not in the DOM cannot be clicked — and
 * app/print.css drops those again, so the printed header is the same document
 * either way. That is also why the separators move into their own spans in
 * edit mode: a " | " left behind by a field that print hid would show up in
 * the PDF as a stray pipe.
 */
export function Header({ header }: { header: ResumeHeader }) {
  const editing = useInlineEditing();
  /** One contact item plus whether it is the empty, print-dropped kind. */
  const items: { node: ReactNode; empty: boolean }[] = [];

  for (const [index, link] of header.links.entries()) {
    if (!editing && !link.url && !link.label) continue;

    // The anchor shows the raw URL when there is no label, in both modes, so
    // what prints does not depend on whether editing was on.
    const shown = link.label || link.url;
    items.push({
      empty: shown === "",
      node: link.url ? (
        <Editable
          as="a"
          href={link.url}
          target={{ kind: "link", index, field: "label" }}
          value={shown}
          placeholder="Label"
        />
      ) : (
        <Editable
          target={{ kind: "link", index, field: "label" }}
          value={link.label}
          placeholder="Label"
        />
      ),
    });
  }

  if (editing || header.phone) {
    items.push({
      empty: header.phone === "",
      node: (
        <Editable
          target={{ kind: "header", field: "phone" }}
          value={header.phone}
          placeholder="Phone"
        />
      ),
    });
  }

  if (editing || header.email) {
    items.push({
      empty: header.email === "",
      node: (
        <Editable
          as="a"
          href={`mailto:${header.email}`}
          target={{ kind: "header", field: "email" }}
          value={header.email}
          placeholder="Email"
        />
      ),
    });
  }

  return (
    <header className="resume-header">
      {editing || header.name ? (
        <Editable
          as="h1"
          className="resume-header__name"
          target={{ kind: "header", field: "name" }}
          value={header.name}
          placeholder="Your name"
        />
      ) : null}
      {editing || header.location ? (
        <Editable
          as="p"
          className="resume-header__line"
          target={{ kind: "header", field: "location" }}
          value={header.location}
          placeholder="City, Country"
        />
      ) : null}
      {items.length > 0 ? (
        <p
          className="resume-header__line"
          // A contact line that is entirely placeholders is not a line; its
          // own margin would otherwise still print.
          data-inline-empty={
            editing && items.every((item) => item.empty) ? "true" : undefined
          }
        >
          {editing
            ? editableContacts(items)
            : items.map((item, index) => (
                <Fragment key={index}>
                  {index > 0 ? " | " : null}
                  {item.node}
                </Fragment>
              ))}
        </p>
      ) : null}
    </header>
  );
}

/**
 * The contact line in edit mode: the same text, with each separator in a span
 * that print can drop.
 *
 * A separator only prints when something before it prints and the field after
 * it prints too, which is exactly when the non-editing render would have
 * emitted one.
 */
function editableContacts(items: { node: ReactNode; empty: boolean }[]) {
  const nodes: ReactNode[] = [];
  let printedBefore = false;

  for (const [index, item] of items.entries()) {
    if (index > 0) {
      nodes.push(
        <span
          key={`separator-${index}`}
          data-inline-empty={!printedBefore || item.empty ? "true" : undefined}
        >
          {" | "}
        </span>,
      );
    }
    nodes.push(<Fragment key={`item-${index}`}>{item.node}</Fragment>);
    if (!item.empty) printedBefore = true;
  }

  return nodes;
}
