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
  | 'announcements.pinned'
  | 'onlineSession.title'
  | 'onlineSession.description'
  | 'onlineSession.join'
  | 'checkin.title.new'
  | 'checkin.title.edit'
  | 'checkin.month.label'
  | 'checkin.month.january'
  | 'checkin.month.february'
  | 'checkin.month.march'
  | 'checkin.month.april'
  | 'checkin.month.may'
  | 'checkin.month.june'
  | 'checkin.month.july'
  | 'checkin.month.august'
  | 'checkin.month.september'
  | 'checkin.month.october'
  | 'checkin.month.november'
  | 'checkin.month.december'
  | 'checkin.q1.label'
  | 'checkin.q1.yes'
  | 'checkin.q1.plannedSoon'
  | 'checkin.q1.unable'
  | 'checkin.q2.label'
  | 'checkin.q2.0'
  | 'checkin.q2.1'
  | 'checkin.q2.2'
  | 'checkin.q2.moreThan2'
  | 'checkin.q3.label'
  | 'checkin.q3.regularly'
  | 'checkin.q3.occasionally'
  | 'checkin.q3.no'
  | 'checkin.q4.label'
  | 'checkin.q5.label'
  | 'checkin.q5.veryHigh'
  | 'checkin.q5.good'
  | 'checkin.q5.moderate'
  | 'checkin.q5.low'
  | 'checkin.q6.label'
  | 'checkin.q7.label'
  | 'checkin.q8.label'
  | 'checkin.q9.label'
  | 'checkin.cancel'
  | 'checkin.save.create'
  | 'checkin.save.update'
  | 'checkin.error.required';

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
    'onlineSession.title': 'Live session',
    'onlineSession.description': 'Join the class online once the meeting has been started.',
    'onlineSession.join': 'Join live session',
    'checkin.title.new': 'Log Check-in with',
    'checkin.title.edit': 'Edit Check-in with',
    'checkin.month.label': 'Month of conducted meetings',
    'checkin.month.january': 'January',
    'checkin.month.february': 'February',
    'checkin.month.march': 'March',
    'checkin.month.april': 'April',
    'checkin.month.may': 'May',
    'checkin.month.june': 'June',
    'checkin.month.july': 'July',
    'checkin.month.august': 'August',
    'checkin.month.september': 'September',
    'checkin.month.october': 'October',
    'checkin.month.november': 'November',
    'checkin.month.december': 'December',
    'checkin.q1.label': 'Did you have an in-person meeting with your mentee last month?',
    'checkin.q1.yes': 'Yes',
    'checkin.q1.plannedSoon': 'No, but we have a meeting planned soon',
    'checkin.q1.unable': 'I wasn’t able to meet',
    'checkin.q2.label': 'How many in-person meetings did you have during this period?',
    'checkin.q2.0': '0',
    'checkin.q2.1': '1',
    'checkin.q2.2': '2',
    'checkin.q2.moreThan2': 'More than 2',
    'checkin.q3.label': 'Did you stay in touch between meetings (by phone call, messages, or online conversations)?',
    'checkin.q3.regularly': 'Yes, regularly',
    'checkin.q3.occasionally': 'Occasionally',
    'checkin.q3.no': 'No',
    'checkin.q4.label': 'What was the main topic of discussion during your last meeting?',
    'checkin.q5.label': 'How would you describe your mentee’s engagement and openness over the past month?',
    'checkin.q5.veryHigh': 'Very high',
    'checkin.q5.good': 'Good',
    'checkin.q5.moderate': 'Moderate',
    'checkin.q5.low': 'Low',
    'checkin.q6.label': 'Have you experienced any difficulties or challenges in mentoring during this period?',
    'checkin.q7.label': 'Is there anything the school can do to support you as a mentor?',
    'checkin.q8.label': 'Share one positive moment or sign of progress you noticed in your mentee over the past month.',
    'checkin.q9.label': 'Do you have any other observations, ideas, or things you would like to share?',
    'checkin.cancel': 'Cancel',
    'checkin.save.create': 'Save Check-in',
    'checkin.save.update': 'Update Check-in',
    'checkin.error.required': 'This field is required',
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
    'onlineSession.title': 'Сесия на живо',
    'onlineSession.description': 'Присъединете се към часа онлайн, след като срещата е започната.',
    'onlineSession.join': 'Влез в сесията на живо',
    'checkin.title.new': 'Запиши среща с',
    'checkin.title.edit': 'Редактирай среща с',
    'checkin.month.label': 'Месец на проведените срещи',
    'checkin.month.january': 'Януари',
    'checkin.month.february': 'Февруари',
    'checkin.month.march': 'Март',
    'checkin.month.april': 'Април',
    'checkin.month.may': 'Май',
    'checkin.month.june': 'Юни',
    'checkin.month.july': 'Юли',
    'checkin.month.august': 'Август',
    'checkin.month.september': 'Септември',
    'checkin.month.october': 'Октомври',
    'checkin.month.november': 'Ноември',
    'checkin.month.december': 'Декември',
    'checkin.q1.label': 'Проведе ли лична среща с ментито си през изминалия месец?',
    'checkin.q1.yes': 'Да',
    'checkin.q1.plannedSoon': 'Не, но имаме планирана среща скоро',
    'checkin.q1.unable': 'Не успях',
    'checkin.q2.label': 'Колко лични срещи имахте през този период?',
    'checkin.q2.0': '0',
    'checkin.q2.1': '1',
    'checkin.q2.2': '2',
    'checkin.q2.moreThan2': 'Повече от 2',
    'checkin.q3.label': 'Поддържахте ли контакт между срещите (чрез обаждане, съобщения или онлайн разговор)?',
    'checkin.q3.regularly': 'Да, редовно',
    'checkin.q3.occasionally': 'От време на време',
    'checkin.q3.no': 'Не',
    'checkin.q4.label': 'За какво основно говорихте на последната среща?',
    'checkin.q5.label': 'Как би описал/а ангажираността и откритостта на ментито през последния месец?',
    'checkin.q5.veryHigh': 'Много висока',
    'checkin.q5.good': 'Добра',
    'checkin.q5.moderate': 'Средна',
    'checkin.q5.low': 'Ниска',
    'checkin.q6.label': 'Срещна ли някакви трудности или предизвикателства в менторството през този период?',
    'checkin.q7.label': 'Има ли нещо, с което училището може да те подкрепи като ментор?',
    'checkin.q8.label': 'Сподели един положителен момент или напредък, който си забелязал/а у ментито през последния месец.',
    'checkin.q9.label': 'Имаш ли други наблюдения, идеи или неща, които би искал/а да споделиш?',
    'checkin.cancel': 'Отказ',
    'checkin.save.create': 'Запази срещата',
    'checkin.save.update': 'Обнови срещата',
    'checkin.error.required': 'Това поле е задължително',
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
