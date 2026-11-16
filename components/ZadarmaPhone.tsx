"use client";

import { useEffect, useRef, useState } from "react";

// Teléfono WebRTC de Zadarma (botón de llamada en las tarjetas, 5.2.x).
// Monta el widget oficial flotante y escucha el evento "crm:llamar" que
// disparan los botones 📞 de los contactos.
//
// El widget pide el permiso de micrófono del navegador la primera vez.
// Requiere HTTPS (o localhost) y el dominio registrado en el panel de
// Zadarma: Configuración → Integraciones y API → widget WebRTC.

// URLs del snippet oficial del panel de Zadarma (Integraciones y API → WebRTC).
const WIDGET_SCRIPTS = [
  "https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-lib.js?sub_v=3",
  "https://my.zadarma.com/webphoneWebRTCWidget/v9/js/loader-phone-fn.js?sub_v=2",
];

// El widget solo puede montarse una vez por carga de página, aunque el
// tablero se desmonte y se vuelva a montar al navegar entre pipelines.
let widgetLoaded = false;

// El loader de Zadarma carga a su vez más recursos de forma asíncrona:
// zadarmaWidgetFn existe de inmediato, pero la interfaz interna
// (zdrmWebrtcPhoneInterface) tarda un poco más. Hay que esperarla.
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

// Intento de marcado automático: el widget oficial no documenta una API
// para marcar por código, así que se busca su campo de número en el DOM.
// Si cambia su estructura interna, devolvemos false y queda el respaldo
// (copiar el número al portapapeles).
function tryAutoDial(phone: string): boolean {
  const root =
    document.querySelector<HTMLElement>("[id*='zadarma']") ??
    document.querySelector<HTMLElement>("[class*='zdrm']");
  if (!root) return false;

  const input = root.querySelector<HTMLInputElement>("input[type='tel'], input[type='text'], input");
  if (!input) return false;

  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, phone);
  input.dispatchEvent(new Event("input", { bubbles: true }));

  const buttons = Array.from(root.querySelectorAll<HTMLElement>("button, [class*='call']"));
  const callButton = buttons.find((b) => /call|llama/i.test(b.className));
  if (!callButton) return false;
  callButton.click();
  return true;
}

export function ZadarmaPhone() {
  const [status, setStatus] = useState<"cargando" | "listo" | "sin-config" | "error">("cargando");
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function mountWidget() {
      if (widgetLoaded) {
        setStatus("listo");
        return;
      }
      try {
        const res = await fetch("/api/voice/webrtc-key");
        if (res.status === 502 || res.status === 401) {
          if (!cancelled) setStatus("sin-config");
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
        if (!cancelled) setStatus("listo");
      } catch (error) {
        console.error("Error montando el teléfono Zadarma:", error);
        if (!cancelled) setStatus("error");
      }
    }

    mountWidget();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function showNotice(text: string) {
      setNotice(text);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(null), 6000);
    }

    async function handleCallRequest(event: Event) {
      const phone = (event as CustomEvent<{ phone: string }>).detail?.phone;
      if (!phone) return;

      if (widgetLoaded && tryAutoDial(phone)) return;

      try {
        await navigator.clipboard.writeText(phone);
        showNotice(`Número ${phone} copiado. Pégalo en el teléfono (abajo a la derecha).`);
      } catch {
        showNotice(`Marca ${phone} en el teléfono (abajo a la derecha).`);
      }
    }

    window.addEventListener("crm:llamar", handleCallRequest);
    return () => window.removeEventListener("crm:llamar", handleCallRequest);
  }, []);

  if (status === "sin-config" || status === "cargando") {
    return notice ? <Toast text={notice} /> : null;
  }
  if (status === "error") {
    return <Toast text="No se pudo cargar el teléfono. Revisa la consola y la configuración de Zadarma." />;
  }
  return notice ? <Toast text={notice} /> : null;
}

function Toast({ text }: { text: string }) {
  return (
    <div className="fixed bottom-24 right-4 z-50 max-w-xs rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 shadow-lg">
      {text}
    </div>
  );
}
