export type BoardType = "negociaciones" | "alianzas";

export type Comment = {
  id: string;
  text: string;
  createdAt: string;
};

export type CardItem = {
  id: string;
  name: string;
  columnId: string;
  createdAt: string;
  comments: Comment[];
};

export type Column = {
  id: string;
  label: string;
};
