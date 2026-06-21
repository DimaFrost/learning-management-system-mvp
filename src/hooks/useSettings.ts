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
  messages: boolean;
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

  const uploadAvatar = async (file: File): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file.');
        setSaving(false);
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        setError('Image must be under 2MB.');
        setSaving(false);
        return;
      }

      const ext = file.name.split('.').pop();
      const path = `${currentUser.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('tbo-lms')
        .upload(path, file, {
          upsert: true,
          cacheControl: '3600',
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('tbo-lms')
        .getPublicUrl(path);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', currentUser.id);
      if (profileError) throw profileError;

      setSuccessMessage('Profile photo updated.');
      setTimeout(() => setSuccessMessage(null), 3000);
      onProfileUpdated();
    } catch (err) {
      setError('Failed to upload photo. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const removeAvatar = async (): Promise<void> => {
    if (!currentUser.avatarUrl) return;
    setSaving(true);
    setError(null);
    try {
      const possiblePaths = ['jpg', 'jpeg', 'png', 'gif', 'webp'].map(
        ext => `${currentUser.id}/avatar.${ext}`
      );
      await supabase.storage.from('tbo-lms').remove(possiblePaths);

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', currentUser.id);
      if (error) throw error;

      setSuccessMessage('Profile photo removed.');
      setTimeout(() => setSuccessMessage(null), 3000);
      onProfileUpdated();
    } catch (err) {
      setError('Failed to remove photo.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return { saving, error, successMessage, updateProfile,
           updateNotificationPreferences, uploadAvatar, removeAvatar };
}
