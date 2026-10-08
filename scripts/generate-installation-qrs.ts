/**
 * Generate PNG QR codes for every installation in the seed catalog.
 *
 * Usage (after Vercel deploy):
 *   VITE_PUBLIC_SITE_URL=https://your-app.vercel.app npm run generate:qr
 *
 * Output default: ~/Desktop/Harring Studios/QR CODES
 * Override: QR_OUTPUT_DIR=/path/to/folder
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import QRCode from 'qrcode';
import { readFileSync, existsSync } from 'node:fs';
import { INSTALLATION_SEED_RECORDS } from '../src/lib/installations/seedData';
import { installationDetailPath } from '../src/lib/taskboard/driveConstants';
import { buildPrintableQrSections } from './build-printable-qr-sections';
import {
  PRINTABLE_A4_QR_PDF_FILENAME,
  writePrintableA4QrListPdf,
} from './installation-qr-printable-pdf';

const DEFAULT_OUTPUT = join(homedir(), 'Desktop', 'Harring Studios', 'QR CODES');

function loadEnvFile() {
  const path = join(process.cwd(), '.env');
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function resolveSiteUrl(): string {
  loadEnvFile();
  const fromEnv = process.env.VITE_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (!fromEnv?.trim()) {
    console.error(
      'Missing production URL. Set VITE_PUBLIC_SITE_URL (in .env or env) to your live site, e.g.\n' +
        '  VITE_PUBLIC_SITE_URL=https://your-app.vercel.app npm run generate:qr',
    );
    process.exit(1);
  }
  const url = fromEnv.trim().replace(/\/$/, '');
  if (url.includes('your-app.vercel.app')) {
    console.error(
      'VITE_PUBLIC_SITE_URL is still the .env.example placeholder.\n' +
        'Set it to your live domain, e.g. VITE_PUBLIC_SITE_URL=https://headlightrabbits.com',
    );
    process.exit(1);
  }
  return url;
}

function pngFilename(id: string, name: string) {
  const suffix = name
    .slice(0, 48)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return suffix ? `${id}--${suffix}.png` : `${id}.png`;
}

async function main() {
  const siteUrl = resolveSiteUrl();
  const outDir = process.env.QR_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT;
  await mkdir(outDir, { recursive: true });

  const indexLines: string[] = [
    '# Installation QR codes',
    `# Site: ${siteUrl}`,
    `# Generated: ${new Date().toISOString()}`,
    '',
    'name\tid\turl\tfile',
  ];

  for (const installation of INSTALLATION_SEED_RECORDS) {
    const url = `${siteUrl}${installationDetailPath(installation.id)}`;
    const file = pngFilename(installation.id, installation.name);
    const filePath = join(outDir, file);

    await QRCode.toFile(filePath, url, {
      type: 'png',
      width: 600,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    indexLines.push(`${installation.name}\t${installation.id}\t${url}\t${file}`);
    console.log(file);
    console.log(`  → ${url}`);
  }

  await writeFile(join(outDir, 'urls.txt'), `${indexLines.join('\n')}\n`, 'utf8');

  const pdfPath = join(outDir, PRINTABLE_A4_QR_PDF_FILENAME);
  const sections = await buildPrintableQrSections(INSTALLATION_SEED_RECORDS, outDir);
  await writePrintableA4QrListPdf(pdfPath, sections);

  console.log(`\nWrote ${INSTALLATION_SEED_RECORDS.length} PNGs to:\n  ${outDir}`);
  console.log(`Printable A4 PDF:\n  ${pdfPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
