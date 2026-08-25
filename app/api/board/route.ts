import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin"; 
import { BOARD_COLLECTION } from "@/lib/constants";

// 1. Maneja las lecturas (GET)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (!type || !BOARD_COLLECTION[type as keyof typeof BOARD_COLLECTION]) {
    return NextResponse.json({ error: "Tipo de tablero inválido" }, { status: 400 });
  }

  try {
    const collectionName = BOARD_COLLECTION[type as keyof typeof BOARD_COLLECTION];
    const snapshot = await adminDb.collection(collectionName).orderBy("createdAt", "asc").get();

    // 🔥 AQUÍ ESTÁ LA CORRECCIÓN DE TYPESCRIPT (doc: any)
    const cards = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(cards);
  } catch (error) {
    console.error("Error GET /api/board:", error);
    return NextResponse.json({ error: "Error al obtener datos" }, { status: 500 });
  }
}

// 2. Maneja las escrituras (POST, PUT, DELETE)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, type, id, payload } = body;

    if (!type || !BOARD_COLLECTION[type as keyof typeof BOARD_COLLECTION]) {
      return NextResponse.json({ error: "Tipo de tablero inválido" }, { status: 400 });
    }

    const collectionName = BOARD_COLLECTION[type as keyof typeof BOARD_COLLECTION];
    const collectionRef = adminDb.collection(collectionName);

    if (action === "add") {
      await collectionRef.add(payload);
    } else if (action === "move" || action === "update") {
      await collectionRef.doc(id).update(payload);
    } else if (action === "delete") {
      await collectionRef.doc(id).delete();
    } else {
      return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error POST /api/board:", error);
    return NextResponse.json({ error: "Error al modificar datos" }, { status: 500 });
  }
}