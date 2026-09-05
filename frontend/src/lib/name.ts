/**
 * The letter to put in a transcript avatar.
 *
 * Takes the first character rather than initials of every word — a single
 * glyph is all that fits, and student names here are not reliably
 * "First Last". Iterating the string rather than indexing it keeps accented
 * and non-Latin first letters intact, which `name[0]` would split.
 */
export function initialOf(name: string | null | undefined): string {
  const first = [...(name ?? '').trim()][0];
  return first ? first.toLocaleUpperCase() : '?';
}
