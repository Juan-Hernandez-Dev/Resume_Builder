# Resume Builder

A local, single-column resume builder with a print-accurate live preview. The
content is structured JSON edited through a form UI; the right pane renders the
document at real page size (Letter or A4), so what you see is what the PDF
gets.

No database, no account, no network calls. The document never leaves the
machine.

![The editor: forms on the left, the live page at real size on the right](docs/screenshot.png)

## Why it exists

Resume tools tend to make you pick between a WYSIWYG editor that fights you
over a single line break and a LaTeX template that needs a recompile to see a
change. This keeps the content as data and the layout as CSS, so the content
stays editable as a form while the page stays exact.

One constraint shapes the whole design: a resume is **one page**. So the
preview is the real page at real size, and an indicator in the toolbar tells
you the moment the document stops fitting.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
zod · dnd-kit · vitest

~9,700 lines across 72 source files, covered by 293 unit tests.

## Design notes

The decisions worth a look, if you are reading this as a code sample:

- **One schema, one source of truth.** `lib/schema.ts` is a zod schema that
  every layer parses through: both API routes, the editor, the file reader and
  the tests. Every optional field carries a default, so a half-written JSON
  file still opens in the editor instead of crashing it.
- **Writes are atomic.** A save is written to a `.tmp` file and then renamed
  over the target, leaving a rolling `.bak` behind. A crash mid-write cannot
  leave a truncated resume on disk.
- **Filesystem errors are translated, never leaked.** `lib/fs-errors.ts` maps
  error *codes* to one actionable sentence each and deliberately never echoes
  the absolute path Node puts in `error.message`. A full disk reads as a full
  disk instead of an opaque `HTTP 500`.
- **Variant names are an allowlist, checked twice.** They become filenames, so
  they are restricted to `[a-z0-9-_]`, and the resolved path is then verified
  to still sit inside `data/`.
- **Component caching is off on purpose.** `next.config.ts` explains why: with
  it on, the build bakes the JSON into its output and saves appear to do
  nothing. For a disk-backed editor that is a correctness bug, not a
  performance trade-off.

## How to run

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

On a fresh clone there is no resume yet. The app seeds an empty one on first
load, or you can start from the included placeholder:

```bash
cp data/example.json data/default.json
```

Both `dev` and `start` bind to `127.0.0.1` on purpose. The API reads and writes
the files under `data/` and has no authentication, because it is meant for one
person on one machine. Bound to every interface, anyone on the same network
could read and overwrite the resume. If you do want it reachable from another
device, pass the host explicitly: `npm run dev -- -H 0.0.0.0`.

## Your resume stays out of git

`data/*.json` is gitignored, with `data/example.json` as the only exception.

That is deliberate: a resume holds your real name, phone number and email
address, and a repo is the wrong place for them. Your variants live on your
disk and are never committed. If you fork this to keep your own resume in a
**private** repo, remove the `/data/*.json` line from `.gitignore`.

Other scripts:

| Script              | What it does                           |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Development server                     |
| `npm run build`     | Production build                       |
| `npm start`         | Serve the production build             |
| `npm test`          | Unit tests (vitest)                    |
| `npm run test:watch`| Same tests, in watch mode              |
| `npm run typecheck` | `tsc --noEmit`                         |
| `npm run lint`      | ESLint                                 |

## Using the editor

The screen is two panes with a toolbar on top:

- **Left**: the forms. The header, then one collapsible card per section, each
  holding one collapsible card per entry.
- **Right**: the live page at real size, scaled to fit the pane, plus a
  **Plain text** tab that shows the resume the way an ATS reads it (same order,
  same line breaks, no markup) with a **Copy** button.
- **Toolbar**: variant picker, Duplicate variant, Save, page size, date
  separator, Export PDF, Import/Export JSON and the page-overflow indicator.

### Editing

- Sections, entries, bullets and header links can be added, edited, deleted and
  reordered. Sections and entries can also be hidden: a hidden item stays in the
  JSON file and disappears from the page and from the plain text.
- Section titles are edited in place, in the card header.
- **Reordering** works by dragging the grip handle, or from the keyboard: focus
  a grip handle, press <kbd>Space</kbd>, move with <kbd>↑</kbd>/<kbd>↓</kbd>,
  press <kbd>Space</kbd> again to drop (<kbd>Esc</kbd> cancels). Only the handle
  starts a drag, so the text inputs stay usable.
- **Skills** items are edited as one comma-separated input and stored as an
  array. **Known limitation**: the comma is the separator, so an item cannot
  contain one. A stored item such as `"REST, GraphQL"` shows correctly but is
  split into two items on the next keystroke in that field. Edit the JSON file
  directly if an item really needs a comma.
- **Bullets** have a soft counter that warns past 140 characters. It never
  blocks: it is a reminder that a bullet should stay on one or two lines.
- Which cards are open is interface state only; it is never written to the JSON.

### Saving

- Autosave writes the file 800ms after you stop typing. A save already in
  flight is never interrupted; a change that arrives during one is written right
  after it.
- The dot next to **Save** means there are unsaved changes. Otherwise the
  toolbar shows when the last save happened.
- **Save** forces a write immediately.
- If the server rejects a write, the toolbar shows the reason (including which
  field failed) and the changes stay in the editor, unsaved. A failed write is
  retried on its own after 1s, 3s and 8s, which is enough for a file lock from
  an antivirus scan or an open editor to clear. After that the error stays on
  screen and **Save** retries.
- Closing the tab with unsaved changes asks for confirmation first.
- Switching or duplicating a variant writes pending changes first, and refuses
  to switch if that write fails. The variant picker is disabled while a variant
  is being opened, and anything typed while one is loading is written to the
  variant you were on, not to the one you are opening.

#### How a write reaches the disk

Every write goes to a temp file in `data/`, is flushed, and is then renamed
over the target, so a crash, a full disk or a file lock can never leave a
half-written variant. The previous contents are kept as a single rolling
`data/<variant>.json.bak` first, which is the file to copy back if a variant
ever needs recovering by hand. Only `*.json` counts as a variant, so neither
the `.bak` nor a temp file shows up in the variant list.

### If a variant will not open

A variant file that is not valid JSON, or no longer matches the schema, does
not take the app down. The editor is replaced by a recovery screen that names
the file, lists exactly which fields do not match, lets you open any other
variant, and can overwrite the broken file with a JSON export. The broken file
is left alone until you choose to replace it. The same screen appears when the
`data/` directory itself cannot be read.

### Import / export JSON

**Export JSON** downloads the document as `<variant>.json`. **Import JSON**
validates the file against the schema and loads it into the current variant as
an unsaved change, so autosave then writes it to that variant's file. Because
that overwrites the current variant's file about a second later, importing over
a document that has anything in it asks for confirmation, and pending edits are
written to the current variant before the import replaces them. Files over 2 MB
are refused without being read. Import never creates a variant: duplicate first
if you want a new file.

## How variants work

Every resume variant is one JSON file in `data/`:

```
data/default.json     -> variant "default"
data/frontend.json    -> variant "frontend"
```

The file name (without `.json`) is the variant name. Names are restricted to
`[a-z0-9-_]` so they can never escape the `data/` directory.

On a fresh clone there is no `data/` directory at all. The first page load
creates it and seeds an empty `data/default.json`, because `PUT` deliberately
refuses to create files and there would otherwise be nothing to save into. An
existing variant is never touched by this.

`/?variant=<name>` opens a specific variant on load. The toolbar's picker
switches variants without reloading; the query parameter exists so the recovery
screen can still reach another variant when the current one is the broken file.

**Duplicate variant** in the toolbar asks for a name, cleans it up to fit that
rule (and asks before using the cleaned-up version), copies the current
variant's file and switches to it. A name that is already taken is reported
instead of overwritten.

To start a new variant by hand, copy an existing file:

```bash
cp data/default.json data/frontend.json
```

The variant list is read on page load, so reload after copying a file in.

### API routes

The files are read and written through route handlers:

| Method | Route                 | Purpose                                              |
| ------ | --------------------- | ---------------------------------------------------- |
| GET    | `/api/variants`       | `{ variants: string[] }`, sorted                     |
| POST   | `/api/variants`       | Duplicate: body `{ from, to }` -> `{ name, resume }` |
| GET    | `/api/variants/:name` | `{ name, resume }`, validated against the schema     |
| PUT    | `/api/variants/:name` | Validate the body, then write the file                |

`PUT` replaces the whole document and does **not** create a variant; `POST`
duplicates an existing one first.

Errors are JSON: `400` for an invalid name or an invalid request body (with the
Zod `issues` attached), `404` for an unknown variant, `409` when duplicating
onto a name that already exists, and `422` when a file on disk no longer matches
the schema.

A filesystem failure is reported with what to do about it rather than as an
opaque `500`: a full disk, a locked file, a permissions problem and a read-only
directory each get their own message and their own error code. Something a
retry could get past (a lock, too many open files) answers `503`; something
that has to be fixed first (no space, no permission) answers `500`. The
messages never include host paths.

## How to export a PDF

1. Pick the page size in the toolbar (Letter or A4).
2. Print the page (`Ctrl+P`) or use **Export PDF**, which calls
   `window.print()`.
3. In the Chrome print dialog:
   - **Destination**: Save as PDF
   - **Margins**: None (the page component already has 0.5in margins)
   - **Background graphics**: off
   - **Headers and footers**: off

The print stylesheet sets `@page { size: letter|a4; margin: 0 }`, hides the
editor and toolbars, and removes the preview's scale transform, so the PDF is
the page at its true size. Printing works from either preview tab.

### Page overflow

The toolbar measures the rendered page and warns when the content no longer
fits on one page, with how far past it runs, for example
`Content exceeds one page by 0.7in / 2 pages`. The measurement uses the real
page box, not the scaled-down preview, so it matches the PDF.

## How to change fonts and spacing

Everything about the look of the resume is in two files, and neither of them
uses Tailwind (the Tailwind classes in the app are for the editor chrome only):

- **`app/resume.css`** — all typography, spacing and page geometry, declared as
  CSS variables. They are not all in one block: the font stack is on `:root`
  (it has to be, the `<html>` element carries the font class), everything else
  is on `.resume-page`, and `.resume-page[data-page-size="a4"]` overrides the
  two page dimensions. Values are not repeated here, so this table cannot go
  stale: read them in the file.

  **Typography**

  | Variable                    | Controls                                   |
  | --------------------------- | ------------------------------------------ |
  | `--resume-font-family`      | Font for the whole document (on `:root`)   |
  | `--resume-font-size`        | Body size                                  |
  | `--resume-line-height`      | Body line height                           |
  | `--resume-name-size`        | Name in the header                          |
  | `--resume-name-line-height` | Line height of the name only               |
  | `--resume-heading-size`     | Section headings                           |
  | `--resume-regular`          | Weight of everything that is not bold      |
  | `--resume-bold`             | Weight of orgs, titles, labels and headings |
  | `--resume-color`            | Text colour                                |
  | `--resume-background`       | Page colour                                |

  **Spacing**

  | Variable                       | Controls                                  |
  | ------------------------------ | ----------------------------------------- |
  | `--resume-space-1/2/3`         | The spacing scale every gap comes from    |
  | `--resume-section-gap`         | Gap before every section                  |
  | `--resume-entry-gap`           | Gap between every entry                   |
  | `--resume-bullets-gap`         | Gap above an entry's bullet list          |
  | `--resume-heading-rule-gap`    | Space below the heading rule (off-scale)  |
  | `--resume-heading-rule-offset` | Heading text to its rule (off-scale)      |
  | `--resume-column-gap`          | Gap between the left and right columns    |

  The two off-scale values are set by eye against the rule thickness; the file
  says so where they are declared.

  **Page geometry and details**

  | Variable                       | Controls                               |
  | ------------------------------ | -------------------------------------- |
  | `--resume-page-width/height`   | Page box (A4 overrides both)           |
  | `--resume-page-padding`        | Page margins                           |
  | `--resume-rule-thickness`      | Section heading rule                   |
  | `--resume-bullet-indent`       | How far the bullet list is indented    |
  | `--resume-bullet-marker-width` | Width of the bullet's hanging indent   |
  | `--resume-page-shadow`         | Preview-only shadow under the page     |

- **`app/print.css`** — the `@page` sizes and everything that changes when
  printing.

The editor's own chrome is not in here: `.app-shell`'s backdrop lives with the
rest of the app chrome in `app/globals.css`.

To change the font, edit the `Source_Serif_4` call in `app/layout.tsx` (any
`next/font/google` family works — keep the `variable: "--font-resume-serif"`
option) and, if needed, the fallback stack in `--font-resume-serif-fallback` in
`app/resume.css`. Nothing else references the font.

## Adding a section type

The section union is narrowed in more than one place, so a new type means
touching all of these:

| File                                  | What to add                            |
| ------------------------------------- | -------------------------------------- |
| `lib/schema.ts`                       | Entry and section schemas, union entry |
| `lib/resume-ops.ts`                   | `createEntry`; `mapBullets` if it has bullets |
| `lib/plain-text.ts`                   | A case in `sectionGroups`              |
| `components/resume/Section.tsx`       | The rendered block for the page        |
| `components/resume/<Type>Block.tsx`   | The block component itself             |
| `app/resume.css`                      | The block's grid and classes           |
| `components/editor/SectionCard.tsx`   | The entry form to show in the editor   |
| `components/editor/<Type>Editor.tsx`  | The entry form itself                  |
| `components/editor/section-types.ts`  | Its picker label and entry noun        |

Every one of those `switch` statements is exhaustive over the union, so
`npx tsc --noEmit` names the ones still missing.

## ATS notes

The rendered page is built so an applicant tracking system reads it correctly:

- DOM order equals reading order (org, location, role, period, bullets).
- Layout uses CSS grid in normal flow only: no floats, no absolute positioning.
- Semantic HTML: `<header>`, `<section>` + `<h2>`, `<ul>`/`<li>`, `<a>`.
- Real selectable text only; nothing is drawn to canvas or SVG.
- The **Plain text** tab renders `toPlainText()` from `lib/plain-text.ts`: the
  same content, in the same order, as plain text.
- Date ranges use a plain hyphen with spaces (`2024 - Present`). The **Dates**
  toggle switches every range to an en dash (`2024 – Present`) and back.

## Project layout

```
app/
  api/variants/           Route handlers for reading and writing variants
  resume.css              Every resume design token (the one place to tweak)
  print.css               @page sizes and print-only rules
  globals.css             App chrome (Tailwind)
  layout.tsx              Font + global stylesheets
  page.tsx                Server component: reads the variants, renders the shell
  error.tsx               Last-resort boundary, so the app is never unloadable
components/
  resume/                 Presentational resume components (the printed page)
    ResumePage, Header, Section, EntryBlock, AchievementBlock,
    SkillsBlock, CertificationBlock, ResumeScaler
  editor/                 The editor UI
    EditorShell           Two-pane layout, owns the editor state
    useResumeEditor       Document state, autosave, variants, import/export
    VariantRecovery       Shown instead of the editor for an unreadable variant
    TopBar                Variant, save, page size, dates, export, overflow
    PreviewPane           Page preview + plain text tab, overflow measurement
    PlainTextPanel        The ATS view
    EditorPanel           Left pane: header form, sections, section picker
    HeaderEditor, LinkList
    SectionList, SectionCard
    EntryCardList, EntryCard
    EntryEditor, AchievementEditor, SkillsEditor, CertificationEditor
    BulletList            Sortable bullets with the soft counter
    section-types.ts      Section type labels and nouns
    ui/                   Field, TextInput, TextArea, Button, IconButton,
                          DragHandle, CollapsibleCard, SegmentedControl,
                          SortableList, Icons
data/                     One JSON file per variant
lib/
  schema.ts               Zod schemas and inferred types
  resume-ops.ts           Immutable document operations used by the editor
  variants.ts             Filesystem access, constrained to data/ (server only)
  atomic-write.ts         Crash-safe writes: temp file, fsync, rename, .bak
  variant-name.ts         Variant name validation and sanitization
  api-response.ts         Reading an API payload, describing an API failure
  import-file.ts          Validating a picked JSON file, size cap included
  fs-errors.ts            Filesystem error codes -> actionable messages
  plain-text.ts           ATS reading-order plain text
  date-separator.ts       Hyphen / en dash date ranges
  skills-items.ts         Comma separated list <-> string[]
  overflow.ts             Page overflow measurement and message
  __tests__/              Unit tests
```

`lib/variants.ts` is `server-only`: it is imported by `app/page.tsx` and the
route handlers, never by a client component. Everything the editor persists
goes through the API routes.

## Tests

`npm test` runs vitest. Most tests cover the pure modules in `lib/` and run in
the default `node` environment. The exception is
`components/editor/__tests__/useResumeEditor.test.tsx`, which drives the
autosave state machine with fake timers and a stubbed `fetch`; it opts into a
DOM with a `// @vitest-environment happy-dom` docblock at the top of the file,
so the rest of the suite keeps running without one.

`lib/__tests__/atomic-write.test.ts` runs against real temp directories on
purpose: what it asserts is the behaviour of `rename` and the open flags on
this platform, which a mocked `fs` would not prove.

## License

MIT. See [LICENSE](LICENSE).
