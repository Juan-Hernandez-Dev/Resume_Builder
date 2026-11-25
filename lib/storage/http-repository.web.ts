import { StorageError } from "./errors";
import type { createHttpRepository as createLocalHttpRepository } from "./http-repository";
import type { ResumeRepository } from "./port";

/**
 * What the web build gets for http-repository.ts (next.config.ts resolves
 * `.web.ts` first there): no request to /api/variants, which a static host
 * does not have. The web platform always provides the IndexedDB repository,
 * so this only stands in for the local platform's default; anything that
 * reaches it is told the storage is unavailable rather than sent to a 404.
 */
export const createHttpRepository: typeof createLocalHttpRepository = () => {
  const unavailable = () =>
    Promise.reject(
      new StorageError("The web build has no server to store variants on.", {
        reason: "unavailable",
        retryable: false,
      }),
    );
  const repository: ResumeRepository = {
    list: unavailable,
    read: unavailable,
    write: unavailable,
    create: unavailable,
    duplicate: unavailable,
  };
  return repository;
};
