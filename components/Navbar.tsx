"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOARD_LABELS } from "@/lib/constants";
import { BoardType } from "@/lib/types";

const TABS: { href: string; boardType: BoardType }[] = [
  { href: "/negociaciones", boardType: "negociaciones" },
  { href: "/alianzas", boardType: "alianzas" },
];

export function Navbar() {
  const pathname = usePathname();

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
