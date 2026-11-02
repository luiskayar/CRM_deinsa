import { NextResponse } from "next/server";
import { BOARD_COLLECTION } from "@/lib/constants";
import { BoardType } from "@/lib/types";
import { getPipeline } from "@/lib/server/pipelines";
import { addCard, bulkAddCards, deleteCard, listCards, updateCard } from "@/lib/server/board";

function isBoardType(type: unknown): type is BoardType {
  return typeof type === "string" && type in BOARD_COLLECTION;
}

// Devuelve el id si el pipeline existe; null en caso contrario.
async function resolvePipelineId(pipelineId: unknown): Promise<string | null> {
  if (typeof pipelineId !== "string") return null;
  return (await getPipeline(pipelineId))?.id ?? null;
}

// 1. Maneja las lecturas (GET)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (!isBoardType(type)) {
    return NextResponse.json({ error: "Tipo de tablero inválido" }, { status: 400 });
  }

  try {
    const pipelineId = await resolvePipelineId(searchParams.get("pipeline"));
    if (!pipelineId) {
      return NextResponse.json({ error: "Pipeline no encontrado" }, { status: 404 });
    }
    return NextResponse.json(await listCards(type, pipelineId));
  } catch (error) {
    console.error("Error GET /api/board:", error);
    return NextResponse.json({ error: "Error al obtener datos" }, { status: 500 });
  }
}

// 2. Maneja las escrituras (POST, PUT, DELETE, BULKADD)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, type, id, payload } = body;

    if (!isBoardType(type)) {
      return NextResponse.json({ error: "Tipo de tablero inválido" }, { status: 400 });
    }
    const pipelineId = await resolvePipelineId(body.pipelineId);
    if (!pipelineId) {
      return NextResponse.json({ error: "Pipeline no encontrado" }, { status: 404 });
    }

    // 🔥 CARGA MASIVA (Requerimiento de Brenda para importaciones)
    if (action === "bulkAdd") {
      if (!Array.isArray(payload)) {
        return NextResponse.json({ error: "El payload debe ser un array para bulkAdd" }, { status: 400 });
      }
      await bulkAddCards(type, pipelineId, payload);
      return NextResponse.json({ success: true, count: payload.length });
    }

    // Acciones individuales
    let found = true;
    if (action === "add") {
      await addCard(type, pipelineId, payload);
    } else if (action === "move" || action === "update") {
      found = await updateCard(type, pipelineId, id, payload);
    } else if (action === "delete") {
      found = await deleteCard(type, pipelineId, id);
    } else {
      return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
    }

    if (!found) {
      return NextResponse.json({ error: "Tarjeta no encontrada en este pipeline" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error POST /api/board:", error);
    return NextResponse.json({ error: "Error al modificar datos" }, { status: 500 });
  }
}
