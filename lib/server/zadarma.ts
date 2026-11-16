import { createHash, createHmac } from "crypto";

// Cliente mínimo de la API de Zadarma (api.zadarma.com) para el widget WebRTC
// (5.2.x, botón de llamada). Las credenciales viven solo en el servidor.
//
// Firma según la doc oficial: se ordenan los parámetros, se arma el query
// string, y se firma "<ruta><query><md5(query)>" con HMAC-SHA1 (digest hex)
// codificado en base64. Header: "Authorization: key:firma".
const ZADARMA_API_BASE = "https://api.zadarma.com";

function buildAuthHeader(method: string, paramsStr: string, key: string, secret: string) {
  const md5 = createHash("md5").update(paramsStr).digest("hex");
  const hmacHex = createHmac("sha1", secret).update(method + paramsStr + md5).digest("hex");
  const signature = Buffer.from(hmacHex).toString("base64");
  return `${key}:${signature}`;
}

export function getZadarmaConfig() {
  const key = process.env.ZADARMA_API_KEY;
  const secret = process.env.ZADARMA_API_SECRET;
  const sip = process.env.ZADARMA_SIP;
  if (!key || !secret || !sip) return null;
  return { key, secret, sip };
}

async function zadarmaGet(method: string, params: Record<string, string>, key: string, secret: string) {
  const sorted = Object.keys(params).sort();
  const search = new URLSearchParams();
  for (const name of sorted) search.append(name, params[name]);
  const paramsStr = search.toString();

  const res = await fetch(`${ZADARMA_API_BASE}${method}?${paramsStr}`, {
    headers: { Authorization: buildAuthHeader(method, paramsStr, key, secret) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.status !== "success") {
    const message = (data && (data.message as string)) || `HTTP ${res.status}`;
    throw new Error(`Zadarma ${method}: ${message}`);
  }
  return data;
}

// Llave temporal (vida útil: 72 horas) para el widget WebRTC.
export async function getWebrtcKey() {
  const config = getZadarmaConfig();
  if (!config) throw new Error("Faltan ZADARMA_API_KEY, ZADARMA_API_SECRET o ZADARMA_SIP en el .env");
  const data = await zadarmaGet("/v1/webrtc/get_key/", { sip: config.sip }, config.key, config.secret);
  return { key: data.key as string, sip: config.sip };
}
