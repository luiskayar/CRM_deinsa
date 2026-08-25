import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase-admin"; // 🔥 AQUÍ ESTÁ LA MAGIA: EL PASE VIP
import { SignJWT } from "jose";

export async function POST(req: Request) {
  try {
    let ip = req.headers.get("x-real-ip");
    
    if (!ip) {
      const forwarded = req.headers.get("x-forwarded-for");
      ip = forwarded ? forwarded.split(',')[0].trim() : "127.0.0.1";
    }

    const dispositivo = req.headers.get("user-agent") || "Navegador_Desconocido";

    const huellaDigital = `${ip}-${dispositivo}`.replace(/[^a-zA-Z0-9.:]/g, "_");
    
    // 🔥 USAMOS ADMIN DB PARA SALTARNOS LAS REGLAS DE FIREBASE
    const ipRef = adminDb.collection("intentos_login").doc(huellaDigital);
    const ipDoc = await ipRef.get();
    
    let intentos = 0;
    let bloqueadoHasta = 0;

    if (ipDoc.exists) {
      const data = ipDoc.data();
      intentos = data?.intentos || 0;
      bloqueadoHasta = data?.bloqueadoHasta || 0;

      if (bloqueadoHasta && Date.now() < bloqueadoHasta) {
        return NextResponse.json(
          { error: "Demasiados intentos fallidos. Bloqueado por 15 minutos." },
          { status: 429 }
        );
      }
    }

    const body = await req.json();
    const { usuario, password } = body;

    const usuarioCorrecto = process.env.CRM_USUARIO || "";
    const passwordCorrecto = process.env.CRM_PASSWORD || "";

    if (usuario === usuarioCorrecto && password === passwordCorrecto) {
      
      if (ipDoc.exists) {
        await ipRef.delete();
      }
      
      const secret = new TextEncoder().encode(passwordCorrecto);
      const token = await new SignJWT({ acceso_concedido: true })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(secret);

      const cookieStore = await cookies();
      cookieStore.set("crm_auth", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      await adminDb.collection("logs_auditoria").add({ // 🔥 USAMOS ADMIN DB
        evento: "LOGIN_EXITOSO",
        fecha: new Date().toISOString(),
        ip: ip,
        dispositivo: dispositivo,
        usuario_ingresado: usuario
      });

      return NextResponse.json({ success: true }, { status: 200 });
    }

    intentos += 1;
    let nuevoBloqueo = 0;
    
    if (intentos >= 5) {
      nuevoBloqueo = Date.now() + 900000;
    }

    await ipRef.set({ // 🔥 USAMOS ADMIN DB
      intentos: intentos,
      bloqueadoHasta: nuevoBloqueo
    });

    await adminDb.collection("logs_auditoria").add({ // 🔥 USAMOS ADMIN DB
      evento: "INTENTO_FALLIDO",
      fecha: new Date().toISOString(),
      ip: ip,
      dispositivo: dispositivo,
      usuario_ingresado: usuario,
      intento_numero: intentos
    });

    if (intentos >= 5) {
      return NextResponse.json(
        { error: "Demasiados intentos fallidos. Bloqueado por 15 minutos." },
        { status: 429 }
      );
    } else {
      return NextResponse.json(
        { error: `Credenciales incorrectas. Intento ${intentos} de 5.` },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("DETALLE DEL ERROR 500:", error);
    return NextResponse.json(
      { error: "Error en el servidor" },
      { status: 500 }
    );
  }
}