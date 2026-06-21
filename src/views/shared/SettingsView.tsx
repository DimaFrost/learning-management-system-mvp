import { useState, useEffect, useRef } from 'react';
import type { User } from '../../types/lms';
import { useSettings } from '../../hooks/useSettings';
import { AvatarCropModal } from '../../components/modals/AvatarCropModal';
import { Save, Bell, User as UserIcon, Camera } from 'lucide-react';

interface SettingsViewProps {
  currentUser: User;
  onProfileUpdated: () => void;
}

type NotificationPreferenceKey = keyof User['notificationPreferences'];

const NOTIFICATION_TOGGLES: {
  key: NotificationPreferenceKey;
  label: string;
  sublabel: string;
}[] = [
  {
    key: 'announcements',
    label: 'New Announcements',
    sublabel: 'Receive an email when a new announcement is posted',
  },
  {
    key: 'roleChange',
    label: 'Role Changes',
    sublabel: 'Receive an email when your role in the platform is updated',
  },
  {
    key: 'enrollment',
    label: 'Course Enrollment',
    sublabel: 'Receive an email when you are added to a course',
  },
  {
    key: 'messages',
    label: 'Direct Messages',
    sublabel: 'Receive an email when someone sends you a message',
  },
];

function NotificationToggle({
  label,
  sublabel,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  sublabel: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 ${
          checked ? 'bg-amber-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsView({ currentUser, onProfileUpdated }: SettingsViewProps) {
  const { saving, error, successMessage, updateProfile, updateNotificationPreferences, uploadAvatar, removeAvatar } =
    useSettings(currentUser, onProfileUpdated);

  const [firstName, setFirstName] = useState(currentUser.firstName);
  const [lastName, setLastName] = useState(currentUser.lastName);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [filePickError, setFilePickError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFirstName(currentUser.firstName);
    setLastName(currentUser.lastName);
  }, [currentUser.firstName, currentUser.lastName]);

  const isProfileSuccess =
    successMessage === 'Profile updated.' ||
    successMessage === 'Profile photo updated.' ||
    successMessage === 'Profile photo removed.';
  const isPrefsSuccess = successMessage === 'Preferences saved.';

  const handleTogglePreference = (key: NotificationPreferenceKey) => {
    updateNotificationPreferences({
      ...currentUser.notificationPreferences,
      [key]: !currentUser.notificationPreferences[key],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage your profile and notification preferences
        </p>
      </div>

      {(error || filePickError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error || filePickError}
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">Profile</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-first-name" className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              id="settings-first-name"
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="settings-last-name" className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              id="settings-last-name"
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <p className="block text-sm font-medium text-gray-700 mb-1">Email</p>
          <p className="text-gray-900">{currentUser.email}</p>
          <p className="text-xs text-gray-500 mt-1">
            Email is managed by Google and cannot be changed here.
          </p>
        </div>

        <div className="flex flex-col items-center">
          {currentUser.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt="Profile photo"
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-3xl font-bold">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                if (!file.type.startsWith('image/')) {
                  setFilePickError('Please select an image file.');
                  return;
                }
                setFilePickError(null);
                setPendingFile(file);
              }
              e.target.value = '';
            }}
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="inline-flex items-center justify-center border border-amber-600 text-amber-600 px-4 py-2 rounded-lg hover:bg-amber-50 disabled:opacity-50 text-sm font-medium"
            >
              <Camera className="w-4 h-4 mr-2" />
              {saving ? 'Uploading...' : 'Change Photo'}
            </button>
            {currentUser.avatarUrl && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Remove your profile photo?')) {
                    removeAvatar();
                  }
                }}
                disabled={saving}
                className="text-sm text-red-600 hover:text-red-700 font-medium ml-3 disabled:opacity-50"
              >
                Remove Photo
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            JPG, PNG or GIF · Max 2MB
          </p>
        </div>

        {isProfileSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <button
          type="button"
          onClick={() => updateProfile({ firstName, lastName })}
          disabled={saving}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Email Notifications</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">Choose which emails you want to receive.</p>
        </div>

        <div>
          {NOTIFICATION_TOGGLES.map(toggle => (
            <NotificationToggle
              key={toggle.key}
              label={toggle.label}
              sublabel={toggle.sublabel}
              checked={currentUser.notificationPreferences[toggle.key]}
              disabled={saving}
              onChange={() => handleTogglePreference(toggle.key)}
            />
          ))}
        </div>

        {isPrefsSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}
      </div>

      {pendingFile && (
        <AvatarCropModal
          file={pendingFile}
          saving={saving}
          onClose={() => setPendingFile(null)}
          onCropComplete={async blob => {
            await uploadAvatar(blob);
            setPendingFile(null);
          }}
        />
      )}
    </div>
  );
}
