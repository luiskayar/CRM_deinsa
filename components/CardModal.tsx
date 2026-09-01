"use client";

import { useState } from "react";
import { CardItem, Comment, Contact, NegotiationStatus } from "@/lib/types";
import { COUNTRY_CODES, STATUS_CONFIG } from "@/lib/constants";
import { getCardContacts } from "@/lib/contact";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CardModal({
  card,
  itemLabel,
  itemOfPhrase,
  onClose,
  onSave,
  onDelete,
}: {
  card: CardItem;
  itemLabel: string;
  itemOfPhrase: string;
  onClose: () => void;
  onSave: (
    cardId: string,
    updates: {
      name?: string;
      comments?: Comment[];
      newComments?: string[];
      contacts?: Contact[];
      status?: NegotiationStatus | null;
    }
  ) => void;
  onDelete: (cardId: string) => void;
}) {
  const [name, setName] = useState(card.name);
  const [comments, setComments] = useState<Comment[]>(card.comments);
  const [draftComments, setDraftComments] = useState<string[]>([]);
  const [commentText, setCommentText] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [status, setStatus] = useState<NegotiationStatus | null>(card.status ?? null);

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value as NegotiationStatus | "";
    const newStatus = value === "" ? null : value;
    setStatus(newStatus);
    await onSave(card.id, { status: newStatus });
  }

  const initialContacts = getCardContacts(card);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  // null = lista cerrada; "new" = agregando; number = editando ese índice.
  const [editingIndex, setEditingIndex] = useState<number | "new" | null>(
    initialContacts.length === 0 ? "new" : null
  );
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactCountryCode, setContactCountryCode] = useState(COUNTRY_CODES[0].code);
  const [contactCountryIso, setContactCountryIso] = useState(COUNTRY_CODES[0].iso);
  const [contactPhone, setContactPhone] = useState("");
  const [contactError, setContactError] = useState<string | null>(null);

  function resetContactForm() {
    setContactName("");
    setContactRole("");
    setContactEmail("");
    setContactCountryCode(COUNTRY_CODES[0].code);
    setContactCountryIso(COUNTRY_CODES[0].iso);
    setContactPhone("");
    setContactError(null);
  }

  function handleContactCountryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const iso = e.target.value;
    const entry = COUNTRY_CODES.find((c) => c.iso === iso);
    setContactCountryIso(iso);
    if (entry) {
      setContactCountryCode(entry.code);
    }
  }

  function handleAddContactClick() {
    resetContactForm();
    setEditingIndex("new");
  }

  function handleEditContactClick(index: number) {
    const target = contacts[index];
    setContactName(target.name);
    setContactRole(target.role);
    setContactEmail(target.email);
    setContactCountryCode(target.countryCode);
    setContactCountryIso(
      COUNTRY_CODES.find((c) => c.code === target.countryCode)?.iso ??
        COUNTRY_CODES[0].iso
    );
    setContactPhone(target.phone);
    setContactError(null);
    setEditingIndex(index);
  }

  function handleCancelContactForm() {
    setContactError(null);
    setEditingIndex(null);
  }

  async function handleSaveContact() {
    const trimmedName = contactName.trim();
    if (!trimmedName) {
      setContactError("El nombre es obligatorio.");
      return;
    }
    const trimmedEmail = contactEmail.trim();
    if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
      setContactError("El correo electrónico no tiene un formato válido.");
      return;
    }

    const newContact: Contact = {
      name: trimmedName,
      role: contactRole.trim(),
      email: trimmedEmail,
      countryCode: contactCountryCode,
      phone: contactPhone.trim(),
    };

    const updatedContacts =
      editingIndex === "new"
        ? [...contacts, newContact]
        : contacts.map((c, i) => (i === editingIndex ? newContact : c));

    setContactError(null);
    await onSave(card.id, { contacts: updatedContacts });
    setContacts(updatedContacts);
    setEditingIndex(null);
  }

  async function handleDeleteContact(index: number) {
    const updatedContacts = contacts.filter((_, i) => i !== index);
    await onSave(card.id, { contacts: updatedContacts });
    setContacts(updatedContacts);
    if (editingIndex === index) {
      resetContactForm();
      setEditingIndex(null);
    }
  }

  function renderContactForm() {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-neutral-800 bg-neutral-900 p-3">
        <input
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="Nombre completo"
          className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange"
        />
        <input
          value={contactRole}
          onChange={(e) => setContactRole(e.target.value)}
          placeholder="Puesto"
          className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange"
        />
        <input
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          type="email"
          placeholder="Correo electrónico"
          className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange"
        />
        <div className="flex gap-2">
          <select
            value={contactCountryIso}
            onChange={handleContactCountryChange}
            className="w-36 min-w-0 shrink-0 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.country} ({c.code})
              </option>
            ))}
          </select>
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Teléfono"
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange"
          />
        </div>
        {contactError && <p className="text-xs text-red-400">{contactError}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleCancelContactForm}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveContact}
            className="rounded-md bg-deinsa-orange px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-deinsa-orange-dark hover:text-neutral-100"
          >
            Guardar contacto
          </button>
        </div>
      </div>
    );
  }

  function addDraftComment() {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    setDraftComments((prev) => [...prev, trimmed]);
    setCommentText("");
  }

  function deleteComment(commentId: string) {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  function deleteDraftComment(index: number) {
    setDraftComments((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    onSave(card.id, { 
      name: name.trim() || card.name, 
      comments: comments, 
      newComments: draftComments 
    });
    onClose();
  }

  function handleDelete() {
    onDelete(card.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-neutral-800 bg-neutral-950 shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-neutral-800 px-5 py-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
              Nombre {itemOfPhrase} {itemLabel}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-base font-medium text-neutral-100 outline-none focus:border-deinsa-orange"
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              Creada el {formatDateTime(card.createdAt)}
            </p>
            <div className="mt-2">
              <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
                Estado
              </label>
              <select
                value={status ?? ""}
                onChange={handleStatusChange}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange"
              >
                <option value="">Sin estado</option>
                {(Object.keys(STATUS_CONFIG) as NegotiationStatus[]).map((key) => (
                  <option key={key} value={key}>
                    {STATUS_CONFIG[key].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-neutral-500 hover:text-neutral-200"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Contactos
          </h3>
          <div className="flex flex-col gap-2">
            {contacts.map((c, index) =>
              editingIndex === index ? (
                <div key={index}>{renderContactForm()}</div>
              ) : (
                <div
                  key={index}
                  className="flex items-start justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-neutral-200">
                      {c.name}
                      {c.role && <span className="text-neutral-500"> — {c.role}</span>}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">{c.email || "Sin correo"}</p>
                    <p className="text-xs text-neutral-500">
                      {c.countryCode} {c.phone || "Sin teléfono"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      onClick={() => handleEditContactClick(index)}
                      className="text-xs text-neutral-400 hover:text-deinsa-orange"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteContact(index)}
                      className="text-neutral-500 hover:text-red-400"
                      aria-label="Eliminar contacto"
                      title="Eliminar contacto"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            )}

            {editingIndex === "new" && renderContactForm()}

            {contacts.length === 0 && editingIndex === null && (
              <p className="text-sm text-neutral-600">Todavía no hay contactos.</p>
            )}
          </div>

          {editingIndex === null && (
            <button
              onClick={handleAddContactClick}
              className="mt-2 w-full rounded-md border border-dashed border-neutral-700 py-1.5 text-xs text-neutral-400 hover:border-deinsa-orange hover:text-deinsa-orange"
            >
              + Agregar contacto
            </button>
          )}

          <h3 className="mb-2 mt-5 border-t border-neutral-800 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Historial de comentarios
          </h3>
          <div className="flex flex-col gap-2">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="flex items-start justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2"
              >
                <div>
                  <p className="text-sm text-neutral-200">{comment.text}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatDateTime(comment.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => deleteComment(comment.id)}
                  className="text-neutral-500 hover:text-red-400"
                  aria-label="Eliminar comentario"
                  title="Eliminar comentario"
                >
                  ✕
                </button>
              </div>
            ))}
            {draftComments.map((text, i) => (
              <div
                key={`draft-${i}`}
                className="flex items-start justify-between gap-3 rounded-md border border-deinsa-orange/40 bg-deinsa-orange/5 px-3 py-2"
              >
                <div>
                  <p className="text-sm text-neutral-200">{text}</p>
                  <p className="mt-1 text-xs text-deinsa-orange">Sin guardar</p>
                </div>
                <button
                  onClick={() => deleteDraftComment(i)}
                  className="text-neutral-500 hover:text-red-400"
                  aria-label="Eliminar comentario"
                  title="Eliminar comentario"
                >
                  ✕
                </button>
              </div>
            ))}
            {comments.length === 0 && draftComments.length === 0 && (
              <p className="text-sm text-neutral-600">Todavía no hay comentarios.</p>
            )}
          </div>
        </div>

        <div className="border-t border-neutral-800 px-5 py-4">
          <label className="mb-1.5 block text-xs uppercase tracking-wide text-neutral-500">
            Agregar comentario
          </label>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={2}
            placeholder="Escribe un comentario..."
            className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-deinsa-orange"
          />
          <div className="mt-2 flex justify-between">
            <button
              onClick={addDraftComment}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-deinsa-orange hover:text-deinsa-orange"
            >
              Agregar comentario
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
              >
                Cerrar sin guardar
              </button>
              <button
                onClick={handleSave}
                className="rounded-md bg-deinsa-orange px-4 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-deinsa-orange-dark hover:text-neutral-100"
              >
                Guardar
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-neutral-800 pt-3">
            {confirmingDelete ? (
              <div className="flex w-full items-center justify-between">
                <span className="text-xs text-neutral-400">
                  ¿Eliminar esta {itemLabel} permanentemente?
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-neutral-50 hover:bg-red-700"
                  >
                    Sí, eliminar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Eliminar {itemLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}