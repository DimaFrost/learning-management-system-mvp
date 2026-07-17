import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AppLanguage = 'en' | 'bg';

type TranslationKey =
  | 'app.brand'
  | 'app.subtitle'
  | 'language.label'
  | 'language.english'
  | 'language.bulgarian'
  | 'header.signOut'
  | 'header.switchRole'
  | 'sidebar.school'
  | 'sidebar.operations'
  | 'sidebar.myWork'
  | 'sidebar.dashboard'
  | 'sidebar.dashboard.desc'
  | 'sidebar.announcements'
  | 'sidebar.announcements.desc'
  | 'sidebar.messages'
  | 'sidebar.messages.desc'
  | 'sidebar.todos'
  | 'sidebar.todos.desc'
  | 'sidebar.curriculum'
  | 'sidebar.curriculum.desc'
  | 'sidebar.users'
  | 'sidebar.users.desc'
  | 'sidebar.attendance'
  | 'sidebar.attendance.desc'
  | 'sidebar.mentorship'
  | 'sidebar.mentorship.desc'
  | 'sidebar.mentorOps'
  | 'sidebar.mentorOps.desc'
  | 'sidebar.mySessions'
  | 'sidebar.mySessions.desc'
  | 'sidebar.translationDesk'
  | 'sidebar.translationDesk.desc'
  | 'sidebar.mentorDashboard'
  | 'sidebar.mentorDashboard.desc'
  | 'sidebar.myCourse'
  | 'sidebar.myCourse.desc'
  | 'sidebar.onDuty'
  | 'sidebar.onDuty.desc'
  | 'sidebar.myAttendance'
  | 'sidebar.myAttendance.desc'
  | 'sidebar.settings'
  | 'sidebar.settings.desc'
  | 'sidebar.menu'
  | 'sidebar.schoolWorkspace'
  | 'sidebar.workspace'
  | 'sidebar.module'
  | 'sidebar.mainMenu'
  | 'sidebar.mainMenu.desc'
  | 'sidebar.live'
  | 'announcements.title'
  | 'announcements.new'
  | 'announcements.loading'
  | 'announcements.empty'
  | 'announcements.emptyFiltered'
  | 'announcements.edited'
  | 'announcements.draft'
  | 'announcements.scheduled'
  | 'announcements.trash'
  | 'announcements.pinned';

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: {
    'app.brand': 'The Burning Ones',
    'app.subtitle': 'Learning management system',
    'language.label': 'Language',
    'language.english': 'English',
    'language.bulgarian': 'Bulgarian',
    'header.signOut': 'Sign out',
    'header.switchRole': 'Switch role',
    'sidebar.school': 'School',
    'sidebar.operations': 'Operations',
    'sidebar.myWork': 'My Work',
    'sidebar.dashboard': 'Dashboard',
    'sidebar.dashboard.desc': 'Overview',
    'sidebar.announcements': 'Stream',
    'sidebar.announcements.desc': 'Posts and notices',
    'sidebar.messages': 'Messages',
    'sidebar.messages.desc': 'Conversations',
    'sidebar.todos': 'To-dos',
    'sidebar.todos.desc': 'Daily work',
    'sidebar.curriculum': 'Curriculum',
    'sidebar.curriculum.desc': 'Courses and sessions',
    'sidebar.users': 'People',
    'sidebar.users.desc': 'People and roles',
    'sidebar.attendance': 'Attendance',
    'sidebar.attendance.desc': 'Presence and duty',
    'sidebar.mentorship': 'Mentorship',
    'sidebar.mentorship.desc': 'Pairs, follow-up & rules',
    'sidebar.mentorOps': 'Mentor Ops',
    'sidebar.mentorOps.desc': 'Cadence and logs',
    'sidebar.mySessions': 'My Sessions',
    'sidebar.mySessions.desc': 'Teaching schedule',
    'sidebar.translationDesk': 'Translation Desk',
    'sidebar.translationDesk.desc': 'Session support',
    'sidebar.mentorDashboard': 'Mentor Dashboard',
    'sidebar.mentorDashboard.desc': 'Students',
    'sidebar.myCourse': 'My Course',
    'sidebar.myCourse.desc': 'Student view',
    'sidebar.onDuty': 'On Duty',
    'sidebar.onDuty.desc': 'This week',
    'sidebar.myAttendance': 'My Attendance',
    'sidebar.myAttendance.desc': 'Personal record',
    'sidebar.settings': 'Settings',
    'sidebar.settings.desc': 'Profile and account',
    'sidebar.menu': 'Menu',
    'sidebar.schoolWorkspace': 'School workspace',
    'sidebar.workspace': 'Workspace',
    'sidebar.module': 'Module',
    'sidebar.mainMenu': 'Main menu',
    'sidebar.mainMenu.desc': 'Back to primary sidebar',
    'sidebar.live': 'Live',
    'announcements.title': 'Stream',
    'announcements.new': 'New post',
    'announcements.loading': 'Loading stream...',
    'announcements.empty': 'No posts yet.',
    'announcements.emptyFiltered': 'No posts.',
    'announcements.edited': 'Edited',
    'announcements.draft': 'Draft',
    'announcements.scheduled': 'Scheduled',
    'announcements.trash': 'Trash',
    'announcements.pinned': 'Pinned',
  },
  bg: {
    'app.brand': 'The Burning Ones',
    'app.subtitle': 'Училищен портал',
    'language.label': 'Език',
    'language.english': 'Английски',
    'language.bulgarian': 'Български',
    'header.signOut': 'Изход',
    'header.switchRole': 'Смени роля',
    'sidebar.school': 'Училище',
    'sidebar.operations': 'Операции',
    'sidebar.myWork': 'Моята работа',
    'sidebar.dashboard': 'Табло',
    'sidebar.dashboard.desc': 'Преглед',
    'sidebar.announcements': 'Поток',
    'sidebar.announcements.desc': 'Публикации и известия',
    'sidebar.messages': 'Съобщения',
    'sidebar.messages.desc': 'Разговори',
    'sidebar.todos': 'Задачи',
    'sidebar.todos.desc': 'Дневна работа',
    'sidebar.curriculum': 'Програма',
    'sidebar.curriculum.desc': 'Курсове и сесии',
    'sidebar.users': 'Хора',
    'sidebar.users.desc': 'Хора и роли',
    'sidebar.attendance': 'Присъствие',
    'sidebar.attendance.desc': 'Присъствие и дежурства',
    'sidebar.mentorship': 'Менторство',
    'sidebar.mentorship.desc': 'Двойки, проследяване и правила',
    'sidebar.mentorOps': 'Ментор екип',
    'sidebar.mentorOps.desc': 'Ритъм и записи',
    'sidebar.mySessions': 'Моите сесии',
    'sidebar.mySessions.desc': 'График за преподаване',
    'sidebar.translationDesk': 'Преводач',
    'sidebar.translationDesk.desc': 'Подкрепа за сесии',
    'sidebar.mentorDashboard': 'Ментор табло',
    'sidebar.mentorDashboard.desc': 'Студенти',
    'sidebar.myCourse': 'Моят курс',
    'sidebar.myCourse.desc': 'Студентски изглед',
    'sidebar.onDuty': 'Дежурство',
    'sidebar.onDuty.desc': 'Тази седмица',
    'sidebar.myAttendance': 'Моето присъствие',
    'sidebar.myAttendance.desc': 'Личен запис',
    'sidebar.settings': 'Настройки',
    'sidebar.settings.desc': 'Профил и акаунт',
    'sidebar.menu': 'Меню',
    'sidebar.schoolWorkspace': 'Училищно работно място',
    'sidebar.workspace': 'Работно място',
    'sidebar.module': 'Модул',
    'sidebar.mainMenu': 'Главно меню',
    'sidebar.mainMenu.desc': 'Назад към основното меню',
    'sidebar.live': 'Активно',
    'announcements.title': 'Поток',
    'announcements.new': 'Нова публикация',
    'announcements.loading': 'Зареждане на потока...',
    'announcements.empty': 'Все още няма публикации.',
    'announcements.emptyFiltered': 'Няма публикации.',
    'announcements.edited': 'Редактирано',
    'announcements.draft': 'Чернова',
    'announcements.scheduled': 'Планирано',
    'announcements.trash': 'Кошче',
    'announcements.pinned': 'Закачено',
  },
};

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getStoredLanguage(): AppLanguage {
  const stored = localStorage.getItem('tbo-language');
  return stored === 'bg' ? 'bg' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(getStoredLanguage);

  useEffect(() => {
    localStorage.setItem('tbo-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: setLanguageState,
    t: key => translations[language][key] ?? translations.en[key] ?? key,
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
