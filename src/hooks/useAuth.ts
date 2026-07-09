import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../types/lms';

async function fetchProfileFromDb(userId: string): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    roles: data.roles,
    firstName: data.first_name ?? '',
    lastName: data.last_name ?? '',
    avatarUrl: data.avatar_url ?? null,
    preferredLanguage: data.preferred_language === 'bg' ? 'bg' : 'en',
    notificationPreferences: data.notification_preferences ?? {
      announcements: true,
      roleChange: true,
      enrollment: true,
      messages: true,
    },
  };
}

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let hasLoadedUser = false;

    const loadProfile = (userId: string, options?: { showLoading?: boolean }) => {
      if (options?.showLoading) setLoading(true);

      setTimeout(async () => {
        if (cancelled) return;
        try {
          const profile = await fetchProfileFromDb(userId);
          if (cancelled) return;
          setCurrentUser(profile);
          setError(null);
          hasLoadedUser = true;
        } catch (err) {
          if (cancelled) return;
          setError('Failed to load user profile');
          console.error(err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }, 0);
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        if (session?.user) {
          loadProfile(session.user.id);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;

      if (event === 'SIGNED_OUT' || !session?.user) {
        hasLoadedUser = false;
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      if (event === 'USER_UPDATED') {
        loadProfile(session.user.id);
        return;
      }

      if (event === 'SIGNED_IN') {
        loadProfile(session.user.id, { showLoading: !hasLoadedUser });
        return;
      }

      if (!hasLoadedUser) {
        loadProfile(session.user.id, { showLoading: true });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (signInError) setError(signInError.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const refetchProfile = useCallback(async () => {
    if (!currentUser) return;
    try {
      const profile = await fetchProfileFromDb(currentUser.id);
      setCurrentUser(profile);
      setError(null);
    } catch (err) {
      setError('Failed to load user profile');
      console.error(err);
    }
  }, [currentUser]);

  return { currentUser, loading, error, signInWithGoogle, signOut, refetchProfile };
}
