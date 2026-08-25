"use client";

import { BOARD_LABELS } from "@/lib/constants";
import { ImportSheetOutcome } from "@/lib/import";

const STATUS_STYLES: Record<string, string> = {
  importado: "text-green-400",
  duplicado: "text-amber-400",
  error: "text-red-400",
};

export function ImportResultModal({
  outcomes,
  onClose,
}: {
  outcomes: ImportSheetOutcome[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-neutral-800 bg-neutral-950 shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-neutral-800 px-5 py-4">
          <h2 className="text-base font-semibold text-neutral-100">
            Resultado de la importación
          </h2>
          <button
            onClick={onClose}
            className="ml-4 text-neutral-500 hover:text-neutral-200"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {outcomes.map((sheet, i) => {
            const imported = sheet.rows.filter((r) => r.status === "importado").length;
            const duplicated = sheet.rows.filter((r) => r.status === "duplicado").length;
            const errored = sheet.rows.filter((r) => r.status === "error").length;
            const issues = sheet.rows.filter((r) => r.status !== "importado");

            return (
              <div key={`${sheet.sheetName}-${i}`} className="mb-5 last:mb-0">
                <h3 className="text-sm font-semibold text-neutral-200">
                  Hoja &quot;{sheet.sheetName}&quot;
                  {sheet.boardType && (
                    <span className="ml-2 text-xs font-normal text-neutral-500">
                      → {BOARD_LABELS[sheet.boardType]}
                    </span>
                  )}
                </h3>

                {!sheet.boardType ? (
                  <p className="mt-1 text-xs text-neutral-500">
                    No se reconoce a qué tablero corresponde esta hoja. No se importó
                    ningún registro desde aquí.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-neutral-400">
                      <span className="text-green-400">{imported} importados</span>
                      {" · "}
                      <span className="text-amber-400">{duplicated} duplicados</span>
                      {" · "}
                      <span className="text-red-400">{errored} con error</span>
                    </p>
                    {issues.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1 rounded-md border border-neutral-800 bg-neutral-900 p-2">
                        {issues.map((rowOutcome, j) => (
                          <p key={j} className="text-xs text-neutral-400">
                            Fila {rowOutcome.row}
                            {rowOutcome.name ? ` (${rowOutcome.name})` : ""}:{" "}
                            <span className={STATUS_STYLES[rowOutcome.status]}>
                              {rowOutcome.detail}
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-neutral-800 px-5 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-md bg-deinsa-orange px-4 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-deinsa-orange-dark hover:text-neutral-100"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
