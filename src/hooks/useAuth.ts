import { useState, useEffect, useCallback } from 'react';
import { translate } from '../i18n/translate';
import { supabase } from '../lib/supabase';
import type { User } from '../types/lms';

async function fetchProfileFromDb(userId: string): Promise<User> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, roles, first_name, last_name, avatar_url, preferred_language, teaching_course_types, is_online_student')
    .eq('id', userId)
    .single();

  if (error) throw error;

  const { data: privateData, error: privateError } = await supabase
    .from('profile_private_data')
    .select('email, phone, notification_preferences')
    .eq('profile_id', userId)
    .maybeSingle();

  if (privateError) throw privateError;

  return {
    id: profile.id,
    name: profile.name,
    email: privateData?.email ?? '',
    phone: privateData?.phone ?? null,
    roles: profile.roles,
    firstName: profile.first_name ?? '',
    lastName: profile.last_name ?? '',
    avatarUrl: profile.avatar_url ?? null,
    preferredLanguage: profile.preferred_language === 'bg' ? 'bg' : 'en',
    teachingCourseTypes: profile.teaching_course_types ?? [],
    isOnlineStudent: profile.is_online_student ?? false,
    notificationPreferences: privateData?.notification_preferences ?? {
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
          setError(translate('errors.auth.loadProfileFailed'));
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
      setError(translate('errors.auth.loadProfileFailed'));
      console.error(err);
    }
  }, [currentUser]);

  return { currentUser, loading, error, signInWithGoogle, signOut, refetchProfile };
}
