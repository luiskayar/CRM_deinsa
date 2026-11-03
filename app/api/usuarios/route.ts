import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("crm_auth")?.value;
  if (!token) return null;

  try {
    const secretString = process.env.JWT_SECRET || process.env.CRM_PASSWORD || "tu_secreto_seguro";
    const secret = new TextEncoder().encode(secretString);
    const { payload } = await jwtVerify(token, secret);
    return payload; 
  } catch {
    return null;
  }
}

const puedeAdministrar = (rol: string) => ["administrador", "superusuario"].includes(rol);

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !puedeAdministrar(session.rol as string)) {
      return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
    }

    const { nuevoUsuario, password, rol } = await req.json();

    // 🔥 REGLA: Los superusuarios solo pueden crear visualizadores.
    // Si la sesión es de Administrador, pasará libremente y creará cualquier rol.
    if (session.rol === "superusuario" && rol !== "visualizador") {
      return NextResponse.json({ error: "Solo el administrador puede crear roles superiores." }, { status: 403 });
    }

    const existe = await adminDb.collection("usuarios").where("usuario", "==", nuevoUsuario).get();
    if (!existe.empty) return NextResponse.json({ error: "El usuario ya existe" }, { status: 400 });

    const hashedPassword = await bcrypt.hash(password, 10);

    await adminDb.collection("usuarios").add({
      usuario: nuevoUsuario,
      password: hashedPassword, 
      rol: rol,
      creadoPor: session.usuario, 
      fechaCreacion: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !puedeAdministrar(session.rol as string)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    let snapshot;
    if (session.rol === "administrador") {
      snapshot = await adminDb.collection("usuarios").get();
    } else {
      snapshot = await adminDb.collection("usuarios").where("creadoPor", "==", session.usuario).get();
    }
    
    const usuarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    usuarios.sort((a: any, b: any) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());
    
    return NextResponse.json(usuarios);
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session || !puedeAdministrar(session.rol as string)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { id, usuario, password, rol } = await req.json();

    if (session.rol === "superusuario" && rol !== "visualizador") {
      return NextResponse.json({ error: "No tienes permiso para asignar este rol." }, { status: 403 });
    }

    const query = await adminDb.collection("usuarios").where("usuario", "==", usuario).get();
    const conflict = query.docs.find(doc => doc.id !== id);
    if (conflict) return NextResponse.json({ error: "El nombre de usuario ya está en uso" }, { status: 400 });

    const updates: any = { usuario, rol };
    if (password && password.trim() !== "") {
      updates.password = await bcrypt.hash(password, 10);
    }

    await adminDb.collection("usuarios").doc(id).update(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session || !puedeAdministrar(session.rol as string)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { id } = await req.json();
    await adminDb.collection("usuarios").doc(id).delete();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}