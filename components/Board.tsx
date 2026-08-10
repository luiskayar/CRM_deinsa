"use client";

import { useState } from "react";
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
} from "@/lib/constants";
import { BoardType } from "@/lib/types";
import { useBoard } from "@/hooks/useBoard";
import { Column } from "./Column";
import { CardModal } from "./CardModal";

export function Board({ boardType }: { boardType: BoardType }) {
  const {
    cards,
    cardsByColumn,
    loading,
    error,
    moveCard,
    addCard,
    updateCard,
    deleteCard,
  } = useBoard(boardType);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const columns = BOARD_COLUMNS[boardType];
  const itemLabel = BOARD_ITEM_LABEL[boardType];
  const itemOfPhrase = BOARD_ITEM_OF_PHRASE[boardType];
  const newItemLabel = BOARD_ITEM_NEW_LABEL[boardType];

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
      <div className="board-scroll flex gap-4 overflow-x-auto p-6 pb-4">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            cards={cardsByColumn[column.id] ?? []}
            itemLabel={itemLabel}
            newItemLabel={newItemLabel}
            onCardClick={setSelectedCardId}
            onAddCard={(name) => addCard(column.id, name)}
          />
        ))}
      </div>

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
    </DndContext>
  );
}
