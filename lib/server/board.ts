import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { BOARD_COLLECTION, COUNTRY_CODES, DEFAULT_PIPELINE } from "@/lib/constants";
import { BoardType } from "@/lib/types";

// Único punto de acceso a Firestore para las tarjetas: al migrar a la BD en
// PHP (5.2.4) solo cambia este archivo.

function boardCollection(boardType: BoardType) {
  return adminDb.collection(BOARD_COLLECTION[boardType]);
}

// Las tarjetas anteriores a 5.2.2 no traen pipelineId: pertenecen al default.
function cardPipelineId(data: FirebaseFirestore.DocumentData) {
  return (data.pipelineId as string | undefined) ?? DEFAULT_PIPELINE.id;
}

// Los valores null llegan desde el cliente cuando se quiere borrar un campo
// (p. ej. eliminar el contacto de RF-05); el Admin SDK solo borra campos de
// verdad con el sentinel FieldValue.delete() en updates. pipelineId e id no
// se pueden cambiar desde un update.
function toFirestoreUpdate(payload: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === "pipelineId" || key === "id") continue;
    result[key] = value === null ? FieldValue.delete() : value;
  }
  return result;
}

// Se filtra en memoria (y no con where) para incluir las tarjetas sin
// pipelineId; se lee la colección completa, igual que antes de 5.2.2.
export async function listCards(boardType: BoardType, pipelineId: string) {
  const snapshot = await boardCollection(boardType).orderBy("createdAt", "asc").get();
  return snapshot.docs
    .filter((doc) => cardPipelineId(doc.data()) === pipelineId)
    .map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function addCard(
  boardType: BoardType,
  pipelineId: string,
  payload: Record<string, unknown>
) {
  await boardCollection(boardType).add({ ...payload, pipelineId });
}

// Normaliza un contacto recibido en la carga masiva: todo dato faltante es null.
function sanitizeContact(contact: Record<string, unknown> | null | undefined) {
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  return {
    name: text(contact?.name),
    role: text(contact?.role),
    email: text(contact?.email),
    countryCode: text(contact?.countryCode) ?? COUNTRY_CODES[0].code,
    phone: text(contact?.phone),
  };
}

export async function bulkAddCards(
  boardType: BoardType,
  pipelineId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[]
) {
  const collectionRef = boardCollection(boardType);
  const batch = adminDb.batch();

  for (const item of items) {
    batch.set(collectionRef.doc(), {
      name: item.name || "",
      columnId: item.columnId || "",
      createdAt: item.createdAt || new Date().toISOString(),
      comments: item.comments || [],
      contacts: Array.isArray(item.contacts) ? item.contacts.map(sanitizeContact) : [],
      status: item.status || null,
      pipelineId,
    });
  }

  await batch.commit();
}

// Devuelve false si la tarjeta no existe o es de otro pipeline.
export async function updateCard(
  boardType: BoardType,
  pipelineId: string,
  id: string,
  payload: Record<string, unknown>
) {
  const docRef = boardCollection(boardType).doc(id);
  const doc = await docRef.get();
  if (!doc.exists || cardPipelineId(doc.data()!) !== pipelineId) return false;
  await docRef.update(toFirestoreUpdate(payload));
  return true;
}

// Borra todas las tarjetas de un pipeline en ambos tableros y devuelve cuántas
// eran. where por un solo campo no requiere índice compuesto. No sirve para el
// default: sus tarjetas antiguas no traen pipelineId.
export async function deletePipelineCards(pipelineId: string) {
  // BulkWriter reparte las escrituras en lotes y reintenta las que fallan.
  const writer = adminDb.bulkWriter();
  let deleted = 0;
  for (const boardType of Object.keys(BOARD_COLLECTION) as BoardType[]) {
    const snapshot = await boardCollection(boardType).where("pipelineId", "==", pipelineId).get();
    snapshot.docs.forEach((doc) => writer.delete(doc.ref));
    deleted += snapshot.size;
  }
  await writer.close();
  return deleted;
}

// Devuelve false si la tarjeta no existe o es de otro pipeline.
export async function deleteCard(boardType: BoardType, pipelineId: string, id: string) {
  const docRef = boardCollection(boardType).doc(id);
  const doc = await docRef.get();
  if (!doc.exists || cardPipelineId(doc.data()!) !== pipelineId) return false;
  await docRef.delete();
  return true;
}
