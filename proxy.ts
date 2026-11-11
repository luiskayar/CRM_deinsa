import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function proxy(req: NextRequest) {
  const token = req.cookies.get('crm_auth')?.value;
  const url = req.nextUrl.clone();
  
  const isPublicRoute = ['/login', '/api/login', '/api/logout'].includes(url.pathname);

  if (!token && !isPublicRoute) {
    if (url.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (token) {
    try {
      const secretString = process.env.JWT_SECRET || process.env.CRM_PASSWORD || "tu_secreto_seguro";
      const secret = new TextEncoder().encode(secretString);
      const { payload } = await jwtVerify(token, secret);
      
      if (url.pathname === '/login') {
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
      
      if (url.pathname.startsWith('/api/') && !isPublicRoute) {
        const isWriteMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
        
        // 🔥 CAMBIO: El visualizador SOLO puede exportar, se eliminó el permiso de importar
        if (payload.rol === 'visualizador' && isWriteMethod) {
          if (!url.pathname.startsWith('/api/export')) {
            return NextResponse.json({ error: 'Acceso denegado: Solo lectura' }, { status: 403 });
          }
        }
      }
    } catch (_error) {
      const response = NextResponse.redirect(new URL('/login', req.url));
      response.cookies.delete('crm_auth');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
};