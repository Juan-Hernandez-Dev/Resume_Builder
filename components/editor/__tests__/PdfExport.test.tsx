// @vitest-environment happy-dom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockInstance,
} from "vitest";

import { BROWSER_NOT_FOUND, BROWSER_NOT_FOUND_MESSAGE } from "@/lib/pdf-export";
import { emptyResume, type Resume } from "@/lib/schema";

import { PdfExport } from "../PdfExport";

/**
 * Export PDF asks the server for a real file and downloads it. When that cannot
 * work — no Chrome or Edge on the machine, or any other failure — it says so
 * next to the button and offers the print dialog as an explicit second choice,
 * instead of opening it unasked.
 */

let fetchMock: MockInstance;
let printMock: Mock<() => void>;
let clickMock: MockInstance;
let downloads: string[];
let connectedWhenClicked: boolean[];

function seedResume(): Resume {
  const resume = emptyResume();
  resume.header.name = "John Doe";
  resume.settings.pageSize = "a4";
  return resume;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pdfResponse(): Response {
  return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="John-Doe-Resume.pdf"',
    },
  });
}

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, "fetch");
  printMock = vi.fn();
  window.print = printMock;
  downloads = [];
  connectedWhenClicked = [];
  URL.createObjectURL = vi.fn(() => "blob:resume");
  URL.revokeObjectURL = vi.fn();
  clickMock = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
      connectedWhenClicked.push(this.isConnected);
    });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function clickExport(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
  });
}

describe("PdfExport", () => {
  it("posts the document on screen, unsaved edits included", async () => {
    fetchMock.mockResolvedValue(pdfResponse());
    const resume = seedResume();
    render(<PdfExport resume={resume} variant="frontend" />);

    await clickExport();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/pdf");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe(
      "application/json",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      resume,
      variant: "frontend",
    });
  });

  it("downloads the PDF under the name the server gave it", async () => {
    fetchMock.mockResolvedValue(pdfResponse());
    render(<PdfExport resume={seedResume()} variant="default" />);

    await clickExport();

    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(downloads).toEqual(["John-Doe-Resume.pdf"]);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(printMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clicks a link that is in the page, and removes it afterwards", async () => {
    fetchMock.mockResolvedValue(pdfResponse());
    render(<PdfExport resume={seedResume()} variant="default" />);

    await clickExport();

    // Some browsers ignore a click on a link that is not in the document.
    expect(connectedWhenClicked).toEqual([true]);
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("revokes the file's URL only after the download had time to start", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(pdfResponse());
    render(<PdfExport resume={seedResume()} variant="default" />);

    await clickExport();
    // Revoking it right after the click can cancel the download.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:resume");
  });

  it("shows a busy state while the PDF is being made", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((res) => {
        resolve = res;
      }),
    );
    render(<PdfExport resume={seedResume()} variant="default" />);

    await clickExport();
    const busy = screen.getByRole("button", {
      name: "Exporting…",
    }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);

    await act(async () => {
      resolve(pdfResponse());
    });
    expect(
      (screen.getByRole("button", { name: "Export PDF" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("does not show the print dialog hint before anything failed", () => {
    render(<PdfExport resume={seedResume()} variant="default" />);
    expect(screen.queryByText(/Save as PDF/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Print instead" })).toBeNull();
  });

  it("explains that Chrome or Edge is needed when the server has neither", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(503, {
        error: BROWSER_NOT_FOUND_MESSAGE,
        code: BROWSER_NOT_FOUND,
      }),
    );
    render(<PdfExport resume={seedResume()} variant="default" />);

    await clickExport();

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(
      "Direct PDF export needs Google Chrome or Microsoft Edge installed.",
    );
    expect(alert.textContent).toContain("CHROME_PATH");
    // Telling the user is the point: the dialog is not opened behind their back.
    expect(printMock).not.toHaveBeenCalled();
  });

  it("uses its own wording for a missing browser when the server sends none", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(503, { code: BROWSER_NOT_FOUND }),
    );
    render(<PdfExport resume={seedResume()} variant="default" />);

    await clickExport();

    expect(screen.getByRole("alert").textContent).toContain(
      BROWSER_NOT_FOUND_MESSAGE,
    );
  });

  it("offers Print instead, with the print settings hint", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(503, {
        error: BROWSER_NOT_FOUND_MESSAGE,
        code: BROWSER_NOT_FOUND,
      }),
    );
    render(<PdfExport resume={seedResume()} variant="default" />);

    await clickExport();
    expect(screen.getByText(/Save as PDF/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Print instead" }));
    expect(printMock).toHaveBeenCalledTimes(1);
  });

  it("reports any other failure with the same way out", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(500, { error: "Chrome could not render the PDF." }),
    );
    render(<PdfExport resume={seedResume()} variant="default" />);

    await clickExport();

    expect(screen.getByRole("alert").textContent).toContain(
      "Chrome could not render the PDF.",
    );
    expect(screen.getByRole("button", { name: "Print instead" })).toBeTruthy();
    expect(printMock).not.toHaveBeenCalled();
  });

  it("reports a request that never reached the server", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<PdfExport resume={seedResume()} variant="default" />);

    await clickExport();

    expect(screen.getByRole("alert").textContent).toContain(
      "Could not export the PDF: Failed to fetch",
    );
  });

  it("clears the notice once an export succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { error: "Broken." }))
      .mockResolvedValueOnce(pdfResponse());
    render(<PdfExport resume={seedResume()} variant="default" />);

    await clickExport();
    expect(screen.getByRole("alert")).toBeTruthy();

    await clickExport();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(downloads).toEqual(["John-Doe-Resume.pdf"]);
  });
});
