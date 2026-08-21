import { BoardType, Column } from "./types";

export const BOARD_COLUMNS: Record<BoardType, Column[]> = {
  negociaciones: [
    { id: "identificacion", label: "Identificación" },
    { id: "primeros_contactos", label: "Primeros contactos" },
    { id: "reunion_agendada", label: "Reunión agendada" },
    { id: "seguimiento", label: "Seguimiento" },
    { id: "venta", label: "Venta" },
    { id: "rechazo", label: "Rechazo" },
  ],
  alianzas: [
    { id: "identificacion", label: "Identificación" },
    { id: "reunion_agendada", label: "Reunión agendada" },
    { id: "seguimiento", label: "Seguimiento" },
    { id: "aliados", label: "Aliados" },
    { id: "rechazo", label: "Rechazo" },
  ],
};

// Prefijo "crm_" para no colisionar con colecciones de otros proyectos Deinsa
// que puedan compartir la misma base de Firestore.
export const BOARD_COLLECTION: Record<BoardType, string> = {
  negociaciones: "crm_negociaciones",
  alianzas: "crm_alianzas",
};

export const BOARD_LABELS: Record<BoardType, string> = {
  negociaciones: "Negociaciones",
  alianzas: "Alianzas",
};

export const BOARD_ITEM_LABEL: Record<BoardType, string> = {
  negociaciones: "negociación",
  alianzas: "aliado",
};

export const BOARD_ITEM_OF_PHRASE: Record<BoardType, string> = {
  negociaciones: "de la",
  alianzas: "del",
};

export const BOARD_ITEM_NEW_LABEL: Record<BoardType, string> = {
  negociaciones: "Nueva negociación",
  alianzas: "Nuevo aliado",
};

// Nombres de hoja requeridos para la exportación a Excel (RF-03).
export const EXPORT_SHEET_NAME: Record<BoardType, string> = {
  negociaciones: "Leads",
  alianzas: "Aliados",
};

export type ColumnAccent = "neutral" | "blue" | "orange" | "amber" | "green" | "red";

// Misma columna (mismo id) usa el mismo color en ambos tableros.
export const COLUMN_ACCENT: Record<string, ColumnAccent> = {
  identificacion: "neutral",
  primeros_contactos: "blue",
  reunion_agendada: "orange",
  seguimiento: "amber",
  venta: "green",
  aliados: "green",
  rechazo: "red",
};

export const COLUMN_ACCENT_CLASSES: Record<
  ColumnAccent,
  { bar: string; badgeBg: string; badgeText: string }
> = {
  neutral: {
    bar: "bg-neutral-500",
    badgeBg: "bg-neutral-700",
    badgeText: "text-neutral-200",
  },
  blue: {
    bar: "bg-blue-500",
    badgeBg: "bg-blue-500/15",
    badgeText: "text-blue-400",
  },
  orange: {
    bar: "bg-deinsa-orange",
    badgeBg: "bg-deinsa-orange/15",
    badgeText: "text-deinsa-orange",
  },
  amber: {
    bar: "bg-amber-500",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-400",
  },
  green: {
    bar: "bg-green-500",
    badgeBg: "bg-green-500/15",
    badgeText: "text-green-400",
  },
  red: {
    bar: "bg-red-500",
    badgeBg: "bg-red-500/15",
    badgeText: "text-red-400",
  },
};
