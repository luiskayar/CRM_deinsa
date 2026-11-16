import { NextResponse } from "next/server";
import { getUserInfo } from "@/lib/server/auth";
import { getWebrtcKey } from "@/lib/server/zadarma";

// Entrega la llave del widget WebRTC de Zadarma SOLO a usuarios con sesión:
// si quedara pública, cualquiera podría llamar con la cuenta de la empresa.
export async function GET() {
  const user = await getUserInfo();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { key, sip } = await getWebrtcKey();
    return NextResponse.json({ key, sip });
  } catch (error) {
    console.error("Error GET /api/voice/webrtc-key:", error);
    return NextResponse.json(
      { error: "No se pudo obtener la llave de telefonía" },
      { status: 502 }
    );
  }
}
