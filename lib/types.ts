export type BoardType = "negociaciones" | "alianzas";

export type Pipeline = {
  /** Slug generado a partir del nombre; también es el id del documento y el segmento de la URL. */
  id: string;
  name: string;
  createdAt?: string;
};

export type Comment = {
  id: string;
  text: string;
  createdAt: string;
};

// Un dato faltante (p. ej. importado desde Excel sin correo) se guarda como null.
export type Contact = {
  name: string | null;
  role: string | null;
  email: string | null;
  countryCode: string;
  phone: string | null;
};

export type NegotiationStatus = "pausada" | "activa" | "muyActiva";

export type CardItem = {
  id: string;
  name: string;
  columnId: string;
  createdAt: string;
  comments: Comment[];
  /** @deprecated usa `contacts`; se conserva para leer tarjetas guardadas antes de RF-01b. */
  contact?: Contact | null;
  contacts?: Contact[];
  status?: NegotiationStatus;
  /** Ausente en tarjetas creadas antes de los pipelines (5.2.2): se leen como DEFAULT_PIPELINE. */
  pipelineId?: string;
};

export type Column = {
  id: string;
  label: string;
};
