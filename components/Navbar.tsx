// components/Navbar.tsx
"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { BOARD_LABELS, DEFAULT_PIPELINE } from "@/lib/constants";
import { BoardType } from "@/lib/types";
import { PipelineSelector } from "./PipelineSelector";
import { UserProfileModal } from "./UserProfileModal"; // 🔥 Importamos el nuevo modal

const TABS: BoardType[] = ["negociaciones", "alianzas"];

interface NavbarProps {
  esSuperAdmin?: boolean;
  nombreUsuario?: string;
}

export function Navbar({ esSuperAdmin = false, nombreUsuario = "" }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ pipeline?: string }>();
  const pipelineId = params.pipeline ?? DEFAULT_PIPELINE.id;

  useEffect(() => {
    if (pathname === "/login") return;

    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        await fetch("/api/logout", { method: "POST" });
        router.push("/login");
      }, 900000); 
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("scroll", resetTimer);
    window.addEventListener("click", resetTimer);

    resetTimer();

    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("scroll", resetTimer);
      window.removeEventListener("click", resetTimer);
      clearTimeout(timeoutId);
    };
  }, [pathname, router]);

  if (pathname === "/login") {
    return null;
  }

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <header className="border-b border-neutral-800 bg-neutral-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        
        {/* PARTE IZQUIERDA */}
        <div className="flex items-center gap-8">
          <span className="text-lg font-bold tracking-wide text-neutral-100">
            DEINSA <span className="text-deinsa-orange">CRM</span>
          </span>
          
          <PipelineSelector currentPipelineId={pipelineId} canCreate={esSuperAdmin} />
          
          <nav className="flex gap-6">
            {TABS.map((boardType) => {
              const href = `/${pipelineId}/${boardType}`;
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={boardType}
                  href={href}
                  className={`border-b-2 pb-1 text-sm font-medium transition-colors ${
                    active
                      ? "border-deinsa-orange text-neutral-50"
                      : "border-transparent text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {BOARD_LABELS[boardType]}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* PARTE DERECHA: Perfil Clickable y Cerrar Sesión */}
        <div className="flex items-center gap-4">
          
          {/* 🔥 Aquí colocamos el nuevo componente. Se comporta como botón y como modal al mismo tiempo */}
          <UserProfileModal esSuperAdmin={esSuperAdmin} nombreUsuario={nombreUsuario} />
          
          <button 
            onClick={handleLogout}
            className="text-sm font-medium text-neutral-400 transition hover:text-white"
          >
            Cerrar Sesión
          </button>
        </div>

      </div>
    </header>
  );
}