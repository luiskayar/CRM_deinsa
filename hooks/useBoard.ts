"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { BoardType, CardItem, Comment, Contact, NegotiationStatus } from "@/lib/types";

function createCommentId() {
  return `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Lectura puntual a través de tu propia API segura (para exportar a Excel)
export async function fetchBoardCards(boardType: BoardType): Promise<CardItem[]> {
  const res = await fetch(`/api/board?type=${boardType}`);
  if (!res.ok) throw new Error("Error fetching board");
  return await res.json();
}

export function useBoard(boardType: BoardType) {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    try {
      const data = await fetchBoardCards(boardType);
      setCards(data);
      setError(null);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [boardType]);

  // Simulamos el tiempo real consultando la API de forma segura
  useEffect(() => {
    const init = async () => {
      await loadCards();
    };
    init();
    
    const interval = setInterval(loadCards, 10000);
    return () => clearInterval(interval);
  }, [loadCards]);

  const cardsByColumn = useMemo(() => {
    const map: Record<string, CardItem[]> = {};
    for (const card of cards) {
      if (!map[card.columnId]) map[card.columnId] = [];
      map[card.columnId].push(card);
    }
    return map;
  }, [cards]);

  // Función interna para hablar con la API (reemplazamos any por unknown)
  async function apiRequest(action: string, id?: string, payload?: unknown) {
    await fetch("/api/board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: boardType, action, id, payload }),
    });
    await loadCards(); // Refrescamos los datos después de escribir
  }

  async function moveCard(cardId: string, newColumnId: string) {
    // UI Optimista
    setCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, columnId: newColumnId } : card))
    );
    await apiRequest("move", cardId, { columnId: newColumnId });
  }

  async function addCard(columnId: string, name: string) {
    await apiRequest("add", undefined, {
      name,
      columnId,
      createdAt: new Date().toISOString(),
      comments: [],
    });
  }

  async function updateCard(
    cardId: string,
    updates: {
      name?: string;
      comments?: Comment[];
      newComments?: string[];
      contacts?: Contact[];
      status?: NegotiationStatus | null;
    }
  ) {
    const payload: Record<string, unknown> = {};
    const optimisticPatch: Partial<CardItem> = {};

    if (updates.name !== undefined) {
      payload.name = updates.name;
      optimisticPatch.name = updates.name;
    }
    if (updates.comments !== undefined) {
      const addedComments: Comment[] = (updates.newComments ?? []).map((text) => ({
        id: createCommentId(),
        text,
        createdAt: new Date().toISOString(),
      }));
      const mergedComments = [...updates.comments, ...addedComments];
      payload.comments = mergedComments;
      optimisticPatch.comments = mergedComments;
    }
    if (updates.contacts !== undefined) {
      payload.contacts = updates.contacts;
      optimisticPatch.contacts = updates.contacts;
    }
    if (updates.status !== undefined) {
      payload.status = updates.status;
      optimisticPatch.status = updates.status ?? undefined;
    }

    // UI Optimista: igual que moveCard, no esperamos al fetch (ni al
    // siguiente ciclo de polling) para reflejar el cambio en pantalla.
    setCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, ...optimisticPatch } : card))
    );

    await apiRequest("update", cardId, payload);
  }

  async function deleteCard(cardId: string) {
    setCards((prev) => prev.filter((card) => card.id !== cardId));
    await apiRequest("delete", cardId);
  }

  return {
    cards,
    cardsByColumn,
    loading,
    error,
    moveCard,
    addCard,
    updateCard,
    deleteCard,
  };
}