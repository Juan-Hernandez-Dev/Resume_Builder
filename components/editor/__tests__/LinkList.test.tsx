// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResumeLink } from "@/lib/schema";

import { LinkList, type LinkListEditor } from "../LinkList";

/**
 * The link rows: two labelled fields per link, and the button that copies the
 * label into the URL so the common "the label is the address" case is one
 * click instead of retyping it.
 */

afterEach(cleanup);

function editorStub(): LinkListEditor {
  return {
    addLink: vi.fn(),
    updateLink: vi.fn(),
    removeLink: vi.fn(),
    moveLink: vi.fn(),
  };
}

function renderLinks(links: ResumeLink[]) {
  const editor = editorStub();
  render(<LinkList links={links} editor={editor} />);
  return editor;
}

describe("LinkList", () => {
  it("shows a labelled display label and link URL field for every link", () => {
    renderLinks([
      { label: "linkedin.com/in/johndoe", url: "https://linkedin.com/in/johndoe" },
    ]);

    expect(screen.getByText("Display label")).toBeTruthy();
    expect(screen.getByText("Link URL")).toBeTruthy();
    expect(
      (screen.getByLabelText("Link 1 label") as HTMLInputElement).value,
    ).toBe("linkedin.com/in/johndoe");
    expect((screen.getByLabelText("Link 1 URL") as HTMLInputElement).value).toBe(
      "https://linkedin.com/in/johndoe",
    );
  });

  it("writes the label and the URL separately", () => {
    const editor = renderLinks([{ label: "", url: "" }]);

    fireEvent.change(screen.getByLabelText("Link 1 label"), {
      target: { value: "GitHub" },
    });
    fireEvent.change(screen.getByLabelText("Link 1 URL"), {
      target: { value: "https://github.com/johndoe" },
    });

    expect(editor.updateLink).toHaveBeenCalledWith(0, { label: "GitHub" });
    expect(editor.updateLink).toHaveBeenCalledWith(0, {
      url: "https://github.com/johndoe",
    });
  });

  it("copies the label into the URL, adding https://", () => {
    const editor = renderLinks([
      { label: "GitHub", url: "https://github.com/johndoe" },
      { label: " linkedin.com/in/johndoe ", url: "" },
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "Use link 2 label as URL" }),
    );

    expect(editor.updateLink).toHaveBeenCalledTimes(1);
    expect(editor.updateLink).toHaveBeenCalledWith(1, {
      url: "https://linkedin.com/in/johndoe",
    });
  });

  it("turns an email label into a mailto: URL", () => {
    const editor = renderLinks([{ label: "john.doe@example.com", url: "" }]);

    fireEvent.click(
      screen.getByRole("button", { name: "Use link 1 label as URL" }),
    );

    expect(editor.updateLink).toHaveBeenCalledWith(0, {
      url: "mailto:john.doe@example.com",
    });
  });

  it("disables the copy button while the label is empty", () => {
    const editor = renderLinks([{ label: "   ", url: "" }]);

    const button = screen.getByRole("button", {
      name: "Use link 1 label as URL",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.click(button);
    expect(editor.updateLink).not.toHaveBeenCalled();
  });

  it("still deletes a link", () => {
    const editor = renderLinks([{ label: "GitHub", url: "" }]);

    fireEvent.click(screen.getByRole("button", { name: "Delete link 1" }));
    expect(editor.removeLink).toHaveBeenCalledWith(0);
  });
});
