import {
  normalizeVisibleTo,
  visibleToSelection,
} from '../../lib/taskboard/projectVisibility';

interface ProjectVisibilityPickerProps {
  usernames: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export default function ProjectVisibilityPicker({
  usernames,
  selected,
  onChange,
  disabled = false,
}: ProjectVisibilityPickerProps) {
  const everyoneSelected = selected.length === usernames.length;

  const toggleUser = (username: string) => {
    if (disabled) return;
    if (selected.includes(username)) {
      onChange(selected.filter((name) => name !== username));
      return;
    }
    onChange([...selected, username]);
  };

  const toggleEveryone = () => {
    if (disabled) return;
    onChange(everyoneSelected ? [] : [...usernames]);
  };

  if (usernames.length === 0) {
    return <p className="text-xs tb-muted">No other users configured.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[0.65rem] tracking-[0.15em] uppercase tb-muted">Visible to</p>
      <label className="flex items-center gap-2 text-sm tb-text cursor-pointer">
        <input
          type="checkbox"
          checked={everyoneSelected}
          onChange={toggleEveryone}
          disabled={disabled}
          className="rounded border-[#dadce0]"
        />
        <span>Everyone</span>
      </label>
      <div className="flex flex-wrap gap-x-4 gap-y-2 pl-1">
        {usernames.map((username) => (
          <label key={username} className="flex items-center gap-2 text-sm tb-text cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(username)}
              onChange={() => toggleUser(username)}
              disabled={disabled}
              className="rounded border-[#dadce0]"
            />
            <span className="uppercase tracking-[0.12em] text-xs">{username}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function selectionToVisibleTo(
  selected: string[],
  usernames: string[]
): string[] | null {
  return normalizeVisibleTo(selected, usernames);
}

export function visibleToToSelection(
  visibleTo: string[] | null | undefined,
  usernames: string[]
): string[] {
  return visibleToSelection(visibleTo, usernames);
}
