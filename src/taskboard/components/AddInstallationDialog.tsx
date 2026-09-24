import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  INSTALLATION_LOCATION_LABELS,
  INSTALLATION_LOCATIONS,
} from '../../lib/installations/constants';
import { createInstallation } from '../../lib/installations/installationService';
import type { InstallationLocation } from '../../lib/installations/types';
import { installationDetailPath } from '../../lib/taskboard/driveConstants';

interface AddInstallationDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AddInstallationDialog({ open, onClose }: AddInstallationDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [location, setLocation] = useState<InstallationLocation>('vzorkovna');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setLocation('vzorkovna');
    setResponsiblePerson('');
    setSubmitting(false);
    setError('');
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Enter a project name.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const created = await createInstallation({
        name: name.trim(),
        location,
        responsible_person: responsiblePerson.trim() || null,
      });
      onClose();
      navigate(installationDetailPath(created.id));
    } catch {
      setError('Could not create project. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="taskboard fixed inset-0 z-[80] flex items-center justify-center px-6">
      <div className="absolute inset-0 tb-overlay" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-lg tb-remote-inst-card shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="add-installation-title"
      >
        <div className="sticky top-0 border-b border-[var(--tb-border)] px-6 py-4 flex items-center justify-between bg-[var(--tb-bg)]">
          <h2 id="add-installation-title" className="tb-heading">
            New project
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="tb-muted hover:text-[var(--tb-text)] transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <div>
            <label htmlFor="installation-name" className="tb-field-label block mb-2">
              Project name
            </label>
            <input
              id="installation-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field-input w-full"
              placeholder="e.g. Starry Night"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="installation-location" className="tb-field-label block mb-2">
              Location
            </label>
            <select
              id="installation-location"
              value={location}
              onChange={(event) => setLocation(event.target.value as InstallationLocation)}
              className="field-input w-full"
            >
              {INSTALLATION_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {INSTALLATION_LOCATION_LABELS[loc]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="installation-responsible" className="tb-field-label block mb-2">
              Responsible person <span className="tb-muted font-normal">(optional)</span>
            </label>
            <input
              id="installation-responsible"
              type="text"
              value={responsiblePerson}
              onChange={(event) => setResponsiblePerson(event.target.value)}
              className="field-input w-full"
              placeholder="e.g. Gus"
            />
          </div>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="tb-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="tb-btn-primary disabled:opacity-50">
              {submitting ? 'Creating…' : 'Add project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
