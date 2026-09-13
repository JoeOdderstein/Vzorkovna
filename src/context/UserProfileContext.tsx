import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTaskboardAuth } from './TaskboardAuthContext';
import { isSupabaseConfigured } from '../lib/taskboard/config';
import type { UserProfile, UserProfileUpdate } from '../lib/taskboard/types';
import {
  fetchOrCreateUserProfile,
  isUserProfilesReady,
  updateUserProfile,
} from '../lib/taskboard/userProfileService';
import { getErrorMessage } from '../lib/taskboard/profileErrors';

interface UserProfileContextValue {
  profile: UserProfile | null;
  loading: boolean;
  profilesReady: boolean;
  error: string;
  updateProfile: (updates: UserProfileUpdate) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { username, authenticated, sessionReady } = useTaskboardAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilesReady, setProfilesReady] = useState(true);
  const [error, setError] = useState('');
  const loadOpRef = useRef(0);

  const refreshProfile = useCallback(async () => {
    const opId = ++loadOpRef.current;

    if (!authenticated || !username) {
      setProfile(null);
      setLoading(false);
      setError('');
      return;
    }

    if (isSupabaseConfigured() && !sessionReady) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const ready = await isUserProfilesReady();
      if (opId !== loadOpRef.current) return;

      setProfilesReady(ready);
      const nextProfile = await fetchOrCreateUserProfile(username);
      if (opId !== loadOpRef.current) return;

      setProfile(nextProfile);
    } catch (err) {
      if (opId !== loadOpRef.current) return;
      setProfile(null);
      setError(getErrorMessage(err, 'Could not load profile.'));
    } finally {
      if (opId === loadOpRef.current) setLoading(false);
    }
  }, [authenticated, username, sessionReady]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const updateProfile = useCallback(
    async (updates: UserProfileUpdate) => {
      if (!username) return;

      const previous = profile;
      if (profile) {
        setProfile({ ...profile, ...updates, updated_at: new Date().toISOString() });
      }

      try {
        const nextProfile = await updateUserProfile(username, updates);
        setProfile(nextProfile);
        setError('');
      } catch (err) {
        setProfile(previous);
        const message = getErrorMessage(err, 'Could not save profile.');
        setError(message);
        throw new Error(message);
      }
    },
    [username, profile]
  );

  const value = useMemo(
    () => ({
      profile,
      loading,
      profilesReady,
      error,
      updateProfile,
      refreshProfile,
    }),
    [profile, loading, profilesReady, error, updateProfile, refreshProfile]
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used within UserProfileProvider');
  return ctx;
}
