import { BOARD_COLUMNS, BOARD_LABELS, EXPORT_SHEET_NAME, COUNTRY_CODES } from "./constants";
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

// 🔥 Se mejoró la lectura de celdas para evitar que los correos salgan como "[object Object]"
function cellText(cell: import("exceljs").Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ("hyperlink" in value) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textVal = (value as any).text;
      if (textVal && typeof textVal === "object" && "richText" in textVal) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return textVal.richText.map((p: any) => p.text).join("");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return String(textVal || (value as any).hyperlink || "").trim();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ("richText" in value) return (value as any).richText.map((part: any) => part.text).join("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ("text" in value) return String((value as any).text).trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ("result" in value) return (value as any).result === undefined ? "" : String((value as any).result).trim();
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bulkAddCards(boardType: BoardType, items: any[]) {
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
  const link = document.createElement("a");
  link.href = "/plantilla-importacion-deinsa-crm.xlsx";
  link.download = "plantilla-importacion-deinsa-crm.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function importWorkbookFile(
  file: File,
  existingCardsByBoard: Record<BoardType, CardItem[]>,
  currentBoardType: BoardType 
): Promise<ImportSheetOutcome[]> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const outcomes: ImportSheetOutcome[] = [];

  for (const worksheet of workbook.worksheets) {
    const sheetBoardType = resolveBoardType(worksheet.name);
    
    // Solo importa la pestaña correspondiente al tablero actual
    if (sheetBoardType !== currentBoardType) continue;

    const existingCards = existingCardsByBoard[currentBoardType];
    
    // Validamos duplicados SOLO contra tarjetas visibles en la vista actual
    const validColumnIds = new Set(BOARD_COLUMNS[currentBoardType].map(c => c.id));
    const seenNames = new Set(
      existingCards
        .filter(card => validColumnIds.has(card.columnId))
        .map((card) => normalizeText(card.name))
    );
    
    const rows: ImportRowOutcome[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toCreate: any[] = [];

    // MAPEO DINÁMICO DE COLUMNAS
    const headers: Record<string, number> = {};
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[normalizeText(cellText(cell))] = colNumber;
    });

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Saltamos encabezados

      const getVal = (keys: string[]) => {
        for (const k of keys) {
          if (headers[k]) return cellText(row.getCell(headers[k]));
        }
        return "";
      };

      // Solo extraemos los datos que nos interesan (se omiten Industria, Sector, etc.)
      const empresa = getVal(["empresa", "compañia"]);
      const contactName = getVal(["nombre", "contacto"]);
      const contactRole = getVal(["cargo", "puesto"]);
      const email = getVal(["correo", "email"]);
      const phone = getVal(["numero", "telefono"]);
      const pais = getVal(["pais", "país"]);
      const columnaExcel = getVal(["columna", "etapa"]);

      const name = empresa || contactName;
      if (!name) return;

      const normalizedName = normalizeText(name);
      
      if (seenNames.has(normalizedName)) {
        rows.push({
          row: rowNumber,
          name,
          status: "duplicado",
          detail: "Ya existe un registro con este nombre en este tablero.",
        });
        return;
      }

      const mappedCountry = COUNTRY_CODES.find(c => normalizeText(c.country) === normalizeText(pais)) || COUNTRY_CODES[0];
      const contact = {
        name: contactName,
        role: contactRole,
        email,
        countryCode: mappedCountry.code,
        phone
      };

      let columnId = resolveColumnId(currentBoardType, columnaExcel);
      if (!columnId) {
         columnId = BOARD_COLUMNS[currentBoardType][0].id;
      }

      seenNames.add(normalizedName);
      
      toCreate.push({
        name,
        columnId,
        createdAt: new Date().toISOString(),
        comments: [], // 🔥 Ahora se envían los comentarios vacíos
        contact 
      });
      rows.push({ row: rowNumber, name, status: "importado" });
    });

    if (toCreate.length > 0) {
      await bulkAddCards(currentBoardType, toCreate);
    }

    outcomes.push({ sheetName: worksheet.name, boardType: currentBoardType, rows });
  }

  if (outcomes.length === 0) {
     outcomes.push({ 
       sheetName: `No se encontró pestaña para ${BOARD_LABELS[currentBoardType]}`, 
       boardType: null, 
       rows: [] 
     });
  }

  return outcomes;
}