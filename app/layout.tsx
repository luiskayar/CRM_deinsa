import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { getUserInfo } from "@/lib/server/auth";
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  
  const userInfo = await getUserInfo();
  // 🔥 Extraemos el rol exacto ("administrador", "superusuario" o "visualizador")
  const rolUsuario = userInfo?.rol || "visualizador";
  const nombreUsuario = userInfo?.usuario || "";

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-dvh flex-col overflow-hidden bg-neutral-950">
        
        {/* 🔥 Le inyectamos el nuevo prop de rolUsuario al Navbar */}
        <Navbar rolUsuario={rolUsuario} nombreUsuario={nombreUsuario} />
        
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}