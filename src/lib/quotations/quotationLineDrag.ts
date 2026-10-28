import type { QuotationLineInput, QuotationSectionCategory } from './types';

export type QuotationLineWithDragKey = QuotationLineInput & { dragKey: string };

export function quotationDragKeyForLine(line: QuotationLineInput, index: number): string {
  return line.id ?? `line-${index}-${line.sort_order}`;
}

export function attachDragKeys(lines: QuotationLineInput[]): QuotationLineWithDragKey[] {
  const seen = new Set<string>();
  return lines.map((line, index) => {
    let dragKey = line.id ?? crypto.randomUUID();
    while (seen.has(dragKey)) {
      dragKey = crypto.randomUUID();
    }
    seen.add(dragKey);
    return { ...line, dragKey };
  });
}

export function stripDragKeys(lines: QuotationLineWithDragKey[]): QuotationLineInput[] {
  return lines.map(({ dragKey: _dragKey, ...line }) => line);
}

export function reindexQuotationLines<T extends QuotationLineInput>(lines: T[]): T[] {
  return lines.map((line, index) => ({ ...line, sort_order: index }));
}

export function sectionCategoryAtIndex(
  lines: QuotationLineInput[],
  lineIndex: number,
): QuotationSectionCategory | null {
  for (let i = lineIndex; i >= 0; i -= 1) {
    const row = lines[i];
    if (row.kind === 'section') {
      return row.section_category ?? 'other';
    }
  }
  return null;
}

/** Index to insert a line before this section's subtotal row. */
export function insertIndexBeforeSectionSubtotal(
  lines: QuotationLineInput[],
  sectionHeaderIndex: number,
): number {
  for (let i = sectionHeaderIndex + 1; i < lines.length; i += 1) {
    if (lines[i].kind === 'subtotal') return i;
    if (lines[i].kind === 'section' || lines[i].kind === 'summary') break;
  }
  return sectionHeaderIndex + 1;
}

export function isQuotationLineDraggable(line: QuotationLineInput): boolean {
  return line.kind === 'line';
}

export function moveQuotationLine(
  lines: QuotationLineWithDragKey[],
  activeDragKey: string,
  overId: string,
): QuotationLineWithDragKey[] {
  const fromIndex = lines.findIndex((line) => line.dragKey === activeDragKey);
  if (fromIndex < 0 || !isQuotationLineDraggable(lines[fromIndex])) {
    return lines;
  }

  let toIndex: number | null = null;

  if (overId.startsWith('section-')) {
    const sectionIndex = Number(overId.slice('section-'.length));
    if (!Number.isFinite(sectionIndex) || sectionIndex < 0 || sectionIndex >= lines.length) {
      return lines;
    }
    if (lines[sectionIndex]?.kind !== 'section') return lines;
    toIndex = insertIndexBeforeSectionSubtotal(lines, sectionIndex);
  } else {
    const overIndex = lines.findIndex((line) => line.dragKey === overId);
    if (overIndex < 0) return lines;
    if (lines[overIndex].kind === 'line') {
      toIndex = overIndex;
    } else if (lines[overIndex].kind === 'section') {
      toIndex = insertIndexBeforeSectionSubtotal(lines, overIndex);
    } else {
      return lines;
    }
  }

  if (toIndex == null) return lines;

  const next = [...lines];
  const [moved] = next.splice(fromIndex, 1);
  let insertAt = toIndex;
  if (fromIndex < insertAt) insertAt -= 1;
  next.splice(insertAt, 0, moved);

  const category = sectionCategoryAtIndex(next, insertAt);
  next[insertAt] = {
    ...moved,
    section_category: category ?? moved.section_category ?? 'other',
  };

  return reindexQuotationLines(next);
}

export function lineSortableIds(lines: QuotationLineWithDragKey[]): string[] {
  return lines.filter(isQuotationLineDraggable).map((line) => line.dragKey);
}

export function removeQuotationLineAt(
  lines: QuotationLineWithDragKey[],
  index: number,
): QuotationLineWithDragKey[] {
  if (index < 0 || index >= lines.length) return lines;
  if (!isQuotationLineDraggable(lines[index])) return lines;
  const next = [...lines.slice(0, index), ...lines.slice(index + 1)];
  return reindexQuotationLines(next);
}
