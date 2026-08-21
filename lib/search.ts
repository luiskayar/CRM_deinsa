// Normaliza texto para comparaciones insensibles a mayúsculas/minúsculas y acentos.
export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
