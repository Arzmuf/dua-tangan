/** Neutral, public places suggested for handoffs: busy, staffed, and nobody's home turf. */
export const SAFE_PLACES = [
  { emoji: '🏬', name: 'Pondok Indah Mall, main lobby' },
  { emoji: '🏬', name: 'Grand Indonesia, main lobby' },
  { emoji: '🏬', name: 'Gandaria City, main lobby' },
  { emoji: '🌳', name: 'Taman Suropati, main gate' },
  { emoji: '🌳', name: 'Taman Langsat, front entrance' },
  { emoji: '🚉', name: 'Gambir Station, main hall' },
];

const PRIVATE_PLACE = /\b(home|house|apartment|apartemen|flat|condo|rumah|kos|kost|kontrakan)\b|\b(my|your|his|her)\s+place\b|'s\s+place\b/i;

/** True when a meeting place sounds like someone's home rather than a public space. */
export function soundsPrivate(place: string): boolean {
  return PRIVATE_PLACE.test(place);
}
