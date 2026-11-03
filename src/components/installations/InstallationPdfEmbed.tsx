import { ExternalLink } from 'lucide-react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { usePdfEmbedUrl } from '../../hooks/usePdfEmbedUrl';

interface InstallationPdfEmbedProps {
  pdfUrl: string;
  title: string;
  className?: string;
  showMobileOpenLink?: boolean;
}

export default function InstallationPdfEmbed({
  pdfUrl,
  title,
  className = 'w-full min-h-[min(72vh,40rem)] border-0 bg-white',
  showMobileOpenLink = true,
}: InstallationPdfEmbedProps) {
  const { t } = useTaskboardI18n();
  const { embedUrl, preparing } = usePdfEmbedUrl(pdfUrl);

  return (
    <div className="tb-installation-pdf-embed">
      <div className="relative">
        {preparing ? (
          <p className="absolute inset-0 z-[1] flex items-center justify-center bg-[var(--tb-bg)] text-sm tb-muted">
            {t('projects.tech.preparingPdf')}
          </p>
        ) : null}
        {embedUrl ? (
          <iframe title={title} src={embedUrl} className={className} />
        ) : (
          <p className="px-3 py-8 text-sm tb-muted text-center">{t('projects.tech.openError')}</p>
        )}
      </div>
      {showMobileOpenLink ? (
        <div className="border-t border-[var(--tb-border)] px-3 py-2 md:hidden">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--tb-accent)] font-medium"
          >
            {t('projects.tech.openInBrowser')}
            <ExternalLink size={14} aria-hidden />
          </a>
        </div>
      ) : null}
    </div>
  );
}
