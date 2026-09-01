import { BOARD_COLUMNS, BOARD_LABELS, EXPORT_SHEET_NAME, COUNTRY_CODES } from "./constants";
import { normalizeText } from "./search";
import { BoardType, CardItem } from "./types";

export type ImportRowOutcome = {
  row: number;
  name: string;
  status: "importado" | "actualizado" | "error"; 
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateCardApi(boardType: BoardType, id: string, payload: any) {
  const res = await fetch("/api/board", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: boardType,
      action: "update",
      id,
      payload,
    }),
  });
  if (!res.ok) {
    throw new Error(`Error al actualizar tarjeta ${id}`);
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
  existingCardsByBoard: Record<BoardType, CardItem[]>
): Promise<ImportSheetOutcome[]> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const outcomes: ImportSheetOutcome[] = [];

  for (const worksheet of workbook.worksheets) {
    const boardType = resolveBoardType(worksheet.name) || (Object.keys(BOARD_LABELS)[0] as BoardType);
    const existingCards = existingCardsByBoard[boardType];
    
    const rows: ImportRowOutcome[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toCreate: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toUpdate: { id: string; payload: any }[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // encabezado

      const contactName = cellText(row.getCell(1));
      const contactRole = cellText(row.getCell(2));
      const empresa = cellText(row.getCell(3));
      const industria = cellText(row.getCell(4));
      const pais = cellText(row.getCell(5));
      const sector = cellText(row.getCell(6));
      const sitioWeb = cellText(row.getCell(7));
      const linkedin = cellText(row.getCell(8));
      const email = cellText(row.getCell(9));
      const phone = cellText(row.getCell(10));
      const respuesta = cellText(row.getCell(11));

      const name = empresa || contactName;
      if (!name) return; // fila vacía, se ignora

      const mappedCountry = COUNTRY_CODES.find(c => normalizeText(c.country) === normalizeText(pais)) || COUNTRY_CODES[0];
      
      const contact = { 
        name: contactName, 
        role: contactRole, 
        email, 
        countryCode: mappedCountry.code, 
        phone 
      };

      const sysInfo = { industria, sector, sitioWeb, linkedin, respuesta };
      const sysText = `__SYSTEM_INFO__${JSON.stringify(sysInfo)}`;
      const sysComment = { 
        id: `sys-${Date.now()}-${rowNumber}`, 
        text: sysText, 
        createdAt: new Date().toISOString() 
      };

      const normalizedName = normalizeText(name);
      const existing = existingCards.find(c => normalizeText(c.name) === normalizedName);

      if (existing) {
        const filteredComments = existing.comments.filter(c => !c.text.startsWith("__SYSTEM_INFO__"));
        toUpdate.push({
          id: existing.id,
          payload: { 
            contact, 
            comments: [...filteredComments, sysComment] 
          }
        });
        rows.push({ 
          row: rowNumber, 
          name, 
          status: "actualizado", 
          detail: "Registro actualizado exitosamente" 
        });
      } else {
        toCreate.push({
          name,
          columnId: "importaciones", // 🔥 FORZADO EXPLÍCITAMENTE AL ID DE LA NUEVA COLUMNA
          createdAt: new Date().toISOString(),
          comments: [sysComment],
          contact 
        });
        rows.push({ row: rowNumber, name, status: "importado" });
      }
    });

    if (toCreate.length > 0) {
      await bulkAddCards(boardType, toCreate);
    }
    
    for (const update of toUpdate) {
      await updateCardApi(boardType, update.id, update.payload);
    }

    outcomes.push({ sheetName: worksheet.name, boardType, rows });
  }

  return outcomes;
}