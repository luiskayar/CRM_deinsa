import { BOARD_COLUMNS, BOARD_LABELS, EXPORT_SHEET_NAME, COUNTRY_CODES } from "./constants";
import { normalizeText } from "./search";
import { BoardType, CardItem, Comment, Contact } from "./types";

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

// 5.2.3: las celdas con varios valores (notas, contactos) se separan con ";".
// Ejemplo: "nota 1; nota 2; nota 3".
const MULTI_VALUE_SEPARATOR = ";";

// Alias aceptados (ya normalizados: sin tildes, en minúsculas) para cada columna.
// Incluye los encabezados de la plantilla ("Respuesta") y los de la exportación.
const HEADER_ALIASES = {
  company: ["empresa", "compania"],
  contactName: ["nombre", "contacto"],
  role: ["cargo", "puesto"],
  email: ["correo", "email"],
  phone: ["numero", "telefono"],
  country: ["pais"],
  stage: ["columna", "etapa"],
  notes: ["notas", "nota", "comentarios", "comentario", "respuesta"],
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

// Un valor vacío, o el literal "null" (así exporta la app los datos faltantes),
// se registra como null.
function toNullable(raw: string | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text || text.toLowerCase() === "null") return null;
  return text;
}

function splitMultiValue(raw: string): string[] {
  return raw.split(MULTI_VALUE_SEPARATOR);
}

function createCommentId() {
  return `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// "nota 1; nota 2" -> 2 notas. Cada nota vacía (o "null") se descarta.
export function parseNotes(raw: string): Comment[] {
  const createdAt = new Date().toISOString();
  return splitMultiValue(raw)
    .map(toNullable)
    .filter((text): text is string => text !== null && normalizeText(text) !== "sin comentarios")
    .map((text) => ({ id: createCommentId(), text, createdAt }));
}

const KNOWN_CALLING_CODES = new Set(COUNTRY_CODES.map((c) => c.code));

// La exportación escribe el teléfono como "+506 8888 8888": si trae un
// prefijo conocido se separa; si no, se usa el del país de la fila.
function splitPhone(phone: string | null, fallbackCode: string) {
  if (!phone) return { countryCode: fallbackCode, phone: null };
  if (phone.startsWith("+")) {
    const digits = phone.slice(1);
    for (let length = 4; length >= 1; length--) {
      const code = `+${digits.slice(0, length)}`;
      if (digits.length > length && KNOWN_CALLING_CODES.has(code)) {
        return { countryCode: code, phone: toNullable(digits.slice(length).replace(/^[\s-]+/, "")) };
      }
    }
  }
  return { countryCode: fallbackCode, phone };
}

// Los campos de contacto se leen por posición: el n-ésimo valor de cada
// columna pertenece al n-ésimo contacto. Lo que falte se registra como null.
export function parseContacts(
  raw: { names: string; roles: string; emails: string; phones: string },
  fallbackCountryCode: string
): Contact[] {
  const names = splitMultiValue(raw.names);
  const roles = splitMultiValue(raw.roles);
  const emails = splitMultiValue(raw.emails);
  const phones = splitMultiValue(raw.phones);
  const total = Math.max(names.length, roles.length, emails.length, phones.length);

  const contacts: Contact[] = [];
  for (let i = 0; i < total; i++) {
    const name = toNullable(names[i]);
    const role = toNullable(roles[i]);
    const email = toNullable(emails[i]);
    const { countryCode, phone } = splitPhone(toNullable(phones[i]), fallbackCountryCode);
    // Posición sin ningún dato (p. ej. un ";" sobrante al final): no es un contacto.
    if (!name && !role && !email && !phone) continue;
    contacts.push({ name, role, email, countryCode, phone });
  }
  return contacts;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bulkAddCards(boardType: BoardType, pipelineId: string, items: any[]) {
  for (const group of chunk(items, 500)) {
    const res = await fetch("/api/board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: boardType,
        pipelineId,
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
  currentBoardType: BoardType,
  pipelineId: string
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
      headers[normalizeText(cellText(cell)).trim()] = colNumber;
    });

    // Formato de la exportación: "Nombre" es la tarjeta y "Contacto" son los
    // contactos. En la plantilla, "Empresa" es la tarjeta y "Nombre" el contacto.
    const isExportLayout =
      !HEADER_ALIASES.company.some((key) => headers[key]) && Boolean(headers["contacto"]);

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Saltamos encabezados

      const getVal = (keys: string[]) => {
        for (const k of keys) {
          if (headers[k]) return cellText(row.getCell(headers[k]));
        }
        return "";
      };

      // Solo extraemos los datos que nos interesan (se omiten Industria, Sector, etc.)
      const contactNamesRaw = isExportLayout ? getVal(["contacto"]) : getVal(HEADER_ALIASES.contactName);
      const name = isExportLayout
        ? toNullable(getVal(["nombre"]))
        : toNullable(getVal(HEADER_ALIASES.company)) ??
          toNullable(splitMultiValue(contactNamesRaw)[0]);
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

      const pais = getVal(HEADER_ALIASES.country);
      const mappedCountry =
        COUNTRY_CODES.find((c) => normalizeText(c.country) === normalizeText(pais.trim())) ||
        COUNTRY_CODES[0];

      // N contactos y N notas por fila, separados por ";"
      const contacts = parseContacts(
        {
          names: contactNamesRaw,
          roles: getVal(HEADER_ALIASES.role),
          emails: getVal(HEADER_ALIASES.email),
          phones: getVal(HEADER_ALIASES.phone),
        },
        mappedCountry.code
      );
      const comments = parseNotes(getVal(HEADER_ALIASES.notes));

      let columnId = resolveColumnId(currentBoardType, getVal(HEADER_ALIASES.stage));
      if (!columnId) {
         columnId = BOARD_COLUMNS[currentBoardType][0].id;
      }

      seenNames.add(normalizedName);
      
      toCreate.push({
        name,
        columnId,
        createdAt: new Date().toISOString(),
        comments,
        contacts,
      });
      rows.push({ row: rowNumber, name, status: "importado" });
    });

    if (toCreate.length > 0) {
      await bulkAddCards(currentBoardType, pipelineId, toCreate);
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