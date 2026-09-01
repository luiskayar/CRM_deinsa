import { CardItem, Contact } from "./types";

// Tarjetas guardadas antes de RF-01b traen un solo `contact`; las nuevas
// usan `contacts[]`. Este helper centraliza la lectura para no perder los
// contactos ya existentes en Firestore.
export function getCardContacts(card: CardItem): Contact[] {
  if (card.contacts && card.contacts.length > 0) return card.contacts;
  if (card.contact) return [card.contact];
  return [];
}
