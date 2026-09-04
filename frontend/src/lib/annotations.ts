import type { Annotation, InterviewMessage } from './api';

export interface Segment {
  text: string;
  annotation: Annotation | null;
}

export interface AnnotatedMessage {
  message: InterviewMessage;
  segments: Segment[];
  /** Annotations for this message whose quote could not be located in it. */
  unanchored: Annotation[];
}

/**
 * Normalise for matching without changing string length.
 *
 * Every substitution here is one character for one, and `toLowerCase` leaves
 * ordinary text the same length — so an index found in the normalised copy is
 * still valid in the original. That is what lets a fuzzy match drive an exact
 * slice.
 */
function norm(value: string): string {
  return value
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ')
    .toLowerCase();
}

function findQuote(text: string, quote: string): number {
  const trimmed = quote.trim();
  if (!trimmed) return -1;

  const direct = text.indexOf(trimmed);
  if (direct !== -1) return direct;

  return norm(text).indexOf(norm(trimmed));
}

/**
 * Attach each annotation to the text it refers to.
 *
 * A model cannot be relied on to reproduce a quote character for character,
 * so nothing here depends on that. If the quote is not found in the message
 * the model named, every other student message is tried; if it is nowhere,
 * the annotation still shows against its message without a highlight. The
 * feedback is never dropped just because the anchor failed.
 */
export function annotateTranscript(
  messages: InterviewMessage[],
  annotations: Annotation[],
): AnnotatedMessage[] {
  const byMessage = new Map<number, { annotation: Annotation; at: number }[]>();
  const unanchoredBy = new Map<number, Annotation[]>();

  for (const annotation of annotations) {
    let index = annotation.messageIndex;
    let at =
      messages[index] !== undefined
        ? findQuote(messages[index].text, annotation.quote)
        : -1;

    // The model got the index wrong but the quote is real — find its home.
    if (at === -1) {
      const found = messages.findIndex(
        (m, i) =>
          m.role === 'student' &&
          i !== annotation.messageIndex &&
          findQuote(m.text, annotation.quote) !== -1,
      );
      if (found !== -1) {
        index = found;
        at = findQuote(messages[found].text, annotation.quote);
      }
    }

    if (at === -1) {
      const list = unanchoredBy.get(index) ?? [];
      list.push(annotation);
      unanchoredBy.set(index, list);
      continue;
    }

    const list = byMessage.get(index) ?? [];
    list.push({ annotation, at });
    byMessage.set(index, list);
  }

  return messages.map((message, index) => {
    const hits = (byMessage.get(index) ?? []).sort((a, b) => a.at - b.at);
    const segments: Segment[] = [];
    let cursor = 0;

    for (const { annotation, at } of hits) {
      // Overlapping highlights would produce nonsense; keep the first.
      if (at < cursor) continue;

      const length = annotation.quote.trim().length;
      if (at > cursor) {
        segments.push({ text: message.text.slice(cursor, at), annotation: null });
      }
      segments.push({
        text: message.text.slice(at, at + length),
        annotation,
      });
      cursor = at + length;
    }

    if (cursor < message.text.length) {
      segments.push({ text: message.text.slice(cursor), annotation: null });
    }

    return {
      message,
      segments: segments.length > 0 ? segments : [{ text: message.text, annotation: null }],
      unanchored: unanchoredBy.get(index) ?? [],
    };
  });
}
