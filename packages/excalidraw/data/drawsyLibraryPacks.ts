const STORAGE_KEY = "drawsy-library-packs";

export type DrawsyImportedLibraryPack = {
  id: string;
  name: string;
  itemIds: string[];
  importedAt: number;
  collapsed?: boolean;
};

type DrawsyImportedLibraryPacks = DrawsyImportedLibraryPack[];

const parseStoredPacks = (value: string | null): DrawsyImportedLibraryPacks => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (pack): pack is DrawsyImportedLibraryPack =>
        !!pack &&
        typeof pack === "object" &&
        typeof pack.id === "string" &&
        typeof pack.name === "string" &&
        typeof pack.importedAt === "number" &&
        Array.isArray(pack.itemIds) &&
        pack.itemIds.every((itemId: unknown) => typeof itemId === "string") &&
        (pack.collapsed === undefined || typeof pack.collapsed === "boolean"),
    );
  } catch {
    return [];
  }
};

const saveImportedLibraryPacks = (packs: DrawsyImportedLibraryPacks) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(packs));
  } catch (error) {
    console.warn("Failed to persist Drawsy imported library packs", error);
  }
};

export const loadImportedLibraryPacks = (): DrawsyImportedLibraryPacks =>
  parseStoredPacks(window.localStorage.getItem(STORAGE_KEY));

export const replaceImportedLibraryPacks = (
  packs: DrawsyImportedLibraryPacks,
) => {
  saveImportedLibraryPacks(packs);
  return packs;
};

export const upsertImportedLibraryPack = (
  nextPack: Omit<DrawsyImportedLibraryPack, "importedAt"> & {
    importedAt?: number;
  },
) => {
  const packs = loadImportedLibraryPacks();
  const existing = packs.find((pack) => pack.id === nextPack.id);
  const nextPacks = [
    {
      id: nextPack.id,
      name: nextPack.name,
      itemIds: nextPack.itemIds,
      importedAt: nextPack.importedAt ?? Date.now(),
      collapsed: existing?.collapsed ?? false,
    },
    ...packs.filter((pack) => pack.id !== nextPack.id),
  ];
  saveImportedLibraryPacks(nextPacks);
  return nextPacks;
};

export const setImportedLibraryPackCollapsed = (
  id: string,
  collapsed: boolean,
) => {
  const nextPacks = loadImportedLibraryPacks().map((pack) =>
    pack.id === id ? { ...pack, collapsed } : pack,
  );
  saveImportedLibraryPacks(nextPacks);
  return nextPacks;
};
