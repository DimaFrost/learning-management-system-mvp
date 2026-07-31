import { announcementsTranslations } from './announcements';
import { appTranslations } from './app';
import { attendanceTranslations } from './attendance';
import { authTranslations } from './auth';
import { commonTranslations } from './common';
import { headerTranslations } from './header';
import { mentorshipTranslations } from './mentorship';
import { navigationTranslations } from './navigation';
import { onboardingTranslations } from './onboarding';
import { searchTranslations } from './search';
import { sessionsTranslations } from './sessions';
import { studentTranslations } from './student';
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
};

type BaseKeyWithSuffix<Key, Suffix extends string> = Key extends `${infer Base}.${Suffix}`
  ? Base
  : never;

/** Keys declared with both a `.one` and an `.other` variant, usable with `tCount`. */
export type PluralKey = BaseKeyWithSuffix<TranslationKey, 'one'> &
  BaseKeyWithSuffix<TranslationKey, 'other'>;
