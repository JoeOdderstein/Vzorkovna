import { buildImportedQuotationDraft } from './buildImportedDraft';

/** Budget lines from `Krakow-Feed-the-Dragon-Quotation-proposal` PDF (narrative sections omitted). */
export function krakowFeedTheDragonQuotationDraft(
  projectId: string,
  sourceInvoiceId: string,
) {
  return buildImportedQuotationDraft({
    project_id: projectId,
    source_invoice_id: sourceInvoiceId,
    title: 'Feed the Dragon — quotation outline',
    subtitle:
      'Imported from PDF. Kraków Ribs · Amounts excl. VAT · Total estimate €16,602 (excl. expansion options).',
    day_rate: 700,
    contingency_rate: 0,
    sections: [
      {
        heading: '1. Show control system & main dragon head',
        parts: [
          {
            subLabel: 'Main system & lights',
            category: 'materials',
            subtotalLabel: 'Subtotal main system & lights',
            lines: [
              { label: 'Raspberry Pi 4 model B — 4GB', unit_price: 99.2, quantity: 1 },
              { label: 'Power supply and storage', unit_price: 41.3, quantity: 1 },
              { label: '4× LED lights in dragon head', unit_price: 124, quantity: 1 },
              { label: 'Smoke geyser', unit_price: 454.5, quantity: 1 },
              { label: '2× pistons for moving dragon head', unit_price: 165.3, quantity: 1 },
              { label: 'Unexpected costs', unit_price: 168.76, quantity: 1 },
            ],
          },
          {
            subLabel: 'Audio',
            category: 'materials',
            subtotalLabel: 'Subtotal audio',
            lines: [
              { label: '4× JBL 305P MKII speakers', unit_price: 393.4, quantity: 1 },
              { label: 'Devine RX-10SA subwoofer', unit_price: 205.79, quantity: 1 },
              { label: 'Focusrite Clarett+ 2Pre', unit_price: 255.37, quantity: 1 },
              { label: '4× speaker mounts', unit_price: 56.38, quantity: 1 },
              { label: '5× XLR cables', unit_price: 85, quantity: 1 },
              { label: '5× power cables', unit_price: 80, quantity: 1 },
              { label: 'Unforeseen', unit_price: 100, quantity: 1 },
            ],
          },
          {
            subLabel: 'Dragon head design',
            category: 'materials',
            subtotalLabel: 'Subtotal dragon head design',
            lines: [
              {
                label: 'Budget for main dragon look (placeholder)',
                notes: 'Art direction / fabrication TBD',
                unit_price: 2000,
                quantity: 1,
              },
            ],
          },
          {
            subLabel: 'Manhours',
            category: 'labour',
            subtotalLabel: 'Subtotal manhours',
            lines: [
              { label: 'Creative hours — dragon sound effects', unit_price: 500, quantity: 1 },
              {
                label: '5 days installing in Kraków (Gus & Joost)',
                unit_price: 3500,
                quantity: 1,
              },
              { label: 'Project development & research fee', unit_price: 1000, quantity: 1 },
            ],
          },
        ],
      },
      {
        heading: '2. Rib presentation pieces (20 units)',
        parts: [
          {
            subLabel: 'Gear',
            category: 'materials',
            subtotalLabel: 'Subtotal gear',
            lines: [
              { label: '3D printing costs', unit_price: 11, quantity: 20 },
              {
                label: 'Assembling 3D prints',
                notes: '€350 per day',
                unit_price: 700,
                quantity: 1,
              },
            ],
          },
          {
            subLabel: 'Manhours',
            category: 'labour',
            subtotalLabel: 'Subtotal manhours',
            lines: [
              {
                label: 'Creative hours — rib presentation tray',
                unit_price: 500,
                quantity: 1,
              },
            ],
          },
        ],
      },
      {
        heading: '3. Small dragon heads (10 units)',
        parts: [
          {
            subLabel: 'Gear',
            category: 'materials',
            subtotalLabel: 'Subtotal gear',
            lines: [
              { label: 'Raspberry Pi 4 model B — 1GB', unit_price: 33, quantity: 10 },
              { label: 'Raspberry Pi supplies', unit_price: 41.3, quantity: 10 },
              { label: 'Weight sensor system', unit_price: 33, quantity: 10 },
              { label: 'LED lights', unit_price: 41.3, quantity: 10 },
              { label: 'Sound speaker', unit_price: 24.7, quantity: 10 },
              { label: 'Small smoke system', unit_price: 12.3, quantity: 10 },
              { label: '3D printing materials', unit_price: 24.7, quantity: 10 },
              { label: 'Unforeseen', unit_price: 10, quantity: 10 },
            ],
          },
          {
            subLabel: 'Manhours',
            category: 'labour',
            subtotalLabel: 'Subtotal manhours',
            lines: [
              { label: 'Designing sounds', unit_price: 1000, quantity: 1 },
              { label: 'Designing 3D model — small dragon heads', unit_price: 1000, quantity: 1 },
              {
                label: 'Ensembling technology parts',
                notes: '5 days',
                unit_price: 1750,
                quantity: 1,
              },
            ],
          },
        ],
      },
    ],
  });
}
