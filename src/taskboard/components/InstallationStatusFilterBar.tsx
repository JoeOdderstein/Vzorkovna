import { useMemo } from 'react';
import {
  INSTALLATION_LIFECYCLE_FILTERS,
  type InstallationLifecycleFilter,
} from '../../lib/installations/constants';
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
  const counts = useMemo(() => {
    const map = {} as Record<InstallationLifecycleFilter, number>;
    for (const { id } of INSTALLATION_LIFECYCLE_FILTERS) {
      map[id] = countForFilter(installations, id);
    }
    return map;
  }, [installations]);

  return (
    <div className="tb-header-scroll-row tb-header-scroll-row--filters mb-8">
      {INSTALLATION_LIFECYCLE_FILTERS.map(({ id, label }) => {
        const active = statusFilter === id;
        const count = counts[id] ?? 0;

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
                aria-label={`${count} installation${count === 1 ? '' : 's'}`}
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
