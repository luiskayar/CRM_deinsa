"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { BOARD_LABELS } from "@/lib/constants";
import { BoardType } from "@/lib/types";

const TABS: { href: string; boardType: BoardType }[] = [
  { href: "/negociaciones", boardType: "negociaciones" },
  { href: "/alianzas", boardType: "alianzas" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  // EFECTO DE INACTIVIDAD (15 Minutos)
  useEffect(() => {
    // Si estamos en el login, no iniciamos el temporizador
    if (pathname === "/login") return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 15 minutos = 15 * 60 * 1000 = 900000 milisegundos
      timeoutId = setTimeout(async () => {
        // Llama a la API para borrar la cookie y redirige al login
        await fetch("/api/logout", { method: "POST" });
        router.push("/login");
      }, 900000); 
    };

    // Escuchar cualquier movimiento del usuario para reiniciar el reloj
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("scroll", resetTimer);
    window.addEventListener("click", resetTimer);

    // Iniciar el reloj por primera vez
    resetTimer();

    // Limpiar los eventos si el usuario cambia de página
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("scroll", resetTimer);
      window.removeEventListener("click", resetTimer);
      clearTimeout(timeoutId);
    };
  }, [pathname, router]);

  // Si estamos en login, ocultamos el Navbar
  if (pathname === "/login") {
    return null;
  }

  return (
    <header className="border-b border-neutral-800 bg-neutral-950">
      <div className="mx-auto flex max-w-7xl items-center gap-8 px-6 py-4">
        <span className="text-lg font-bold tracking-wide text-neutral-100">
          DEINSA <span className="text-deinsa-orange">CRM</span>
        </span>
        <nav className="flex gap-6">
          {TABS.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`border-b-2 pb-1 text-sm font-medium transition-colors ${
                  active
                    ? "border-deinsa-orange text-neutral-50"
                    : "border-transparent text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {BOARD_LABELS[tab.boardType]}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}