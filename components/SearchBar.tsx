"use client";

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full max-w-sm">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Buscar..."}
        aria-label="Buscar"
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 pr-8 text-sm text-neutral-100 outline-none focus:border-deinsa-orange"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          title="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200"
        >
          ✕
        </button>
      )}
    </div>
  );
}
