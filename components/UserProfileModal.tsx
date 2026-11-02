"use client";

import { useState, useEffect } from "react";

interface UserProfileModalProps {
  esSuperAdmin: boolean;
  nombreUsuario: string;
}

interface UsuarioDB {
  id: string;
  usuario: string;
  rol: string;
  fechaCreacion: string;
}

export function UserProfileModal({ esSuperAdmin, nombreUsuario }: UserProfileModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [vista, setVista] = useState<"perfil" | "crear" | "editar">("perfil");
  const [mensaje, setMensaje] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Estados para Crear
  const [nuevoUsuario, setNuevoUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState("visualizador");

  // Estados para Listar
  const [listaUsuarios, setListaUsuarios] = useState<UsuarioDB[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("todos");
  const [cargandoLista, setCargandoLista] = useState(false);

  // Estados para Editar un usuario específico
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioDB | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editPass, setEditPass] = useState("");
  const [editRol, setEditRol] = useState("visualizador");

  useEffect(() => {
    if (vista === "editar" && esSuperAdmin && !usuarioEditando) {
      cargarUsuarios();
    }
  }, [vista, esSuperAdmin, usuarioEditando]);

  const cargarUsuarios = async () => {
    setCargandoLista(true);
    try {
      const res = await fetch("/api/usuarios");
      if (res.ok) {
        const data = await res.json();
        setListaUsuarios(data);
      }
    } catch (error) {
      console.error(error);
    }
    setCargandoLista(false);
  };

  const handleCreateUser = async () => {
    if (!nuevoUsuario.trim() || !password.trim()) {
      setMensaje("Todos los campos son obligatorios."); return;
    }
    setIsLoading(true);
    setMensaje("Creando...");

    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nuevoUsuario, password, rol }),
    });
    const data = await res.json();
    setIsLoading(false);

    if (res.ok) {
      setMensaje("¡Usuario creado con éxito!");
      setNuevoUsuario(""); setPassword(""); setRol("visualizador");
      setTimeout(() => { setVista("perfil"); setMensaje(""); }, 1500);
    } else {
      setMensaje(data.error || "Error al crear");
    }
  };

  const abrirEdicion = (u: UsuarioDB) => {
    setUsuarioEditando(u);
    setEditNombre(u.usuario);
    setEditRol(u.rol);
    setEditPass(""); // La dejamos en blanco
    setMensaje("");
  };

  const handleActualizarUsuario = async () => {
    if (!editNombre.trim()) {
      setMensaje("El nombre no puede estar vacío"); return;
    }
    setIsLoading(true);
    setMensaje("Actualizando...");

    const res = await fetch("/api/usuarios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: usuarioEditando?.id, usuario: editNombre, password: editPass, rol: editRol }),
    });
    const data = await res.json();
    setIsLoading(false);

    if (res.ok) {
      setMensaje("¡Usuario actualizado!");
      setTimeout(() => {
        setUsuarioEditando(null);
        setMensaje("");
      }, 1500);
    } else {
      setMensaje(data.error || "Error al actualizar");
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este usuario? Esta acción no se puede deshacer.")) return;
    const res = await fetch("/api/usuarios", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) cargarUsuarios();
  };

  const cerrarModal = () => {
    setIsOpen(false);
    setTimeout(() => {
      setVista("perfil"); setMensaje(""); setNuevoUsuario(""); setPassword("");
      setBusqueda(""); setFiltroRol("todos"); setUsuarioEditando(null);
    }, 300);
  };

  const usuariosFiltrados = listaUsuarios.filter((u) => {
    const coincideNombre = u.usuario.toLowerCase().includes(busqueda.toLowerCase());
    return coincideNombre && (filtroRol === "todos" || u.rol === filtroRol);
  });

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center rounded-md border border-deinsa-orange bg-neutral-900 px-4 py-1.5 text-sm font-bold text-deinsa-orange transition-all hover:bg-deinsa-orange/10 hover:shadow-[0_0_8px_rgba(255,107,0,0.3)]"
      >
        Perfil
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={cerrarModal}>
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-neutral-800 bg-neutral-950 shadow-xl">
            
            {/* HEADER */}
            <div className="flex items-start justify-between border-b border-neutral-800 px-5 py-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
                  {vista === "perfil" && "Cuenta de Usuario"}
                  {vista === "crear" && "Administración"}
                  {vista === "editar" && "Administración"}
                </label>
                <h2 className="text-base font-medium text-neutral-100">
                  {vista === "perfil" && "Perfil General"}
                  {vista === "crear" && "Crear Nuevo Usuario"}
                  {vista === "editar" && !usuarioEditando && "Usuarios Existentes"}
                  {vista === "editar" && usuarioEditando && "Editar Usuario"}
                </h2>
              </div>
              <button onClick={cerrarModal} className="ml-4 text-neutral-500 hover:text-neutral-200">✕</button>
            </div>

            {/* BODY */}
            <div className="flex-1 overflow-y-auto px-5 py-6">
              
              {/* VISTA 1: PERFIL */}
              {vista === "perfil" && (
                <div className="flex flex-col items-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-neutral-800 bg-neutral-900 text-3xl font-bold text-deinsa-orange uppercase">
                    {nombreUsuario.charAt(0)}
                  </div>
                  <h3 className="text-lg font-bold text-neutral-100 capitalize">{nombreUsuario}</h3>
                  <p className="mb-6 text-sm text-neutral-500">
                    Rol: <span className="text-deinsa-orange">{esSuperAdmin ? "Superusuario" : "Visualizador"}</span>
                  </p>

                  {esSuperAdmin && (
                    <div className="w-full space-y-3 border-t border-neutral-800 pt-6">
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 text-center">Opciones de Administrador</h3>
                      <button onClick={() => setVista("crear")} className="w-full rounded-md border border-neutral-700 bg-neutral-900 py-2 text-sm text-neutral-200 transition-colors hover:border-deinsa-orange hover:text-deinsa-orange">+ Crear Nuevo Usuario</button>
                      <button onClick={() => setVista("editar")} className="w-full rounded-md border border-neutral-800 bg-neutral-950 py-2 text-sm text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-200">Editar Usuarios Existentes</button>
                    </div>
                  )}
                </div>
              )}

              {/* VISTA 2: CREAR */}
              {vista === "crear" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Nombre de Usuario</label>
                    <input value={nuevoUsuario} onChange={(e) => setNuevoUsuario(e.target.value)} placeholder="Ej. Luis Umana" className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Contraseña</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Asigna una contraseña" className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Rol del Usuario</label>
                    <select value={rol} onChange={(e) => setRol(e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange">
                      <option value="visualizador">Visualizador (Solo lectura)</option>
                      <option value="superusuario">Superusuario (Acceso total)</option>
                    </select>
                  </div>
                  {mensaje && <p className={`text-xs mt-2 ${mensaje.includes("éxito") ? "text-green-400" : "text-deinsa-orange"}`}>{mensaje}</p>}
                </div>
              )}

              {/* VISTA 3: LISTA DE USUARIOS */}
              {vista === "editar" && !usuarioEditando && (
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Buscar por nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange" />
                    <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)} className="w-36 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange">
                      <option value="todos">Todos</option>
                      <option value="superusuario">Superusuarios</option>
                      <option value="visualizador">Visualizadores</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2 mt-2 max-h-60 overflow-y-auto pr-1">
                    {cargandoLista ? (
                      <p className="text-sm text-neutral-500 text-center py-4">Cargando usuarios...</p>
                    ) : usuariosFiltrados.length === 0 ? (
                      <p className="text-sm text-neutral-500 text-center py-4">No se encontraron usuarios.</p>
                    ) : (
                      usuariosFiltrados.map((u) => (
                        <div key={u.id} className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-3">
                          <div>
                            <p className="text-sm font-medium text-neutral-200 capitalize">{u.usuario}</p>
                            <p className="text-xs text-neutral-500 capitalize">{u.rol}</p>
                          </div>
                          <div className="flex gap-3">
                            <button onClick={() => abrirEdicion(u)} className="text-xs text-neutral-400 hover:text-deinsa-orange transition">Editar</button>
                            <button onClick={() => handleEliminar(u.id)} className="text-xs text-neutral-500 hover:text-red-400 transition" title="Eliminar usuario">✕</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* VISTA 4: FORMULARIO DE EDICIÓN */}
              {vista === "editar" && usuarioEditando && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Nombre de Usuario</label>
                    <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Nueva Contraseña <span className="lowercase text-neutral-600">(opcional)</span></label>
                    <input type="password" value={editPass} onChange={(e) => setEditPass(e.target.value)} placeholder="Déjalo en blanco para mantener la actual" className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">Rol del Usuario</label>
                    <select value={editRol} onChange={(e) => setEditRol(e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange">
                      <option value="visualizador">Visualizador (Solo lectura)</option>
                      <option value="superusuario">Superusuario (Acceso total)</option>
                    </select>
                  </div>
                  {mensaje && <p className={`text-xs mt-2 ${mensaje.includes("éxito") || mensaje.includes("actualizado") ? "text-green-400" : "text-deinsa-orange"}`}>{mensaje}</p>}
                </div>
              )}
            </div>

            {/* FOOTER */}
            {vista !== "perfil" && (
              <div className="flex items-center justify-end gap-2 border-t border-neutral-800 px-5 py-4">
                <button
                  onClick={() => {
                    if (vista === "editar" && usuarioEditando) {
                      setUsuarioEditando(null); setMensaje(""); // Vuelve a la lista
                    } else {
                      setVista("perfil"); setMensaje(""); // Vuelve al inicio
                    }
                  }}
                  className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                  disabled={isLoading}
                >
                  {vista === "editar" && usuarioEditando ? "Cancelar" : "Volver al perfil"}
                </button>
                
                {vista === "crear" && (
                  <button onClick={handleCreateUser} disabled={isLoading} className="rounded-md bg-deinsa-orange px-4 py-1.5 text-xs font-semibold text-neutral-950 hover:opacity-90 disabled:opacity-50">
                    Guardar usuario
                  </button>
                )}

                {vista === "editar" && usuarioEditando && (
                  <button onClick={handleActualizarUsuario} disabled={isLoading} className="rounded-md bg-deinsa-orange px-4 py-1.5 text-xs font-semibold text-neutral-950 hover:opacity-90 disabled:opacity-50">
                    Actualizar
                  </button>
                )}
              </div>
            )}
            
          </div>
        </div>
      )}
    </>
  );
}