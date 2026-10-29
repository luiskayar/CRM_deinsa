import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function proxy(req: NextRequest) {
  const authCookie = req.cookies.get('crm_auth')?.value;
  const passwordActual = process.env.CRM_PASSWORD || "";
  
  const url = req.nextUrl.clone();

  // 🔥 LISTA BLANCA: Estas son las ÚNICAS rutas del sistema que no piden contraseña
  const rutasPublicas = ['/login', '/api/login', '/api/logout'];
  const isPublicRoute = rutasPublicas.includes(url.pathname);

  let tieneAccesoValido = false;

  // 1. Verificamos la firma del token
  if (authCookie) {
    try {
      const secret = new TextEncoder().encode(passwordActual);
      await jwtVerify(authCookie, secret);
      tieneAccesoValido = true;
    } catch (_error) { // 🔥 Aquí está la corrección: _error
      tieneAccesoValido = false;
    }
  }

  // 2. 🔥 EL ESCUDO (DENEGAR POR DEFECTO): Si NO tiene acceso y la ruta NO está en la lista blanca
  if (!tieneAccesoValido && !isPublicRoute) {
    // Si era un intento de hackear una API, devolvemos un "Acceso Denegado" puro
    if (url.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    // Si era un intento de entrar a una pantalla, lo mandamos a que se loguee
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 3. Si YA tiene acceso e intenta ir al login, lo mandamos de regreso al trabajo
  if (tieneAccesoValido && url.pathname === '/login') {
    url.pathname = '/negociaciones';
    return NextResponse.redirect(url);
  }

  // 4. Si todo está en orden, lo dejamos pasar
  return NextResponse.next();
}

// Configuración para que el guardia ignore imágenes y archivos internos del sistema
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
};