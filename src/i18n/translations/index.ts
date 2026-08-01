import { adminTranslations } from './admin';
import { absenceTranslations } from './absence';
import { announcementsTranslations } from './announcements';
import { appTranslations } from './app';
import { assignmentTranslations } from './assignment';
import { attendanceTranslations } from './attendance';
import { authTranslations } from './auth';
import { classDetailTranslations } from './classDetail';
import { classworkTranslations } from './classwork';
import { commonTranslations } from './common';
import { curriculumTranslations } from './curriculum';
import { editTranslations } from './edit';
import { filePreviewTranslations } from './filePreview';
import { gradeModalTranslations } from './gradeModal';
import { gradesTranslations } from './grades';
import { headerTranslations } from './header';
import { inboxTranslations } from './inbox';
import { messagesTranslations } from './messages';
import { mentorshipTranslations } from './mentorship';
import { navigationTranslations } from './navigation';
import { onboardingTranslations } from './onboarding';
import { planningTranslations } from './planning';
import { searchTranslations } from './search';
import { sessionsTranslations } from './sessions';
import { settingsTranslations } from './settings';
import { ministryTranslations } from './ministry';
import { staffDashboardTranslations } from './staffDashboard';
import { studentTranslations } from './student';
import { teacherTranslations } from './teacher';
import { submissionDetailTranslations } from './submissionDetail';
import { submissionsTranslations } from './submissions';
import { todosTranslations } from './todos';
import { booksTranslations } from './books';
import { tuitionTranslations } from './tuition';
import { usersTranslations } from './users';
import { workspaceTranslations } from './workspace';
import { knowledgeBaseTranslations } from './knowledgeBase';

export const en = {
  ...commonTranslations.en,
  ...appTranslations.en,
  ...headerTranslations.en,
  ...workspaceTranslations.en,
  ...navigationTranslations.en,
  ...announcementsTranslations.en,
  ...sessionsTranslations.en,
  ...mentorshipTranslations.en,
  ...authTranslations.en,
  ...onboardingTranslations.en,
  ...searchTranslations.en,
  ...attendanceTranslations.en,
  ...studentTranslations.en,
  ...classworkTranslations.en,
  ...classDetailTranslations.en,
  ...curriculumTranslations.en,
  ...gradesTranslations.en,
  ...gradeModalTranslations.en,
  ...assignmentTranslations.en,
  ...editTranslations.en,
  ...submissionDetailTranslations.en,
  ...filePreviewTranslations.en,
  ...todosTranslations.en,
  ...messagesTranslations.en,
  ...inboxTranslations.en,
  ...absenceTranslations.en,
  ...settingsTranslations.en,
  ...submissionsTranslations.en,
  ...staffDashboardTranslations.en,
  ...adminTranslations.en,
  ...ministryTranslations.en,
  ...planningTranslations.en,
  ...teacherTranslations.en,
  ...tuitionTranslations.en,
  ...usersTranslations.en,
  ...booksTranslations.en,
  ...knowledgeBaseTranslations.en,
};

export type TranslationKey = keyof typeof en;

export const bg: Record<TranslationKey, string> = {
  ...commonTranslations.bg,
  ...appTranslations.bg,
  ...headerTranslations.bg,
  ...workspaceTranslations.bg,
  ...navigationTranslations.bg,
  ...announcementsTranslations.bg,
  ...sessionsTranslations.bg,
  ...mentorshipTranslations.bg,
  ...authTranslations.bg,
  ...onboardingTranslations.bg,
  ...searchTranslations.bg,
  ...attendanceTranslations.bg,
  ...studentTranslations.bg,
  ...classworkTranslations.bg,
  ...classDetailTranslations.bg,
  ...curriculumTranslations.bg,
  ...gradesTranslations.bg,
  ...gradeModalTranslations.bg,
  ...assignmentTranslations.bg,
  ...editTranslations.bg,
  ...submissionDetailTranslations.bg,
  ...filePreviewTranslations.bg,
  ...todosTranslations.bg,
  ...messagesTranslations.bg,
  ...inboxTranslations.bg,
  ...absenceTranslations.bg,
  ...settingsTranslations.bg,
  ...submissionsTranslations.bg,
  ...staffDashboardTranslations.bg,
  ...adminTranslations.bg,
  ...ministryTranslations.bg,
  ...planningTranslations.bg,
  ...teacherTranslations.bg,
  ...tuitionTranslations.bg,
  ...usersTranslations.bg,
  ...booksTranslations.bg,
  ...knowledgeBaseTranslations.bg,
};

/**
 * Bases that have both `.one` and `.other` variants, usable with `tCount`.
 * Mapped extraction stays tractable after large dictionaries (intersection of
 * two distributed conditionals collapsed to `never` past ~1k keys).
 */
export type PluralKey = {
  [K in TranslationKey]: K extends `${infer Base}.one`
    ? `${Base}.other` extends TranslationKey
      ? Base
      : never
    : never;
}[TranslationKey];
