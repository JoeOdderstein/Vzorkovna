import { useCallback, useContext, useEffect } from 'react';
import { UserProfileContext } from '../context/UserProfileContext';
import { useTaskboardAuth } from '../context/TaskboardAuthContext';
import {
  formatMessage,
  type MessageKey,
  taskboardMessages,
} from '../lib/taskboard/i18n/messages';
import type { UserProfilePreferredLocale } from '../lib/taskboard/types';

const LOCALE_CACHE_PREFIX = 'taskboard-preferred-locale';

export function cachePreferredLocaleForUser(
  username: string,
  locale: UserProfilePreferredLocale
) {
  try {
    localStorage.setItem(`${LOCALE_CACHE_PREFIX}:${username}`, locale);
  } catch {
    // ignore
  }
}

function readCachedLocale(username: string | null): UserProfilePreferredLocale {
  if (!username) return 'en';
  try {
    const value = localStorage.getItem(`${LOCALE_CACHE_PREFIX}:${username}`);
    return value === 'uk' ? 'uk' : 'en';
  } catch {
    return 'en';
  }
}

export function useTaskboardI18n() {
  const { username } = useTaskboardAuth();
  const profileCtx = useContext(UserProfileContext);
  const locale: UserProfilePreferredLocale =
    profileCtx?.profile?.preferred_locale ?? readCachedLocale(username);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string>) => {
      const template = taskboardMessages[locale][key] ?? taskboardMessages.en[key];
      return formatMessage(template, vars);
    },
    [locale]
  );

  useEffect(() => {
    document.documentElement.lang = locale === 'uk' ? 'uk' : 'en';
  }, [locale]);

  return { t, locale };
}
