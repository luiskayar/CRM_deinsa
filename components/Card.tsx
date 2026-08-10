"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CardItem } from "@/lib/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function Card({
  card,
  onClick,
}: {
  card: CardItem;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card.id });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`cursor-pointer rounded-lg border border-neutral-700 bg-neutral-800 p-3 shadow-md transition-colors hover:border-deinsa-orange/60 ${
        isDragging ? "z-10 opacity-50" : ""
      }`}
    >
      <p className="text-sm font-medium text-neutral-100">{card.name}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>{formatDate(card.createdAt)}</span>
        <span className="rounded-full bg-neutral-700 px-2 py-0.5 text-neutral-300">
          {card.comments.length} comentario{card.comments.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
