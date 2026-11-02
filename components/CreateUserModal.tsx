// components/CreateUserModal.tsx
"use client";

import { useState } from "react";

export function CreateUserModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [nuevoUsuario, setNuevoUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState("visualizador");
  const [mensaje, setMensaje] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje("Creando...");

    // Llama al API que creamos en el paso anterior
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nuevoUsuario, password, rol }),
    });

    const data = await res.json();
    if (res.ok) {
      setMensaje("¡Usuario creado con éxito!");
      setNuevoUsuario("");
      setPassword("");
      // Cerrar el modal después de 2 segundos
      setTimeout(() => setIsOpen(false), 2000);
    } else {
      setMensaje(data.error || "Error al crear usuario");
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded bg-deinsa-orange px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
      >
        + Crear Usuario
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-lg border border-neutral-700 bg-neutral-900 p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-white">Crear Nuevo Usuario</h2>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-sm text-neutral-400">Nombre de Usuario</label>
                <input
                  type="text"
                  required
                  value={nuevoUsuario}
                  onChange={(e) => setNuevoUsuario(e.target.value)}
                  className="w-full rounded bg-neutral-800 p-2 text-white outline-none focus:ring-1 focus:ring-deinsa-orange"
                />
              </div>

              <div>
                <label className="text-sm text-neutral-400">Contraseña</label>
                <input
                  type="text" // Puede ser password, pero a veces es útil ver qué clave le estás asignando
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded bg-neutral-800 p-2 text-white outline-none focus:ring-1 focus:ring-deinsa-orange"
                />
              </div>

              <div>
                <label className="text-sm text-neutral-400">Rol del Usuario</label>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                  className="w-full rounded bg-neutral-800 p-2 text-white outline-none focus:ring-1 focus:ring-deinsa-orange"
                >
                  <option value="visualizador">Visualizador (Solo lectura)</option>
                  <option value="superusuario">Superusuario (Acceso total)</option>
                </select>
              </div>

              {mensaje && <p className="text-sm text-deinsa-orange">{mensaje}</p>}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded px-4 py-2 text-neutral-400 hover:bg-neutral-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded bg-deinsa-orange px-4 py-2 font-bold text-white hover:opacity-90"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}