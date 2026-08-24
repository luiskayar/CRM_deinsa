import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("crm_auth"); // Destruye la llave de acceso
  return NextResponse.json({ success: true });
}