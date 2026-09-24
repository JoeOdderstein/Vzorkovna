import { useCallback, useEffect, useState } from 'react';
import type { TaskPhoto } from '../../lib/taskboard/types';
import { getTaskPhotoUrl } from '../../lib/taskboard/taskPhotoService';
import { isLocalTaskboardMode } from '../../lib/taskboard/taskService';
import TaskPhotoLightbox from './TaskPhotoLightbox';

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
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = useCallback((photoId: string) => {
    const index = photos.findIndex((photo) => photo.id === photoId);
    if (index >= 0 && previewUrls[photoId]) setLightboxIndex(index);
  }, [photos, previewUrls]);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const lightboxPhoto =
    lightboxIndex != null && lightboxIndex >= 0 && lightboxIndex < photos.length
      ? photos[lightboxIndex]
      : null;
  const lightboxUrl = lightboxPhoto ? previewUrls[lightboxPhoto.id] : null;

  return (
    <div className="mt-2 space-y-2">
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
          {photos.map((photo) => (
            <PhotoThumb
              key={photo.id}
              photo={photo}
              disabled={uploading}
              previewUrl={previewUrls[photo.id] ?? null}
              onPreviewUrl={(url) =>
                setPreviewUrls((prev) => ({ ...prev, [photo.id]: url }))
              }
              onOpen={() => openLightbox(photo.id)}
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

      {lightboxPhoto && lightboxUrl && (
        <TaskPhotoLightbox
          imageUrl={lightboxUrl}
          fileName={lightboxPhoto.file_name}
          onClose={closeLightbox}
          hasPrevious={lightboxIndex != null && lightboxIndex > 0}
          hasNext={lightboxIndex != null && lightboxIndex < photos.length - 1}
          onPrevious={() =>
            setLightboxIndex((i) => (i != null && i > 0 ? i - 1 : i))
          }
          onNext={() =>
            setLightboxIndex((i) =>
              i != null && i < photos.length - 1 ? i + 1 : i
            )
          }
        />
      )}
    </div>
  );
}

function PhotoThumb({
  photo,
  disabled,
  previewUrl,
  onPreviewUrl,
  onOpen,
  onRemove,
}: {
  photo: TaskPhoto;
  disabled: boolean;
  previewUrl: string | null;
  onPreviewUrl: (url: string) => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    if (isLocalTaskboardMode() && !photo.storage_path.startsWith('data:')) {
      setPreviewError('Photo preview requires Supabase.');
      return;
    }

    let cancelled = false;
    setPreviewError('');

    getTaskPhotoUrl(photo.storage_path)
      .then((url) => {
        if (!cancelled) onPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewError('Could not load photo.');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per storage path
  }, [photo.storage_path]);

  return (
    <li className="relative shrink-0">
      <button
        type="button"
        onClick={onOpen}
        disabled={!previewUrl}
        className="tb-desc-photo group relative rounded-md border border-[var(--tb-surface-border)] overflow-hidden bg-[var(--tb-surface-muted)] disabled:opacity-60"
        title={photo.file_name || 'View photo'}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="block h-20 w-20 object-cover" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center text-[10px] tb-text-muted px-1 text-center">
            …
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
          View
        </span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
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
