"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PIPELINE_NAME_MAX_LENGTH } from "@/lib/constants";
import { BoardType, Pipeline } from "@/lib/types";

export function PipelineSelector({
  currentPipelineId,
  canCreate,
}: {
  currentPipelineId: string;
  // TODO(5.2.1): solo superusuarios; por ahora siempre true.
  canCreate: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/pipelines")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Error fetching pipelines"))))
      .then(setPipelines)
      .catch((err) => console.error(err));
  }, []);

  // Cierra el desplegable al hacer click fuera de él.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function close() {
    setOpen(false);
    setAdding(false);
    setName("");
    setError(null);
  }

  // Se conserva la sección (negociaciones/alianzas) al cambiar de pipeline.
  function goTo(pipelineId: string) {
    const boardType: BoardType = pathname?.endsWith("/alianzas") ? "alianzas" : "negociaciones";
    close();
    router.push(`/${pipelineId}/${boardType}`);
  }

  async function submit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear el pipeline.");
        return;
      }
      setPipelines((prev) => [...prev, data]);
      goTo(data.id);
    } catch (err) {
      console.error(err);
      setError("No se pudo crear el pipeline.");
    } finally {
      setSaving(false);
    }
  }

  const current = pipelines.find((p) => p.id === currentPipelineId);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-w-44 items-center justify-between gap-3 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 hover:border-deinsa-orange"
      >
        <span className="truncate">{current?.name ?? "Seleccionar pipeline"}</span>
        <span className={`text-xs text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-md border border-neutral-700 bg-neutral-900 shadow-xl"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {pipelines.map((pipeline) => {
              const selected = pipeline.id === currentPipelineId;
              return (
                <li key={pipeline.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => goTo(pipeline.id)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-800 ${
                      selected ? "text-deinsa-orange" : "text-neutral-200"
                    }`}
                  >
                    <span className="truncate">{pipeline.name}</span>
                    {selected && <span className="text-xs">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          {canCreate && (
            <div className="border-t border-neutral-800 p-2">
              {adding ? (
                <div className="flex flex-col gap-2">
                  <input
                    autoFocus
                    value={name}
                    maxLength={PIPELINE_NAME_MAX_LENGTH}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                    placeholder="Nombre del pipeline"
                    className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange"
                  />
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={submit}
                      disabled={saving || !name.trim()}
                      className="flex-1 rounded-md bg-deinsa-orange px-2 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-deinsa-orange-dark hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Creando..." : "Crear"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setName("");
                        setError(null);
                      }}
                      className="rounded-md border border-neutral-700 px-2 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="w-full rounded-md border border-dashed border-neutral-700 py-1.5 text-xs text-neutral-400 hover:border-deinsa-orange hover:text-deinsa-orange"
                >
                  + Nuevo pipeline
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
