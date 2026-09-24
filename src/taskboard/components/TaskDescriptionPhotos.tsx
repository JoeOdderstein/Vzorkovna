import { useEffect, useState } from 'react';
import type { TaskPhoto } from '../../lib/taskboard/types';
import { getTaskPhotoUrl } from '../../lib/taskboard/taskPhotoService';
import { isLocalTaskboardMode } from '../../lib/taskboard/taskService';

interface TaskDescriptionPhotosProps {
  photos: TaskPhoto[];
  loading?: boolean;
  uploading?: boolean;
  uploadError?: string;
  onUpload: (files: File[]) => void;
  onRemove: (photoId: string) => void;
}

export default function TaskDescriptionPhotos({
  photos,
  loading = false,
  uploading = false,
  uploadError,
  onUpload,
  onRemove,
}: TaskDescriptionPhotosProps) {
  return (
    <div className="mt-2 space-y-2">
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
          {photos.map((photo) => (
            <PhotoThumb
              key={photo.id}
              photo={photo}
              disabled={uploading}
              onRemove={() => onRemove(photo.id)}
            />
          ))}
        </ul>
      )}

      {loading && photos.length === 0 && (
        <p className="text-[11px] tb-text-muted">Loading photos…</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="text-xs tb-link-accent hover:underline cursor-pointer">
          Add photos
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const list = e.target.files;
              if (!list?.length) return;
              onUpload(Array.from(list));
              e.target.value = '';
            }}
          />
        </label>
        {uploading && <span className="text-[11px] tb-muted">Uploading…</span>}
      </div>

      {uploadError && <p className="text-[11px] text-red-600">{uploadError}</p>}
    </div>
  );
}

function PhotoThumb({
  photo,
  disabled,
  onRemove,
}: {
  photo: TaskPhoto;
  disabled: boolean;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    if (isLocalTaskboardMode() && !photo.storage_path.startsWith('data:')) {
      setPreviewError('Photo preview requires Supabase.');
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    setPreviewError('');

    getTaskPhotoUrl(photo.storage_path)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewUrl(null);
          setPreviewError('Could not load photo.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [photo.storage_path]);

  const openFullSize = () => {
    if (previewUrl) window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <li className="relative shrink-0">
      <button
        type="button"
        onClick={openFullSize}
        disabled={!previewUrl}
        className="tb-desc-photo group relative rounded-md border border-[var(--tb-surface-border)] overflow-hidden bg-[var(--tb-surface-muted)] disabled:opacity-60"
        title={photo.file_name || 'Open photo'}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="block h-20 w-20 object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center text-[10px] tb-text-muted px-1 text-center">
            …
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
          Open
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove photo"
        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-[#202124] text-white text-xs leading-none hover:bg-red-600 disabled:opacity-50 shadow"
      >
        ×
      </button>
      {previewError && (
        <p className="text-[10px] text-red-600 max-w-[5rem] mt-0.5">{previewError}</p>
      )}
    </li>
  );
}
