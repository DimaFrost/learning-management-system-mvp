import { absenceTranslations } from './absence';
import { announcementsTranslations } from './announcements';
import { appTranslations } from './app';
import { assignmentTranslations } from './assignment';
import { attendanceTranslations } from './attendance';
import { authTranslations } from './auth';
import { classDetailTranslations } from './classDetail';
import { classworkTranslations } from './classwork';
import { commonTranslations } from './common';
import { editTranslations } from './edit';
import { filePreviewTranslations } from './filePreview';
import { gradeModalTranslations } from './gradeModal';
import { gradesTranslations } from './grades';
import { headerTranslations } from './header';
import { messagesTranslations } from './messages';
import { mentorshipTranslations } from './mentorship';
import { navigationTranslations } from './navigation';
import { onboardingTranslations } from './onboarding';
import { searchTranslations } from './search';
import { sessionsTranslations } from './sessions';
import { settingsTranslations } from './settings';
import { staffDashboardTranslations } from './staffDashboard';
import { studentTranslations } from './student';
import { submissionDetailTranslations } from './submissionDetail';
import { submissionsTranslations } from './submissions';
import { todosTranslations } from './todos';
import { workspaceTranslations } from './workspace';

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
  ...gradesTranslations.en,
  ...gradeModalTranslations.en,
  ...assignmentTranslations.en,
  ...editTranslations.en,
  ...submissionDetailTranslations.en,
  ...filePreviewTranslations.en,
  ...todosTranslations.en,
  ...messagesTranslations.en,
  ...absenceTranslations.en,
  ...settingsTranslations.en,
  ...submissionsTranslations.en,
  ...staffDashboardTranslations.en,
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
  ...gradesTranslations.bg,
  ...gradeModalTranslations.bg,
  ...assignmentTranslations.bg,
  ...editTranslations.bg,
  ...submissionDetailTranslations.bg,
  ...filePreviewTranslations.bg,
  ...todosTranslations.bg,
  ...messagesTranslations.bg,
  ...absenceTranslations.bg,
  ...settingsTranslations.bg,
  ...submissionsTranslations.bg,
  ...staffDashboardTranslations.bg,
};

type BaseKeyWithSuffix<Key, Suffix extends string> = Key extends `${infer Base}.${Suffix}`
  ? Base
  : never;

/** Keys declared with both a `.one` and an `.other` variant, usable with `tCount`. */
export type PluralKey = BaseKeyWithSuffix<TranslationKey, 'one'> &
  BaseKeyWithSuffix<TranslationKey, 'other'>;
