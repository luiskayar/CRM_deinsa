"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BOARD_COLLECTION } from "@/lib/constants";
import { BoardType, CardItem, Comment } from "@/lib/types";

function createCommentId() {
  return `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useBoard(boardType: BoardType) {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, BOARD_COLLECTION[boardType]),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCards(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<CardItem, "id">),
          }))
        );
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [boardType]);

  const cardsByColumn = useMemo(() => {
    const map: Record<string, CardItem[]> = {};
    for (const card of cards) {
      if (!map[card.columnId]) map[card.columnId] = [];
      map[card.columnId].push(card);
    }
    return map;
  }, [cards]);

  async function moveCard(cardId: string, newColumnId: string) {
    await updateDoc(doc(db, BOARD_COLLECTION[boardType], cardId), {
      columnId: newColumnId,
    });
  }

  async function addCard(columnId: string, name: string) {
    await addDoc(collection(db, BOARD_COLLECTION[boardType]), {
      name,
      columnId,
      createdAt: new Date().toISOString(),
      comments: [],
    });
  }

  async function updateCard(
    cardId: string,
    updates: { name: string; newComments: string[] }
  ) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const addedComments: Comment[] = updates.newComments.map((text) => ({
      id: createCommentId(),
      text,
      createdAt: new Date().toISOString(),
    }));
    await updateDoc(doc(db, BOARD_COLLECTION[boardType], cardId), {
      name: updates.name,
      comments: [...card.comments, ...addedComments],
    });
  }

  async function deleteCard(cardId: string) {
    await deleteDoc(doc(db, BOARD_COLLECTION[boardType], cardId));
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
