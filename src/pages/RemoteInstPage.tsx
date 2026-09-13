import { REMOTE_INSTALLATIONS } from '../lib/taskboard/remoteInstData';

function statusLightClass(status: (typeof REMOTE_INSTALLATIONS)[number]['status']) {
  switch (status) {
    case 'active':
      return 'tb-remote-inst-light--active';
    case 'issues':
      return 'tb-remote-inst-light--issues';
    case 'broken':
      return 'tb-remote-inst-light--broken';
  }
}

export default function RemoteInstPage() {
  return (
    <div className="max-w-screen-2xl mx-auto px-6 md:px-10">
      <span className="tb-label block mb-2">Remote Inst</span>
      <p className="text-sm tb-muted mb-8">Live status overview for on-site installations.</p>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REMOTE_INSTALLATIONS.map((installation) => {
          const content = (
            <>
              <h2 className="text-base tb-text font-medium">{installation.name}</h2>
              <div className="mt-4 flex items-center gap-3">
                <span
                  className={`tb-remote-inst-light ${statusLightClass(installation.status)}`}
                  aria-hidden
                />
                <span className="text-sm tb-text-secondary">{installation.statusLabel}</span>
              </div>
            </>
          );

          return (
            <li key={installation.id}>
              {installation.url ? (
                <a
                  href={installation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tb-remote-inst-card block hover:border-[var(--tb-accent)] transition-colors"
                >
                  {content}
                </a>
              ) : (
                <div className="tb-remote-inst-card">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
