import { parseLibraryJSON } from "./blob";

import type { LibraryItem, LibraryItems } from "../types";

export type DrawsyLibraryAuthor = {
  name: string;
  url?: string;
};

export type DrawsyLibraryCatalogEntry = {
  id: string;
  name: string;
  description: string;
  source: string;
  preview: string;
  created: string;
  updated: string;
  version: number;
  authors: DrawsyLibraryAuthor[];
  itemNames?: string[];
  downloads?: {
    total: number;
    week: number;
  };
};

type DrawsyLibraryStats = Record<
  string,
  {
    total: number;
    week: number;
  }
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isLibraryAuthor = (value: unknown): value is DrawsyLibraryAuthor =>
  isRecord(value) &&
  typeof value.name === "string" &&
  (value.url === undefined || typeof value.url === "string");

const toCatalogEntryId = (source: string) =>
  source
    .toLowerCase()
    .replace(/\//g, "-")
    .replace(/\.excalidrawlib$/g, "");

const normalizeCatalogEntry = (
  value: unknown,
): DrawsyLibraryCatalogEntry | null => {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    typeof value.source !== "string" ||
    typeof value.preview !== "string" ||
    typeof value.created !== "string" ||
    typeof value.updated !== "string" ||
    typeof value.version !== "number" ||
    !Array.isArray(value.authors) ||
    !value.authors.every(isLibraryAuthor)
  ) {
    return null;
  }

  return {
    id:
      typeof value.id === "string" ? value.id : toCatalogEntryId(value.source),
    name: value.name,
    description: typeof value.description === "string" ? value.description : "",
    source: value.source,
    preview: value.preview,
    created: value.created,
    updated: value.updated,
    version: value.version,
    authors: value.authors.map((author) => ({
      name: author.name,
      url: author.url,
    })),
    itemNames:
      Array.isArray(value.itemNames) &&
      value.itemNames.every((itemName) => typeof itemName === "string")
        ? value.itemNames
        : undefined,
  };
};

function ensureDirectoryUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

export function resolveDrawsyLibraryUrl(baseUrl: string, path: string) {
  if (!baseUrl) {
    throw new Error("Missing Drawsy library base URL");
  }
  return new URL(path, ensureDirectoryUrl(baseUrl)).toString();
}

export const DEFAULT_DRAWSY_LIBRARY_BASE_URL =
  import.meta.env.VITE_APP_DRAWSY_LIBRARY_BASE_URL ||
  `${window.location.origin}/drawsy-libraries/`;

export const DEFAULT_DRAWSY_LIBRARY_CATALOG_URL =
  import.meta.env.VITE_APP_DRAWSY_LIBRARY_CATALOG_URL ||
  resolveDrawsyLibraryUrl(DEFAULT_DRAWSY_LIBRARY_BASE_URL, "libraries.json");

const parseCatalog = (value: unknown): DrawsyLibraryCatalogEntry[] => {
  if (!Array.isArray(value)) {
    throw new Error("Invalid Drawsy library catalog");
  }

  const normalizedCatalog = value
    .map(normalizeCatalogEntry)
    .filter(Boolean) as DrawsyLibraryCatalogEntry[];

  if (normalizedCatalog.length === 0) {
    throw new Error("Invalid Drawsy library catalog");
  }

  return normalizedCatalog;
};

export const getDrawsyLibraryPreviewUrl = (
  entry: DrawsyLibraryCatalogEntry,
  baseUrl: string,
) => resolveDrawsyLibraryUrl(baseUrl, `libraries/${entry.preview}`);

export const getDrawsyLibraryPackUrl = (
  entry: DrawsyLibraryCatalogEntry,
  baseUrl: string,
) => resolveDrawsyLibraryUrl(baseUrl, `libraries/${entry.source}`);

export const fetchDrawsyLibraryCatalog = async (catalogUrl: string) => {
  const response = await fetch(catalogUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Drawsy library catalog: ${response.status}`,
    );
  }

  return parseCatalog(await response.json());
};

export const fetchDrawsyLibraryStats = async (statsUrl: string) => {
  const response = await fetch(statsUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Drawsy library stats: ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload)) {
    throw new Error("Invalid Drawsy library stats");
  }

  return payload as DrawsyLibraryStats;
};

export const enrichDrawsyLibraryCatalogWithStats = (
  catalog: DrawsyLibraryCatalogEntry[],
  stats: DrawsyLibraryStats,
) =>
  catalog.map((entry) => {
    const statsKey = entry.source
      .toLowerCase()
      .replace(/\//g, "-")
      .replace(/\.excalidrawlib$/g, "");
    return {
      ...entry,
      downloads: stats[statsKey] || { total: 0, week: 0 },
    };
  });

export const parseDrawsyLibraryPack = (
  payload: string,
  defaultStatus: LibraryItem["status"] = "published",
): LibraryItems => parseLibraryJSON(payload, defaultStatus);

export const fetchDrawsyLibraryPack = async (
  packUrl: string,
  defaultStatus: LibraryItem["status"] = "published",
) => {
  const response = await fetch(packUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Drawsy library pack: ${response.status}`);
  }

  return parseDrawsyLibraryPack(await response.text(), defaultStatus);
};

export const fetchDrawsyLibraryPackFromCatalogEntry = async (
  entry: DrawsyLibraryCatalogEntry,
  baseUrl: string,
  defaultStatus: LibraryItem["status"] = "published",
) =>
  fetchDrawsyLibraryPack(
    getDrawsyLibraryPackUrl(entry, baseUrl),
    defaultStatus,
  );
