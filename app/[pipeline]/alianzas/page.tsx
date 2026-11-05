import { notFound } from "next/navigation";
import { Board } from "@/components/Board";
import { getPipeline } from "@/lib/server/pipelines";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export default async function AlianzasPage({ params }: any) {
  const pipeline = await getPipeline((await params).pipeline);
  if (!pipeline) notFound();
  
  let rolUsuario = "visualizador";
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("crm_auth")?.value;
    if (token) {
      const secretString = process.env.JWT_SECRET || process.env.CRM_PASSWORD || "tu_secreto_seguro";
      const secret = new TextEncoder().encode(secretString);
      const { payload } = await jwtVerify(token, secret);
      if (payload.rol) rolUsuario = payload.rol as string;
    }
  } catch (e) {
    console.error("Error leyendo rol:", e);
  }

  return <Board key={pipeline.id} boardType="alianzas" pipeline={pipeline} rolUsuario={rolUsuario} />;
}