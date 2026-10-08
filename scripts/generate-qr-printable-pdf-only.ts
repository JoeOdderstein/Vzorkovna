/**
 * Build printable A4 PDF from existing PNGs in the QR output folder (no regeneration).
 *
 *   npm run generate:qr-pdf
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import { INSTALLATION_SEED_RECORDS } from '../src/lib/installations/seedData';
import { buildPrintableQrSections } from './build-printable-qr-sections';
import {
  PRINTABLE_A4_QR_PDF_FILENAME,
  writePrintableA4QrListPdf,
} from './installation-qr-printable-pdf';

const DEFAULT_OUTPUT = join(homedir(), 'Desktop', 'Harring Studios', 'QR CODES');

async function main() {
  const outDir = process.env.QR_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT;

  let sections;
  try {
    sections = await buildPrintableQrSections(INSTALLATION_SEED_RECORDS, outDir, {
      verifyPngExists: true,
    });
  } catch {
    console.error(`Missing PNG (run npm run generate:qr first) in:\n  ${outDir}`);
    process.exit(1);
  }

  const pdfPath = join(outDir, PRINTABLE_A4_QR_PDF_FILENAME);
  await writePrintableA4QrListPdf(pdfPath, sections);
  const count = sections.reduce((n, s) => n + s.entries.length, 0);
  console.log(`Wrote ${count} QR codes (30×30 mm) to:\n  ${pdfPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
