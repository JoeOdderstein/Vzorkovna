import { useEffect, useMemo, useRef } from 'react';
import type { Project } from '../../lib/taskboard/types';
import type { ProjectTimelineState } from '../../lib/taskboard/projectTimelineService';
import {
  buildTimelineMonthBands,
  isoWeekNumber,
  timelineBlockHasContent,
  timelineBlockPlainLabel,
  timelineBlockWeekSpan,
  timelineInitialScrollWeekIndex,
  type TimelineWeekSlot,
} from '../../lib/taskboard/projectTimelineUtils';
import type { ProjectTimelineEntry } from '../../lib/taskboard/projectTimelineService';
import {
  buildProjectCalendarColorIndex,
  projectCalendarColorClassForId,
} from '../../lib/taskboard/calendarProjectColors';
import type { TimelineBlockDetail } from './ProjectTimelineBlockDetailDialog';

const WEEK_COL_PX = 38;
const LABEL_COL_WIDTH = '9rem';

interface ProjectTimelineGridProps {
  projects: Project[];
  timelines: Map<string, ProjectTimelineState>;
  weekSlots: TimelineWeekSlot[];
  onSelectBlock: (detail: TimelineBlockDetail) => void;
}

export default function ProjectTimelineGrid({
  projects,
  timelines,
  weekSlots,
  onSelectBlock,
}: ProjectTimelineGridProps) {
  const weekKeys = useMemo(() => weekSlots.map((s) => s.weekStartKey), [weekSlots]);
  const monthBands = useMemo(() => buildTimelineMonthBands(weekSlots), [weekSlots]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);

  const todayKey = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const match = weekSlots.find((s) => s.weekStart <= now && s.weekEnd >= now);
    return match?.weekStartKey ?? weekKeys[0];
  }, [weekSlots, weekKeys]);

  useEffect(() => {
    if (didInitialScroll.current || monthBands.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const weekIndex = timelineInitialScrollWeekIndex(monthBands, weekSlots);
    el.scrollLeft = Math.max(0, weekIndex * WEEK_COL_PX);
    didInitialScroll.current = true;
  }, [monthBands, weekSlots]);

  const colorIndexByProject = useMemo(() => buildProjectCalendarColorIndex(projects), [projects]);

  const rows = useMemo(() => {
    return projects.map((project) => {
      const state = timelines.get(project.id);
      const blocks = (state?.entries ?? [])
        .filter((e) => timelineBlockHasContent({ name: e.name, description: e.description }))
        .sort((a, b) => {
          const byStart = a.week_start.localeCompare(b.week_start);
          if (byStart !== 0) return byStart;
          return a.week_end.localeCompare(b.week_end);
        })
        .map((entry: ProjectTimelineEntry) => ({
          entry,
          span: timelineBlockWeekSpan(entry.week_start, entry.week_end, weekKeys),
        }));

      return { project, blocks, completed: state?.timelineCompleted ?? false };
    }).filter((row) => row.blocks.length > 0);
  }, [projects, timelines, weekKeys]);

  if (rows.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="mt-4 overflow-x-auto overflow-y-visible rounded-lg border border-[var(--tb-border)] bg-[var(--tb-bg)]"
    >
      <div className="min-w-max">
        <div
          className="sticky top-0 z-20 grid border-b border-[var(--tb-border)] bg-[var(--tb-surface)]"
          style={{
            gridTemplateColumns: `${LABEL_COL_WIDTH} auto`,
            gridTemplateRows: 'auto auto',
          }}
        >
          <div
            className="sticky left-0 z-30 shrink-0 border-r border-[var(--tb-border)] bg-[var(--tb-surface)]"
            style={{ gridColumn: 1, gridRow: '1 / span 2' }}
            aria-hidden
          />
          <div
            className="flex shrink-0 border-b border-[var(--tb-border)]"
            style={{ gridColumn: 2, gridRow: 1, width: weekSlots.length * WEEK_COL_PX }}
          >
            {monthBands.map((band, bandIndex) => (
              <div
                key={`${band.key}-${band.startIndex}`}
                className={`tb-project-timeline-month-band shrink-0 flex items-center justify-center px-1 py-1.5 text-center border-r border-[var(--tb-border)] last:border-r-0 ${
                  bandIndex % 2 === 0
                    ? 'tb-project-timeline-month-band--a'
                    : 'tb-project-timeline-month-band--b'
                }`}
                style={{ width: band.span * WEEK_COL_PX }}
                title={band.label}
              >
                <span className="text-[11px] font-semibold tb-text leading-tight tracking-tight">
                  {band.label}
                </span>
              </div>
            ))}
          </div>
          <div
            className="flex shrink-0"
            style={{ gridColumn: 2, gridRow: 2, width: weekSlots.length * WEEK_COL_PX }}
          >
            {weekSlots.map((slot) => {
              const isCurrent = slot.weekStartKey === todayKey;
              return (
                <div
                  key={slot.weekStartKey}
                  className={`shrink-0 px-0.5 py-1 text-center border-r border-[var(--tb-border)] last:border-r-0 ${
                    isCurrent ? 'bg-[color-mix(in_srgb,var(--tb-accent)_12%,transparent)]' : ''
                  }`}
                  style={{ width: WEEK_COL_PX }}
                  title={slot.label}
                >
                  <span className="block text-[10px] font-semibold tb-text leading-none">
                    W{isoWeekNumber(slot.weekStart)}
                  </span>
                  <span className="block text-[9px] tb-muted leading-tight mt-0.5">
                    {slot.weekStart.toLocaleDateString(undefined, {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {rows.map(({ project, blocks, completed }) => {
          const colorClass = projectCalendarColorClassForId(project.id, colorIndexByProject);
          const trackWidth = weekSlots.length * WEEK_COL_PX;

          return (
            <div
              key={project.id}
              className="flex border-b border-[var(--tb-border)] last:border-b-0 min-h-[2.75rem]"
            >
              <div
                className={`sticky left-0 z-10 flex shrink-0 items-center px-2 py-1.5 text-xs font-bold border-r border-[var(--tb-border)] bg-[var(--tb-surface)] ${
                  completed ? 'tb-muted' : 'tb-text'
                }`}
                style={{ width: LABEL_COL_WIDTH }}
                title={project.name}
              >
                <span className="line-clamp-2 leading-snug">{project.name}</span>
              </div>

              <div
                className="relative shrink-0 min-h-[2.75rem]"
                style={{ width: trackWidth }}
              >
                <div className="absolute inset-0 flex pointer-events-none">
                  {weekSlots.map((slot) => (
                    <div
                      key={slot.weekStartKey}
                      className={`shrink-0 border-r border-[var(--tb-border)] last:border-r-0 ${
                        slot.weekStartKey === todayKey
                          ? 'bg-[color-mix(in_srgb,var(--tb-accent)_6%,transparent)]'
                          : ''
                      }`}
                      style={{ width: WEEK_COL_PX }}
                    />
                  ))}
                </div>

                {blocks.map(({ entry, span }) => {
                  if (!span) return null;
                  const label = timelineBlockPlainLabel(entry.name);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={`tb-project-timeline-phase absolute top-1 bottom-1 ${colorClass}`}
                      style={{
                        left: span.startIndex * WEEK_COL_PX + 2,
                        width: span.span * WEEK_COL_PX - 4,
                        maxWidth: span.span * WEEK_COL_PX - 4,
                      }}
                      title={label}
                      onClick={() =>
                        onSelectBlock({
                          projectName: project.name,
                          entry,
                        })
                      }
                    >
                      <span className="tb-project-timeline-phase__label">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
