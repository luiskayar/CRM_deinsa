import { getCardContacts } from "./contact";
import { CardItem, Column, Comment, Contact } from "./types";

export const EXPORT_HEADERS = [
  "Nombre",
  "Etapa",
  "Contacto",
  "Puesto",
  "Correo",
  "Teléfono",
  "Fecha de creación",
  "Comentarios",
];

const CONTACT_NAME_INDEX = 2;
const CONTACT_EMAIL_INDEX = 4;
const COMMENTS_COLUMN_INDEX = EXPORT_HEADERS.length - 1;

function formatExportDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatContactPhone(contact: Contact) {
  if (!contact.phone) return "";
  return contact.countryCode ? `${contact.countryCode} ${contact.phone}` : contact.phone;
}

// Une el mismo campo de todos los contactos de la tarjeta en una sola celda,
// una línea por contacto (se combina con "wrapText"/"linebreak" al exportar).
function formatContactsField(contacts: Contact[], pick: (contact: Contact) => string) {
  return contacts
    .map(pick)
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");
}

function formatComments(comments: Comment[]) {
  if (comments.length === 0) return "Sin comentarios";
  return comments
    .map((comment) => `[${formatExportDate(comment.createdAt)}] ${comment.text}`)
    .join("\n");
}

export function cardsToExportRows(
  cards: CardItem[],
  columns: Column[]
): (string | number)[][] {
  const stageLabel = new Map(columns.map((column) => [column.id, column.label]));
  return cards.map((card) => {
    const contacts = getCardContacts(card);
    return [
      card.name,
      stageLabel.get(card.columnId) ?? card.columnId,
      formatContactsField(contacts, (c) => c.name),
      formatContactsField(contacts, (c) => c.role),
      formatContactsField(contacts, (c) => c.email),
      formatContactsField(contacts, formatContactPhone),
      formatExportDate(card.createdAt),
      formatComments(card.comments),
    ];
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportRowsToPdf({
  title,
  headers,
  rows,
  filename,
}: {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generado el ${new Date().toLocaleString("es")}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [headers],
    body: rows,
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [38, 38, 38], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      [CONTACT_NAME_INDEX]: { cellWidth: 45 },
      [CONTACT_EMAIL_INDEX]: { cellWidth: 50 },
      [COMMENTS_COLUMN_INDEX]: { cellWidth: 80 },
    },
  });

  doc.save(filename);
}

const EXCEL_COLUMN_WIDTHS: Record<number, number> = {
  [CONTACT_NAME_INDEX]: 28,
  [CONTACT_EMAIL_INDEX]: 30,
  [COMMENTS_COLUMN_INDEX]: 50,
};

export async function exportSheetsToExcel({
  sheets,
  filename,
}: {
  sheets: { name: string; headers: string[]; rows: (string | number)[][] }[];
  filename: string;
}) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Deinsa CRM";
  workbook.created = new Date();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.columns = sheet.headers.map((header, index) => ({
      header,
      width: EXCEL_COLUMN_WIDTHS[index] ?? 22,
    }));
    worksheet.addRows(sheet.rows);
    worksheet.getRow(1).font = { bold: true };
    worksheet.columns.forEach((column) => {
      column.alignment = { wrapText: true, vertical: "top" };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
}
