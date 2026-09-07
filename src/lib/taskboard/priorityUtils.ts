import type { Priority } from './constants';

export const priorityDotClasses: Record<Priority, string> = {
  high: 'bg-red-500',
  normal: 'bg-[#1a73e8]',
  low: 'bg-[#80868b]',
};

export const priorityBorderClasses: Record<Priority, string> = {
  high: 'border-l-red-500',
  normal: 'border-l-[#1a73e8]',
  low: 'border-l-[#dadce0]',
};

export const priorityLabels: Record<Priority, string> = {
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};
