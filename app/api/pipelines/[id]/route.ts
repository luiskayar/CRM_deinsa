import { NextResponse } from "next/server";
import { getAdministrador, getAdminUser } from "@/lib/server/auth";
import { archivePipeline, renamePipeline } from "@/lib/server/pipelines";

const FORBIDDEN = { error: "No tienes permisos para modificar pipelines." };

// Renombrar (solo administradores y superusuarios, 5.2.2).
export async function PATCH(req: Request, ctx: RouteContext<"/api/pipelines/[id]">) {
  try {
    const user = await getAdminUser();
    if (!user) return NextResponse.json(FORBIDDEN, { status: 403 });

    const { id } = await ctx.params;
    const { name } = await req.json();
    const result = await renamePipeline(id, name, user.usuario);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.pipeline);
  } catch (error) {
    console.error("Error PATCH /api/pipelines/[id]:", error);
    return NextResponse.json({ error: "Error al renombrar el pipeline" }, { status: 500 });
  }
}

// Eliminar = archivar (solo el administrador). Ver lib/server/pipelines.ts.
export async function DELETE(_req: Request, ctx: RouteContext<"/api/pipelines/[id]">) {
  try {
    const user = await getAdministrador();
    if (!user) {
      return NextResponse.json(
        { error: "Solo el administrador puede eliminar pipelines." },
        { status: 403 }
      );
    }

    const { id } = await ctx.params;
    const result = await archivePipeline(id, user.usuario);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error DELETE /api/pipelines/[id]:", error);
    return NextResponse.json({ error: "Error al eliminar el pipeline" }, { status: 500 });
  }
}
