// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { emptyResume, type Resume } from "@/lib/schema";

import {
  AUTOSAVE_DELAY_MS,
  SAVE_RETRY_DELAYS_MS,
  useResumeEditor,
} from "../useResumeEditor";

/**
 * The autosave state machine is the only stateful, async, data-loss-capable
 * code in the app, so it is pinned here rather than left to the pure tests.
 *
 * Everything is driven through fake timers and a stubbed `fetch`: these tests
 * are about *when* a write happens and *which* document and variant it carries,
 * which is exactly what a regression in the debounce, the in-flight coalescing
 * or the flush-before-switch would change.
 */

type Deferred = {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
  reject: (cause: unknown) => void;
};

function deferred(): Deferred {
  let resolve!: (response: Response) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A resume with one section, so an edit has something real to change. */
function seedResume(name = "Ada"): Resume {
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

type Call = { url: string; method: string; body: unknown };

let fetchMock: MockInstance;
let calls: Call[];

function recordCall(input: unknown, init?: RequestInit): Call {
  const call: Call = {
    url: String(input),
    method: init?.method ?? "GET",
    body:
      typeof init?.body === "string" ? JSON.parse(init.body) : (init?.body ?? null),
  };
  calls.push(call);
  return call;
}

/** Every PUT seen so far, which is every actual write to disk. */
function puts(): Call[] {
  return calls.filter((call) => call.method === "PUT");
}

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  fetchMock = vi.spyOn(globalThis, "fetch");
  // happy-dom has no modal dialogs, so the hook's confirm needs a stand-in.
  window.confirm = () => true;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Lets queued microtasks run without advancing the fake clock. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function mount(initialResume = seedResume(), initialVariant = "default") {
  return renderHook(() =>
    useResumeEditor({
      initialVariant,
      initialResume,
      initialVariants: [initialVariant, "frontend"],
    }),
  );
}

describe("autosave debounce", () => {
  it("does not write anything on mount", async () => {
    mount();
    await advance(AUTOSAVE_DELAY_MS * 5);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fire before the debounce has elapsed", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return Promise.resolve(okResponse({ name: "default", resume: seedResume() }));
    });
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "Grace" }));
    expect(result.current.dirty).toBe(true);

    await advance(AUTOSAVE_DELAY_MS - 1);
    expect(puts()).toHaveLength(0);

    await advance(1);
    expect(puts()).toHaveLength(1);
  });

  it("restarts the debounce on every keystroke, writing once at the end", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return Promise.resolve(okResponse({ name: "default", resume: seedResume() }));
    });
    const { result } = mount();

    for (const name of ["G", "Gr", "Gra", "Grac", "Grace"]) {
      act(() => result.current.updateHeader({ name }));
      await advance(AUTOSAVE_DELAY_MS - 100);
    }
    expect(puts()).toHaveLength(0);

    await advance(AUTOSAVE_DELAY_MS);
    expect(puts()).toHaveLength(1);
    expect((puts()[0].body as Resume).header.name).toBe("Grace");
  });

  it("writes to the variant it is editing", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return Promise.resolve(okResponse({ name: "default", resume: seedResume() }));
    });
    const { result } = mount(seedResume(), "frontend");

    act(() => result.current.updateHeader({ name: "Grace" }));
    await advance(AUTOSAVE_DELAY_MS);

    expect(puts()[0].url).toBe("/api/variants/frontend");
  });

  it("clears the unsaved dot once the write lands", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return Promise.resolve(okResponse({ name: "default", resume: seedResume() }));
    });
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "Grace" }));
    await advance(AUTOSAVE_DELAY_MS);

    expect(result.current.dirty).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastSavedAt).not.toBeNull();
  });
});

describe("no-op edits", () => {
  it("does not become dirty when a patch changes nothing", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return Promise.resolve(okResponse({ name: "default", resume: seedResume() }));
    });
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "Ada" }));
    act(() => result.current.updateSettings({ pageSize: "letter" }));
    act(() => result.current.updateSection("s1", { title: "Experience" }));

    expect(result.current.dirty).toBe(false);
    await advance(AUTOSAVE_DELAY_MS * 2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not save a move whose from equals its to", async () => {
    const { result } = mount();

    act(() => result.current.moveSection(0, 0));
    act(() => result.current.moveEntry("s1", 0, 0));
    act(() => result.current.moveBullet("s1", "e1", 0, 0));

    expect(result.current.dirty).toBe(false);
    await advance(AUTOSAVE_DELAY_MS * 2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not save an edit aimed at an id that is not there", async () => {
    const { result } = mount();

    act(() => result.current.updateSection("nope", { title: "x" }));
    act(() => result.current.updateEntry("s1", "nope", { org: "x" }));
    act(() => result.current.removeEntry("s1", "nope"));

    expect(result.current.dirty).toBe(false);
    await advance(AUTOSAVE_DELAY_MS * 2);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("a change during an in-flight save", () => {
  it("triggers exactly one follow-up save, carrying the newest document", async () => {
    const first = deferred();
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return puts().length === 1
        ? first.promise
        : Promise.resolve(okResponse({ name: "default", resume: seedResume() }));
    });
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "One" }));
    await advance(AUTOSAVE_DELAY_MS);
    expect(puts()).toHaveLength(1);
    expect(result.current.saving).toBe(true);

    // Two more edits while the first request is still open.
    act(() => result.current.updateHeader({ name: "Two" }));
    act(() => result.current.updateHeader({ name: "Three" }));
    await advance(AUTOSAVE_DELAY_MS);
    // Still one request: the in-flight save is never interrupted.
    expect(puts()).toHaveLength(1);

    await act(async () => {
      first.resolve(okResponse({ name: "default", resume: seedResume() }));
      await first.promise;
    });
    await settle();

    // Exactly one follow-up, and it carries the last edit, not the first.
    expect(puts()).toHaveLength(2);
    expect((puts()[0].body as Resume).header.name).toBe("One");
    expect((puts()[1].body as Resume).header.name).toBe("Three");
    expect(result.current.dirty).toBe(false);
  });

  it("keeps the dot set when the document moved on mid-save", async () => {
    const first = deferred();
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return puts().length === 1 ? first.promise : deferred().promise;
    });
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "One" }));
    await advance(AUTOSAVE_DELAY_MS);
    act(() => result.current.updateHeader({ name: "Two" }));

    await act(async () => {
      first.resolve(okResponse({ name: "default", resume: seedResume() }));
      await first.promise;
    });
    await settle();

    // The follow-up is in flight, so what is on screen is not on disk yet.
    expect(result.current.dirty).toBe(true);
  });
});

describe("a rejected write", () => {
  it("surfaces the zod issues from a 400 and keeps the edits", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return Promise.resolve(
        errorResponse(400, {
          error: "Invalid resume.",
          issues: [{ path: ["header", "name"], message: "Expected string" }],
        }),
      );
    });
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "Grace" }));
    await advance(AUTOSAVE_DELAY_MS);

    expect(result.current.error).toBe(
      "Invalid resume. header.name: Expected string",
    );
    expect(result.current.dirty).toBe(true);
    expect(result.current.resume.header.name).toBe("Grace");
  });

  it("keeps the edits when the request never reaches the server", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return Promise.reject(new TypeError("Failed to fetch"));
    });
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "Grace" }));
    await advance(AUTOSAVE_DELAY_MS);

    expect(result.current.error).toBe("Could not save: Failed to fetch");
    expect(result.current.dirty).toBe(true);
    expect(result.current.resume.header.name).toBe("Grace");
    expect(result.current.saving).toBe(false);
  });

  it("explains an opaque failure with the status instead of swallowing it", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return Promise.resolve(new Response("nope", { status: 500 }));
    });
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "Grace" }));
    await advance(AUTOSAVE_DELAY_MS);

    expect(result.current.error).toBe('Could not save "default". (HTTP 500)');
  });

  it("retries on its own, with backoff, and stops after the last delay", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return Promise.resolve(errorResponse(503, { error: "Locked." }));
    });
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "Grace" }));
    await advance(AUTOSAVE_DELAY_MS);
    expect(puts()).toHaveLength(1);

    for (const [index, delay] of SAVE_RETRY_DELAYS_MS.entries()) {
      await advance(delay - 1);
      expect(puts()).toHaveLength(index + 1);
      await advance(1);
      expect(puts()).toHaveLength(index + 2);
    }

    // Bounded: no further attempt once the delays are used up.
    const total = SAVE_RETRY_DELAYS_MS.length + 1;
    await advance(60_000);
    expect(puts()).toHaveLength(total);
    expect(result.current.error).toBe("Locked.");
    expect(result.current.dirty).toBe(true);
  });

  it("stops retrying as soon as one attempt succeeds", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return Promise.resolve(
        puts().length === 1
          ? errorResponse(503, { error: "Locked." })
          : okResponse({ name: "default", resume: seedResume() }),
      );
    });
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "Grace" }));
    await advance(AUTOSAVE_DELAY_MS);
    await advance(SAVE_RETRY_DELAYS_MS[0]);

    expect(puts()).toHaveLength(2);
    expect(result.current.dirty).toBe(false);
    expect(result.current.error).toBeNull();

    await advance(60_000);
    expect(puts()).toHaveLength(2);
  });
});

describe("switching variants", () => {
  function respond(bodyByUrl: (url: string, method: string) => Response) {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      const call = recordCall(input, init);
      return Promise.resolve(bodyByUrl(call.url, call.method));
    });
  }

  it("writes pending edits before it opens the other variant", async () => {
    respond((url, method) =>
      method === "PUT"
        ? okResponse({ name: "default", resume: seedResume() })
        : okResponse({ name: "frontend", resume: seedResume("Linus") }),
    );
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "Grace" }));
    await act(async () => {
      await result.current.loadVariant("frontend");
    });

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "PUT /api/variants/default",
      "GET /api/variants/frontend",
    ]);
    expect((puts()[0].body as Resume).header.name).toBe("Grace");
    expect(result.current.variant).toBe("frontend");
    expect(result.current.resume.header.name).toBe("Linus");
    expect(result.current.dirty).toBe(false);
  });

  it("aborts the switch when that write fails, keeping the edits", async () => {
    respond((url, method) =>
      method === "PUT"
        ? errorResponse(500, { error: "Disk is full." })
        : okResponse({ name: "frontend", resume: seedResume("Linus") }),
    );
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "Grace" }));
    await act(async () => {
      await result.current.loadVariant("frontend");
    });

    expect(calls.map((call) => call.method)).toEqual(["PUT"]);
    expect(result.current.variant).toBe("default");
    expect(result.current.resume.header.name).toBe("Grace");
    expect(result.current.dirty).toBe(true);
    expect(result.current.error).toBe("Disk is full.");
  });

  it("can be retried after a failed flush", async () => {
    let failPut = true;
    respond((url, method) => {
      if (method !== "PUT") {
        return okResponse({ name: "frontend", resume: seedResume("Linus") });
      }
      if (failPut) {
        failPut = false;
        return errorResponse(500, { error: "Disk is full." });
      }
      return okResponse({ name: "default", resume: seedResume() });
    });
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "Grace" }));
    await act(async () => {
      await result.current.loadVariant("frontend");
    });
    expect(result.current.variant).toBe("default");

    // Selecting the same variant again must not be swallowed as a no-op.
    await act(async () => {
      await result.current.loadVariant("frontend");
    });
    expect(result.current.variant).toBe("frontend");
  });

  it("ignores the request to open the variant already on screen", async () => {
    respond(() => okResponse({ name: "default", resume: seedResume() }));
    const { result } = mount();

    await act(async () => {
      await result.current.loadVariant("default");
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ends on the variant chosen last, not on the response that arrives last", async () => {
    const frontend = deferred();
    const other = deferred();
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      const call = recordCall(input, init);
      return call.url.endsWith("frontend") ? frontend.promise : other.promise;
    });
    const { result } = mount();

    let firstLoad!: Promise<void>;
    let secondLoad!: Promise<void>;
    await act(async () => {
      firstLoad = result.current.loadVariant("frontend");
      secondLoad = result.current.loadVariant("other");
    });

    // The first response comes back last; it must not win.
    await act(async () => {
      other.resolve(okResponse({ name: "other", resume: seedResume("Second") }));
      frontend.resolve(
        okResponse({ name: "frontend", resume: seedResume("First") }),
      );
      await Promise.all([firstLoad, secondLoad]);
    });

    expect(result.current.variant).toBe("other");
    expect(result.current.resume.header.name).toBe("Second");
  });

  it("writes edits typed while the variant was loading to the old variant", async () => {
    const pending = deferred();
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      const call = recordCall(input, init);
      if (call.method === "PUT") {
        return Promise.resolve(okResponse({ name: call.url, resume: seedResume() }));
      }
      return pending.promise;
    });
    const { result } = mount();

    let load!: Promise<void>;
    act(() => {
      load = result.current.loadVariant("frontend");
    });
    // Typed after the GET went out, before it came back.
    act(() => result.current.updateHeader({ name: "Typed mid-load" }));

    await act(async () => {
      pending.resolve(
        okResponse({ name: "frontend", resume: seedResume("Linus") }),
      );
      await load;
    });

    const written = puts();
    expect(written).toHaveLength(1);
    expect(written[0].url).toBe("/api/variants/default");
    expect((written[0].body as Resume).header.name).toBe("Typed mid-load");
    expect(result.current.variant).toBe("frontend");
    expect(result.current.resume.header.name).toBe("Linus");
  });

  it("reports a load failure and stays where it is", async () => {
    respond(() => errorResponse(422, { error: "Does not match the schema." }));
    const { result } = mount();

    await act(async () => {
      await result.current.loadVariant("frontend");
    });

    expect(result.current.variant).toBe("default");
    expect(result.current.error).toBe("Does not match the schema.");
    expect(result.current.loading).toBe(false);
  });

  it("marks itself busy while a load is in flight, so the picker can lock", async () => {
    const pending = deferred();
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return pending.promise;
    });
    const { result } = mount();

    let load!: Promise<void>;
    act(() => {
      load = result.current.loadVariant("frontend");
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      pending.resolve(
        okResponse({ name: "frontend", resume: seedResume("Linus") }),
      );
      await load;
    });
    expect(result.current.loading).toBe(false);
  });
});

describe("import", () => {
  function pickedFile(body: unknown, name = "import.json"): File {
    return new File([JSON.stringify(body)], name, {
      type: "application/json",
    });
  }

  it("replaces a blank document without asking", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = mount(emptyResume());

    await act(async () => {
      await result.current.importJson(pickedFile(seedResume("Imported")));
    });

    expect(confirm).not.toHaveBeenCalled();
    expect(result.current.resume.header.name).toBe("Imported");
    expect(result.current.dirty).toBe(true);
  });

  it("asks before replacing a document that has content", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = mount(seedResume("Ada"));

    await act(async () => {
      await result.current.importJson(pickedFile(seedResume("Imported")));
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(result.current.resume.header.name).toBe("Ada");
    expect(result.current.dirty).toBe(false);
  });

  it("writes pending edits before the document is replaced", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return Promise.resolve(okResponse({ name: "default", resume: seedResume() }));
    });
    const { result } = mount(seedResume("Ada"));

    act(() => result.current.updateHeader({ name: "Grace" }));
    await act(async () => {
      await result.current.importJson(pickedFile(seedResume("Imported")));
    });

    expect(puts()).toHaveLength(1);
    expect((puts()[0].body as Resume).header.name).toBe("Grace");
    expect(result.current.resume.header.name).toBe("Imported");
  });

  it("does not replace the document when those pending edits fail to write", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return Promise.resolve(errorResponse(500, { error: "Disk is full." }));
    });
    const { result } = mount(seedResume("Ada"));

    act(() => result.current.updateHeader({ name: "Grace" }));
    await act(async () => {
      await result.current.importJson(pickedFile(seedResume("Imported")));
    });

    expect(result.current.resume.header.name).toBe("Grace");
    expect(result.current.dirty).toBe(true);
    expect(result.current.error).toBe("Disk is full.");
  });

  it("refuses a file that is not a resume, leaving the document alone", async () => {
    const { result } = mount(seedResume("Ada"));

    await act(async () => {
      await result.current.importJson(
        new File(["{ not json"], "broken.json", { type: "application/json" }),
      );
    });

    expect(result.current.resume.header.name).toBe("Ada");
    expect(result.current.dirty).toBe(false);
    expect(result.current.error).toContain("broken.json");
  });

  it("refuses a file too large to be a resume", async () => {
    const { result } = mount(seedResume("Ada"));
    const file = pickedFile(seedResume("Imported"), "huge.json");
    Object.defineProperty(file, "size", { value: 50 * 1024 * 1024 });

    await act(async () => {
      await result.current.importJson(file);
    });

    expect(result.current.error).toMatch(/too large/i);
    expect(result.current.resume.header.name).toBe("Ada");
  });
});

describe("unsaved-changes guard", () => {
  it("warns before the tab closes while there are unsaved edits", async () => {
    const { result } = mount();

    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    act(() => result.current.updateHeader({ name: "Grace" }));

    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("stops warning once the document is on disk", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      recordCall(input, init);
      return Promise.resolve(okResponse({ name: "default", resume: seedResume() }));
    });
    const { result } = mount();

    act(() => result.current.updateHeader({ name: "Grace" }));
    await advance(AUTOSAVE_DELAY_MS);
    expect(result.current.dirty).toBe(false);

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
