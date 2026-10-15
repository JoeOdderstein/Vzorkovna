import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTaskboardFilter } from '../context/TaskboardFilterContext';
import {
  CALENDAR_PROJECT_QUERY_KEY,
  findProjectByCalendarQuery,
} from '../lib/taskboard/calendarProjectUrl';

/** Keeps ?project=<slug> in sync with the calendar project filter chip. */
export function useSyncCalendarProjectQuery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { projectFilter, setProjectFilter, filterProjects } = useTaskboardFilter();
  const skipNextUrlWriteRef = useRef(false);
  /** True until a ?project= link has been applied to the filter (or cleared as invalid). */
  const pendingUrlProjectRef = useRef(Boolean(searchParams.get(CALENDAR_PROJECT_QUERY_KEY)));

  useEffect(() => {
    const param = searchParams.get(CALENDAR_PROJECT_QUERY_KEY);
    pendingUrlProjectRef.current = Boolean(param);
  }, [searchParams]);

  // URL → filter (shared links, refresh, browser navigation)
  useEffect(() => {
    if (filterProjects.length === 0) return;

    const param = searchParams.get(CALENDAR_PROJECT_QUERY_KEY);
    if (!param) {
      pendingUrlProjectRef.current = false;
      return;
    }

    const matched = findProjectByCalendarQuery(param, filterProjects);
    if (matched) {
      skipNextUrlWriteRef.current = true;
      pendingUrlProjectRef.current = false;
      setProjectFilter(matched.id);
      return;
    }

    skipNextUrlWriteRef.current = true;
    pendingUrlProjectRef.current = false;
    setProjectFilter('all');
    const next = new URLSearchParams(searchParams);
    next.delete(CALENDAR_PROJECT_QUERY_KEY);
    setSearchParams(next, { replace: true });
  }, [searchParams, filterProjects, setProjectFilter, setSearchParams]);

  // Filter → URL (chip selection)
  useEffect(() => {
    if (filterProjects.length === 0) return;

    if (skipNextUrlWriteRef.current) {
      skipNextUrlWriteRef.current = false;
      return;
    }

    const param = searchParams.get(CALENDAR_PROJECT_QUERY_KEY);
    const next = new URLSearchParams(searchParams);

    if (projectFilter === 'all') {
      if (
        pendingUrlProjectRef.current &&
        param &&
        findProjectByCalendarQuery(param, filterProjects)
      ) {
        return;
      }
      if (param) {
        next.delete(CALENDAR_PROJECT_QUERY_KEY);
        setSearchParams(next, { replace: true });
      }
      return;
    }

    pendingUrlProjectRef.current = false;

    const project = filterProjects.find((p) => p.id === projectFilter);
    if (!project) return;

    if (param !== project.slug) {
      next.set(CALENDAR_PROJECT_QUERY_KEY, project.slug);
      setSearchParams(next, { replace: true });
    }
  }, [projectFilter, filterProjects, searchParams, setSearchParams]);
}
