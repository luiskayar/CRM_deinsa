import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Importamos tu base de datos

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const bloqueadoHasta = cookieStore.get("lockout_time")?.value;

    // 1. Capturamos la información de red para el log de auditoría
    const ip = req.headers.get("x-forwarded-for") || "IP_Desconocida";
    const dispositivo = req.headers.get("user-agent") || "Navegador_Desconocido";

    // 2. Verificar si está bloqueado por fuerza bruta
    if (bloqueadoHasta && Date.now() < parseInt(bloqueadoHasta)) {
      return NextResponse.json(
        { error: "Demasiados intentos fallidos. Bloqueado por 15 minutos." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { usuario, password } = body;

    const usuarioCorrecto = process.env.CRM_USUARIO || "";
    const passwordCorrecto = process.env.CRM_PASSWORD || "";

    // 3. SI LAS CREDENCIALES SON CORRECTAS
    if (usuario === usuarioCorrecto && password === passwordCorrecto) {
      // Limpiamos los castigos
      cookieStore.delete("failed_attempts");
      cookieStore.delete("lockout_time");
      
      // Damos acceso
      cookieStore.set("crm_auth", passwordCorrecto, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      // 🔥 GUARDAMOS EL LOG EN FIREBASE (Acceso exitoso)
      await addDoc(collection(db, "logs_auditoria"), {
        evento: "LOGIN_EXITOSO",
        fecha: new Date().toISOString(),
        ip: ip,
        dispositivo: dispositivo,
        usuario_ingresado: usuario
      });

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 4. SI LAS CREDENCIALES SON INCORRECTAS
    let intentos = parseInt(cookieStore.get("failed_attempts")?.value || "0") + 1;
    
    // 🔥 GUARDAMOS EL LOG EN FIREBASE (Intento de intrusión)
    await addDoc(collection(db, "logs_auditoria"), {
      evento: "INTENTO_FALLIDO",
      fecha: new Date().toISOString(),
      ip: ip,
      dispositivo: dispositivo,
      usuario_ingresado: usuario,
      intento_numero: intentos
    });

    if (intentos >= 5) {
      cookieStore.set("lockout_time", (Date.now() + 900000).toString(), { path: "/" });
      return NextResponse.json(
        { error: "Demasiados intentos fallidos. Bloqueado por 15 minutos." },
        { status: 429 }
      );
    } else {
      cookieStore.set("failed_attempts", intentos.toString(), { path: "/" });
      return NextResponse.json(
        { error: `Credenciales incorrectas. Intento ${intentos} de 5.` },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Error en el servidor" },
      { status: 500 }
    );
  }
}