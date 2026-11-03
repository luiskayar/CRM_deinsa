import { cache } from "react";
import { adminDb } from "@/lib/firebase-admin";
import {
  DEFAULT_PIPELINE,
  PIPELINE_COLLECTION,
  PIPELINE_NAME_MAX_LENGTH,
  RESERVED_PIPELINE_SLUGS,
} from "@/lib/constants";
import { pipelineSlug } from "@/lib/pipeline";
import { deletePipelineCards } from "@/lib/server/board";
import { Pipeline } from "@/lib/types";

// Único punto de acceso a Firestore para pipelines: al migrar a la BD en PHP
// (5.2.4) solo cambia este archivo.
//
// Eliminar un pipeline lo borra por completo junto con sus tarjetas; queda
// constancia en logs_auditoria.

// Código gRPC que devuelve Firestore cuando .create() choca con un id existente.
const ALREADY_EXISTS = 6;

const pipelinesCollection = () => adminDb.collection(PIPELINE_COLLECTION);

function toPipeline(id: string, data: FirebaseFirestore.DocumentData): Pipeline {
  return { id, name: data.name, createdAt: data.createdAt };
}

export async function listPipelines(): Promise<Pipeline[]> {
  const snapshot = await pipelinesCollection().orderBy("createdAt", "asc").get();
  return [DEFAULT_PIPELINE, ...snapshot.docs.map((doc) => toPipeline(doc.id, doc.data()))];
}

// cache(): las consultas repetidas dentro de un mismo request se hacen una vez.
export const getPipeline = cache(async (id: string): Promise<Pipeline | null> => {
  if (id === DEFAULT_PIPELINE.id) return DEFAULT_PIPELINE;
  const doc = await pipelinesCollection().doc(id).get();
  if (!doc.exists) return null;
  return toPipeline(doc.id, doc.data()!);
});

export type PipelineResult =
  | { ok: true; pipeline: Pipeline }
  | { ok: false; status: number; error: string };

type Failure = Extract<PipelineResult, { ok: false }>;

const DUPLICATE_NAME: Failure = {
  ok: false,
  status: 409,
  error: "Ya existe un pipeline con ese nombre.",
};

const NOT_FOUND: Failure = { ok: false, status: 404, error: "Pipeline no encontrado." };

const DEFAULT_LOCKED: Failure = {
  ok: false,
  status: 400,
  error: `"${DEFAULT_PIPELINE.name}" es el pipeline por defecto y no se puede modificar.`,
};

// Devuelve el nombre limpio y su slug, o el error de validación.
function validateName(rawName: unknown): { name: string; slug: string } | Failure {
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
  const slug = pipelineSlug(name);
  if (!slug) {
    return { ok: false, status: 400, error: "El nombre debe incluir letras o números." };
  }
  return { name, slug };
}

// Un nombre está ocupado si su slug coincide con el id o con el nombre de otro
// pipeline. Comparar nombres importa porque renombrar no cambia el id.
async function isNameTaken(slug: string, exceptId?: string) {
  if (RESERVED_PIPELINE_SLUGS.has(slug) || slug === pipelineSlug(DEFAULT_PIPELINE.name)) {
    return true;
  }
  const snapshot = await pipelinesCollection().get();
  return snapshot.docs.some(
    (doc) => doc.id !== exceptId && (doc.id === slug || pipelineSlug(doc.data().name) === slug)
  );
}

export async function createPipeline(rawName: unknown, createdBy: string): Promise<PipelineResult> {
  const validated = validateName(rawName);
  if ("ok" in validated) return validated;
  if (await isNameTaken(validated.slug)) return DUPLICATE_NAME;

  const pipeline: Pipeline = {
    id: validated.slug,
    name: validated.name,
    createdAt: new Date().toISOString(),
  };
  try {
    await pipelinesCollection()
      .doc(pipeline.id)
      .create({ name: pipeline.name, createdAt: pipeline.createdAt, createdBy });
  } catch (error) {
    if ((error as { code?: number }).code === ALREADY_EXISTS) return DUPLICATE_NAME;
    throw error;
  }
  return { ok: true, pipeline };
}

// Solo cambia el nombre: el id (y por lo tanto la URL y el pipelineId de las
// tarjetas) se mantiene.
export async function renamePipeline(
  id: string,
  rawName: unknown,
  updatedBy: string
): Promise<PipelineResult> {
  if (id === DEFAULT_PIPELINE.id) return DEFAULT_LOCKED;
  const current = await getPipeline(id);
  if (!current) return NOT_FOUND;

  const validated = validateName(rawName);
  if ("ok" in validated) return validated;
  if (await isNameTaken(validated.slug, id)) return DUPLICATE_NAME;

  await pipelinesCollection().doc(id).update({
    name: validated.name,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });
  return { ok: true, pipeline: { ...current, name: validated.name } };
}

// Irreversible. Primero se borra el pipeline para que /api/board rechace
// nuevas tarjetas en él, y después sus tarjetas; así el nombre queda libre
// sin que un pipeline nuevo con el mismo id herede datos.
export async function deletePipeline(id: string, deletedBy: string): Promise<PipelineResult> {
  if (id === DEFAULT_PIPELINE.id) return DEFAULT_LOCKED;
  const current = await getPipeline(id);
  if (!current) return NOT_FOUND;

  await pipelinesCollection().doc(id).delete();
  const deletedCards = await deletePipelineCards(id);
  await adminDb.collection("logs_auditoria").add({
    evento: "PIPELINE_ELIMINADO",
    fecha: new Date().toISOString(),
    usuario: deletedBy,
    pipelineId: id,
    pipelineNombre: current.name,
    tarjetasEliminadas: deletedCards,
  });
  return { ok: true, pipeline: current };
}
