export type BoardType = "negociaciones" | "alianzas";

export type Comment = {
  id: string;
  text: string;
  createdAt: string;
};

export type Contact = {
  name: string;
  role: string;
  email: string;
  countryCode: string;
  phone: string;
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
};

export type Column = {
  id: string;
  label: string;
};
