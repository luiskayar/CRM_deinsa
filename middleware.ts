import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // 1. Obtenemos el valor guardado en la cookie y la contraseña actual del .env
  const authCookie = req.cookies.get('crm_auth')?.value;
  const passwordActual = process.env.CRM_PASSWORD;

  // 2. Verificamos si la cookie tiene EXACTAMENTE la misma contraseña del .env actual
  const tieneAccesoValido = authCookie === passwordActual;
  
  const url = req.nextUrl.clone();
  const isLoginPage = url.pathname === '/login';
  const isApiRoute = url.pathname.startsWith('/api/');

  // 3. Si NO tiene la clave correcta (o si los jefes la acaban de cambiar) y quiere entrar al CRM, lo rebotamos al login
  if (!tieneAccesoValido && !isLoginPage && !isApiRoute) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 4. Si YA tiene la clave correcta e intenta ir a la pantalla de login, lo mandamos al CRM
  if (tieneAccesoValido && isLoginPage) {
    url.pathname = '/negociaciones';
    return NextResponse.redirect(url);
  }

  // 5. Si todo está en orden, lo dejamos pasar
  return NextResponse.next();
}

// Configuración para que el guardia ignore imágenes y archivos internos del sistema
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
};