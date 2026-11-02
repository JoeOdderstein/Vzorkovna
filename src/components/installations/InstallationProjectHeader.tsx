import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronDown, ChevronUp, ImageIcon, Trash2, Upload } from 'lucide-react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import {
  clearInstallationHeaderImage,
  getInstallationHeaderImageUrl,
  updateInstallationHeaderImageFocusY,
  uploadInstallationHeaderImage,
} from '../../lib/installations/installationHeaderImageService';
import { clampHeaderImageFocusY } from '../../lib/installations/installationService';

interface InstallationProjectHeaderProps {
  installationId: string;
  headerImagePath: string | null;
  headerImageFocusY?: number;
  projectName: string;
  variant: 'detail' | 'card';
  /** Overview card: image fills the entire block behind the title. */
  cover?: boolean;
  /** Detail page: image fills the hero behind title and actions. */
  integrated?: boolean;
  isAdmin?: boolean;
}

export default function InstallationProjectHeader({
  installationId,
  headerImagePath,
  headerImageFocusY = 50,
  projectName,
  variant,
  cover = false,
  integrated = false,
  isAdmin = false,
}: InstallationProjectHeaderProps) {
  const { t } = useTaskboardI18n();
  const canManageHeaderPhoto = isAdmin && variant === 'detail';
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [focusY, setFocusY] = useState(() => clampHeaderImageFocusY(headerImageFocusY));
  const saveFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFocusSaveRef = useRef<number | null>(null);

  const imageVariant = variant === 'card' ? 'card' : 'detail';

  useEffect(() => {
    let cancelled = false;
    if (!headerImagePath) {
      setImageUrl(null);
      return;
    }
    void getInstallationHeaderImageUrl(headerImagePath, imageVariant).then((url) => {
      if (!cancelled) setImageUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [headerImagePath, imageVariant]);

  useEffect(() => {
    setFocusY(clampHeaderImageFocusY(headerImageFocusY));
  }, [installationId, headerImagePath]);

  useEffect(
    () => () => {
      if (saveFocusTimerRef.current) clearTimeout(saveFocusTimerRef.current);
    },
    [],
  );

  const showPlaceholder = canManageHeaderPhoto && !imageUrl && !uploading;

  if (!cover && !integrated && !canManageHeaderPhoto && !imageUrl) return null;

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await uploadInstallationHeaderImage(installationId, file, headerImagePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.header.uploadFailed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm(t('projects.header.removeConfirm'))) return;
    setUploading(true);
    setError('');
    try {
      await clearInstallationHeaderImage({
        id: installationId,
        header_image_path: headerImagePath,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.header.removeFailed'));
    } finally {
      setUploading(false);
    }
  };

  const openPicker = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    inputRef.current?.click();
  };

  const adjustFocus = (delta: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const next = clampHeaderImageFocusY(focusY + delta);
    if (next === focusY) return;
    setFocusY(next);
    setError('');
    pendingFocusSaveRef.current = next;
    if (saveFocusTimerRef.current) clearTimeout(saveFocusTimerRef.current);
    saveFocusTimerRef.current = setTimeout(() => {
      const toSave = pendingFocusSaveRef.current;
      if (toSave == null) return;
      void updateInstallationHeaderImageFocusY(installationId, toSave).catch((err) => {
        setError(err instanceof Error ? err.message : t('projects.header.positionFailed'));
      });
    }, 350);
  };

  const focusPosition = `center ${focusY}%`;

  const frameClass =
    variant === 'detail'
      ? [
          'tb-installation-header tb-installation-header--detail',
          integrated ? 'tb-installation-header--detail-integrated' : '',
        ]
          .filter(Boolean)
          .join(' ')
      : [
          'tb-installation-header tb-installation-header--card',
          cover ? 'tb-installation-header--card-cover' : '',
        ]
          .filter(Boolean)
          .join(' ');

  const awaitingImage = Boolean(headerImagePath) && !imageUrl && !uploading;

  return (
    <div className={`${frameClass}${awaitingImage ? ' tb-installation-header--loading' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt=""
            className="tb-installation-header__img"
            style={{ objectPosition: focusPosition }}
            loading={integrated || variant !== 'card' ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={integrated ? 'high' : variant === 'card' ? 'low' : 'high'}
          />
          {canManageHeaderPhoto ? (
            <>
              <div className="tb-installation-header__position">
                <button
                  type="button"
                  className="tb-installation-header__admin-btn"
                  disabled={uploading || focusY <= 0}
                  onClick={(e) => adjustFocus(-5, e)}
                  aria-label={t('projects.header.moveUp')}
                  title={t('projects.header.moveUp')}
                >
                  <ChevronUp size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className="tb-installation-header__admin-btn"
                  disabled={uploading || focusY >= 100}
                  onClick={(e) => adjustFocus(5, e)}
                  aria-label={t('projects.header.moveDown')}
                  title={t('projects.header.moveDown')}
                >
                  <ChevronDown size={14} aria-hidden />
                </button>
              </div>
              <div className="tb-installation-header__admin">
              <button
                type="button"
                className="tb-installation-header__admin-btn"
                disabled={uploading}
                onClick={openPicker}
                aria-label={
                  uploading ? t('projects.header.uploading') : t('projects.header.change')
                }
              >
                <Upload size={14} aria-hidden />
                <span className={variant === 'card' ? 'sr-only' : undefined}>
                  {uploading ? t('projects.header.uploading') : t('projects.header.change')}
                </span>
              </button>
              <button
                type="button"
                className="tb-installation-header__admin-btn tb-installation-header__admin-btn--danger"
                disabled={uploading}
                onClick={(e) => void handleRemove(e)}
                aria-label={t('common.remove')}
              >
                <Trash2 size={14} aria-hidden />
                <span className={variant === 'card' ? 'sr-only' : undefined}>{t('common.remove')}</span>
              </button>
            </div>
            </>
          ) : null}
        </>
      ) : showPlaceholder ? (
        <button
          type="button"
          className="tb-installation-header__placeholder"
          disabled={uploading}
          onClick={openPicker}
        >
          {uploading ? (
            <span className="text-sm tb-muted">{t('projects.header.uploading')}</span>
          ) : (
            <>
              <Camera size={variant === 'card' ? 16 : 22} className="tb-muted" aria-hidden />
              <span className="text-sm tb-muted">{t('projects.header.addPhoto')}</span>
            </>
          )}
        </button>
      ) : uploading ? (
        <div className="tb-installation-header__placeholder" aria-busy>
          <span className="text-sm tb-muted">{t('projects.header.uploading')}</span>
        </div>
      ) : (
        <div className="tb-installation-header__placeholder" aria-hidden>
          <ImageIcon size={20} className="tb-muted opacity-40" />
        </div>
      )}

      {error ? (
        <p className="tb-installation-header__error text-xs text-red-600 px-3 py-1">{error}</p>
      ) : null}
      <span className="sr-only">{projectName}</span>
    </div>
  );
}
