import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase-admin"; 
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    let ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(',')[0].trim() || "127.0.0.1";
    const dispositivo = req.headers.get("user-agent") || "Navegador_Desconocido";
    const huellaDigital = `${ip}-${dispositivo}`.replace(/[^a-zA-Z0-9.:]/g, "_");
    
    const ipRef = adminDb.collection("intentos_login").doc(huellaDigital);
    const ipDoc = await ipRef.get();
    
    let intentos = ipDoc.data()?.intentos || 0;
    let bloqueadoHasta = ipDoc.data()?.bloqueadoHasta || 0;

    if (bloqueadoHasta && Date.now() < bloqueadoHasta) {
      return NextResponse.json({ error: "Demasiados intentos fallidos. Bloqueado por 15 minutos." }, { status: 429 });
    }

    const { usuario, password } = await req.json();

    let usuarioValido = false;
    let rol = "visualizador"; 

    // 1. PRIMERO BUSCAMOS EN FIREBASE (Cuentas creadas después)
    const userDocRef = adminDb.collection("usuarios").where("usuario", "==", usuario);
    const userSnapshot = await userDocRef.get();
    
    if (!userSnapshot.empty) {
      const userData = userSnapshot.docs[0].data();
      
      // 🔥 Comparamos la contraseña en texto plano con el hash guardado en Firebase
      const match = await bcrypt.compare(password, userData.password);
      
      if (match) {
        usuarioValido = true;
        rol = userData.rol;
      }
    } 
    // 2. SI NO ESTÁ EN FIREBASE, VERIFICAMOS LA CUENTA MAESTRA DEL .ENV
    else if (usuario === process.env.CRM_USUARIO && password === process.env.CRM_PASSWORD) {
      usuarioValido = true;
      rol = "superusuario";
    }

    // 3. SI ALGUNA DE LAS DOS FUE CORRECTA, LE DAMOS ACCESO
    if (usuarioValido) {
      if (ipDoc.exists) await ipRef.delete();
      
      const secretString = process.env.JWT_SECRET || process.env.CRM_PASSWORD || "tu_secreto_seguro";
      const secret = new TextEncoder().encode(secretString);
      
      const token = await new SignJWT({ usuario, rol })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('12h')
        .sign(secret);

      const cookieStore = await cookies();
      cookieStore.set("crm_auth", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      await adminDb.collection("logs_auditoria").add({
        evento: "LOGIN_EXITOSO",
        fecha: new Date().toISOString(),
        ip: ip,
        dispositivo: dispositivo,
        usuario_ingresado: usuario,
        rol: rol
      });

      return NextResponse.json({ success: true, rol }, { status: 200 });
    }

    // SI LA CONTRASEÑA FUE INCORRECTA
    intentos += 1;
    let nuevoBloqueo = intentos >= 5 ? Date.now() + 900000 : 0;
    await ipRef.set({ intentos, bloqueadoHasta: nuevoBloqueo });

    await adminDb.collection("logs_auditoria").add({
      evento: "INTENTO_FALLIDO",
      fecha: new Date().toISOString(),
      ip: ip,
      usuario_ingresado: usuario,
      intento_numero: intentos
    });

    return NextResponse.json(
      { error: intentos >= 5 ? "Bloqueado por 15 min." : `Credenciales incorrectas. Intento ${intentos} de 5.` },
      { status: intentos >= 5 ? 429 : 401 }
    );
  } catch (error) {
    console.error("Error en login:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}