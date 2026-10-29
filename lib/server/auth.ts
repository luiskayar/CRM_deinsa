import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export async function getUserInfo() {
  const cookieStore = await cookies();
  const token = cookieStore.get("crm_auth")?.value;
  if (!token) return null;

  try {
    const secretString = process.env.JWT_SECRET || process.env.CRM_PASSWORD || "tu_secreto_seguro";
    const secret = new TextEncoder().encode(secretString);
    const { payload } = await jwtVerify(token, secret);
    
    return {
      usuario: payload.usuario as string,
      rol: payload.rol as string
    };
  } catch {
    return null;
  }
}