import { CardItem, Column } from "./types";

export const EXPORT_HEADERS = ["Nombre", "Etapa", "Fecha de creación", "Comentarios"];

function formatExportDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function cardsToExportRows(
  cards: CardItem[],
  columns: Column[]
): (string | number)[][] {
  const stageLabel = new Map(columns.map((column) => [column.id, column.label]));
  return cards.map((card) => [
    card.name,
    stageLabel.get(card.columnId) ?? card.columnId,
    formatExportDate(card.createdAt),
    card.comments.length,
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

  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generado el ${new Date().toLocaleString("es")}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [headers],
    body: rows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [38, 38, 38], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
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
    worksheet.columns = sheet.headers.map((header) => ({ header, width: 24 }));
    worksheet.addRows(sheet.rows);
    worksheet.getRow(1).font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
}
