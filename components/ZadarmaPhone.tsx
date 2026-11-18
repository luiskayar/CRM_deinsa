"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Teléfono WebRTC de Zadarma (botón de llamada en las tarjetas, 5.2.x).
//
// El motor de llamada es el widget oficial de Zadarma (SIP/WebRTC): no se
// puede reemplazar. Lo que SÍ controlamos es la interfaz: montamos el widget
// oficial OCULTO y mostramos nuestra propia UI:
//   - un botón flotante (FAB) con icono de teléfono abajo a la derecha,
//   - una pestaña flotante para marcar y confirmar la llamada.
//
// Los botones "📞 Llamar" de los contactos disparan el evento "crm:llamar",
// que abre la pestaña flotante con el número ya cargado; el usuario confirma.
//
// El widget pide permiso de micrófono la primera vez. Requiere HTTPS (o
// localhost) y el dominio registrado en el panel de Zadarma:
// Configuración → Integraciones y API → widget WebRTC.

// URLs del snippet oficial del panel de Zadarma (Integraciones y API → WebRTC).
const WIDGET_SCRIPTS = [
  "https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-lib.js?sub_v=3",
  "https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-fn.js?sub_v=2",
];

// El widget solo puede montarse una vez por carga de página, aunque el
// tablero se desmonte y se vuelva a montar al navegar entre pipelines.
let widgetLoaded = false;

// CSS que oculta el widget nativo de Zadarma: usamos nuestra propia interfaz,
// pero el widget sigue vivo (fuera de pantalla) para que el audio y el permiso
// de micrófono funcionen. Si algo fallara en el control, la clase se retira
// para dejar el widget nativo a la vista (respaldo).
const HIDE_STYLE_ID = "zdrm-hide-native";
function ensureHideStyle() {
  if (document.getElementById(HIDE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIDE_STYLE_ID;
  style.textContent = `
    html.zdrm-ocultar [id*="zadarma"],
    html.zdrm-ocultar [class*="zdrm"],
    html.zdrm-ocultar [class*="zadarma"] {
      position: fixed !important;
      left: -10000px !important;
      bottom: auto !important;
      right: auto !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
  document.documentElement.classList.add("zdrm-ocultar");
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

// Espera a que exista un global del widget (su interfaz interna tarda un poco
// más que el loader en estar disponible).
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

// Marca un número en el widget nativo. Reintenta hasta que su campo esté
// disponible (el loader carga de forma asíncrona), lo que evita el problema
// de "tener que dar varios clics". Devuelve true si logró iniciar la llamada.
async function dialWithRetry(phone: string, attempts = 20, gapMs = 250): Promise<boolean> {
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

      const buttons = Array.from(root.querySelectorAll<HTMLElement>("button, a, [role='button'], [class*='call']"));
      const callButton = buttons.find(
        (b) => /call|llama|dial/i.test(b.className) || /call|llama/i.test(b.getAttribute("title") ?? "")
      );
      if (callButton) {
        callButton.click();
        return true;
      }
    }
    await new Promise((r) => setTimeout(r, gapMs));
  }
  return false;
}

// Cuelga la llamada activa pulsando el botón de colgar del widget nativo.
function hangUpNative(): boolean {
  const root = getWidgetRoot();
  if (!root) return false;
  const buttons = Array.from(root.querySelectorAll<HTMLElement>("button, a, [role='button']"));
  const hangButton = buttons.find(
    (b) => /hang|colg|end|finaliz|reject/i.test(b.className + " " + (b.getAttribute("title") ?? ""))
  );
  if (hangButton) {
    hangButton.click();
    return true;
  }
  return false;
}

type Estado = "cargando" | "listo" | "sin-config" | "error";
type Llamada = "idle" | "marcando";

export function ZadarmaPhone() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [abierto, setAbierto] = useState(false);
  const [numero, setNumero] = useState("");
  const [llamada, setLlamada] = useState<Llamada>("idle");
  const [aviso, setAviso] = useState<string | null>(null);

  const avisoTimer = useRef<number | null>(null);

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(null), 5000);
  }, []);

  // --- Montaje del widget nativo (oculto) ---
  useEffect(() => {
    let cancelled = false;

    async function mountWidget() {
      if (widgetLoaded) {
        ensureHideStyle();
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
        widgetFn(key, sip, "rounded", "es", true, { right: "16px", bottom: "16px" });

        ensureHideStyle();
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
    function handleCallRequest(event: Event) {
      const phone = (event as CustomEvent<{ phone: string }>).detail?.phone;
      if (!phone) return;
      if (estado === "sin-config") {
        mostrarAviso("La telefonía no está configurada en este entorno.");
        return;
      }
      setNumero(phone);
      setAbierto(true); // abre la pestaña flotante; el usuario confirma.
    }
    window.addEventListener("crm:llamar", handleCallRequest);
    return () => window.removeEventListener("crm:llamar", handleCallRequest);
  }, [estado, mostrarAviso]);

  const iniciarLlamada = useCallback(async () => {
    const limpio = numero.trim();
    if (!limpio) {
      mostrarAviso("Escribe un número para llamar.");
      return;
    }
    if (estado !== "listo") {
      mostrarAviso("El teléfono aún se está cargando, espera un momento.");
      return;
    }

    // Permiso de micrófono: una llamada WebRTC NO conecta sin micrófono. Como
    // el widget va oculto y lo marcamos con clicks sintéticos, el navegador no
    // muestra el aviso por sí solo, así que lo pedimos aquí, dentro del gesto
    // real del usuario (el click en "Llamar"). Una vez concedido, el navegador
    // lo recuerda y el widget de Zadarma ya puede usar el audio.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Liberamos el stream de prueba: solo nos interesaba el permiso.
        stream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        console.error("Permiso de micrófono denegado:", err);
        mostrarAviso(
          "Necesito permiso de micrófono para llamar. Pulsa el candado 🔒 de la barra del navegador → Micrófono → Permitir, y vuelve a intentarlo."
        );
        return;
      }
    }

    setLlamada("marcando");
    const ok = await dialWithRetry(limpio);
    if (!ok) {
      setLlamada("idle");
      // Respaldo: si no pudimos controlar el widget, mostramos el nativo y
      // copiamos el número para que el usuario no se quede bloqueado.
      document.documentElement.classList.remove("zdrm-ocultar");
      try {
        await navigator.clipboard.writeText(limpio);
        mostrarAviso(`No se pudo marcar solo. Número ${limpio} copiado; usa el teléfono que apareció.`);
      } catch {
        mostrarAviso(`No se pudo marcar solo. Marca ${limpio} en el teléfono que apareció.`);
      }
    }
  }, [numero, estado, mostrarAviso]);

  const colgar = useCallback(() => {
    hangUpNative();
    setLlamada("idle");
  }, []);

  // No renderizamos nada mientras carga o si no hay telefonía configurada.
  if (estado === "cargando" || estado === "sin-config") {
    return aviso ? <Aviso texto={aviso} /> : null;
  }

  return (
    <>
      {/* Pestaña flotante */}
      {abierto && (
        <div className="fixed bottom-24 right-5 z-[60] w-72 overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl ring-1 ring-black/40">
          {/* Cabecera */}
          <div className="flex items-center justify-between bg-neutral-800/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                <IconoTelefono className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-neutral-100">Teléfono</span>
            </div>
            <button
              onClick={() => setAbierto(false)}
              className="text-neutral-400 transition hover:text-neutral-100"
              title="Cerrar"
            >
              <IconoCerrar className="h-4 w-4" />
            </button>
          </div>

          <div className="px-4 py-4">
            {llamada === "idle" ? (
              <>
                <label className="mb-1 block text-xs text-neutral-400">Número</label>
                <input
                  type="tel"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && iniciarLlamada()}
                  placeholder="Introduce el número"
                  autoFocus
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-green-500"
                />
                <button
                  onClick={iniciarLlamada}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500 active:scale-[0.98]"
                >
                  <IconoTelefono className="h-4 w-4" />
                  Llamar
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center py-2 text-center">
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-green-600/15 text-green-400">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500/30" />
                  <IconoTelefono className="h-6 w-6" />
                </span>
                <p className="mt-3 text-sm font-medium text-neutral-100">{numero}</p>
                <p className="mt-0.5 text-xs text-neutral-400">Llamando…</p>
                <button
                  onClick={colgar}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-[0.98]"
                >
                  <IconoColgar className="h-4 w-4" />
                  Finalizar
                </button>
              </div>
            )}

            {estado === "error" && (
              <p className="mt-3 text-[11px] leading-snug text-amber-400">
                El teléfono no cargó bien. Revisa la consola y la configuración de Zadarma.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Botón flotante (FAB) abajo a la derecha — siempre verde */}
      <button
        onClick={() => setAbierto((v) => !v)}
        title="Teléfono"
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-xl ring-1 ring-black/30 transition hover:scale-105 hover:bg-green-500 active:scale-95"
      >
        <IconoTelefono className="h-6 w-6" />
      </button>

      {aviso && <Aviso texto={aviso} />}
    </>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="fixed bottom-24 left-1/2 z-[70] max-w-xs -translate-x-1/2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-center text-xs text-neutral-200 shadow-lg">
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

function IconoColgar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function IconoCerrar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
