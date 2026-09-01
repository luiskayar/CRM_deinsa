import { BOARD_COLUMNS, BOARD_LABELS, EXPORT_SHEET_NAME } from "./constants";
import { normalizeText } from "./search";
import { BoardType, CardItem } from "./types";

export type ImportRowOutcome = {
  row: number;
  name: string;
  status: "importado" | "duplicado" | "error";
  detail?: string;
};

export type ImportSheetOutcome = {
  sheetName: string;
  boardType: BoardType | null;
  rows: ImportRowOutcome[];
};

// Une el nombre de hoja del archivo cargado con el tablero al que corresponde,
// aceptando tanto el nombre usado en la exportación ("Leads"/"Aliados") como
// el nombre del tablero en pantalla ("Negociaciones"/"Alianzas").
function resolveBoardType(sheetName: string): BoardType | null {
  const normalized = normalizeText(sheetName.trim());
  for (const boardType of Object.keys(BOARD_LABELS) as BoardType[]) {
    const candidates = [BOARD_LABELS[boardType], EXPORT_SHEET_NAME[boardType], boardType];
    if (candidates.some((candidate) => normalizeText(candidate) === normalized)) {
      return boardType;
    }
  }
  return null;
}

function resolveColumnId(boardType: BoardType, etapaRaw: string): string | null {
  const columns = BOARD_COLUMNS[boardType];
  if (!etapaRaw.trim()) return columns[0].id;
  const normalized = normalizeText(etapaRaw.trim());
  const match = columns.find((column) => normalizeText(column.label) === normalized);
  return match ? match.id : null;
}

function cellText(cell: import("exceljs").Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value) return String(value.text);
    if ("result" in value) return value.result === undefined ? "" : String(value.result);
    if (value instanceof Date) return value.toISOString();
  }
  return String(value).trim();
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Carga masiva a través de /api/board (Admin SDK del lado servidor), ya que
// Firestore ya no acepta escrituras directas desde el cliente. Se trocea en
// grupos de 500 porque ese es el máximo de operaciones por batch de Firestore.
async function bulkAddCards(
  boardType: BoardType,
  items: { name: string; columnId: string }[]
) {
  for (const group of chunk(items, 500)) {
    const res = await fetch("/api/board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: boardType,
        action: "bulkAdd",
        payload: group,
      }),
    });
    if (!res.ok) {
      throw new Error("Error al realizar la importación masiva");
    }
  }
}

export async function downloadImportTemplate() {
  // Descarga directamente el archivo físico alojado en la carpeta public/
  const link = document.createElement("a");
  link.href = "/plantilla-importacion-deinsa-crm.xlsx";
  link.download = "plantilla-importacion-deinsa-crm.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Lee el archivo cargado, valida cada fila y crea los registros nuevos en
// Firestore. Evita duplicados comparando el nombre (sin mayúsculas/acentos)
// contra los registros ya existentes y contra el resto del propio archivo.
export async function importWorkbookFile(
  file: File,
  existingCardsByBoard: Record<BoardType, CardItem[]>
): Promise<ImportSheetOutcome[]> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const outcomes: ImportSheetOutcome[] = [];

  for (const worksheet of workbook.worksheets) {
    const boardType = resolveBoardType(worksheet.name);
    if (!boardType) {
      outcomes.push({ sheetName: worksheet.name, boardType: null, rows: [] });
      continue;
    }

    const seenNames = new Set(
      existingCardsByBoard[boardType].map((card) => normalizeText(card.name))
    );
    const rows: ImportRowOutcome[] = [];
    const toCreate: { name: string; columnId: string }[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // encabezado

      const name = cellText(row.getCell(1));
      const etapaRaw = cellText(row.getCell(2));
      if (!name && !etapaRaw) return; // fila vacía, se ignora sin error

      if (!name) {
        rows.push({ row: rowNumber, name: "", status: "error", detail: "Falta el nombre." });
        return;
      }

      const normalizedName = normalizeText(name);
      if (seenNames.has(normalizedName)) {
        rows.push({
          row: rowNumber,
          name,
          status: "duplicado",
          detail: "Ya existe un registro con este nombre.",
        });
        return;
      }

      const columnId = resolveColumnId(boardType, etapaRaw);
      if (!columnId) {
        rows.push({
          row: rowNumber,
          name,
          status: "error",
          detail: `Etapa "${etapaRaw}" no reconocida.`,
        });
        return;
      }

      seenNames.add(normalizedName);
      toCreate.push({ name, columnId });
      rows.push({ row: rowNumber, name, status: "importado" });
    });

    if (toCreate.length > 0) {
      await bulkAddCards(boardType, toCreate);
    }

    outcomes.push({ sheetName: worksheet.name, boardType, rows });
  }

  return outcomes;
}