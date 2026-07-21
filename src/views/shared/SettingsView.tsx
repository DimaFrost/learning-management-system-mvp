import { useState, useEffect, useRef } from 'react';
import type { User } from '../../types/lms';
import { useSettings } from '../../hooks/useSettings';
import { hasRole } from '../../utils/userUtils';
import { AvatarCropModal } from '../../components/modals/AvatarCropModal';
import {
  type GoogleDocsDiagnosticCheck,
  getGoogleDocsConnectionStatus,
  startGoogleDocsOAuth,
  testGoogleDocsSetup,
} from '../../utils/googleDocsV2';
import { Save, Bell, User as UserIcon, Camera, FileText, RefreshCcw, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { WorkspaceId } from '../../types/workspace';

interface SettingsViewProps {
  currentUser: User;
  activeWorkspace: WorkspaceId | null;
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

export function SettingsView({ currentUser, activeWorkspace, onProfileUpdated }: SettingsViewProps) {
  const { saving, error, successMessage, updateProfile, updateNotificationPreferences, uploadAvatar, removeAvatar } =
    useSettings(currentUser, onProfileUpdated);

  const [firstName, setFirstName] = useState(currentUser.firstName);
  const [lastName, setLastName] = useState(currentUser.lastName);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [filePickError, setFilePickError] = useState<string | null>(null);
  const [docsConnection, setDocsConnection] = useState<{
    connected_email: string;
    updated_at: string;
  } | null>(null);
  const [docsMessage, setDocsMessage] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [docsSaving, setDocsSaving] = useState(false);
  const [docsTesting, setDocsTesting] = useState(false);
  const [docsDiagnostics, setDocsDiagnostics] = useState<GoogleDocsDiagnosticCheck[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEditProfileName = hasRole(currentUser, 'administrator');
  const canManageGoogleDocs = activeWorkspace === 'administrator' && hasRole(currentUser, 'administrator');

  useEffect(() => {
    setFirstName(currentUser.firstName);
    setLastName(currentUser.lastName);
  }, [currentUser.firstName, currentUser.lastName]);

  useEffect(() => {
    if (!canManageGoogleDocs) return;
    const params = new URLSearchParams(window.location.search);
    const googleDocsStatus = params.get('google_docs');
    const googleDocsMessage = params.get('google_docs_message');

    if (googleDocsStatus === 'connected') {
      setDocsMessage(`Google Docs connected${googleDocsMessage ? ` as ${googleDocsMessage}` : ''}.`);
    } else if (googleDocsStatus === 'error') {
      setDocsError(googleDocsMessage || 'Google Docs authorization failed.');
    }

    if (googleDocsStatus) {
      params.delete('google_docs');
      params.delete('google_docs_message');
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
    }

    getGoogleDocsConnectionStatus()
      .then(result => {
        const connection = result.connection
          ? {
              connected_email: result.connection.connected_email,
              updated_at: result.connection.updated_at,
            }
          : null;

        setDocsConnection(connection);
      })
      .catch(() => {
        setDocsConnection(null);
      });
  }, [canManageGoogleDocs]);

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

  const connectGoogleDocs = async () => {
    setDocsSaving(true);
    setDocsError(null);
    setDocsMessage(null);
    try {
      const result = await startGoogleDocsOAuth(window.location.href);
      window.location.assign(result.authUrl);
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : 'Could not start Google Docs authorization.');
      setDocsSaving(false);
    }
  };

  const testGoogleConnection = async () => {
    setDocsTesting(true);
    setDocsError(null);
    setDocsMessage(null);
    try {
      const result = await testGoogleDocsSetup();
      setDocsDiagnostics(result.checks);
      setDocsMessage(result.ok ? 'Google Docs setup is ready.' : 'Google Docs setup needs attention.');
    } catch (err) {
      setDocsDiagnostics(null);
      setDocsError(err instanceof Error ? err.message : 'Could not test Google Docs setup.');
    } finally {
      setDocsTesting(false);
    }
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
              disabled={!canEditProfileName}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
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
              disabled={!canEditProfileName}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {!canEditProfileName && (
          <p className="text-xs text-gray-500">
            Name can only be changed by an administrator.
          </p>
        )}

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

        {canEditProfileName && (
          <button
            type="button"
            onClick={() => updateProfile({ firstName, lastName })}
            disabled={saving}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
        )}
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

      {canManageGoogleDocs && (
        <div className="overflow-hidden rounded-2xl border border-[#dbeafe] bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e0f2fe] bg-[#eff6ff] px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#2563eb] shadow-sm">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#172554]">Google Docs</h3>
                <p className="mt-1 max-w-2xl text-sm text-[#1e40af]">
                  Connect the school Google account used to create assignment documents in the Shared Drive.
                </p>
              </div>
            </div>
            <div className="rounded-full border border-[#bfdbfe] bg-white px-3 py-1 text-xs font-semibold text-[#1d4ed8]">
              Dedicated OAuth
            </div>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className={`h-5 w-5 ${docsConnection ? 'text-[#16a34a]' : 'text-[#a3a3a3]'}`} />
                <div>
                  <p className="text-sm font-semibold text-[#171717]">
                    {docsConnection ? docsConnection.connected_email : 'No Google account connected'}
                  </p>
                  <p className="text-xs text-[#737373]">
                    {docsConnection
                      ? `Last saved ${new Date(docsConnection.updated_at).toLocaleString()}`
                      : 'Connect the school Google account to create student assignment documents.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={connectGoogleDocs}
                  disabled={docsSaving}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#bfdbfe] bg-white px-3 py-2 text-sm font-semibold text-[#1d4ed8] hover:bg-[#eff6ff] disabled:opacity-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {docsSaving ? 'Opening Google...' : docsConnection ? 'Reconnect Google' : 'Connect Google'}
                </button>
                {docsConnection ? (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-sm font-semibold text-[#15803d]">
                    <CheckCircle2 className="h-4 w-4" />
                    Connected
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={testGoogleConnection}
                  disabled={docsTesting || !docsConnection}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm font-semibold text-[#404040] hover:bg-[#f5f5f5] disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {docsTesting ? 'Testing...' : 'Test setup'}
                </button>
              </div>
            </div>

            {docsDiagnostics && (
              <div className="grid gap-3 md:grid-cols-3">
                {docsDiagnostics.map(check => (
                  <div
                    key={check.label}
                    className={`rounded-xl border px-4 py-3 ${
                      check.ok
                        ? 'border-[#bbf7d0] bg-[#f0fdf4]'
                        : 'border-[#fecaca] bg-[#fef2f2]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className={`text-sm font-semibold ${check.ok ? 'text-[#14532d]' : 'text-[#991b1b]'}`}>
                        {check.label}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        check.ok ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'
                      }`}>
                        {check.ok ? 'Ready' : 'Fix'}
                      </span>
                    </div>
                    {check.name && <p className="mt-1 truncate text-xs font-medium text-[#525252]">{check.name}</p>}
                    <p className={`mt-2 text-xs leading-5 ${check.ok ? 'text-[#166534]' : 'text-[#991b1b]'}`}>
                      {check.message}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {docsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {docsError}
              </div>
            )}
            {docsMessage && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {docsMessage}
              </div>
            )}
          </div>
        </div>
      )}

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
