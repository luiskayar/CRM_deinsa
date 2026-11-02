import { NextResponse } from "next/server";
import { createPipeline, listPipelines } from "@/lib/server/pipelines";

export async function GET() {
  try {
    return NextResponse.json(await listPipelines());
  } catch (error) {
    console.error("Error GET /api/pipelines:", error);
    return NextResponse.json({ error: "Error al obtener los pipelines" }, { status: 500 });
  }
}

// TODO(5.2.1): restringir a superusuarios cuando existan los roles.
export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    const result = await createPipeline(name);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.pipeline, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/pipelines:", error);
    return NextResponse.json({ error: "Error al crear el pipeline" }, { status: 500 });
  }
}
