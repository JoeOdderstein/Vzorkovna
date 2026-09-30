import { useMemo } from 'react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import {
  INSTALLATION_LIFECYCLE_FILTERS,
  INSTALLATION_LIFECYCLE_LABELS,
  type InstallationLifecycleFilter,
} from '../../lib/installations/constants';
import {
  formatMessage,
  translateInstallationLifecycle,
} from '../../lib/taskboard/i18n/messages';
import type { InstallationRecord } from '../../lib/installations/types';

interface InstallationStatusFilterBarProps {
  installations: InstallationRecord[];
  statusFilter: InstallationLifecycleFilter;
  onStatusFilterChange: (filter: InstallationLifecycleFilter) => void;
}

function countForFilter(
  installations: InstallationRecord[],
  filter: InstallationLifecycleFilter,
) {
  if (filter === 'all') return installations.length;
  return installations.filter((installation) => installation.lifecycle_status === filter).length;
}

export default function InstallationStatusFilterBar({
  installations,
  statusFilter,
  onStatusFilterChange,
}: InstallationStatusFilterBarProps) {
  const { t, locale } = useTaskboardI18n();

  const counts = useMemo(() => {
    const map = {} as Record<InstallationLifecycleFilter, number>;
    for (const { id } of INSTALLATION_LIFECYCLE_FILTERS) {
      map[id] = countForFilter(installations, id);
    }
    return map;
  }, [installations]);

  return (
    <div className="tb-header-scroll-row tb-header-scroll-row--filters mb-8">
      {INSTALLATION_LIFECYCLE_FILTERS.map(({ id }) => {
        const active = statusFilter === id;
        const count = counts[id] ?? 0;
        const label =
          id === 'all'
            ? t('filter.all')
            : translateInstallationLifecycle(
                locale,
                id,
                INSTALLATION_LIFECYCLE_LABELS[id],
              );

        return (
          <button
            key={id}
            type="button"
            onClick={() => onStatusFilterChange(id)}
            className={`tb-filter-btn relative ${active ? 'tb-filter-btn--active' : ''}`}
          >
            {label}
            {count > 0 ? (
              <span
                className="tb-filter-count"
                aria-label={formatMessage(t('projects.filter.countAria'), {
                  count: String(count),
                })}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
