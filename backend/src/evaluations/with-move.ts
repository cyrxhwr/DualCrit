/**
 * Fold the model's closing move into the prose a student reads.
 *
 * The move is asked for as its own key so the model cannot quietly drop it.
 * Asked for inside the prose instead, it went missing on about a third of
 * rubric entries — and most often on the low scores, which are exactly the
 * ones where knowing what to do next matters.
 *
 * Students never see two fields: the join happens here, before anything is
 * stored, so `reason` and `response` stay single blocks of text everywhere
 * downstream — the cards, the markdown summary, and the stored evaluation.
 */
export function withMove(text: string | undefined, move?: string): string {
  const body = (text ?? '').trim();
  const tail = (move ?? '').trim();

  if (!tail) return body;
  if (!body) return tail;

  // Only add a full stop when the model left the sentence unterminated.
  return /[.!?]["')\]]?$/.test(body) ? `${body} ${tail}` : `${body}. ${tail}`;
}
