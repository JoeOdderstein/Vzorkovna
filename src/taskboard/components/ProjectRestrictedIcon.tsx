import { Eye } from 'lucide-react';
import type { Project } from '../../lib/taskboard/types';
import { isProjectRestrictedVisibility } from '../../lib/taskboard/projectVisibility';

interface ProjectRestrictedIconProps {
  project: Pick<Project, 'visible_to'>;
  size?: number;
}

export default function ProjectRestrictedIcon({
  project,
  size = 14,
}: ProjectRestrictedIconProps) {
  if (!isProjectRestrictedVisibility(project)) return null;

  return (
    <Eye
      size={size}
      className="text-[#80868b] shrink-0"
      aria-label="Limited visibility"
      title="Not visible to everyone"
    />
  );
}
