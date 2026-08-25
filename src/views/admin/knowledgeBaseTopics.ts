import {
  Archive,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  Inbox,
  Languages,
  LayoutDashboard,
  Library,
  ListChecks,
  MailCheck,
  Mail,
  Megaphone,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import type { TranslationKey } from '../../i18n/LanguageContext';

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

export type KnowledgeTopic = {
  id: string;
  sectionKey: string;
  title: string;
  section: string;
  summary: string;
  icon: typeof LayoutDashboard;
  tone: 'blue' | 'green' | 'amber' | 'rose' | 'slate' | 'violet';
  keywords: string[];
  essentials: string[];
  where?: string[];
  commonTasks?: string[];
  careful?: string[];
  steps?: string[];
  visual?: Array<{ label: string; icon: typeof LayoutDashboard; hint: string }>;
};

type VisualSpec = { icon: typeof LayoutDashboard; index: number };

type TopicSpec = {
  id: string;
  sectionKey: string;
  icon: typeof LayoutDashboard;
  tone: KnowledgeTopic['tone'];
  keywords: number;
  essentials: number;
  where?: number;
  commonTasks?: number;
  careful?: number;
  steps?: number;
  visual: VisualSpec[];
};

function sectionLabel(t: TFunction, sectionKey: string) {
  return t(`kb.section.${sectionKey}` as TranslationKey);
}

function list(t: TFunction, base: string, count: number) {
  return Array.from({ length: count }, (_, i) => t(`${base}.${i}` as TranslationKey));
}

function visualItems(t: TFunction, id: string, specs: VisualSpec[]) {
  return specs.map(({ icon, index }) => ({
    icon,
    label: t(`kb.topic.${id}.visual.${index}.label` as TranslationKey),
    hint: t(`kb.topic.${id}.visual.${index}.hint` as TranslationKey),
  }));
}

function buildTopic(t: TFunction, spec: TopicSpec): KnowledgeTopic {
  const { id, sectionKey, icon, tone, keywords, essentials, where, commonTasks, careful, steps, visual } = spec;
  return {
    id,
    sectionKey,
    icon,
    tone,
    title: t(`kb.topic.${id}.title` as TranslationKey),
    section: sectionLabel(t, sectionKey),
    summary: t(`kb.topic.${id}.summary` as TranslationKey),
    keywords: list(t, `kb.topic.${id}.keywords`, keywords),
    essentials: list(t, `kb.topic.${id}.essentials`, essentials),
    ...(where ? { where: list(t, `kb.topic.${id}.where`, where) } : {}),
    ...(commonTasks ? { commonTasks: list(t, `kb.topic.${id}.commonTasks`, commonTasks) } : {}),
    ...(careful ? { careful: list(t, `kb.topic.${id}.careful`, careful) } : {}),
    ...(steps ? { steps: list(t, `kb.topic.${id}.steps`, steps) } : {}),
    visual: visualItems(t, id, visual),
  };
}

const topicSpecs: TopicSpec[] = [
  {
    id: 'dashboard',
    sectionKey: 'dailyOperations',
    icon: LayoutDashboard,
    tone: 'blue',
    keywords: 7,
    essentials: 4,
    visual: [
      { icon: GraduationCap, index: 0 },
      { icon: ListChecks, index: 1 },
      { icon: CalendarDays, index: 2 },
    ],
  },
  {
    id: 'calendar',
    sectionKey: 'dailyOperations',
    icon: CalendarDays,
    tone: 'blue',
    keywords: 7,
    essentials: 4,
    where: 2,
    visual: [
      { icon: CalendarDays, index: 0 },
      { icon: ClipboardList, index: 1 },
      { icon: Megaphone, index: 2 },
    ],
  },
  {
    id: 'people',
    sectionKey: 'schoolSetup',
    icon: Users,
    tone: 'green',
    keywords: 10,
    essentials: 5,
    steps: 3,
    visual: [
      { icon: ShieldCheck, index: 0 },
      { icon: HeartHandshake, index: 1 },
      { icon: GraduationCap, index: 2 },
    ],
  },
  {
    id: 'stream',
    sectionKey: 'communication',
    icon: Bell,
    tone: 'green',
    keywords: 8,
    essentials: 5,
    visual: [
      { icon: Users, index: 0 },
      { icon: CalendarDays, index: 1 },
      { icon: Mail, index: 2 },
    ],
  },
  {
    id: 'inbox',
    sectionKey: 'communication',
    icon: Inbox,
    tone: 'slate',
    keywords: 6,
    essentials: 4,
    visual: [
      { icon: CheckCircle2, index: 0 },
      { icon: Mail, index: 1 },
      { icon: Send, index: 2 },
    ],
  },
  {
    id: 'emailLog',
    sectionKey: 'communication',
    icon: MailCheck,
    tone: 'slate',
    keywords: 6,
    essentials: 4,
    visual: [
      { icon: MailCheck, index: 0 },
      { icon: Users, index: 1 },
      { icon: CheckCircle2, index: 2 },
    ],
  },
  {
    id: 'classwork',
    sectionKey: 'learningWork',
    icon: BookOpen,
    tone: 'blue',
    keywords: 8,
    essentials: 7,
    steps: 3,
    visual: [
      { icon: BookOpen, index: 0 },
      { icon: ClipboardList, index: 1 },
      { icon: Library, index: 2 },
    ],
  },
  {
    id: 'grades',
    sectionKey: 'learningWork',
    icon: GraduationCap,
    tone: 'violet',
    keywords: 6,
    essentials: 4,
    visual: [
      { icon: ClipboardList, index: 0 },
      { icon: ShieldCheck, index: 1 },
      { icon: CheckCircle2, index: 2 },
    ],
  },
  {
    id: 'curriculum',
    sectionKey: 'schoolSetup',
    icon: CalendarDays,
    tone: 'amber',
    keywords: 8,
    essentials: 6,
    visual: [
      { icon: CalendarDays, index: 0 },
      { icon: Library, index: 1 },
      { icon: Archive, index: 2 },
    ],
  },
  {
    id: 'attendance',
    sectionKey: 'graduationGates',
    icon: ClipboardList,
    tone: 'amber',
    keywords: 10,
    essentials: 8,
    steps: 5,
    visual: [
      { icon: CalendarDays, index: 0 },
      { icon: HeartHandshake, index: 1 },
      { icon: ShieldCheck, index: 2 },
    ],
  },
  {
    id: 'ministry',
    sectionKey: 'graduationGates',
    icon: HeartHandshake,
    tone: 'rose',
    keywords: 6,
    essentials: 5,
    visual: [
      { icon: UserCheck, index: 0 },
      { icon: ClipboardList, index: 1 },
      { icon: CheckCircle2, index: 2 },
    ],
  },
  {
    id: 'mentorship-checkin',
    sectionKey: 'peopleAndMentoring',
    icon: HeartHandshake,
    tone: 'violet',
    keywords: 8,
    essentials: 5,
    where: 3,
    visual: [
      { icon: CalendarDays, index: 0 },
      { icon: ClipboardList, index: 1 },
      { icon: UserCheck, index: 2 },
    ],
  },
  {
    id: 'todos',
    sectionKey: 'dailyOperations',
    icon: ListChecks,
    tone: 'blue',
    keywords: 6,
    essentials: 4,
    visual: [
      { icon: Sparkles, index: 0 },
      { icon: Users, index: 1 },
      { icon: CheckCircle2, index: 2 },
    ],
  },
  {
    id: 'messages',
    sectionKey: 'communication',
    icon: MessageSquare,
    tone: 'slate',
    keywords: 9,
    essentials: 5,
    visual: [
      { icon: MessageSquare, index: 0 },
      { icon: Users, index: 1 },
      { icon: Inbox, index: 2 },
    ],
  },
  {
    id: 'tuition',
    sectionKey: 'finance',
    icon: Mail,
    tone: 'green',
    keywords: 9,
    essentials: 7,
    where: 6,
    commonTasks: 5,
    careful: 4,
    visual: [
      { icon: Bell, index: 0 },
      { icon: CheckCircle2, index: 1 },
      { icon: Send, index: 2 },
    ],
  },
  {
    id: 'books',
    sectionKey: 'learningWork',
    icon: Library,
    tone: 'violet',
    keywords: 7,
    essentials: 5,
    where: 3,
    commonTasks: 4,
    careful: 3,
    visual: [
      { icon: Library, index: 0 },
      { icon: CalendarDays, index: 1 },
      { icon: CheckCircle2, index: 2 },
    ],
  },
  {
    id: 'google-drive',
    sectionKey: 'integrations',
    icon: BookOpen,
    tone: 'blue',
    keywords: 7,
    essentials: 5,
    where: 3,
    commonTasks: 4,
    careful: 3,
    visual: [
      { icon: BookOpen, index: 0 },
      { icon: Library, index: 1 },
      { icon: ShieldCheck, index: 2 },
    ],
  },
  {
    id: 'absence-notices',
    sectionKey: 'attendance',
    icon: CalendarDays,
    tone: 'amber',
    keywords: 6,
    essentials: 5,
    where: 3,
    commonTasks: 4,
    careful: 3,
    visual: [
      { icon: Bell, index: 0 },
      { icon: CalendarDays, index: 1 },
      { icon: Mail, index: 2 },
    ],
  },
  {
    id: 'settings-permissions',
    sectionKey: 'adminSafety',
    icon: ShieldCheck,
    tone: 'rose',
    keywords: 8,
    essentials: 6,
    where: 4,
    commonTasks: 4,
    careful: 3,
    visual: [
      { icon: ShieldCheck, index: 0 },
      { icon: UserCheck, index: 1 },
      { icon: ClipboardList, index: 2 },
    ],
  },
  {
    id: 'language',
    sectionKey: 'platform',
    icon: Languages,
    tone: 'slate',
    keywords: 7,
    essentials: 6,
    visual: [
      { icon: Languages, index: 0 },
      { icon: BookOpen, index: 1 },
    ],
  },
];

export function buildTopics(t: TFunction): KnowledgeTopic[] {
  return topicSpecs.map(spec => buildTopic(t, spec));
}

export const DEFAULT_TOPIC_ID = 'dashboard';
export const ALL_SECTIONS = '__all__';
