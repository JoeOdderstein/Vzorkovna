import type { UserProfilePreferredLocale } from '../types';

export type MessageKey = keyof typeof en;

const en = {
  'nav.taskboard': 'Taskboard',
  'nav.archive': 'Archive',
  'nav.projects': 'Projects',
  'nav.drive': 'Drive',
  'nav.remoteInst': 'Remote inst',
  'nav.logout': 'Logout',
  'nav.openMenu': 'Open menu',
  'nav.closeMenu': 'Close menu',

  'common.loading': 'Loading…',
  'common.saving': 'Saving…',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.done': 'Done',
  'common.remove': 'Remove',
  'common.save': 'Save',
  'common.all': 'All',
  'common.project': 'Project',

  'filter.all': 'All',

  'header.addTask': '+ Add task',
  'header.calendar': 'Calendar',
  'header.calendarAria': 'View deadlines calendar',
  'header.profile': 'Profile',
  'header.profileAria': 'Open profile settings',
  'header.manageProjects': '+ Manage projects',
  'header.manageMembers': 'Manage members',

  'task.untitled': 'Untitled task',
  'task.task': 'Task',
  'task.subtask': 'Subtask',
  'task.name': 'Task name',
  'task.description': 'Description',
  'task.assignedTo': 'Assigned to',
  'task.priority': 'Priority',
  'task.deadline': 'Deadline',
  'task.category': 'Category',
  'task.completed': 'Completed',
  'task.markCompleted': 'Mark as completed',
  'task.attachments': 'Attachments',
  'task.drivePlaceholder': 'Google Drive link',
  'task.addSubtask': '+ Subtask',
  'task.deleteTask': 'Delete task',
  'task.deleteConfirm': 'Delete this task and all its subtasks?',

  'priority.high': 'High',
  'priority.normal': 'Normal',
  'priority.low': 'Low',

  'category.quotations': 'Quotations & Proposals',
  'category.designing': 'Designing',
  'category.installation': 'Installation & Implementation',
  'category.repairs': 'Repairs & Final Tweaks',

  'comments.title': 'Comments',
  'comments.logIn': 'Log in to comment.',
  'comments.placeholder': 'Write a comment…',
  'comments.addPlaceholder': 'Add a comment…',
  'comments.enterHint': 'Enter to post, Shift+Enter for new line',
  'comments.post': 'Post',
  'comments.saving': '…',
  'comments.edit': 'Edit',
  'comments.delete': 'Delete',
  'comments.deleteConfirm': 'Delete this comment?',
  'comments.edited': 'edited',
  'comments.empty': 'No comments yet.',

  'translate.translating': 'Translating…',
  'translate.showOriginal': 'Show original',
  'translate.showUkrainian': 'Show Ukrainian',

  'addTask.title': 'New task',
  'addTask.chooseProject': '1. Choose project',
  'addTask.chooseCategory': '2. Choose category',
  'addTask.loadingProjects': 'Loading projects…',
  'addTask.loadingCategories': 'Loading categories…',
  'addTask.noProjects': 'No projects found.',
  'addTask.chooseProjectError': 'Choose a project.',
  'addTask.create': 'Create task',
  'addTask.creating': 'Creating…',
  'addTask.createError': 'Could not create task.',

  'archive.title': 'Archive',
  'archive.back': 'Projects',
  'archive.completedHeading': 'Completed tasks',
  'archive.searchPlaceholder': 'Search tasks…',
  'archive.empty': 'No completed tasks yet.',
  'archive.restore': 'Undo',
  'archive.restoring': 'Restoring…',
  'archive.loadError': 'Could not load archive.',
  'archive.restoreError': 'Could not restore task.',
  'archive.done': 'Done',

  'overview.projectsLabel': 'Projects',
  'overview.hint': 'Click a project to expand its tasks. You can open multiple projects at once.',
  'overview.loadingProjects': 'Loading projects…',
  'overview.loadError': 'Could not load projects. Please try again.',
  'overview.noProjects': 'No projects yet.',

  'profile.title': 'Profile',
  'profile.loginUsername': 'Login username',
  'profile.boardName': 'Your name on the taskboard',
  'profile.boardNameHint':
    'Linked automatically from your login. Tasks assigned to {name} on the board will notify the email below.',
  'profile.email': 'Email',
  'profile.readingLanguage': 'Taskboard language (reading)',
  'profile.readingEnglish': 'English — show tasks as written',
  'profile.readingUkrainian': 'Ukrainian — translate titles, descriptions, and comments',
  'profile.readingHint':
    'Translations are automatic for your view only. Original text stays in the database. Text is sent to DeepL when you read content (requires DEEPL_API_KEY on the server).',
  'profile.notify': 'Email me when I am assigned to a task or someone comments on my task',
  'profile.notifyHint': 'Requires a saved email above. Applies to tasks assigned to your board name.',
  'profile.save': 'Save profile',
  'profile.notConfigured': 'Not configured',

  'members.title': 'Manage members',
  'members.teamHeading': 'Team on the taskboard',
  'members.teamHint':
    'Everyone who can be assigned tasks appears here. Add an email and send an invite so they can choose their own password. Use the form below for brand-new people.',
  'members.loading': 'Loading members…',
  'members.empty': 'No members yet. Add one below.',
  'members.addHeading': 'Add member',
  'members.add': 'Add member',
  'members.addAndInvite': 'Add and send invite',
  'members.inviteLink': 'Invite link',
  'members.copyLink': 'Copy link',

  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.toggle': 'Toggle theme',

  'projects.pageDescription':
    'Installation records by venue — My People Bar, Vzorkovna, and Kraków.',
  'projects.remotePageDescription': 'Live status overview for on-site installations.',
  'projects.addProject': 'Add project',
  'projects.loading': 'Loading installations…',
  'projects.noMatch': 'No installations match this status.',
  'projects.open': 'Open',
  'projects.filter.countAria': '{count} installation(s)',

  'projects.location.my_people_bar': 'My People Bar',
  'projects.location.vzorkovna': 'Vzorkovna',
  'projects.location.krakow': 'Kraków',

  'projects.lifecycle.concept': 'Concept phase',
  'projects.lifecycle.implementation': 'Implementation phase',
  'projects.lifecycle.waiting_tech_approval': 'Pending tech approval',
  'projects.lifecycle.operational': 'Operational',
  'projects.lifecycle.maintenance_needed': 'Maintenance needed',

  'projects.operational.active': 'Active',
  'projects.operational.issues': 'Issues detected',
  'projects.operational.broken': 'Offline',

  'projects.addDialog.title': 'New project',
  'projects.addDialog.name': 'Project name',
  'projects.addDialog.namePlaceholder': 'e.g. Starry Night',
  'projects.addDialog.location': 'Location',
  'projects.addDialog.responsible': 'Responsible person',
  'projects.addDialog.responsibleOptional': '(optional)',
  'projects.addDialog.responsiblePlaceholder': 'e.g. Gus',
  'projects.addDialog.nameError': 'Enter a project name.',
  'projects.addDialog.createError': 'Could not create project. Try again.',
  'projects.addDialog.creating': 'Creating…',

  'projects.detail.back': 'Back to projects',
  'projects.detail.installationLabel': 'Installation',
  'projects.detail.loading': 'Loading installation…',
  'projects.detail.notFound': 'Installation not found.',
  'projects.detail.statusSaveError': 'Could not save status. Try again.',
  'projects.detail.statusAria': 'Installation status',
  'projects.detail.openRemote': 'Open remote session',
  'projects.detail.overview': 'Overview',
  'projects.detail.meta.location': 'Location',
  'projects.detail.meta.currentStatus': 'Current status',
  'projects.detail.meta.responsible': 'Responsible person',
  'projects.detail.meta.lastInspection': 'Most recent inspection',
  'projects.detail.meta.nextMaintenance': 'Next maintenance',
  'projects.detail.meta.revizniZprava': 'Revizní zpráva',
  'projects.detail.onFile': 'On file',
  'projects.detail.notOnFile': 'Not on file',
  'projects.detail.photographs': 'Photographs',
  'projects.detail.noPhotos': 'No photographs uploaded yet.',
  'projects.detail.defaultPhotograph': 'Photograph',
  'projects.detail.technical': 'Technical documentation',
  'projects.detail.electrical': 'Electrical documentation',
  'projects.detail.noElectrical': 'No electrical documents on file yet.',
  'projects.detail.malfunction': 'Malfunction & repair history',
  'projects.detail.noRepairs': 'No malfunctions or repairs recorded yet.',
  'projects.detail.repairResolved': 'Resolved',
  'projects.detail.repairOpen': 'Open',

  'projects.tech.noDocs': 'No technical documents on file yet.',
  'projects.tech.opening': 'Opening…',
  'projects.tech.removing': 'Removing…',
  'projects.tech.defaultDoc': 'Document',
  'projects.tech.defaultViewerTitle': 'Technical document',
  'projects.tech.openError': 'Could not open this PDF. Try again.',
  'projects.tech.pdfOnly': 'Only PDF files can be uploaded here.',
  'projects.tech.uploadFailed': 'Upload failed.',
  'projects.tech.removeConfirm': 'Remove "{label}" from technical documentation?',
  'projects.tech.removeFailed': 'Could not remove document.',
  'projects.tech.upload': 'Upload PDF',
  'projects.tech.uploading': 'Uploading…',
  'projects.tech.uploadHint':
    'PDF only, up to 25 MB. Team members can open files here in the browser.',
} as const;

const uk: Record<MessageKey, string> = {
  'nav.taskboard': 'Табло завдань',
  'nav.archive': 'Архів',
  'nav.projects': 'Проєкти',
  'nav.drive': 'Диск',
  'nav.remoteInst': 'Віддалені інст.',
  'nav.logout': 'Вийти',
  'nav.openMenu': 'Відкрити меню',
  'nav.closeMenu': 'Закрити меню',

  'common.loading': 'Завантаження…',
  'common.saving': 'Збереження…',
  'common.cancel': 'Скасувати',
  'common.close': 'Закрити',
  'common.done': 'Готово',
  'common.remove': 'Видалити',
  'common.save': 'Зберегти',
  'common.all': 'Усі',
  'common.project': 'Проєкт',

  'filter.all': 'Усі',

  'header.addTask': '+ Додати завдання',
  'header.calendar': 'Календар',
  'header.calendarAria': 'Календар дедлайнів',
  'header.profile': 'Профіль',
  'header.profileAria': 'Налаштування профілю',
  'header.manageProjects': '+ Керувати проєктами',
  'header.manageMembers': 'Керувати учасниками',

  'task.untitled': 'Без назви',
  'task.task': 'Завдання',
  'task.subtask': 'Підзавдання',
  'task.name': 'Назва завдання',
  'task.description': 'Опис',
  'task.assignedTo': 'Виконавець',
  'task.priority': 'Пріоритет',
  'task.deadline': 'Дедлайн',
  'task.category': 'Категорія',
  'task.completed': 'Виконано',
  'task.markCompleted': 'Позначити виконаним',
  'task.attachments': 'Вкладення',
  'task.drivePlaceholder': 'Посилання Google Drive',
  'task.addSubtask': '+ Підзавдання',
  'task.deleteTask': 'Видалити завдання',
  'task.deleteConfirm': 'Видалити це завдання та всі підзавдання?',

  'priority.high': 'Високий',
  'priority.normal': 'Звичайний',
  'priority.low': 'Низький',

  'category.quotations': 'Кошториси та пропозиції',
  'category.designing': 'Проєтування',
  'category.installation': 'Монтаж і впровадження',
  'category.repairs': 'Ремонт і фінальні правки',

  'comments.title': 'Коментарі',
  'comments.logIn': 'Увійдіть, щоб коментувати.',
  'comments.placeholder': 'Напишіть коментар…',
  'comments.addPlaceholder': 'Додайте коментар…',
  'comments.enterHint': 'Enter — надіслати, Shift+Enter — новий рядок',
  'comments.post': 'Надіслати',
  'comments.saving': '…',
  'comments.edit': 'Редагувати',
  'comments.delete': 'Видалити',
  'comments.deleteConfirm': 'Видалити цей коментар?',
  'comments.edited': 'змінено',
  'comments.empty': 'Коментарів ще немає.',

  'translate.translating': 'Переклад…',
  'translate.showOriginal': 'Показати оригінал',
  'translate.showUkrainian': 'Показати українською',

  'addTask.title': 'Нове завдання',
  'addTask.chooseProject': '1. Оберіть проєкт',
  'addTask.chooseCategory': '2. Оберіть категорію',
  'addTask.loadingProjects': 'Завантаження проєктів…',
  'addTask.loadingCategories': 'Завантаження категорій…',
  'addTask.noProjects': 'Проєктів не знайдено.',
  'addTask.chooseProjectError': 'Оберіть проєкт.',
  'addTask.create': 'Створити завдання',
  'addTask.creating': 'Створення…',
  'addTask.createError': 'Не вдалося створити завдання.',

  'archive.title': 'Архів',
  'archive.back': 'Проєкти',
  'archive.completedHeading': 'Виконані завдання',
  'archive.searchPlaceholder': 'Пошук завдань…',
  'archive.empty': 'Виконаних завдань ще немає.',
  'archive.restore': 'Скасувати',
  'archive.restoring': 'Відновлення…',
  'archive.loadError': 'Не вдалося завантажити архів.',
  'archive.restoreError': 'Не вдалося відновити завдання.',
  'archive.done': 'Готово',

  'overview.projectsLabel': 'Проєкти',
  'overview.hint': 'Натисніть проєкт, щоб розгорнути завдання. Можна відкрити кілька проєктів одночасно.',
  'overview.loadingProjects': 'Завантаження проєктів…',
  'overview.loadError': 'Не вдалося завантажити проєкти. Спробуйте ще раз.',
  'overview.noProjects': 'Проєктів ще немає.',

  'profile.title': 'Профіль',
  'profile.loginUsername': 'Логін',
  'profile.boardName': "Ваше ім'я на табло",
  'profile.boardNameHint':
    "Прив'язано до вашого логіну. Завдання, призначені {name}, надсилатимуть сповіщення на email нижче.",
  'profile.email': 'Email',
  'profile.readingLanguage': 'Мова перегляду табло',
  'profile.readingEnglish': 'English — показувати текст як написано',
  'profile.readingUkrainian': 'Українська — перекладати назви, описи та коментарі',
  'profile.readingHint':
    'Переклад лише для вас; оригінал залишається в базі. Текст надсилається в DeepL (потрібен DEEPL_API_KEY на сервері).',
  'profile.notify': 'Email, коли мене призначають або коментують моє завдання',
  'profile.notifyHint': 'Потрібен збережений email. Для завдань з вашим ім’ям на табло.',
  'profile.save': 'Зберегти профіль',
  'profile.notConfigured': 'Не налаштовано',

  'members.title': 'Керування учасниками',
  'members.teamHeading': 'Команда на табло',
  'members.teamHint':
    'Усі, кому можна призначати завдання. Додайте email і надішліть запрошення для пароля. Нових людей додавайте формою нижче.',
  'members.loading': 'Завантаження учасників…',
  'members.empty': 'Учасників ще немає.',
  'members.addHeading': 'Додати учасника',
  'members.add': 'Додати',
  'members.addAndInvite': 'Додати і надіслати запрошення',
  'members.inviteLink': 'Посилання запрошення',
  'members.copyLink': 'Копіювати',

  'theme.light': 'Світла',
  'theme.dark': 'Темна',
  'theme.toggle': 'Змінити тему',

  'projects.pageDescription':
    'Записи інсталяцій за локаціями — My People Bar, Vzorkovna та Краків.',
  'projects.remotePageDescription': 'Огляд статусу інсталяцій на місці.',
  'projects.addProject': 'Додати проєкт',
  'projects.loading': 'Завантаження інсталяцій…',
  'projects.noMatch': 'Немає інсталяцій з таким статусом.',
  'projects.open': 'Відкрити',
  'projects.filter.countAria': '{count} інсталяцій',

  'projects.location.my_people_bar': 'My People Bar',
  'projects.location.vzorkovna': 'Vzorkovna',
  'projects.location.krakow': 'Краків',

  'projects.lifecycle.concept': 'Фаза концепції',
  'projects.lifecycle.implementation': 'Фаза впровадження',
  'projects.lifecycle.waiting_tech_approval': 'Очікує технічного погодження',
  'projects.lifecycle.operational': 'Експлуатується',
  'projects.lifecycle.maintenance_needed': 'Потрібне обслуговування',

  'projects.operational.active': 'Активна',
  'projects.operational.issues': 'Виявлено проблеми',
  'projects.operational.broken': 'Офлайн',

  'projects.addDialog.title': 'Новий проєкт',
  'projects.addDialog.name': 'Назва проєкту',
  'projects.addDialog.namePlaceholder': 'напр. Starry Night',
  'projects.addDialog.location': 'Локація',
  'projects.addDialog.responsible': 'Відповідальна особа',
  'projects.addDialog.responsibleOptional': '(необов’язково)',
  'projects.addDialog.responsiblePlaceholder': 'напр. Gus',
  'projects.addDialog.nameError': 'Введіть назву проєкту.',
  'projects.addDialog.createError': 'Не вдалося створити проєкт. Спробуйте ще раз.',
  'projects.addDialog.creating': 'Створення…',

  'projects.detail.back': 'Назад до проєктів',
  'projects.detail.installationLabel': 'Інсталяція',
  'projects.detail.loading': 'Завантаження інсталяції…',
  'projects.detail.notFound': 'Інсталяцію не знайдено.',
  'projects.detail.statusSaveError': 'Не вдалося зберегти статус. Спробуйте ще раз.',
  'projects.detail.statusAria': 'Статус інсталяції',
  'projects.detail.openRemote': 'Відкрити віддалену сесію',
  'projects.detail.overview': 'Огляд',
  'projects.detail.meta.location': 'Локація',
  'projects.detail.meta.currentStatus': 'Поточний статус',
  'projects.detail.meta.responsible': 'Відповідальна особа',
  'projects.detail.meta.lastInspection': 'Останній огляд',
  'projects.detail.meta.nextMaintenance': 'Наступне обслуговування',
  'projects.detail.meta.revizniZprava': 'Revizní zpráva',
  'projects.detail.onFile': 'Є в архіві',
  'projects.detail.notOnFile': 'Немає в архіві',
  'projects.detail.photographs': 'Фотографії',
  'projects.detail.noPhotos': 'Фотографій ще не завантажено.',
  'projects.detail.defaultPhotograph': 'Фотографія',
  'projects.detail.technical': 'Технічна документація',
  'projects.detail.electrical': 'Електрична документація',
  'projects.detail.noElectrical': 'Електричних документів ще немає.',
  'projects.detail.malfunction': 'Несправності та історія ремонтів',
  'projects.detail.noRepairs': 'Несправностей і ремонтів ще не зафіксовано.',
  'projects.detail.repairResolved': 'Усунено',
  'projects.detail.repairOpen': 'Відкрито',

  'projects.tech.noDocs': 'Технічних документів ще немає.',
  'projects.tech.opening': 'Відкриття…',
  'projects.tech.removing': 'Видалення…',
  'projects.tech.defaultDoc': 'Документ',
  'projects.tech.defaultViewerTitle': 'Технічний документ',
  'projects.tech.openError': 'Не вдалося відкрити PDF. Спробуйте ще раз.',
  'projects.tech.pdfOnly': 'Тут можна завантажувати лише PDF.',
  'projects.tech.uploadFailed': 'Завантаження не вдалося.',
  'projects.tech.removeConfirm': 'Видалити «{label}» з технічної документації?',
  'projects.tech.removeFailed': 'Не вдалося видалити документ.',
  'projects.tech.upload': 'Завантажити PDF',
  'projects.tech.uploading': 'Завантаження…',
  'projects.tech.uploadHint':
    'Лише PDF, до 25 МБ. Команда може переглядати файли тут у браузері.',
};

export const taskboardMessages: Record<UserProfilePreferredLocale, Record<MessageKey, string>> = {
  en,
  uk,
};

export function formatMessage(template: string, vars?: Record<string, string>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

const GLOBAL_CATEGORY_KEYS: Record<string, MessageKey> = {
  quotations: 'category.quotations',
  designing: 'category.designing',
  installation: 'category.installation',
  repairs: 'category.repairs',
};

export function translateCategoryLabel(
  locale: UserProfilePreferredLocale,
  categoryId: string,
  fallback: string
) {
  const key = GLOBAL_CATEGORY_KEYS[categoryId];
  if (!key || locale === 'en') return fallback;
  return taskboardMessages.uk[key] ?? fallback;
}

export function translatePriorityLabel(
  locale: UserProfilePreferredLocale,
  priority: 'high' | 'normal' | 'low'
) {
  const key = `priority.${priority}` as MessageKey;
  return taskboardMessages[locale][key] ?? taskboardMessages.en[key];
}

type InstallationLocationKey = 'my_people_bar' | 'vzorkovna' | 'krakow';
type InstallationLifecycleKey =
  | 'concept'
  | 'implementation'
  | 'waiting_tech_approval'
  | 'operational'
  | 'maintenance_needed';

export function translateInstallationLocation(
  locale: UserProfilePreferredLocale,
  location: InstallationLocationKey,
  fallback: string
) {
  const key = `projects.location.${location}` as MessageKey;
  return taskboardMessages[locale][key] ?? fallback;
}

export function translateInstallationLifecycle(
  locale: UserProfilePreferredLocale,
  status: InstallationLifecycleKey,
  fallback: string
) {
  const key = `projects.lifecycle.${status}` as MessageKey;
  return taskboardMessages[locale][key] ?? fallback;
}

export function translateInstallationOperational(
  locale: UserProfilePreferredLocale,
  status: 'active' | 'issues' | 'broken'
) {
  const key = `projects.operational.${status}` as MessageKey;
  return taskboardMessages[locale][key] ?? taskboardMessages.en[key];
}
