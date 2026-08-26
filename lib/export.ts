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

const COMMENTS_COLUMN_INDEX = EXPORT_HEADERS.length - 1;

function formatExportDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatContactPhone(contact?: Contact | null) {
  if (!contact?.phone) return "";
  return contact.countryCode ? `${contact.countryCode} ${contact.phone}` : contact.phone;
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
  return cards.map((card) => [
    card.name,
    stageLabel.get(card.columnId) ?? card.columnId,
    card.contact?.name ?? "",
    card.contact?.role ?? "",
    card.contact?.email ?? "",
    formatContactPhone(card.contact),
    formatExportDate(card.createdAt),
    formatComments(card.comments),
  ]);
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
      [COMMENTS_COLUMN_INDEX]: { cellWidth: 90 },
    },
  });

  doc.save(filename);
}

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
      width: index === COMMENTS_COLUMN_INDEX ? 50 : 22,
    }));
    worksheet.addRows(sheet.rows);
    worksheet.getRow(1).font = { bold: true };

    const commentsColumn = worksheet.getColumn(COMMENTS_COLUMN_INDEX + 1);
    commentsColumn.alignment = { wrapText: true, vertical: "top" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
}
