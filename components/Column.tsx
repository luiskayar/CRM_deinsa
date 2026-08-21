"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { CardItem, Column as ColumnType } from "@/lib/types";
import { COLUMN_ACCENT, COLUMN_ACCENT_CLASSES } from "@/lib/constants";
import { Card } from "./Card";

export function Column({
  column,
  cards,
  itemLabel,
  newItemLabel,
  onCardClick,
  onAddCard,
}: {
  column: ColumnType;
  cards: CardItem[];
  itemLabel: string;
  newItemLabel: string;
  onCardClick: (cardId: string) => void;
  onAddCard: (name: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const accent = COLUMN_ACCENT_CLASSES[COLUMN_ACCENT[column.id] ?? "neutral"];

  function submit() {
    const trimmed = name.trim();
    if (trimmed) {
      onAddCard(trimmed);
    }
    setName("");
    setAdding(false);
  }

  return (
    <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      <div className={`h-1 w-full ${accent.bar}`} />
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2.5">
        <h2 className="text-sm font-semibold text-neutral-200">
          {column.label}
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${accent.badgeBg} ${accent.badgeText}`}
        >
          {cards.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`column-scroll flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2.5 transition-colors ${
          isOver ? "bg-deinsa-orange/10" : ""
        }`}
      >
        {cards.map((card) => (
          <Card key={card.id} card={card} onClick={() => onCardClick(card.id)} />
        ))}
      </div>

      <div className="border-t border-neutral-800 p-2.5">
        {adding ? (
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") {
                  setAdding(false);
                  setName("");
                }
              }}
              placeholder={`Nombre de ${itemLabel}`}
              className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange"
            />
            <div className="flex gap-2">
              <button
                onClick={submit}
                className="flex-1 rounded-md bg-deinsa-orange px-2 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-deinsa-orange-dark hover:text-neutral-100"
              >
                Agregar
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setName("");
                }}
                className="rounded-md border border-neutral-700 px-2 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full rounded-md border border-dashed border-neutral-700 py-1.5 text-xs text-neutral-400 hover:border-deinsa-orange hover:text-deinsa-orange"
          >
            + {newItemLabel}
          </button>
        )}
      </div>
    </div>
  );
}
