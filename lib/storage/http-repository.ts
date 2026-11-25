import { describeFailure, readResume } from "../api-response";
import type { Resume } from "../schema";
import { assertValidVariantName } from "../variant-name";

import {
  InvalidVariantDataError,
  StorageError,
  VariantExistsError,
  VariantNotFoundError,
} from "./errors";
import type { ResumeRepository } from "./port";

/**
 * The /api/variants routes as a repository: what the editor uses in local
 * mode, where the files live on the machine running the server.
 *
 * Every failed response becomes the same error another adapter would throw
 * (404 VariantNotFoundError, 409 VariantExistsError, 422 InvalidVariantData-
 * Error, anything else a StorageError), carrying the line describeFailure
 * makes of the server's answer, so the editor can show it as it is. A request
 * that never reached the server is not translated: the caller says what it
 * was trying to do.
 */
export function createHttpRepository(): ResumeRepository {
  return {
    async list() {
      const response = await fetch("/api/variants", { cache: "no-store" });
      if (!response.ok) {
        throw await failure(response, "", "Could not list the variants.");
      }
      const payload = (await response.json().catch(() => null)) as {
        variants?: unknown;
      } | null;
      const variants = payload?.variants;
      if (!Array.isArray(variants)) {
        throw new StorageError("The variant list did not come back as a list.", {
          reason: "io",
          retryable: true,
        });
      }
      return variants.filter((name): name is string => typeof name === "string");
    },

    async read(name) {
      assertValidVariantName(name);
      const response = await fetch(variantUrl(name), { cache: "no-store" });
      if (!response.ok) {
        throw await failure(response, name, `Could not open "${name}".`);
      }
      return expectResume(response, name);
    },

    async write(name, resume) {
      assertValidVariantName(name);
      const response = await fetch(variantUrl(name), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(resume),
      });
      if (!response.ok) {
        throw await failure(response, name, `Could not save "${name}".`);
      }
      // The server answers with what it stored; the request is the fallback.
      return (await readResume(response)) ?? resume;
    },

    async create(name, resume) {
      assertValidVariantName(name);
      const response = await post({ to: name, resume });
      if (!response.ok) {
        throw await failure(response, name, `Could not create "${name}".`);
      }
      return expectResume(response, name);
    },

    async duplicate(from, to) {
      assertValidVariantName(from);
      assertValidVariantName(to);
      const response = await post({ from, to });
      if (!response.ok) {
        // A 404 is about the source, anything else about the new name.
        throw await failure(
          response,
          response.status === 404 ? from : to,
          `Could not create "${to}".`,
        );
      }
      return expectResume(response, to);
    },
  };
}

function variantUrl(name: string): string {
  return `/api/variants/${encodeURIComponent(name)}`;
}

function post(body: unknown): Promise<Response> {
  return fetch("/api/variants", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function expectResume(response: Response, name: string): Promise<Resume> {
  const resume = await readResume(response);
  if (resume === null) {
    throw new InvalidVariantDataError(
      name,
      [],
      `"${name}" did not come back as a valid resume.`,
    );
  }
  return resume;
}

/** The failed response as the domain error its status stands for. */
async function failure(
  response: Response,
  variant: string,
  fallback: string,
): Promise<Error> {
  const message = await describeFailure(response.clone(), fallback);

  switch (response.status) {
    case 404:
      return new VariantNotFoundError(variant, message);
    case 409:
      return new VariantExistsError(variant, message);
    case 422:
      return new InvalidVariantDataError(
        variant,
        await issuesOf(response),
        message,
      );
    case 503:
      return new StorageError(message, { reason: "io", retryable: true });
    default:
      return new StorageError(message, { reason: "io", retryable: false });
  }
}

async function issuesOf(
  response: Response,
): Promise<{ path: string; message: string }[]> {
  const payload = (await response.json().catch(() => null)) as {
    issues?: unknown;
  } | null;
  if (!Array.isArray(payload?.issues)) return [];
  return payload.issues.filter(
    (issue): issue is { path: string; message: string } =>
      typeof issue === "object" &&
      issue !== null &&
      typeof (issue as { path?: unknown }).path === "string" &&
      typeof (issue as { message?: unknown }).message === "string",
  );
}
