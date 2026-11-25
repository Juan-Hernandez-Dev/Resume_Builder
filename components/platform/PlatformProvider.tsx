"use client";

import { createContext, useContext, type ReactNode } from "react";

import { createHttpRepository } from "@/lib/storage/http-repository";
import type { ResumeRepository } from "@/lib/storage/port";

/**
 * What differs between the local app and the web build, handed to the editor
 * instead of being decided inside it:
 *
 * - `repository`: where variants are read and written. Files through the API
 *   routes locally, IndexedDB in the web build.
 * - `pdf`: `direct` posts the document to /api/pdf for a real download;
 *   `print` opens the browser's print dialog, the only way without a server.
 * - `storage`: how to talk about where a variant lives, so the recovery screen
 *   never sends a web visitor looking for a data/ folder they do not have.
 *
 * The context's default is the local platform, so the local page needs no
 * provider at all and components rendered on their own (in tests, for one)
 * behave exactly as the local app does.
 */

export type PdfMode = "direct" | "print";

export type StorageDescription = {
  kind: "filesystem" | "browser";
  /** Where a variant lives, in words: `data/frontend.json`. */
  describe(name: string): string;
};

export type Platform = {
  repository: ResumeRepository;
  pdf: PdfMode;
  storage: StorageDescription;
};

export const filesystemStorage: StorageDescription = {
  kind: "filesystem",
  describe: (name) => `data/${name}.json`,
};

export const browserStorage: StorageDescription = {
  kind: "browser",
  describe: (name) => `the "${name}" variant saved in this browser`,
};

export const localPlatform: Platform = {
  repository: createHttpRepository(),
  pdf: "direct",
  storage: filesystemStorage,
};

const PlatformContext = createContext<Platform>(localPlatform);

export function PlatformProvider({
  value,
  children,
}: {
  value: Platform;
  children: ReactNode;
}) {
  return <PlatformContext value={value}>{children}</PlatformContext>;
}

export function usePlatform(): Platform {
  return useContext(PlatformContext);
}
