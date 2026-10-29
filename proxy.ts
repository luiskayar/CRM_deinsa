import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// 🔥 AQUÍ ESTÁ EL CAMBIO PRINCIPAL: Se llama "proxy", no "middleware"
export async function proxy(req: NextRequest) {
  const token = req.cookies.get('crm_auth')?.value;
  const url = req.nextUrl.clone();
  
  // Lista blanca de rutas que no piden token
  const isPublicRoute = ['/login', '/api/login', '/api/logout'].includes(url.pathname);

  // 1. Si NO hay token y la ruta NO es pública
  if (!token && !isPublicRoute) {
    if (url.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 2. Si HAY token, lo verificamos
  if (token) {
    try {
      // Usamos JWT_SECRET, o tu antiguo CRM_PASSWORD como respaldo de seguridad
      const secretString = process.env.JWT_SECRET || process.env.CRM_PASSWORD || "tu_secreto_seguro";
      const secret = new TextEncoder().encode(secretString);
      const { payload } = await jwtVerify(token, secret);
      
      // Si ya tiene acceso válido e intenta ir al login, lo mandamos al inicio
      if (url.pathname === '/login') {
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
      
      // 3. Bloquear APIs de modificación si el rol es "visualizador"
      if (url.pathname.startsWith('/api/') && !isPublicRoute) {
        const isWriteMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
        
        if (payload.rol === 'visualizador' && isWriteMethod) {
          // Excepción: Permitimos que el visualizador pueda exportar
          if (!url.pathname.startsWith('/api/export')) {
            return NextResponse.json({ error: 'Acceso denegado: Solo lectura' }, { status: 403 });
          }
        }
      }
    } catch (_error) {
      // Token inválido o expirado: borramos cookie y al login
      const response = NextResponse.redirect(new URL('/login', req.url));
      response.cookies.delete('crm_auth');
      return response;
    }
  }

  return NextResponse.next();
}

// Configuración para que el guardia ignore imágenes y archivos internos del sistema
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
};