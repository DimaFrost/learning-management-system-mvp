import { ExternalLink, Video } from 'lucide-react';
import type { User } from '../../types/lms';
import { useLanguage } from '../../i18n/LanguageContext';
import { useOnlineSessionSettings } from '../../hooks/useOnlineSessionSettings';

/**
 * Prominent "Join live session" banner for online students. Google Meet cannot
 * be embedded in an iframe, so the button opens the school-wide Meet link in a
 * new tab. Renders nothing unless the signed-in student is flagged as an
 * online student and an admin has configured a link.
 */
export function JoinLiveSessionBanner({ currentUser }: { currentUser: User }) {
  const { t } = useLanguage();
  const { onlineSessionSettings } = useOnlineSessionSettings();
  const meetLink = onlineSessionSettings.meetLink.trim();

  if (!currentUser.isOnlineStudent || !meetLink) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#7dd3fc] bg-gradient-to-r from-[#f0f9ff] to-[#e0f2fe] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[#0369a1] shadow-sm ring-1 ring-[#bae6fd]">
          <Video className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[#0c4a6e]">{t('onlineSession.title')}</p>
          <p className="text-sm text-[#0369a1]">{t('onlineSession.description')}</p>
        </div>
      </div>
      <a
        href={meetLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0369a1] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#075985]"
      >
        <Video className="h-4 w-4" />
        {t('onlineSession.join')}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
