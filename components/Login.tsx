"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); 

    // Llamada a la API que validará contra el .env
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password }),
    });

    const data = await res.json();

    if (res.ok) {
      router.push("/negociaciones");
      router.refresh();
    } else {
      // Mostramos el error dinámico (ej. bloqueos o credenciales incorrectas)
      setError(data.error || "Usuario o contraseña incorrectos.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-900">
      <form 
        onSubmit={handleSubmit} 
        className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-950 p-8 shadow-xl"
      >
        <h2 className="mb-6 text-center text-2xl font-bold text-neutral-100">
          Acceso CRM Deinsa
        </h2>
        
        <div className="mb-4">
          <label className="mb-2 block text-sm font-bold text-neutral-400">
            Usuario
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 focus:border-deinsa-orange focus:outline-none focus:ring-1 focus:ring-deinsa-orange"
            placeholder="Ej: deinsa"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-bold text-neutral-400">
            Contraseña
          </label>
          <input
            type="password"
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 focus:border-deinsa-orange focus:outline-none focus:ring-1 focus:ring-deinsa-orange"
            placeholder="Tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-900 bg-red-950/40 p-3 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded bg-deinsa-orange px-4 py-2 font-bold text-white transition-opacity hover:opacity-90"
        >
          Ingresar
        </button>
      </form>
    </div>
  );
}