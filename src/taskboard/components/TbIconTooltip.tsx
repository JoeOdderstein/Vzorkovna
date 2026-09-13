import type { ReactElement } from 'react';

interface TbIconTooltipProps {
  label: string;
  children: ReactElement;
}

export default function TbIconTooltip({ label, children }: TbIconTooltipProps) {
  return (
    <span className="tb-tooltip-wrap">
      {children}
      <span className="tb-tooltip" role="tooltip">
        {label}
      </span>
    </span>
  );
}
