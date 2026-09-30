import { useEffect, useState } from 'react';
import { ASSIGNEES } from '../lib/taskboard/constants';
import { fetchAssigneeNames } from '../lib/taskboard/memberService';

export function useAssigneeNames() {
  const [names, setNames] = useState<string[]>([...ASSIGNEES]);

  useEffect(() => {
    let cancelled = false;
    fetchAssigneeNames()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setNames(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return names;
}
