import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { MIME_TYPES, arrayToMap, nextAnimationFrame } from "@excalidraw/common";

import { duplicateElements } from "@excalidraw/element";

import clsx from "clsx";

import { deburr } from "../deburr";
import {
  DEFAULT_DRAWSY_LIBRARY_BASE_URL,
  DEFAULT_DRAWSY_LIBRARY_CATALOG_URL,
  enrichDrawsyLibraryCatalogWithStats,
  fetchDrawsyLibraryCatalog,
  fetchDrawsyLibraryPackFromCatalogEntry,
  fetchDrawsyLibraryStats,
  getDrawsyLibraryPreviewUrl,
  resolveDrawsyLibraryUrl,
} from "../data/drawsyLibraries";
import {
  loadImportedLibraryPacks,
  replaceImportedLibraryPacks,
  setImportedLibraryPackCollapsed,
  upsertImportedLibraryPack,
} from "../data/drawsyLibraryPacks";

import { useLibraryCache } from "../hooks/useLibraryItemSvg";
import { useScrollPosition } from "../hooks/useScrollPosition";
import { t } from "../i18n";

import {
  LibraryMenuSection,
  LibraryMenuSectionGrid,
} from "./LibraryMenuSection";
import { LibraryDropdownMenu } from "./LibraryMenuHeaderContent";
import Spinner from "./Spinner";
import Stack from "./Stack";

import "./LibraryMenuItems.scss";

import { TextField } from "./TextField";

import { useEditorInterface } from "./App";

import { Button } from "./Button";
import { chevronLeftIcon } from "./icons";

import type { ExcalidrawLibraryIds } from "../data/types";
import type { DrawsyImportedLibraryPack } from "../data/drawsyLibraryPacks";
import type { DrawsyLibraryCatalogEntry } from "../data/drawsyLibraries";
import type {
  ExcalidrawProps,
  LibraryItem,
  LibraryItems,
  UIAppState,
} from "../types";

const ITEMS_RENDERED_PER_BATCH = 17;
const CACHED_ITEMS_RENDERED_PER_BATCH = 64;
const IMPORTED_PACK_COLLAPSED_ITEMS = 7;
const MARKETPLACE_PAGE_SIZE = 4;
const MARKETPLACE_PACK_PREVIEW_ITEMS = 7;

type MarketplaceSort = "popular" | "updated" | "new" | "name";

type ViewState =
  | { type: "overview" }
  | { type: "marketplace" }
  | {
      type: "pack";
      entry: DrawsyLibraryCatalogEntry;
      source: "drawsy" | "marketplace";
    };

type PackCacheEntry =
  | {
      status: "loading";
      items: null;
      errorMessage: null;
    }
  | {
      status: "loaded";
      items: LibraryItems;
      errorMessage: null;
    }
  | {
      status: "error";
      items: null;
      errorMessage: string;
    };

const noopSelectToggle = () => undefined;
const noopItemDrag = () => undefined;
const noopIsItemSelected = () => false;

const sortCatalogEntries = (
  entries: DrawsyLibraryCatalogEntry[],
  sort: MarketplaceSort,
) => {
  const copy = [...entries];

  switch (sort) {
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "new":
      return copy.sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
      );
    case "updated":
      return copy.sort(
        (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime(),
      );
    case "popular":
    default:
      return copy.sort(
        (a, b) => (b.downloads?.total || 0) - (a.downloads?.total || 0),
      );
  }
};

const matchesCatalogQuery = (
  entry: DrawsyLibraryCatalogEntry,
  query: string,
) => {
  const normalizedQuery = deburr(query.trim().toLowerCase());
  if (!normalizedQuery) {
    return true;
  }

  const authorNames = entry.authors.map((author) => author.name).join(" ");
  const itemNames = entry.itemNames?.join(" ") || "";

  return [entry.name, entry.description, authorNames, itemNames].some((value) =>
    deburr(value.toLowerCase()).includes(normalizedQuery),
  );
};

const PackCard = ({
  entry,
  onSelect,
  isSelected = false,
}: {
  entry: DrawsyLibraryCatalogEntry;
  onSelect: () => void;
  isSelected?: boolean;
}) => {
  const primaryAuthor = entry.authors[0];

  return (
    <button
      type="button"
      className={clsx("drawsy-library-card", {
        "drawsy-library-card--selected": isSelected,
      })}
      onClick={onSelect}
    >
      <div className="drawsy-library-card__topline">
        <div className="drawsy-library-card__title" title={entry.name}>
          {entry.name}
        </div>
        <time className="drawsy-library-card__date" dateTime={entry.updated}>
          {entry.updated}
        </time>
      </div>
      <div
        className="drawsy-library-card__author"
        title={primaryAuthor?.name || ""}
      >
        {primaryAuthor?.name || "Unknown creator"}
      </div>
    </button>
  );
};

const LibraryMoreTile = ({
  label,
  onSelect,
  disabled = false,
  variant = "muted",
}: {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  variant?: "muted" | "primary";
}) => (
  <button
    type="button"
    className={clsx("drawsy-library-more-tile", {
      "drawsy-library-more-tile--primary": variant === "primary",
    })}
    onClick={onSelect}
    disabled={disabled}
  >
    {label}
  </button>
);

const PackHeader = ({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) => {
  return (
    <div className="drawsy-library-sheet__header">
      <Button className="drawsy-library-sheet__back" onSelect={onBack}>
        <span aria-hidden="true">{chevronLeftIcon}</span>
        <span>Back</span>
      </Button>
      <div className="drawsy-library-sheet__header-copy">
        <div className="drawsy-library-sheet__title">{title}</div>
        {subtitle ? (
          <div className="drawsy-library-sheet__subtitle">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
};

const ImportedPackGroup = ({
  pack,
  items,
  svgCache,
  itemsRenderedPerBatch,
  onToggleCollapsed,
  onItemClick,
  onItemSelectToggle,
  onItemDrag,
  isItemSelected,
}: {
  pack: DrawsyImportedLibraryPack;
  items: LibraryItems;
  svgCache: ReturnType<typeof useLibraryCache>["svgCache"];
  itemsRenderedPerBatch: number;
  onToggleCollapsed: () => void;
  onItemClick: (id: LibraryItem["id"] | null) => void;
  onItemSelectToggle: (id: LibraryItem["id"], event: React.MouseEvent) => void;
  onItemDrag: (id: LibraryItem["id"], event: React.DragEvent) => void;
  isItemSelected: (id: LibraryItem["id"] | null) => boolean;
}) => {
  const hasOverflow = items.length > IMPORTED_PACK_COLLAPSED_ITEMS;
  const visibleItems =
    pack.collapsed && hasOverflow
      ? items.slice(0, IMPORTED_PACK_COLLAPSED_ITEMS)
      : items;

  return (
    <div className="drawsy-library-pack">
      <div className="drawsy-library-pack__header">
        <div className="drawsy-library-pack__header-copy">
          <div className="drawsy-library-pack__title" title={pack.name}>
            {pack.name}
          </div>
          <div className="drawsy-library-pack__meta">{items.length} items</div>
        </div>
      </div>
      <LibraryMenuSectionGrid>
        <LibraryMenuSection
          items={visibleItems}
          onItemSelectToggle={onItemSelectToggle}
          onItemDrag={onItemDrag}
          onClick={onItemClick}
          isItemSelected={isItemSelected}
          svgCache={svgCache}
          itemsRenderedPerBatch={itemsRenderedPerBatch}
        />
        {hasOverflow ? (
          <LibraryMoreTile
            label={pack.collapsed ? "Show more" : "Show less"}
            onSelect={onToggleCollapsed}
          />
        ) : null}
      </LibraryMenuSectionGrid>
    </div>
  );
};

export default function LibraryMenuItems({
  isLoading,
  libraryItems,
  onAddToLibrary,
  onInsertLibraryItems,
  onImportLibraryPack,
  pendingElements,
  theme: _theme,
  id: _id,
  libraryReturnUrl: _libraryReturnUrl,
  onSelectItems,
  selectedItems,
}: {
  isLoading: boolean;
  libraryItems: LibraryItems;
  pendingElements: LibraryItem["elements"];
  onInsertLibraryItems: (libraryItems: LibraryItems) => void;
  onImportLibraryPack: (libraryItems: LibraryItems) => Promise<void>;
  onAddToLibrary: (elements: LibraryItem["elements"]) => void;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
}) {
  const editorInterface = useEditorInterface();
  const libraryContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosition = useScrollPosition<HTMLDivElement>(libraryContainerRef);
  const { svgCache } = useLibraryCache();
  const [lastSelectedItem, setLastSelectedItem] = useState<
    LibraryItem["id"] | null
  >(null);
  const [searchInputValue, setSearchInputValue] = useState("");
  const [view, setView] = useState<ViewState>({ type: "overview" });
  const [marketplaceQuery, setMarketplaceQuery] = useState("");
  const [marketplaceSort, setMarketplaceSort] =
    useState<MarketplaceSort>("popular");
  const [marketplacePage, setMarketplacePage] = useState(1);
  const [selectedMarketplaceEntryId, setSelectedMarketplaceEntryId] = useState<
    string | null
  >(null);
  const [catalogStatus, setCatalogStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");
  const [catalogEntries, setCatalogEntries] = useState<
    DrawsyLibraryCatalogEntry[]
  >([]);
  const [catalogErrorMessage, setCatalogErrorMessage] = useState("");
  const [packCache, setPackCache] = useState<Record<string, PackCacheEntry>>(
    {},
  );
  const [importingPackId, setImportingPackId] = useState<string | null>(null);
  const [importedPacks, setImportedPacks] = useState(loadImportedLibraryPacks);
  const [isRecoveringImportedPacks, setIsRecoveringImportedPacks] =
    useState(false);

  useEffect(() => {
    if (scrollPosition > 0) {
      libraryContainerRef.current?.scrollTo(0, scrollPosition);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    nextAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      setCatalogStatus("loading");
      setCatalogErrorMessage("");

      try {
        const statsUrl = resolveDrawsyLibraryUrl(
          DEFAULT_DRAWSY_LIBRARY_BASE_URL,
          "stats.json",
        );
        const [catalog, stats] = await Promise.all([
          fetchDrawsyLibraryCatalog(DEFAULT_DRAWSY_LIBRARY_CATALOG_URL),
          fetchDrawsyLibraryStats(statsUrl),
        ]);

        if (cancelled) {
          return;
        }

        setCatalogEntries(enrichDrawsyLibraryCatalogWithStats(catalog, stats));
        setCatalogStatus("loaded");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCatalogStatus("error");
        setCatalogErrorMessage(
          error instanceof Error ? error.message : "Failed to load marketplace",
        );
      }
    };

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const unpublishedItems = useMemo(
    () => libraryItems.filter((item) => item.status !== "published"),
    [libraryItems],
  );

  const publishedItems = useMemo(
    () => libraryItems.filter((item) => item.status === "published"),
    [libraryItems],
  );

  const itemIdsInImportedPacks = useMemo(() => {
    const ids = new Set<string>();
    importedPacks.forEach((pack) => {
      pack.itemIds.forEach((itemId) => ids.add(itemId));
    });
    return ids;
  }, [importedPacks]);

  const importedPackSections = useMemo(() => {
    const libraryItemsMap = new Map(
      libraryItems.map((item) => [item.id, item]),
    );

    return importedPacks
      .map((pack) => ({
        ...pack,
        items: pack.itemIds
          .map((itemId) => libraryItemsMap.get(itemId))
          .filter(Boolean) as LibraryItems,
      }))
      .filter((pack) => pack.items.length > 0);
  }, [importedPacks, libraryItems]);

  const looseUnpublishedItems = useMemo(
    () =>
      unpublishedItems.filter((item) => !itemIdsInImportedPacks.has(item.id)),
    [itemIdsInImportedPacks, unpublishedItems],
  );

  const loosePublishedItems = useMemo(
    () => publishedItems.filter((item) => !itemIdsInImportedPacks.has(item.id)),
    [itemIdsInImportedPacks, publishedItems],
  );

  const filteredLooseItems = useMemo(() => {
    const searchQuery = deburr(searchInputValue.trim().toLowerCase());
    if (!searchQuery) {
      return {
        looseUnpublishedItems,
        loosePublishedItems,
        importedPackSections,
      };
    }

    const matchesItem = (item: LibraryItem) =>
      deburr((item.name || "").toLowerCase()).includes(searchQuery);

    return {
      looseUnpublishedItems: looseUnpublishedItems.filter(matchesItem),
      loosePublishedItems: loosePublishedItems.filter(matchesItem),
      importedPackSections: importedPackSections
        .map((pack) => ({
          ...pack,
          items: deburr(pack.name.toLowerCase()).includes(searchQuery)
            ? pack.items
            : pack.items.filter(matchesItem),
        }))
        .filter((pack) => pack.items.length > 0),
    };
  }, [
    importedPackSections,
    loosePublishedItems,
    looseUnpublishedItems,
    searchInputValue,
  ]);

  const filteredMarketplaceEntries = useMemo(() => {
    const filtered = catalogEntries.filter((entry) =>
      matchesCatalogQuery(entry, marketplaceQuery),
    );

    return sortCatalogEntries(filtered, marketplaceSort);
  }, [catalogEntries, marketplaceQuery, marketplaceSort]);

  const marketplacePageCount = Math.max(
    1,
    Math.ceil(filteredMarketplaceEntries.length / MARKETPLACE_PAGE_SIZE),
  );

  const paginatedMarketplaceEntries = useMemo(() => {
    const pageStart = (marketplacePage - 1) * MARKETPLACE_PAGE_SIZE;
    return filteredMarketplaceEntries.slice(
      pageStart,
      pageStart + MARKETPLACE_PAGE_SIZE,
    );
  }, [filteredMarketplaceEntries, marketplacePage]);

  const selectedMarketplaceEntry = useMemo(
    () =>
      paginatedMarketplaceEntries.find(
        (entry) => entry.id === selectedMarketplaceEntryId,
      ) ||
      paginatedMarketplaceEntries[0] ||
      null,
    [paginatedMarketplaceEntries, selectedMarketplaceEntryId],
  );

  const selectedMarketplacePackState = selectedMarketplaceEntry
    ? packCache[selectedMarketplaceEntry.id] || null
    : null;

  useEffect(() => {
    setMarketplacePage(1);
  }, [marketplaceQuery, marketplaceSort]);

  useEffect(() => {
    setMarketplacePage((currentPage) =>
      Math.min(currentPage, marketplacePageCount),
    );
  }, [marketplacePageCount]);

  const isLibraryEmpty =
    !libraryItems.length &&
    !pendingElements.length &&
    importedPackSections.length === 0;

  const getInsertedElements = useCallback(
    (id: string) => {
      let targetElements;
      if (selectedItems.includes(id)) {
        targetElements = libraryItems.filter((item) =>
          selectedItems.includes(item.id),
        );
      } else {
        targetElements = libraryItems.filter((item) => item.id === id);
      }
      return targetElements.map((item) => {
        return {
          ...item,
          elements: duplicateElements({
            type: "everything",
            elements: item.elements,
            randomizeSeed: true,
            preserveFrameChildrenOrder: true,
          }).duplicatedElements,
        };
      });
    },
    [libraryItems, selectedItems],
  );

  const onItemSelectToggle = useCallback(
    (itemId: LibraryItem["id"], event: React.MouseEvent) => {
      const shouldSelect = !selectedItems.includes(itemId);
      const orderedItems = [...looseUnpublishedItems, ...loosePublishedItems];
      if (shouldSelect) {
        if (event.shiftKey && lastSelectedItem) {
          const rangeStart = orderedItems.findIndex(
            (item) => item.id === lastSelectedItem,
          );
          const rangeEnd = orderedItems.findIndex((item) => item.id === itemId);

          if (rangeStart === -1 || rangeEnd === -1) {
            onSelectItems([...selectedItems, itemId]);
            return;
          }

          const selectedItemsMap = arrayToMap(selectedItems);
          const minRange = Math.min(rangeStart, rangeEnd);
          const maxRange = Math.max(rangeStart, rangeEnd);
          const nextSelectedIds = orderedItems.reduce(
            (acc: LibraryItem["id"][], item, idx) => {
              if (
                (idx >= minRange && idx <= maxRange) ||
                selectedItemsMap.has(item.id)
              ) {
                acc.push(item.id);
              }
              return acc;
            },
            [],
          );
          onSelectItems(nextSelectedIds);
        } else {
          onSelectItems([...selectedItems, itemId]);
        }
        setLastSelectedItem(itemId);
      } else {
        setLastSelectedItem(null);
        onSelectItems(selectedItems.filter((_id) => _id !== itemId));
      }
    },
    [
      lastSelectedItem,
      loosePublishedItems,
      looseUnpublishedItems,
      onSelectItems,
      selectedItems,
    ],
  );

  useEffect(() => {
    if (!selectedItems.length) {
      setLastSelectedItem(null);
    }
  }, [selectedItems]);

  const onItemDrag = useCallback(
    (itemId: LibraryItem["id"], event: React.DragEvent) => {
      const data: ExcalidrawLibraryIds = {
        itemIds: selectedItems.includes(itemId) ? selectedItems : [itemId],
      };
      event.dataTransfer.setData(
        MIME_TYPES.excalidrawlibIds,
        JSON.stringify(data),
      );
    },
    [selectedItems],
  );

  const isItemSelected = useCallback(
    (itemId: LibraryItem["id"] | null) => {
      if (!itemId) {
        return false;
      }
      return selectedItems.includes(itemId);
    },
    [selectedItems],
  );

  const onAddToLibraryClick = useCallback(() => {
    onAddToLibrary(pendingElements);
  }, [onAddToLibrary, pendingElements]);

  const onItemClick = useCallback(
    (itemId: LibraryItem["id"] | null) => {
      if (itemId) {
        onInsertLibraryItems(getInsertedElements(itemId));
      }
    },
    [getInsertedElements, onInsertLibraryItems],
  );

  const currentLoadedPack =
    view.type === "pack" ? packCache[view.entry.id] : null;

  const currentPackItemsLength =
    currentLoadedPack?.status === "loaded"
      ? currentLoadedPack.items.length
      : libraryItems.length;

  const itemsRenderedPerBatch =
    svgCache.size >= Math.max(1, currentPackItemsLength || 0)
      ? CACHED_ITEMS_RENDERED_PER_BATCH
      : ITEMS_RENDERED_PER_BATCH;

  const searchInputRef = useRef<HTMLInputElement>(null);

  const ensurePackLoaded = useCallback(
    async (entry: DrawsyLibraryCatalogEntry) => {
      const cached = packCache[entry.id];
      if (cached?.status === "loaded") {
        return cached.items;
      }
      if (cached?.status === "loading") {
        return null;
      }

      setPackCache((current) => ({
        ...current,
        [entry.id]: {
          status: "loading",
          items: null,
          errorMessage: null,
        },
      }));

      try {
        const items = await fetchDrawsyLibraryPackFromCatalogEntry(
          entry,
          DEFAULT_DRAWSY_LIBRARY_BASE_URL,
        );
        setPackCache((current) => ({
          ...current,
          [entry.id]: {
            status: "loaded",
            items,
            errorMessage: null,
          },
        }));
        return items;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load library pack";
        setPackCache((current) => ({
          ...current,
          [entry.id]: {
            status: "error",
            items: null,
            errorMessage: message,
          },
        }));
        return null;
      }
    },
    [packCache],
  );

  useEffect(() => {
    if (view.type === "marketplace" && selectedMarketplaceEntry) {
      ensurePackLoaded(selectedMarketplaceEntry);
    }
  }, [ensurePackLoaded, selectedMarketplaceEntry, view.type]);

  useEffect(() => {
    if (view.type === "pack") {
      ensurePackLoaded(view.entry);
    }
  }, [ensurePackLoaded, view]);

  const handleImportPack = useCallback(
    async (entry: DrawsyLibraryCatalogEntry) => {
      setImportingPackId(entry.id);
      try {
        const items = await ensurePackLoaded(entry);
        if (!items) {
          return;
        }
        await onImportLibraryPack(items);
        setImportedPacks(
          upsertImportedLibraryPack({
            id: entry.id,
            name: entry.name,
            itemIds: items.map((item) => item.id),
          }),
        );
      } finally {
        setImportingPackId((currentPackId) =>
          currentPackId === entry.id ? null : currentPackId,
        );
      }
    },
    [ensurePackLoaded, onImportLibraryPack],
  );

  const handleImportedPackToggle = useCallback((packId: string) => {
    setImportedPacks((currentPacks) => {
      const target = currentPacks.find((pack) => pack.id === packId);
      if (!target) {
        return currentPacks;
      }
      return setImportedLibraryPackCollapsed(packId, !target.collapsed);
    });
  }, []);

  const packState =
    view.type === "pack" ? packCache[view.entry.id] || null : null;

  useEffect(() => {
    let cancelled = false;

    const recoverImportedPacks = async () => {
      if (
        catalogStatus !== "loaded" ||
        importedPacks.length > 0 ||
        publishedItems.length === 0 ||
        isRecoveringImportedPacks
      ) {
        return;
      }

      setIsRecoveringImportedPacks(true);
      const remainingItemIds = new Set(publishedItems.map((item) => item.id));
      const recoveredPacks: DrawsyImportedLibraryPack[] = [];

      for (const entry of sortCatalogEntries(catalogEntries, "popular")) {
        if (cancelled || remainingItemIds.size === 0) {
          break;
        }

        const items = await ensurePackLoaded(entry);
        if (!items || items.length === 0) {
          continue;
        }

        const packItemIds = items.map((item) => item.id);
        const isFullPackPresent = packItemIds.every((itemId) =>
          remainingItemIds.has(itemId),
        );

        if (!isFullPackPresent) {
          continue;
        }

        recoveredPacks.push({
          id: entry.id,
          name: entry.name,
          itemIds: packItemIds,
          importedAt: Date.now(),
          collapsed: false,
        });

        packItemIds.forEach((itemId) => {
          remainingItemIds.delete(itemId);
        });
      }

      if (!cancelled && recoveredPacks.length > 0) {
        setImportedPacks(replaceImportedLibraryPacks(recoveredPacks));
      }

      if (!cancelled) {
        setIsRecoveringImportedPacks(false);
      }
    };

    recoverImportedPacks();

    return () => {
      cancelled = true;
    };
  }, [
    catalogEntries,
    catalogStatus,
    ensurePackLoaded,
    importedPacks.length,
    isRecoveringImportedPacks,
    publishedItems,
  ]);

  return (
    <div
      className="library-menu-items-container"
      style={
        libraryItems.length || pendingElements.length
          ? { justifyContent: "flex-start" }
          : { borderBottom: 0 }
      }
    >
      {view.type === "overview" ? (
        <>
          <div className="library-menu-items-header">
            <TextField
              ref={searchInputRef}
              type="search"
              className={clsx("library-menu-items-container__search", {
                hideCancelButton: editorInterface.formFactor !== "phone",
              })}
              placeholder={t("library.search.inputPlaceholder")}
              value={searchInputValue}
              onChange={(value) => setSearchInputValue(value)}
            />
            <LibraryDropdownMenu
              selectedItems={selectedItems}
              onSelectItems={onSelectItems}
              className="library-menu-dropdown-container--in-heading"
            />
          </div>

          <Stack.Col
            className={clsx("library-menu-items-container__items", {
              "library-menu-items-container__items--with-sticky-action":
                !isLibraryEmpty && catalogStatus === "loaded",
            })}
            align="start"
            gap={1}
            style={{
              flex: 1,
              margin: 0,
            }}
            ref={libraryContainerRef}
          >
            {isLoading ? (
              <div
                style={{
                  position: "absolute",
                  top: "var(--container-padding-y)",
                  right: "var(--container-padding-x)",
                  transform: "translateY(50%)",
                }}
              >
                <Spinner />
              </div>
            ) : null}

            {isLibraryEmpty && catalogStatus === "loaded" ? (
              <div className="library-menu-items__no-items">
                <div className="library-menu-items__no-items__label">
                  {t("library.noItems")}
                </div>
                <div className="library-menu-items__no-items__hint">
                  {t("library.hint_emptyLibrary")}
                </div>
                <div className="library-menu-items__no-items__actions">
                  <button
                    type="button"
                    className="library-menu-browse-button drawsy-library-primary-button"
                    onClick={() => setView({ type: "marketplace" })}
                  >
                    Browse libraries
                  </button>
                </div>
              </div>
            ) : null}

            {!isLibraryEmpty ? (
              <div className="library-menu-items-container__header">
                {t("labels.personalLib")}
              </div>
            ) : null}

            {pendingElements.length > 0 ||
            filteredLooseItems.looseUnpublishedItems.length > 0 ? (
              <LibraryMenuSectionGrid>
                {pendingElements.length > 0 ? (
                  <LibraryMenuSection
                    items={[{ id: null, elements: pendingElements }]}
                    onItemSelectToggle={onItemSelectToggle}
                    onItemDrag={onItemDrag}
                    onClick={onAddToLibraryClick}
                    isItemSelected={isItemSelected}
                    svgCache={svgCache}
                    itemsRenderedPerBatch={itemsRenderedPerBatch}
                  />
                ) : null}
                <LibraryMenuSection
                  items={filteredLooseItems.looseUnpublishedItems}
                  onItemSelectToggle={onItemSelectToggle}
                  onItemDrag={onItemDrag}
                  onClick={onItemClick}
                  isItemSelected={isItemSelected}
                  svgCache={svgCache}
                  itemsRenderedPerBatch={itemsRenderedPerBatch}
                />
              </LibraryMenuSectionGrid>
            ) : null}

            {filteredLooseItems.importedPackSections.length > 0 ||
            filteredLooseItems.loosePublishedItems.length > 0 ? (
              <>
                <div className="library-menu-items-container__header library-menu-items-container__header--secondary">
                  Imported Libraries
                </div>

                {filteredLooseItems.importedPackSections.map((pack) => (
                  <ImportedPackGroup
                    key={pack.id}
                    pack={pack}
                    items={pack.items}
                    svgCache={svgCache}
                    itemsRenderedPerBatch={itemsRenderedPerBatch}
                    onToggleCollapsed={() => handleImportedPackToggle(pack.id)}
                    onItemClick={onItemClick}
                    onItemSelectToggle={onItemSelectToggle}
                    onItemDrag={onItemDrag}
                    isItemSelected={isItemSelected}
                  />
                ))}

                {filteredLooseItems.loosePublishedItems.length > 0 ? (
                  <div className="drawsy-library-pack">
                    <div className="drawsy-library-pack__header">
                      <div className="drawsy-library-pack__header-copy">
                        <div className="drawsy-library-pack__title">
                          Imported Items
                        </div>
                        <div className="drawsy-library-pack__meta">
                          {filteredLooseItems.loosePublishedItems.length} items
                        </div>
                      </div>
                    </div>
                    <LibraryMenuSectionGrid>
                      <LibraryMenuSection
                        items={filteredLooseItems.loosePublishedItems}
                        onItemSelectToggle={onItemSelectToggle}
                        onItemDrag={onItemDrag}
                        onClick={onItemClick}
                        isItemSelected={isItemSelected}
                        svgCache={svgCache}
                        itemsRenderedPerBatch={itemsRenderedPerBatch}
                      />
                    </LibraryMenuSectionGrid>
                  </div>
                ) : null}
              </>
            ) : null}

            {!isLibraryEmpty && catalogStatus === "loaded" ? (
              <div className="drawsy-library-sticky-actions">
                <button
                  type="button"
                  className="library-menu-browse-button drawsy-library-primary-button"
                  onClick={() => setView({ type: "marketplace" })}
                >
                  Browse libraries
                </button>
              </div>
            ) : null}

            {catalogStatus === "loading" ? (
              <div className="drawsy-library-state">
                <Spinner />
                <span>Loading marketplace...</span>
              </div>
            ) : null}

            {catalogStatus === "error" ? (
              <div className="drawsy-library-state drawsy-library-state--error">
                {catalogErrorMessage}
              </div>
            ) : null}
          </Stack.Col>
        </>
      ) : null}

      {view.type === "marketplace" ? (
        <Stack.Col className="library-menu-items-container__items" gap={1}>
          <PackHeader
            title="Marketplace"
            onBack={() => setView({ type: "overview" })}
          />
          <div className="drawsy-library-sheet__toolbar">
            <TextField
              type="search"
              className="library-menu-items-container__search"
              placeholder="Search marketplace"
              value={marketplaceQuery}
              onChange={setMarketplaceQuery}
            />
            <select
              className="drawsy-library-sheet__sort"
              value={marketplaceSort}
              onChange={(event) =>
                setMarketplaceSort(event.target.value as MarketplaceSort)
              }
            >
              <option value="popular">Popular</option>
              <option value="updated">Updated</option>
              <option value="new">New</option>
              <option value="name">Name</option>
            </select>
          </div>

          {catalogStatus === "loading" ? (
            <div className="drawsy-library-state">
              <Spinner />
              <span>Loading marketplace...</span>
            </div>
          ) : null}

          {catalogStatus === "error" ? (
            <div className="drawsy-library-state drawsy-library-state--error">
              {catalogErrorMessage}
            </div>
          ) : null}

          {catalogStatus === "loaded" ? (
            <>
              <div className="drawsy-library-card-grid drawsy-library-card-grid--marketplace">
                {paginatedMarketplaceEntries.map((entry) => (
                  <PackCard
                    key={entry.id}
                    entry={entry}
                    onSelect={() => setSelectedMarketplaceEntryId(entry.id)}
                    isSelected={selectedMarketplaceEntry?.id === entry.id}
                  />
                ))}
              </div>

              {selectedMarketplaceEntry ? (
                <div className="drawsy-library-selected-pack">
                  <div className="drawsy-library-pack__header">
                    <div className="drawsy-library-pack__header-copy">
                      <div
                        className="drawsy-library-pack__title"
                        title={selectedMarketplaceEntry.name}
                      >
                        {selectedMarketplaceEntry.name}
                      </div>
                      <div className="drawsy-library-pack__meta">
                        Preview before importing
                      </div>
                    </div>
                  </div>

                  {selectedMarketplacePackState?.status === "loaded" ? (
                    <LibraryMenuSectionGrid>
                      <LibraryMenuSection
                        items={selectedMarketplacePackState.items.slice(
                          0,
                          MARKETPLACE_PACK_PREVIEW_ITEMS,
                        )}
                        onItemSelectToggle={noopSelectToggle}
                        onItemDrag={noopItemDrag}
                        onClick={(itemId) => {
                          if (!itemId) {
                            return;
                          }
                          const item = selectedMarketplacePackState.items.find(
                            (libraryItem) => libraryItem.id === itemId,
                          );
                          if (item) {
                            onInsertLibraryItems([item]);
                          }
                        }}
                        isItemSelected={noopIsItemSelected}
                        svgCache={svgCache}
                        itemsRenderedPerBatch={itemsRenderedPerBatch}
                      />
                      <LibraryMoreTile
                        label={
                          importingPackId === selectedMarketplaceEntry.id
                            ? "Importing..."
                            : "Import Library"
                        }
                        onSelect={() =>
                          handleImportPack(selectedMarketplaceEntry)
                        }
                        disabled={
                          importingPackId === selectedMarketplaceEntry.id
                        }
                        variant="primary"
                      />
                    </LibraryMenuSectionGrid>
                  ) : null}

                  {selectedMarketplacePackState?.status === "loading" ||
                  !selectedMarketplacePackState ? (
                    <div className="drawsy-library-state">
                      <Spinner />
                      <span>Loading preview...</span>
                    </div>
                  ) : null}

                  {selectedMarketplacePackState?.status === "error" ? (
                    <div className="drawsy-library-state drawsy-library-state--error">
                      {selectedMarketplacePackState.errorMessage}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="drawsy-library-pagination drawsy-library-pagination--sticky">
                <Button
                  onSelect={() =>
                    setMarketplacePage((page) => Math.max(1, page - 1))
                  }
                  disabled={marketplacePage === 1}
                >
                  Prev
                </Button>
                <span>
                  {marketplacePage} / {marketplacePageCount}
                </span>
                <Button
                  onSelect={() =>
                    setMarketplacePage((page) =>
                      Math.min(marketplacePageCount, page + 1),
                    )
                  }
                  disabled={marketplacePage === marketplacePageCount}
                >
                  Next
                </Button>
              </div>
            </>
          ) : null}
        </Stack.Col>
      ) : null}

      {view.type === "pack" ? (
        <Stack.Col className="library-menu-items-container__items" gap={1}>
          <PackHeader
            title={view.entry.name}
            subtitle={
              view.source === "drawsy"
                ? "Drawsy Library pack"
                : "Marketplace pack"
            }
            onBack={() =>
              setView(
                view.source === "drawsy"
                  ? { type: "overview" }
                  : { type: "marketplace" },
              )
            }
          />

          <div className="drawsy-library-pack-detail">
            <img
              className="drawsy-library-pack-detail__preview"
              src={getDrawsyLibraryPreviewUrl(
                view.entry,
                DEFAULT_DRAWSY_LIBRARY_BASE_URL,
              )}
              alt={view.entry.name}
            />
            <div className="drawsy-library-pack-detail__copy">
              <div className="drawsy-library-pack-detail__description">
                {view.entry.description}
              </div>
              <div className="drawsy-library-pack-detail__meta">
                {view.entry.authors.map((author) => author.name).join(", ")}
              </div>
              <Button
                className="drawsy-library-pack-detail__add"
                onSelect={() => handleImportPack(view.entry)}
                disabled={importingPackId === view.entry.id}
              >
                {importingPackId === view.entry.id
                  ? "Adding..."
                  : "Add to Personal"}
              </Button>
            </div>
          </div>

          {packState?.status === "loading" || !packState ? (
            <div className="drawsy-library-state">
              <Spinner />
              <span>Loading pack items...</span>
            </div>
          ) : null}

          {packState?.status === "error" ? (
            <div className="drawsy-library-state drawsy-library-state--error">
              {packState.errorMessage}
            </div>
          ) : null}

          {packState?.status === "loaded" ? (
            <>
              <div className="library-menu-items-container__header">
                Pack items
              </div>
              <LibraryMenuSectionGrid>
                <LibraryMenuSection
                  items={packState.items}
                  onItemSelectToggle={noopSelectToggle}
                  onItemDrag={noopItemDrag}
                  onClick={(itemId) => {
                    if (!itemId) {
                      return;
                    }
                    const item = packState.items.find(
                      (libraryItem) => libraryItem.id === itemId,
                    );
                    if (item) {
                      onInsertLibraryItems([item]);
                    }
                  }}
                  isItemSelected={noopIsItemSelected}
                  svgCache={svgCache}
                  itemsRenderedPerBatch={itemsRenderedPerBatch}
                />
              </LibraryMenuSectionGrid>
            </>
          ) : null}
        </Stack.Col>
      ) : null}
    </div>
  );
}
