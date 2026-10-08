/**
 * Excel list of installations by location with an empty URL column to fill in.
 *
 *   npm run generate:installation-urls
 *
 * Default output: ~/Desktop/Harring Studios/installation-urls.xlsx
 * Override: INSTALLATION_URLS_XLSX=/path/to/file.xlsx
 */
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import * as XLSX from 'xlsx';
import { groupInstallationsByLocation } from '../src/lib/installations/constants';
import { INSTALLATION_SEED_RECORDS } from '../src/lib/installations/seedData';

const DEFAULT_OUTPUT = join(homedir(), 'Desktop', 'Harring Studios', 'installation-urls.xlsx');

async function main() {
  const outPath = process.env.INSTALLATION_URLS_XLSX?.trim() || DEFAULT_OUTPUT;
  await mkdir(dirname(outPath), { recursive: true });

  const rows: string[][] = [['Location', 'Installation name', 'Installation ID', 'URL']];

  for (const group of groupInstallationsByLocation(INSTALLATION_SEED_RECORDS)) {
    for (const installation of group.installations) {
      rows.push([group.label, installation.name, installation.id, '']);
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 18 }, { wch: 58 }, { wch: 32 }, { wch: 64 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Installations');
  XLSX.writeFile(workbook, outPath);

  console.log(`Wrote ${rows.length - 1} installations to:\n  ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
