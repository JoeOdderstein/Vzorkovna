import TaskCalendarDialog from '../taskboard/components/TaskCalendarDialog';
import { useTaskboardI18n } from '../hooks/useTaskboardI18n';

export default function CalendarPage() {
  const { t } = useTaskboardI18n();

  return (
    <div className="max-w-screen-2xl mx-auto px-6 md:px-10 pb-8">
      <header className="mb-6">
        <span className="tb-label block mb-2">{t('nav.calendar')}</span>
        <p className="text-sm tb-muted">{t('calendar.pageDescription')}</p>
      </header>
      <TaskCalendarDialog open variant="page" />
    </div>
  );
}
