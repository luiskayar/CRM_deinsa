import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/server/auth";
import { createPipeline, listPipelines } from "@/lib/server/pipelines";

export async function GET() {
  try {
    return NextResponse.json(await listPipelines());
  } catch (error) {
    console.error("Error GET /api/pipelines:", error);
    return NextResponse.json({ error: "Error al obtener los pipelines" }, { status: 500 });
  }
}

// Solo administradores y superusuarios (5.2.2).
export async function POST(req: Request) {
  try {
    const user = await getAdminUser();
    if (!user) {
      return NextResponse.json({ error: "No tienes permisos para crear pipelines." }, { status: 403 });
    }

    const { name } = await req.json();
    const result = await createPipeline(name, user.usuario);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.pipeline, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/pipelines:", error);
    return NextResponse.json({ error: "Error al crear el pipeline" }, { status: 500 });
  }
}
