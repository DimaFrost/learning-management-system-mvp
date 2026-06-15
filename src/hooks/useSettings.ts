import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../types/lms';

interface UpdateProfileData {
  firstName: string;
  lastName: string;
}

interface UpdateNotificationPreferences {
  announcements: boolean;
  roleChange: boolean;
  enrollment: boolean;
}

export function useSettings(currentUser: User, onProfileUpdated: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const updateProfile = async (data: UpdateProfileData) => {
    setSaving(true);
    setError(null);
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: data.firstName,
        last_name: data.lastName,
        name: fullName,
      })
      .eq('id', currentUser.id);

    setSaving(false);
    if (error) {
      setError('Failed to save profile.');
      console.error(error);
    } else {
      setSuccessMessage('Profile updated.');
      setTimeout(() => setSuccessMessage(null), 3000);
      onProfileUpdated(); // triggers refetch in useUsers/useAuth
    }
  };

  const updateNotificationPreferences = async (
    prefs: UpdateNotificationPreferences
  ) => {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('profiles')
      .update({ notification_preferences: prefs })
      .eq('id', currentUser.id);

    setSaving(false);
    if (error) {
      setError('Failed to save notification preferences.');
      console.error(error);
    } else {
      setSuccessMessage('Preferences saved.');
      setTimeout(() => setSuccessMessage(null), 3000);
      onProfileUpdated();
    }
  };

  return { saving, error, successMessage, updateProfile,
           updateNotificationPreferences };
}
