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

export type CardItem = {
  id: string;
  name: string;
  columnId: string;
  createdAt: string;
  comments: Comment[];
  contact?: Contact | null;
};

export type Column = {
  id: string;
  label: string;
};
