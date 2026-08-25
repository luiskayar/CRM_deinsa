"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { BoardType, CardItem, Comment } from "@/lib/types";

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
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [boardType]);

  // Simulamos el tiempo real consultando la API cada 10 segundos
  // Así evitamos tener Firebase abierto en el cliente
  useEffect(() => {
    loadCards();
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

  // Función interna para hablar con la API de modificaciones
  async function apiRequest(action: string, id?: string, payload?: any) {
    await fetch("/api/board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: boardType, action, id, payload }),
    });
    await loadCards(); // Refrescamos los datos después de escribir
  }

  async function moveCard(cardId: string, newColumnId: string) {
    // UI Optimista: Movemos la tarjeta en pantalla al instante para que no haya lag
    setCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, columnId: newColumnId } : card))
    );
    // Luego le avisamos a la API en segundo plano
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
    updates: { name: string; comments: Comment[]; newComments: string[] }
  ) {
    const addedComments: Comment[] = updates.newComments.map((text) => ({
      id: createCommentId(),
      text,
      createdAt: new Date().toISOString(),
    }));
    await apiRequest("update", cardId, {
      name: updates.name,
      comments: [...updates.comments, ...addedComments],
    });
  }

  async function deleteCard(cardId: string) {
    // UI Optimista: Desaparecemos la tarjeta al instante
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