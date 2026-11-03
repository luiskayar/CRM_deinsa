"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DEFAULT_PIPELINE, PIPELINE_NAME_MAX_LENGTH } from "@/lib/constants";
import { BoardType, Pipeline } from "@/lib/types";

const INPUT_CLASS =
  "rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange";
const PRIMARY_BUTTON_CLASS =
  "flex-1 rounded-md bg-deinsa-orange px-2 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-deinsa-orange-dark hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BUTTON_CLASS =
  "rounded-md border border-neutral-700 px-2 py-1.5 text-xs text-neutral-400 hover:text-neutral-200";

async function readError(res: Response, fallback: string) {
  try {
    return (await res.json()).error ?? fallback;
  } catch {
    return fallback;
  }
}

export function PipelineSelector({
  currentPipelineId,
  canManage,
}: {
  currentPipelineId: string;
  /** Crear, renombrar y eliminar pipelines: solo superusuarios (5.2.2). */
  canManage: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [toDelete, setToDelete] = useState<Pipeline | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadPipelines = useCallback(() => {
    fetch("/api/pipelines")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Error fetching pipelines"))))
      .then(setPipelines)
      .catch((err) => console.error(err));
  }, []);

  useEffect(loadPipelines, [loadPipelines]);

  const close = useCallback(() => {
    setOpen(false);
    setAdding(false);
    setName("");
    setEditingId(null);
    setError(null);
  }, []);

  // Cierra el desplegable al hacer click fuera de él.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, close]);

  function currentBoardType(): BoardType {
    return pathname?.endsWith("/alianzas") ? "alianzas" : "negociaciones";
  }

  // Se conserva la sección (negociaciones/alianzas) al cambiar de pipeline.
  function goTo(pipelineId: string) {
    close();
    router.push(`/${pipelineId}/${currentBoardType()}`);
  }

  function toggle() {
    if (open) {
      close();
    } else {
      // Se recarga al abrir para ver los cambios de otros superusuarios.
      loadPipelines();
      setOpen(true);
    }
  }

  async function submitCreate() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setError(await readError(res, "No se pudo crear el pipeline."));
        return;
      }
      const created: Pipeline = await res.json();
      setPipelines((prev) => [...prev, created]);
      goTo(created.id);
    } catch (err) {
      console.error(err);
      setError("No se pudo crear el pipeline.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(pipeline: Pipeline) {
    setAdding(false);
    setError(null);
    setEditingId(pipeline.id);
    setEditName(pipeline.name);
  }

  async function submitRename() {
    if (!editingId || !editName.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipelines/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      if (!res.ok) {
        setError(await readError(res, "No se pudo renombrar el pipeline."));
        return;
      }
      const renamed: Pipeline = await res.json();
      setPipelines((prev) => prev.map((p) => (p.id === renamed.id ? renamed : p)));
      setEditingId(null);
      // El tablero recibe el nombre desde el servidor (títulos de exportación).
      if (renamed.id === currentPipelineId) router.refresh();
    } catch (err) {
      console.error(err);
      setError("No se pudo renombrar el pipeline.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipelines/${toDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError(await readError(res, "No se pudo eliminar el pipeline."));
        return;
      }
      setPipelines((prev) => prev.filter((p) => p.id !== toDelete.id));
      setToDelete(null);
      if (toDelete.id === currentPipelineId) goTo(DEFAULT_PIPELINE.id);
    } catch (err) {
      console.error(err);
      setError("No se pudo eliminar el pipeline.");
    } finally {
      setSaving(false);
    }
  }

  const current = pipelines.find((p) => p.id === currentPipelineId);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
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
          className="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-md border border-neutral-700 bg-neutral-900 shadow-xl"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !toDelete) close();
          }}
        >
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {pipelines.map((pipeline) => {
              const selected = pipeline.id === currentPipelineId;

              if (pipeline.id === editingId) {
                return (
                  <li key={pipeline.id} className="flex flex-col gap-2 px-2 py-1.5">
                    <input
                      autoFocus
                      value={editName}
                      maxLength={PIPELINE_NAME_MAX_LENGTH}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename();
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setEditingId(null);
                          setError(null);
                        }
                      }}
                      aria-label="Nuevo nombre del pipeline"
                      className={INPUT_CLASS}
                    />
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={submitRename}
                        disabled={saving || !editName.trim()}
                        className={PRIMARY_BUTTON_CLASS}
                      >
                        {saving ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setError(null);
                        }}
                        className={SECONDARY_BUTTON_CLASS}
                      >
                        Cancelar
                      </button>
                    </div>
                  </li>
                );
              }

              const editable = canManage && pipeline.id !== DEFAULT_PIPELINE.id;
              return (
                <li
                  key={pipeline.id}
                  role="option"
                  aria-selected={selected}
                  className="group flex items-center hover:bg-neutral-800"
                >
                  <button
                    type="button"
                    onClick={() => goTo(pipeline.id)}
                    className={`flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                      selected ? "text-deinsa-orange" : "text-neutral-200"
                    }`}
                  >
                    <span className="truncate">{pipeline.name}</span>
                    {selected && <span className="text-xs">✓</span>}
                  </button>
                  {editable && (
                    <div className="flex shrink-0 gap-1 pr-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => startEditing(pipeline)}
                        aria-label={`Renombrar ${pipeline.name}`}
                        title="Renombrar"
                        className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setToDelete(pipeline);
                        }}
                        aria-label={`Eliminar ${pipeline.name}`}
                        title="Eliminar"
                        className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-red-950 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {canManage && (
            <div className="border-t border-neutral-800 p-2">
              {adding ? (
                <div className="flex flex-col gap-2">
                  <input
                    autoFocus
                    value={name}
                    maxLength={PIPELINE_NAME_MAX_LENGTH}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitCreate();
                    }}
                    placeholder="Nombre del pipeline"
                    className={INPUT_CLASS}
                  />
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={submitCreate}
                      disabled={saving || !name.trim()}
                      className={PRIMARY_BUTTON_CLASS}
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
                      className={SECONDARY_BUTTON_CLASS}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setError(null);
                    setAdding(true);
                  }}
                  className="w-full rounded-md border border-dashed border-neutral-700 py-1.5 text-xs text-neutral-400 hover:border-deinsa-orange hover:text-deinsa-orange"
                >
                  + Nuevo pipeline
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {toDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onKeyDown={(e) => {
            if (e.key === "Escape") setToDelete(null);
          }}
        >
          <div
            role="alertdialog"
            aria-labelledby="delete-pipeline-title"
            className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-900 p-5 shadow-2xl"
          >
            <h2 id="delete-pipeline-title" className="text-base font-semibold text-neutral-100">
              Eliminar &quot;{toDelete.name}&quot;
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              El pipeline y todas sus negociaciones y aliados dejarán de verse en el CRM para
              todos los usuarios. La información no se borra: queda archivada y puede
              recuperarse desde la base de datos.
            </p>
            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setToDelete(null);
                  setError(null);
                }}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={saving}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-neutral-50 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Eliminando..." : "Eliminar pipeline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
