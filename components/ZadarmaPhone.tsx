"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Teléfono WebRTC de Zadarma (botón de llamada en las tarjetas, 5.2.x).
//
// El motor de llamada es el widget oficial de Zadarma (SIP/WebRTC) y NO tiene
// API documentada para marcar por código: el que coloca la llamada de verdad
// es su botón verde. Por eso NO lo reemplazamos ni lo marcamos con clicks
// sintéticos. Lo que hacemos es puramente visual:
//
//   - El widget nativo sigue siendo el teléfono real y funcional.
//   - Por defecto queda MINIMIZADO (escondido con CSS), para que no estorbe.
//   - Un icono verde flotante (FAB) abajo a la derecha lo EXPANDE / MINIMIZA.
//   - El botón "📞 Llamar" de un contacto expande el teléfono y le carga el
//     número; el usuario confirma con el botón verde del propio widget.
//
// Minimizar/expandir solo cambia la visibilidad por CSS: el widget sigue vivo,
// así que una llamada en curso no se corta al minimizarlo.

// URLs del snippet oficial del panel de Zadarma (Integraciones y API → WebRTC).
const WIDGET_SCRIPTS = [
  "https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-lib.js?sub_v=3",
  "https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-fn.js?sub_v=2",
];

// El widget solo puede montarse una vez por carga de página.
let widgetLoaded = false;

// CSS que controla mostrar/ocultar el widget nativo con una animación suave.
// Etiquetamos su contenedor con [data-crm-phone] para animar SOLO ese elemento;
// mientras no esté etiquetado, un respaldo lo mantiene invisible para evitar el
// parpadeo del widget feo al cargar la página.
const STYLE_ID = "crm-zdrm-style";
function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    [data-crm-phone] {
      transition: transform .28s ease, opacity .28s ease !important;
      transform-origin: bottom right;
    }
    html.crm-phone-min [data-crm-phone] {
      transform: translateY(140%) scale(.85) !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    /* Respaldo antes de etiquetar: evita el parpadeo del widget al cargar. */
    html.crm-phone-min:not(.crm-phone-tagged) [id*="zadarma"],
    html.crm-phone-min:not(.crm-phone-tagged) [class*="zdrm"] {
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.body.appendChild(script);
  });
}

function waitForGlobal(name: string, timeoutMs = 8000) {
  return new Promise<void>((resolve) => {
    const start = Date.now();
    const timer = window.setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any)[name] !== undefined || Date.now() - start > timeoutMs) {
        window.clearInterval(timer);
        resolve();
      }
    }, 150);
  });
}

// Localiza la raíz del widget nativo de Zadarma en el DOM.
function getWidgetRoot(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>("[id*='zadarma']") ??
    document.querySelector<HTMLElement>("[class*='zdrm']") ??
    document.querySelector<HTMLElement>("[class*='zadarma']")
  );
}

// Busca el contenedor del widget y lo etiqueta con [data-crm-phone] para poder
// animarlo. Sube hasta el ancestro que cuelga directamente de <body>.
function tagWidgetRoot(attempts = 40, gapMs = 150) {
  let tries = 0;
  const timer = window.setInterval(() => {
    const found = getWidgetRoot();
    if (found) {
      let root: HTMLElement = found;
      while (root.parentElement && root.parentElement !== document.body) {
        root = root.parentElement;
      }
      root.setAttribute("data-crm-phone", "1");
      document.documentElement.classList.add("crm-phone-tagged");
      window.clearInterval(timer);
    } else if (++tries >= attempts) {
      window.clearInterval(timer);
    }
  }, gapMs);
}

// Escribe el número en el campo del widget nativo (no pulsa llamar: eso lo hace
// el usuario con el botón verde, que es lo fiable). Reintenta porque el campo
// tarda en aparecer.
async function rellenarNumero(phone: string, attempts = 20, gapMs = 250): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const root = getWidgetRoot();
    const input = root?.querySelector<HTMLInputElement>(
      "input[type='tel'], input[type='text'], input"
    );
    if (root && input) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(input, phone);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      try {
        input.focus();
      } catch {
        /* no-op */
      }
      return true;
    }
    await new Promise((r) => setTimeout(r, gapMs));
  }
  return false;
}

type Estado = "cargando" | "listo" | "sin-config" | "error";

export function ZadarmaPhone() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [minimizado, setMinimizado] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const avisoTimer = useRef<number | null>(null);

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(null), 7000);
  }, []);

  // Sincroniza el estado minimizado con la clase que dispara el CSS.
  useEffect(() => {
    ensureStyle();
    document.documentElement.classList.toggle("crm-phone-min", minimizado);
  }, [minimizado]);

  // --- Montaje del widget nativo (el teléfono real) ---
  useEffect(() => {
    let cancelled = false;

    async function mountWidget() {
      ensureStyle();
      if (widgetLoaded) {
        tagWidgetRoot();
        setEstado("listo");
        return;
      }
      try {
        const res = await fetch("/api/voice/webrtc-key");
        if (res.status === 502 || res.status === 401) {
          if (!cancelled) setEstado("sin-config");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { key, sip } = await res.json();

        for (const src of WIDGET_SCRIPTS) await loadScript(src);
        await waitForGlobal("zdrmWebrtcPhoneInterface");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const widgetFn = (window as any).zadarmaWidgetFn;
        if (typeof widgetFn !== "function") throw new Error("zadarmaWidgetFn no está disponible");
        // Lo colocamos un poco más arriba para que no tape el icono flotante.
        widgetFn(key, sip, "rounded", "es", true, { right: "16px", bottom: "92px" });

        tagWidgetRoot();
        widgetLoaded = true;
        if (!cancelled) setEstado("listo");
      } catch (error) {
        console.error("Error montando el teléfono Zadarma:", error);
        if (!cancelled) setEstado("error");
      }
    }

    mountWidget();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Evento desde los botones "Llamar" de los contactos ---
  useEffect(() => {
    async function handleCallRequest(event: Event) {
      const phone = (event as CustomEvent<{ phone: string }>).detail?.phone;
      if (!phone) return;

      if (estado === "sin-config") {
        mostrarAviso("La telefonía no está configurada en este entorno.");
        return;
      }
      if (estado !== "listo") {
        mostrarAviso("El teléfono aún se está cargando, espera un momento e inténtalo de nuevo.");
        return;
      }

      // Permiso de micrófono dentro del gesto del usuario (click en Llamar).
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
        } catch (err) {
          console.error("Permiso de micrófono denegado:", err);
          mostrarAviso(
            "Necesito permiso de micrófono para llamar. Pulsa el candado 🔒 de la barra → Micrófono → Permitir, y vuelve a intentarlo."
          );
          return;
        }
      }

      setMinimizado(false); // expande el teléfono para que se vea el número.
      const ok = await rellenarNumero(phone);
      if (ok) {
        mostrarAviso("Número cargado. Pulsa el botón verde del teléfono para llamar. 📞");
      } else {
        try {
          await navigator.clipboard.writeText(phone);
          mostrarAviso(`Número ${phone} copiado. Pégalo en el teléfono y pulsa el verde.`);
        } catch {
          mostrarAviso(`Marca ${phone} en el teléfono.`);
        }
      }
    }

    window.addEventListener("crm:llamar", handleCallRequest);
    return () => window.removeEventListener("crm:llamar", handleCallRequest);
  }, [estado, mostrarAviso]);

  // Nada que mostrar mientras carga o si no hay telefonía (ni icono).
  if (estado === "cargando" || estado === "sin-config") {
    return aviso ? <Aviso texto={aviso} /> : null;
  }

  return (
    <>
      {/* Icono flotante verde: expande / minimiza el teléfono nativo */}
      <button
        onClick={() => setMinimizado((v) => !v)}
        title={minimizado ? "Abrir teléfono" : "Minimizar teléfono"}
        className="fixed bottom-5 right-5 z-[65] flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-xl ring-1 ring-black/30 transition hover:scale-105 hover:bg-green-500 active:scale-95"
      >
        {minimizado ? <IconoTelefono className="h-6 w-6" /> : <IconoMinimizar className="h-6 w-6" />}
      </button>

      {aviso && <Aviso texto={aviso} />}
    </>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="fixed bottom-24 right-5 z-[70] max-w-xs rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 shadow-lg">
      {texto}
    </div>
  );
}

function IconoTelefono({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconoMinimizar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
