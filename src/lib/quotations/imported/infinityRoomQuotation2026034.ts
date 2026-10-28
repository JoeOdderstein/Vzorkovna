import { buildImportedQuotationDraft } from './buildImportedDraft';

/** Parsed from uploaded PDF `Infinity-Room-Quotation_2026034.1.pdf` (invoice area). */
export function infinityRoomQuotation2026034Draft(
  projectId: string,
  sourceInvoiceId: string,
) {
  return buildImportedQuotationDraft({
    project_id: projectId,
    source_invoice_id: sourceInvoiceId,
    title: 'Quotation 2026034.1 — Infinity Room',
    subtitle:
      'Imported from PDF. Client: Old Square Bar 1401 s.r.o · Ref INFINITY ROOM · Sent 14-09-2026 · Valid until 14-10-2026 · VAT reverse-charged · Amounts excl. VAT.',
    day_rate: 350,
    contingency_rate: 0,
    sections: [
      {
        heading: 'Infinity Room — hardware & labour',
        parts: [
          {
            subLabel: 'Materials & equipment',
            category: 'materials',
            subtotalLabel: 'Subtotal materials',
            lines: [
              { label: 'Dig-Octa Power-7', unit_price: 70, quantity: 2 },
              { label: 'QuinLED Dig-Octa Brainboard-32-8L', unit_price: 80, quantity: 2 },
              { label: 'LED Strings', unit_price: 1500, quantity: 1 },
              { label: 'Case', unit_price: 100, quantity: 1 },
              { label: 'Meanwell LRS-600-12', unit_price: 120, quantity: 2 },
              { label: '230 v distributor', unit_price: 90, quantity: 1 },
              { label: 'Mini PC', unit_price: 1000, quantity: 1 },
              {
                label: 'Extra materials',
                notes: 'Cabling, shrink tube, etc.',
                unit_price: 250,
                quantity: 1,
              },
              {
                label: 'Extra microcontroller + materials',
                unit_price: 120,
                quantity: 1,
              },
              { label: 'TD Licentie', unit_price: 600, quantity: 1 },
              { label: 'Switch', unit_price: 60, quantity: 1 },
              {
                label: 'Joost — audio materials',
                unit_price: 2232.12,
                quantity: 1,
              },
            ],
          },
          {
            subLabel: 'Labour',
            category: 'labour',
            subtotalLabel: 'Subtotal labour',
            lines: [
              {
                label: 'Gus — design, programming, testing, narrative, build',
                unit_price: 350,
                quantity: 8,
              },
              { label: 'Gus — installation', unit_price: 350, quantity: 5 },
              { label: 'Tereza — installation', unit_price: 125, quantity: 5 },
              {
                label: 'Joost — music & sound design',
                unit_price: 4050,
                quantity: 1,
                notes: 'Lump sum from quotation PDF',
              },
            ],
          },
        ],
      },
    ],
  });
}
