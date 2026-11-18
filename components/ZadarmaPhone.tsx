"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Teléfono WebRTC de Zadarma (botón de llamada en las tarjetas, 5.2.x).
//
// IMPORTANTE: el motor de llamada es el widget oficial de Zadarma (SIP/WebRTC)
// y NO tiene una API documentada para marcar por código. Intentar esconderlo y
// marcarlo con clicks sintéticos no coloca la llamada de verdad. Por eso aquí
// el widget nativo queda VISIBLE (es el teléfono que realmente funciona) y
// nuestros botones solo le CARGAN el número: el usuario confirma pulsando el
// botón verde del propio widget.
//
// Flujo:
//   1. El usuario pulsa "📞 Llamar" en un contacto → evento "crm:llamar".
//   2. Pedimos permiso de micrófono (la llamada WebRTC no conecta sin él).
//   3. Escribimos el número en el campo del widget nativo (abajo a la derecha).
//   4. El usuario pulsa el botón verde del widget para llamar.
//
// Requiere HTTPS (o localhost) y el dominio registrado en el panel de Zadarma:
// Configuración → Integraciones y API → widget WebRTC.

// URLs del snippet oficial del panel de Zadarma (Integraciones y API → WebRTC).
const WIDGET_SCRIPTS = [
  "https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-lib.js?sub_v=3",
  "https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-fn.js?sub_v=2",
];

// El widget solo puede montarse una vez por carga de página, aunque el
// tablero se desmonte y se vuelva a montar al navegar entre pipelines.
let widgetLoaded = false;

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

// Escribe el número en el campo del widget nativo. Reintenta porque el loader
// carga de forma asíncrona y el campo puede tardar en aparecer. Solo rellena:
// NO pulsa el botón de llamar (eso lo hace el usuario, que es lo fiable).
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
  const [aviso, setAviso] = useState<string | null>(null);
  const avisoTimer = useRef<number | null>(null);

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(null), 7000);
  }, []);

  // --- Montaje del widget nativo (VISIBLE: es el teléfono que funciona) ---
  useEffect(() => {
    let cancelled = false;

    async function mountWidget() {
      if (widgetLoaded) {
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

      // Permiso de micrófono dentro del gesto del usuario (el click en Llamar).
      // La llamada WebRTC no conecta sin micrófono; concederlo aquí evita que
      // falle luego al pulsar el botón verde del widget.
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

      const ok = await rellenarNumero(phone);
      if (ok) {
        mostrarAviso("Número cargado en el teléfono (abajo a la derecha). Pulsa el botón verde para llamar. 📞");
      } else {
        // Respaldo: si no encontramos el campo del widget, copiamos el número.
        try {
          await navigator.clipboard.writeText(phone);
          mostrarAviso(`Número ${phone} copiado. Pégalo en el teléfono de abajo a la derecha y pulsa el verde.`);
        } catch {
          mostrarAviso(`Marca ${phone} en el teléfono de abajo a la derecha.`);
        }
      }
    }

    window.addEventListener("crm:llamar", handleCallRequest);
    return () => window.removeEventListener("crm:llamar", handleCallRequest);
  }, [estado, mostrarAviso]);

  // La interfaz visible es el propio widget nativo de Zadarma. Aquí solo
  // mostramos avisos puntuales (número cargado, falta de micrófono, etc.).
  return aviso ? <Aviso texto={aviso} /> : null;
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="fixed bottom-28 right-5 z-[70] max-w-xs rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 shadow-lg">
      {texto}
    </div>
  );
}
