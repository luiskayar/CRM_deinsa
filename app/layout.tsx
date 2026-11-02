import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { getUserInfo } from "@/lib/server/auth"; // 🔥 Importamos nuestra función de autenticación
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deinsa CRM",
  description: "CRM interno de Deinsa: negociaciones y alianzas",
};

// 🔥 Hacemos el layout asíncrono (async) para poder leer las credenciales
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  
  // 🔥 Obtenemos la información de la sesión
  const userInfo = await getUserInfo();
  const esSuperAdmin = userInfo?.rol === "superusuario";
  const nombreUsuario = userInfo?.usuario || "";

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-dvh flex-col overflow-hidden bg-neutral-950">
        
        {/* 🔥 Le inyectamos los datos al Navbar para que los muestre */}
        <Navbar esSuperAdmin={esSuperAdmin} nombreUsuario={nombreUsuario} />
        
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}