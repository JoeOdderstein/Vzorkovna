import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { groupInstallationsByLocation } from '../src/lib/installations/constants';
import type { InstallationRecord } from '../src/lib/installations/types';
import type { PrintableQrSection } from './installation-qr-printable-pdf';

export function pngFilename(id: string, name: string) {
  const suffix = name
    .slice(0, 48)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return suffix ? `${id}--${suffix}.png` : `${id}.png`;
}

export async function buildPrintableQrSections(
  installations: InstallationRecord[],
  outDir: string,
  options?: { verifyPngExists?: boolean },
): Promise<PrintableQrSection[]> {
  const verify = options?.verifyPngExists ?? false;
  const groups = groupInstallationsByLocation(installations);
  const sections: PrintableQrSection[] = [];

  for (const group of groups) {
    const entries = [];
    for (const installation of group.installations) {
      const pngPath = join(outDir, pngFilename(installation.id, installation.name));
      if (verify) {
        await access(pngPath);
      }
      entries.push({ name: installation.name, pngPath });
    }
    sections.push({ title: group.label, entries });
  }

  return sections;
}
