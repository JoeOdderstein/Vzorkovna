import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { InvoiceDocumentKind } from '../lib/invoices/constants';
import {
  INVOICE_ID_QUERY_KEY,
  INVOICE_KIND_QUERY_KEY,
  parseInvoiceIdFromQuery,
  parseInvoiceKindFromQuery,
} from '../lib/invoices/invoiceDocumentKindUrl';

/** Keeps ?kind= and ?id= in sync with the invoices page UI. */
export function useSyncInvoicesPageQuery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [documentKind, setDocumentKind] = useState<InvoiceDocumentKind>(() =>
    parseInvoiceKindFromQuery(searchParams.get(INVOICE_KIND_QUERY_KEY)),
  );

  const urlInvoiceId = parseInvoiceIdFromQuery(searchParams.get(INVOICE_ID_QUERY_KEY));

  const setInvoiceIdInUrl = useCallback(
    (invoiceId: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (invoiceId) next.set(INVOICE_ID_QUERY_KEY, invoiceId);
      else next.delete(INVOICE_ID_QUERY_KEY);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    const parsed = parseInvoiceKindFromQuery(searchParams.get(INVOICE_KIND_QUERY_KEY));
    setDocumentKind((current) => (current === parsed ? current : parsed));
  }, [searchParams]);

  useEffect(() => {
    const param = searchParams.get(INVOICE_KIND_QUERY_KEY);
    const next = new URLSearchParams(searchParams);

    if (documentKind === 'invoice') {
      if (param !== null) {
        next.delete(INVOICE_KIND_QUERY_KEY);
        setSearchParams(next, { replace: true });
      }
      return;
    }

    if (param !== documentKind) {
      next.set(INVOICE_KIND_QUERY_KEY, documentKind);
      setSearchParams(next, { replace: true });
    }
  }, [documentKind, searchParams, setSearchParams]);

  return { documentKind, setDocumentKind, urlInvoiceId, setInvoiceIdInUrl };
}
