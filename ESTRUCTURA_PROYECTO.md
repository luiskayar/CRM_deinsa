# Estructura del proyecto

Resumen del repositorio `deinsa-crm`.

- **Rama actual:** `Jaime`
- **Tecnologías principales:** Next.js 16, React 19 y TypeScript
- **Gestión de estilos:** Tailwind CSS 4
- **Persistencia y servicios:** Firebase

## Árbol de carpetas

```text
CRM_deinsa/
├── app/
│   ├── [pipeline]/
│   │   ├── alianzas/
│   │   ├── negociaciones/
│   │   └── page.tsx
│   ├── alianzas/
│   │   └── page.tsx
│   ├── api/
│   │   ├── board/
│   │   ├── login/
│   │   ├── logout/
│   │   ├── pipelines/
│   │   ├── usuarios/
│   │   └── readme.md
│   ├── login/
│   │   └── page.tsx
│   ├── negociaciones/
│   │   └── page.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Board.tsx
│   ├── Card.tsx
│   ├── CardModal.tsx
│   ├── Column.tsx
│   ├── CreateUserModal.tsx
│   ├── ImportResultModal.tsx
│   ├── Login.tsx
│   ├── Navbar.tsx
│   ├── PipelineSelector.tsx
│   ├── SearchBar.tsx
│   └── UserProfileModal.tsx
├── hooks/
│   └── useBoard.ts
├── lib/
│   ├── server/
│   │   ├── auth.ts
│   │   ├── board.ts
│   │   └── pipelines.ts
│   ├── constants.ts
│   ├── contact.ts
│   ├── export.ts
│   ├── firebase.ts
│   ├── firebase-admin.ts
│   ├── import.ts
│   ├── pipeline.ts
│   ├── search.ts
│   └── types.ts
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── plantilla-importacion-deinsa-crm.xlsx
│   ├── vercel.svg
│   └── window.svg
├── .env
├── .gitignore
├── AGENTS.md
├── CLAUDE.md
├── eslint.config.mjs
├── next.config.ts
├── next-env.d.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── proxy.ts
├── README.md
└── tsconfig.json
```

> El árbol refleja la estructura observada en la rama `Jaime`. Se excluyen carpetas generadas y dependencias, como `.git`, `node_modules` y `.next`. El archivo `.env` se muestra solo como nombre; no se incluyen valores ni credenciales.

## Descripción de las áreas

- **`app/`**: páginas, estilos globales y rutas API. Incluye vistas de alianzas, negociaciones, login y pipelines.
- **`components/`**: componentes de interfaz para tableros, tarjetas, columnas, búsqueda, selección de pipeline y modales.
- **`hooks/`**: hooks compartidos de React; actualmente incluye `useBoard`.
- **`lib/`**: tipos, constantes y lógica de Firebase, importación/exportación, pipelines y búsqueda.
- **`lib/server/`**: lógica de servidor para autenticación, tableros y pipelines.
- **`public/`**: recursos estáticos y plantilla de importación.

## Comandos disponibles

```bash
npm run dev    # Inicia el servidor de desarrollo
npm run build  # Genera la compilación de producción
npm run start  # Inicia la aplicación compilada
npm run lint   # Ejecuta ESLint
```
