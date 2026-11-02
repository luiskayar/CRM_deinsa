import { cache } from "react";
import { adminDb } from "@/lib/firebase-admin";
import {
  DEFAULT_PIPELINE,
  PIPELINE_COLLECTION,
  PIPELINE_NAME_MAX_LENGTH,
  RESERVED_PIPELINE_SLUGS,
} from "@/lib/constants";
import { pipelineSlug } from "@/lib/pipeline";
import { Pipeline } from "@/lib/types";

// Único punto de acceso a Firestore para pipelines: al migrar a la BD en PHP
// (5.2.4) solo cambia este archivo.

// Código gRPC que devuelve Firestore cuando .create() choca con un id existente.
const ALREADY_EXISTS = 6;

function toPipeline(id: string, data: FirebaseFirestore.DocumentData): Pipeline {
  return { id, name: data.name, createdAt: data.createdAt };
}

export async function listPipelines(): Promise<Pipeline[]> {
  const snapshot = await adminDb.collection(PIPELINE_COLLECTION).orderBy("createdAt", "asc").get();
  return [DEFAULT_PIPELINE, ...snapshot.docs.map((doc) => toPipeline(doc.id, doc.data()))];
}

// cache(): el layout y la página de un mismo request lo consultan una sola vez.
export const getPipeline = cache(async (id: string): Promise<Pipeline | null> => {
  if (id === DEFAULT_PIPELINE.id) return DEFAULT_PIPELINE;
  const doc = await adminDb.collection(PIPELINE_COLLECTION).doc(id).get();
  return doc.exists ? toPipeline(doc.id, doc.data()!) : null;
});

export type CreatePipelineResult =
  | { ok: true; pipeline: Pipeline }
  | { ok: false; status: number; error: string };

export async function createPipeline(rawName: unknown): Promise<CreatePipelineResult> {
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) {
    return { ok: false, status: 400, error: "El nombre del pipeline es obligatorio." };
  }
  if (name.length > PIPELINE_NAME_MAX_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `El nombre no puede superar ${PIPELINE_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  const id = pipelineSlug(name);
  if (!id) {
    return { ok: false, status: 400, error: "El nombre debe incluir letras o números." };
  }
  if (RESERVED_PIPELINE_SLUGS.has(id)) {
    return { ok: false, status: 409, error: "Ya existe un pipeline con ese nombre." };
  }

  const pipeline: Pipeline = { id, name, createdAt: new Date().toISOString() };
  try {
    await adminDb
      .collection(PIPELINE_COLLECTION)
      .doc(id)
      .create({ name: pipeline.name, createdAt: pipeline.createdAt });
  } catch (error) {
    if ((error as { code?: number }).code === ALREADY_EXISTS) {
      return { ok: false, status: 409, error: "Ya existe un pipeline con ese nombre." };
    }
    throw error;
  }
  return { ok: true, pipeline };
}
