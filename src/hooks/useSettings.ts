import { useState } from 'react';
import { translate } from '../i18n/translate';
import { supabase } from '../lib/supabase';
import type { User } from '../types/lms';
import { hasRole } from '../utils/userUtils';

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
    if (!hasRole(currentUser, 'administrator')) {
      setSaving(false);
      setError(translate('settings.profile.nameAdminOnly'));
      return;
    }
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
      setError(translate('errors.settings.saveProfileFailed'));
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
    const { error: privateError } = await supabase
      .from('profile_private_data')
      .upsert({
        profile_id: currentUser.id,
        email: currentUser.email,
        phone: currentUser.phone,
        notification_preferences: prefs,
      }, { onConflict: 'profile_id' });

    setSaving(false);
    if (privateError) {
      setError(translate('errors.settings.saveNotificationsFailed'));
      console.error(privateError);
    } else {
      setSuccessMessage('Preferences saved.');
      setTimeout(() => setSuccessMessage(null), 3000);
      onProfileUpdated();
    }
  };

  const uploadAvatar = async (croppedBlob: Blob): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      if (croppedBlob.size > 2 * 1024 * 1024) {
        setError(translate('errors.settings.imageSize'));
        setSaving(false);
        return;
      }

      const path = `${currentUser.id}/avatar.jpg`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tbo-lms')
        .upload(path, croppedBlob, {
          upsert: true,
          cacheControl: '3600',
          contentType: 'image/jpeg',
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('tbo-lms')
        .getPublicUrl(uploadData.path);

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
      setError(translate('errors.settings.uploadPhotoFailed'));
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
      setError(translate('errors.settings.removePhotoFailed'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return { saving, error, successMessage, updateProfile,
           updateNotificationPreferences, uploadAvatar, removeAvatar };
}
