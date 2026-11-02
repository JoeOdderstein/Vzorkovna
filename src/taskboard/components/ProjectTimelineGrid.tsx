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
  PROJECT_TIMELINE_ROW_MIN_PX,
  isTimelinePhase,
  isTimelineVisit,
  type TimelineWeekSlot,
} from '../../lib/taskboard/projectTimelineUtils';
import type { ProjectTimelineEntry } from '../../lib/taskboard/projectTimelineService';
import {
  buildProjectCalendarColorIndex,
  projectCalendarColorClassForId,
} from '../../lib/taskboard/calendarProjectColors';
import type { TimelineBlockDetail } from './ProjectTimelineBlockDetailDialog';

const WEEK_COL_PX_DEFAULT = 38;
const WEEK_COL_PX_COMPACT = 52;
const LABEL_COL_WIDTH = '9rem';
/** Visit blocks may extend past week column borders for readability. */
const VISIT_WEEK_BLEED_PX = 6;
const PHASE_BLOCK_INSET_PX = 2;

interface ProjectTimelineGridProps {
  projects: Project[];
  timelines: Map<string, ProjectTimelineState>;
  weekSlots: TimelineWeekSlot[];
  compactViewport?: boolean;
  onSelectBlock: (detail: TimelineBlockDetail) => void;
}

export default function ProjectTimelineGrid({
  projects,
  timelines,
  weekSlots,
  compactViewport = false,
  onSelectBlock,
}: ProjectTimelineGridProps) {
  const weekColPx = compactViewport ? WEEK_COL_PX_COMPACT : WEEK_COL_PX_DEFAULT;
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
    didInitialScroll.current = false;
  }, [weekSlots]);

  useEffect(() => {
    if (didInitialScroll.current || monthBands.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    if (compactViewport) {
      const weekIndex = timelineInitialScrollWeekIndex(weekSlots);
      el.scrollLeft = weekIndex * weekColPx;
    } else {
      el.scrollLeft = 0;
    }
    didInitialScroll.current = true;
  }, [monthBands, weekSlots, weekColPx, compactViewport]);

  const colorIndexByProject = useMemo(() => buildProjectCalendarColorIndex(projects), [projects]);

  const rows = useMemo(() => {
    return projects.map((project) => {
      const state = timelines.get(project.id);
      const withContent = (state?.entries ?? []).filter((e) =>
        timelineBlockHasContent({ name: e.name, description: e.description }),
      );

      const mapBlocks = (entries: ProjectTimelineEntry[]) =>
        entries
          .sort((a, b) => {
            const byStart = a.week_start.localeCompare(b.week_start);
            if (byStart !== 0) return byStart;
            return a.week_end.localeCompare(b.week_end);
          })
          .map((entry) => ({
            entry,
            span: timelineBlockWeekSpan(entry.week_start, entry.week_end, weekSlots),
          }));

      const phases = mapBlocks(withContent.filter((e) => isTimelinePhase(e)));
      const visits = mapBlocks(withContent.filter((e) => isTimelineVisit(e)));

      return { project, phases, visits, completed: state?.timelineCompleted ?? false };
    }).filter((row) => row.phases.length > 0 || row.visits.length > 0);
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
            style={{ gridColumn: 2, gridRow: 1, width: weekSlots.length * weekColPx }}
          >
            {monthBands.map((band, bandIndex) => (
              <div
                key={`${band.key}-${band.startIndex}`}
                className={`tb-project-timeline-month-band shrink-0 flex items-center justify-center px-1 py-1.5 text-center border-r border-[var(--tb-border)] last:border-r-0 ${
                  bandIndex % 2 === 0
                    ? 'tb-project-timeline-month-band--a'
                    : 'tb-project-timeline-month-band--b'
                }`}
                style={{ width: band.span * weekColPx }}
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
            style={{ gridColumn: 2, gridRow: 2, width: weekSlots.length * weekColPx }}
          >
            {weekSlots.map((slot) => {
              const isCurrent = slot.weekStartKey === todayKey;
              return (
                <div
                  key={slot.weekStartKey}
                  className={`shrink-0 px-0.5 py-1 text-center border-r border-[var(--tb-border)] last:border-r-0 ${
                    isCurrent ? 'bg-[color-mix(in_srgb,var(--tb-accent)_12%,transparent)]' : ''
                  }`}
                  style={{ width: weekColPx }}
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

        {rows.map(({ project, phases, visits, completed }) => {
          const colorClass = projectCalendarColorClassForId(project.id, colorIndexByProject);
          const trackWidth = weekSlots.length * weekColPx;

          const renderBlock = (
            entry: ProjectTimelineEntry,
            span: NonNullable<ReturnType<typeof timelineBlockWeekSpan>>,
            variant: 'phase' | 'visit',
          ) => {
            const label = timelineBlockPlainLabel(entry.name);
            const className =
              variant === 'phase'
                ? `tb-project-timeline-phase ${colorClass}`
                : `tb-project-timeline-visit ${colorClass}`;
            const blockLeft =
              variant === 'visit'
                ? span.startIndex * weekColPx - VISIT_WEEK_BLEED_PX
                : span.startIndex * weekColPx + PHASE_BLOCK_INSET_PX;
            const blockWidth =
              variant === 'visit'
                ? span.span * weekColPx + VISIT_WEEK_BLEED_PX * 2
                : span.span * weekColPx - PHASE_BLOCK_INSET_PX * 2;

            return (
              <button
                key={entry.id}
                type="button"
                className={`${className} absolute`}
                style={{
                  left: blockLeft,
                  width: blockWidth,
                  maxWidth: variant === 'phase' ? blockWidth : undefined,
                }}
                title={label}
                onClick={() =>
                  onSelectBlock({
                    projectName: project.name,
                    entry,
                  })
                }
              >
                <span
                  className={
                    variant === 'phase'
                      ? 'tb-project-timeline-phase__label'
                      : 'tb-project-timeline-visit__label'
                  }
                >
                  {label}
                </span>
              </button>
            );
          };

          return (
            <div
              key={project.id}
              className="flex border-b border-[var(--tb-border)] last:border-b-0 tb-project-timeline-row"
              style={{ minHeight: PROJECT_TIMELINE_ROW_MIN_PX }}
            >
              <div
                className={`sticky left-0 z-10 flex shrink-0 items-center px-2 py-1.5 text-xs font-bold border-r border-[var(--tb-border)] bg-[var(--tb-surface)] ${
                  completed ? 'tb-muted' : 'tb-text'
                }`}
                style={{ width: LABEL_COL_WIDTH }}
                title={project.name}
              >
                <span className="line-clamp-3 leading-snug">{project.name}</span>
              </div>

              <div
                className="relative shrink-0 tb-project-timeline-track"
                style={{ width: trackWidth, minHeight: PROJECT_TIMELINE_ROW_MIN_PX }}
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
                      style={{ width: weekColPx }}
                    />
                  ))}
                </div>

                {phases.map(({ entry, span }) => (span ? renderBlock(entry, span, 'phase') : null))}
                {visits.map(({ entry, span }) => (span ? renderBlock(entry, span, 'visit') : null))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
