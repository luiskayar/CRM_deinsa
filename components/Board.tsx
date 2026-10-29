"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  BOARD_COLUMNS,
  BOARD_ITEM_LABEL,
  BOARD_ITEM_NEW_LABEL,
  BOARD_ITEM_OF_PHRASE,
  BOARD_LABELS,
  EXPORT_SHEET_NAME,
} from "@/lib/constants";
import { getCardContacts } from "@/lib/contact";
import { cardsToExportRows, EXPORT_HEADERS, exportRowsToPdf, exportSheetsToExcel } from "@/lib/export";
import { downloadImportTemplate, importWorkbookFile, ImportSheetOutcome } from "@/lib/import";
import { normalizeText } from "@/lib/search";
import { BoardType, CardItem } from "@/lib/types";
import { fetchBoardCards, useBoard } from "@/hooks/useBoard";
import { Column } from "./Column";
import { CardModal } from "./CardModal";
import { ImportResultModal } from "./ImportResultModal";
import { SearchBar } from "./SearchBar";

const OTHER_BOARD_TYPE: Record<BoardType, BoardType> = {
  negociaciones: "alianzas",
  alianzas: "negociaciones",
};

const AUTO_SCROLL_SPEED = 12; // px por tick mientras el mouse está sobre la flecha
const ARROW_SCROLL_STEP = 288; // ancho de una columna, para el click/tap

export function Board({ boardType }: { boardType: BoardType }) {
  const {
    cards,
    loading,
    error,
    moveCard,
    addCard,
    updateCard,
    deleteCard,
  } = useBoard(boardType);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const columns = BOARD_COLUMNS[boardType];
  const itemLabel = BOARD_ITEM_LABEL[boardType];
  const itemOfPhrase = BOARD_ITEM_OF_PHRASE[boardType];
  const newItemLabel = BOARD_ITEM_NEW_LABEL[boardType];

  const isSearching = search.trim().length > 0;

  const filteredCards = useMemo(() => {
    if (!isSearching) return cards;
    const query = normalizeText(search.trim());
    return cards.filter((card) => {
      const contacts = getCardContacts(card);
      const haystack = [card.name, ...contacts.flatMap((c) => [c.name, c.email, c.phone])]
        .filter(Boolean)
        .join(" ");
      return normalizeText(haystack).includes(query);
    });
  }, [cards, isSearching, search]);

  const filteredCardsByColumn = useMemo(() => {
    const map: Record<string, CardItem[]> = {};
    for (const card of filteredCards) {
      if (!map[card.columnId]) map[card.columnId] = [];
      map[card.columnId].push(card);
    }
    return map;
  }, [filteredCards]);

  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExportPdf() {
    setExportError(null);
    setExporting("pdf");
    try {
      await exportRowsToPdf({
        title: `${BOARD_LABELS[boardType]} — Deinsa CRM`,
        headers: EXPORT_HEADERS,
        rows: cardsToExportRows(filteredCards, columns),
        filename: `${boardType}-${new Date().toISOString().slice(0, 10)}.pdf`,
      });
    } catch (err) {
      console.error(err);
      setExportError("No se pudo generar el PDF.");
    } finally {
      setExporting(null);
    }
  }

  async function handleExportExcel() {
    setExportError(null);
    setExporting("excel");
    try {
      const otherBoardType = OTHER_BOARD_TYPE[boardType];
      const otherCards = await fetchBoardCards(otherBoardType);
      const currentSheet = {
        name: EXPORT_SHEET_NAME[boardType],
        headers: EXPORT_HEADERS,
        rows: cardsToExportRows(filteredCards, columns),
      };
      const otherSheet = {
        name: EXPORT_SHEET_NAME[otherBoardType],
        headers: EXPORT_HEADERS,
        rows: cardsToExportRows(otherCards, BOARD_COLUMNS[otherBoardType]),
      };
      await exportSheetsToExcel({
        sheets: boardType === "negociaciones" ? [currentSheet, otherSheet] : [otherSheet, currentSheet],
        filename: `deinsa-crm-${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
    } catch (err) {
      console.error(err);
      setExportError("No se pudo generar el Excel.");
    } finally {
      setExporting(null);
    }
  }

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportSheetOutcome[] | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportError(null);
    setImporting(true);
    try {
      // Ya no necesitamos traer las cartas del otro tablero
      // porque solo vamos a importar al tablero actual (boardType)
      const existingCardsByBoard = {
        [boardType]: cards,
      } as Record<BoardType, CardItem[]>;
      
      // 🔥 Le pasamos a la función `boardType` para que sepa dónde estamos
      const outcomes = await importWorkbookFile(file, existingCardsByBoard, boardType);
      setImportResult(outcomes);
    } catch (err) {
      console.error(err);
      setImportError("No se pudo leer el archivo. Verifica que sea un Excel válido.");
    } finally {
      setImporting(false);
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollIntervalRef = useRef<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollEdges();
    el.addEventListener("scroll", updateScrollEdges);
    const observer = new ResizeObserver(updateScrollEdges);
    observer.observe(el);
    window.addEventListener("resize", updateScrollEdges);
    return () => {
      el.removeEventListener("scroll", updateScrollEdges);
      observer.disconnect();
      window.removeEventListener("resize", updateScrollEdges);
    };
  }, [updateScrollEdges, filteredCardsByColumn]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current !== null) {
      window.clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  }, []);

  const startAutoScroll = useCallback(
    (direction: "left" | "right") => {
      stopAutoScroll();
      autoScrollIntervalRef.current = window.setInterval(() => {
        const el = scrollRef.current;
        if (!el) return;
        const before = el.scrollLeft;
        el.scrollBy({ left: direction === "left" ? -AUTO_SCROLL_SPEED : AUTO_SCROLL_SPEED });
        if (el.scrollLeft === before) stopAutoScroll();
      }, 16);
    },
    [stopAutoScroll]
  );

  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const cardId = String(active.id);
    const newColumnId = String(over.id);
    moveCard(cardId, newColumnId);
  }

  const selectedCard = cards.find((c) => c.id === selectedCardId) ?? null;

  if (error) {
    return (
      <div className="m-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
        No se pudo conectar con Firebase: {error}
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-sm text-neutral-500">Cargando tablero...</div>;
  }

  return (
    <DndContext id={`board-${boardType}`} sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 pt-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, contacto o correo..."
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting !== null}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-deinsa-orange hover:text-deinsa-orange disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === "pdf" ? "Generando..." : "Exportar PDF"}
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting !== null}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-deinsa-orange hover:text-deinsa-orange disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === "excel" ? "Generando..." : "Exportar Excel"}
          </button>
          <button
            type="button"
            onClick={() => downloadImportTemplate()}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-deinsa-orange hover:text-deinsa-orange"
          >
            Plantilla de importación
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-deinsa-orange hover:text-deinsa-orange disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? "Importando..." : "Importar Excel"}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {exportError && (
        <div className="mx-6 mt-2 shrink-0 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {exportError}
        </div>
      )}

      {importError && (
        <div className="mx-6 mt-2 shrink-0 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {importError}
        </div>
      )}

      {isSearching && filteredCards.length === 0 ? (
        <div className="m-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
          No se encontraron resultados para &quot;{search.trim()}&quot;.
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <button
            type="button"
            aria-label="Ver columnas anteriores"
            tabIndex={canScrollLeft ? 0 : -1}
            onMouseEnter={() => startAutoScroll("left")}
            onMouseLeave={stopAutoScroll}
            onClick={() =>
              scrollRef.current?.scrollBy({ left: -ARROW_SCROLL_STEP, behavior: "smooth" })
            }
            className={`absolute left-0 top-1/2 z-10 flex h-20 w-11 -translate-y-1/2 items-center justify-center rounded-r-full border border-l-0 border-neutral-700 bg-neutral-900/80 text-4xl text-neutral-200 shadow-lg backdrop-blur transition-opacity duration-200 hover:border-deinsa-orange hover:text-deinsa-orange ${
              canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            ‹
          </button>

          <div
            ref={scrollRef}
            className="board-scroll flex h-full gap-4 overflow-x-auto p-6 pb-4"
          >
            {columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                cards={filteredCardsByColumn[column.id] ?? []}
                itemLabel={itemLabel}
                newItemLabel={newItemLabel}
                onCardClick={setSelectedCardId}
                onAddCard={(name) => addCard(column.id, name)}
              />
            ))}
          </div>

          <button
            type="button"
            aria-label="Ver columnas siguientes"
            tabIndex={canScrollRight ? 0 : -1}
            onMouseEnter={() => startAutoScroll("right")}
            onMouseLeave={stopAutoScroll}
            onClick={() =>
              scrollRef.current?.scrollBy({ left: ARROW_SCROLL_STEP, behavior: "smooth" })
            }
            className={`absolute right-0 top-1/2 z-10 flex h-20 w-11 -translate-y-1/2 items-center justify-center rounded-l-full border border-r-0 border-neutral-700 bg-neutral-900/80 text-4xl text-neutral-200 shadow-lg backdrop-blur transition-opacity duration-200 hover:border-deinsa-orange hover:text-deinsa-orange ${
              canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            ›
          </button>
        </div>
      )}

      {selectedCard && (
        <CardModal
          card={selectedCard}
          itemLabel={itemLabel}
          itemOfPhrase={itemOfPhrase}
          onClose={() => setSelectedCardId(null)}
          onSave={updateCard}
          onDelete={deleteCard}
        />
      )}

      {importResult && (
        <ImportResultModal outcomes={importResult} onClose={() => setImportResult(null)} />
      )}
    </DndContext>
  );
}