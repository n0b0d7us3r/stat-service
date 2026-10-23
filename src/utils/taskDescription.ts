const IMAGE_MARKDOWN_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g;

export const TASK_DESCRIPTION_MAX_LENGTH = 50_000;

export function insertTextAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
  onChange: (next: string) => void,
): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
  onChange(next);

  requestAnimationFrame(() => {
    const cursor = start + text.length;
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('image-read-failed'));
        return;
      }

      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('image-read-failed'));
    reader.readAsDataURL(file);
  });
}

export type TaskDescriptionBlock =
  | { type: 'text'; value: string }
  | { type: 'image'; alt: string; url: string };

export function parseTaskDescriptionBlocks(text: string): TaskDescriptionBlock[] {
  if (!text) {
    return [];
  }

  const blocks: TaskDescriptionBlock[] = [];
  let lastIndex = 0;
  const pattern = new RegExp(IMAGE_MARKDOWN_PATTERN.source, 'g');

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      blocks.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    blocks.push({
      type: 'image',
      alt: match[1] ?? '',
      url: match[2] ?? '',
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    blocks.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return blocks;
}

export function descriptionHasImages(text: string): boolean {
  return /!\[[^\]]*\]\([^)]+\)/.test(text);
}

export type TaskDescriptionInlineSegment =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'upper'; value: string };

const INLINE_MARKUP_PATTERN = /\*\*([^*]+)\*\*|\*([^*]+)\*|\^\^([^^]+)\^\^/g;

export function parseTaskDescriptionInline(text: string): TaskDescriptionInlineSegment[] {
  if (!text) {
    return [];
  }

  const segments: TaskDescriptionInlineSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_MARKUP_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    if (match[1] !== undefined) {
      segments.push({ type: 'strong', value: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ type: 'em', value: match[2] });
    } else if (match[3] !== undefined) {
      segments.push({ type: 'upper', value: match[3] });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}
