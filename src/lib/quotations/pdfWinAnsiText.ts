import { Encodings } from '@pdf-lib/standard-fonts';

const winAnsi = Encodings.WinAnsi;

const REPLACEMENTS: Record<number, string> = {
  0x2014: '-', // em dash
  0x2013: '-', // en dash
  0x2212: '-', // minus
  0x2026: '...',
  0x00a0: ' ', // nbsp
};

/** Strip/replace characters StandardFonts (WinAnsi) cannot render. */
export function pdfWinAnsiText(value: string): string {
  let out = '';
  for (const ch of value) {
    const cp = ch.codePointAt(0)!;
    const replacement = REPLACEMENTS[cp];
    if (replacement !== undefined) {
      out += replacement;
      continue;
    }
    if (winAnsi.canEncodeUnicodeCodePoint(cp)) {
      out += ch;
    }
  }
  return out;
}
