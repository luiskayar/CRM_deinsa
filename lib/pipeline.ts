import { normalizeText } from "./search";

// "La Plaza Digital" -> "la-plaza-digital". Se usa como id del documento y en la URL.
export function pipelineSlug(name: string) {
  return normalizeText(name.trim())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
