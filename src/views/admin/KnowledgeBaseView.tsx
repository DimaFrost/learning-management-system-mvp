import { useMemo, useState } from 'react';
import {
  Archive,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  Library,
  ListChecks,
  Mail,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';

type KnowledgeTopic = {
  id: string;
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

const toneClasses = {
  blue: {
    shell: 'border-[#d2e3fc] bg-[#f7faff]',
    icon: 'bg-[#e8f0fe] text-[#1a73e8]',
    accent: 'text-[#1a73e8]',
    rail: 'bg-[#1a73e8]',
  },
  green: {
    shell: 'border-[#cdebd8] bg-[#f7fcf8]',
    icon: 'bg-[#e7f7ee] text-[#137333]',
    accent: 'text-[#137333]',
    rail: 'bg-[#137333]',
  },
  amber: {
    shell: 'border-[#f2dfaa] bg-[#fffaf0]',
    icon: 'bg-[#fff8e6] text-[#9a5b00]',
    accent: 'text-[#9a5b00]',
    rail: 'bg-[#d99000]',
  },
  rose: {
    shell: 'border-[#f5c7c0] bg-[#fff8f6]',
    icon: 'bg-[#fff1ef] text-[#b42318]',
    accent: 'text-[#b42318]',
    rail: 'bg-[#d95645]',
  },
  slate: {
    shell: 'border-[#e5e5e5] bg-[#fafafa]',
    icon: 'bg-[#f3f4f6] text-[#525252]',
    accent: 'text-[#525252]',
    rail: 'bg-[#737373]',
  },
  violet: {
    shell: 'border-[#ddd6fe] bg-[#fbfaff]',
    icon: 'bg-[#ede9fe] text-[#6d28d9]',
    accent: 'text-[#6d28d9]',
    rail: 'bg-[#7c3aed]',
  },
};

const topics: KnowledgeTopic[] = [
  {
    id: 'dashboard',
    title: 'Admin Dashboard',
    section: 'Daily Operations',
    summary: 'The first screen for administrators: readiness, upcoming school events, to-dos, on-duty people, and calendar signals.',
    icon: LayoutDashboard,
    tone: 'blue',
    keywords: ['home', 'dashboard', 'pulse', 'today', 'calendar', 'readiness', 'year group health'],
    essentials: [
      'Year group health shows how close each active year group is to graduation readiness.',
      'Missing readiness items explain why a group is not at 100%.',
      'Upcoming opens the subject page for sessions, while the month calendar reveals the day’s events inside the calendar area.',
      'To-dos surface dynamic admin/staff work, including duty, grading, and assigned tasks.',
    ],
    visual: [
      { label: 'Readiness', icon: GraduationCap, hint: 'Graduation health' },
      { label: 'To-dos', icon: ListChecks, hint: 'Action queue' },
      { label: 'Calendar', icon: CalendarDays, hint: 'Month signals' },
    ],
  },
  {
    id: 'people',
    title: 'People',
    section: 'School Setup',
    summary: 'Directory, pending access, enrollments, roles, responsibilities, mentors, team leaders, and staff assignments.',
    icon: Users,
    tone: 'green',
    keywords: ['users', 'people', 'roles', 'students', 'teachers', 'mentors', 'team leaders', 'directory', 'enrollments', 'online students'],
    essentials: [
      'People is the visible name for users and profiles.',
      'Roles control workspaces: administrator, teacher, translator, mentor, team leader, and student.',
      'Student year groups use the roman numeral year badge. Active First Year and Second Year have distinct visual styles.',
      'Edit person can assign roles, student year group, teacher year-group scope, mentor/mentee links, and ministry teams led.',
      'The student tab in Edit person has an Online student toggle. Online students get an Online badge in the directory and attendance rosters, see the Join live session button on My Classwork, and are scored against the online attendance requirements.',
    ],
    steps: [
      'Use Pending access when a new Google-authenticated user needs a real role.',
      'Use Directory for search, user detail, editing, deletion, and student dashboard access.',
      'Use Enrollments for student-year and mentor relationship checks.',
    ],
    visual: [
      { label: 'Roles', icon: ShieldCheck, hint: 'Access chips' },
      { label: 'Mentorship', icon: HeartHandshake, hint: 'Mentor links' },
      { label: 'Year group', icon: GraduationCap, hint: 'I / II badges' },
    ],
  },
  {
    id: 'stream',
    title: 'Stream',
    section: 'Communication',
    summary: 'The announcement feed: posts, drafts, scheduled publishing, trash, reactions, comments, audience targeting, and email notifications.',
    icon: Bell,
    tone: 'green',
    keywords: ['announcements', 'stream', 'posts', 'audience', 'drafts', 'scheduled', 'email', 'attachments'],
    essentials: [
      'Stream is the user-facing name for announcements.',
      'Admins control Stream settings from the settings button near New Post.',
      'Audiences can be All, Staff, Students, or Custom, with sub-audience controls where needed.',
      'Published and scheduled posts can queue Brevo email notifications through notification jobs.',
      'Deleted posts move to trash first; admins can restore or permanently delete them.',
    ],
    visual: [
      { label: 'Audience', icon: Users, hint: 'Recipient scope' },
      { label: 'Scheduled', icon: CalendarDays, hint: 'Future publish' },
      { label: 'Inbox copy', icon: Mail, hint: 'Email copy' },
    ],
  },
  {
    id: 'inbox',
    title: 'Inbox',
    section: 'Communication',
    summary: 'Copies of portal emails sent to the current admin account, useful when admins miss email in their actual mailbox.',
    icon: Inbox,
    tone: 'slate',
    keywords: ['inbox', 'emails', 'brevo', 'delivered', 'failed', 'notification deliveries'],
    essentials: [
      'Inbox shows emails sent to the logged-in admin, not every email sent by the system.',
      'Delivered means Brevo accepted the email.',
      'Failed means the portal tried to send but the provider or function returned an error.',
      'Pending and skipped are rare, but useful for debugging email flow.',
    ],
    visual: [
      { label: 'Delivered', icon: CheckCircle2, hint: 'Accepted by Brevo' },
      { label: 'Email', icon: Mail, hint: 'Portal copy' },
      { label: 'Portal update', icon: Send, hint: 'Workflow email' },
    ],
  },
  {
    id: 'classwork',
    title: 'Classwork',
    section: 'Learning Work',
    summary: 'The learning work hub: subjects first, with sessions, assignments, materials, readings, submissions, and grades nearby.',
    icon: BookOpen,
    tone: 'blue',
    keywords: ['classwork', 'subjects', 'sessions', 'homework', 'assignments', 'materials', 'submissions', 'grades'],
    essentials: [
      'Classwork is organized around subjects, not isolated session pages.',
      'Sessions can have assignments and materials attached, but assignments can also belong directly to a subject.',
      'Student materials and staff notes are stored in the school Google Drive; staff notes remain private to teachers, admins, and translators (view).',
      'Teachers see year groups they are allowed to teach, with a filter for Teaching vs Year group.',
      'Students see only their own active year group work.',
      'Submissions is the teacher/admin review queue for work that needs grading.',
      'Translators opening a subject see only the Sessions and Materials tabs (not Homework or Attendance).',
    ],
    steps: [
      'Open Classwork to find subjects and sessions.',
      'Open a subject for tabs: sessions, homework, materials, and attendance (translators: sessions and materials only).',
      'Open an assignment for the dedicated Google-Classroom-like assignment detail page.',
    ],
    visual: [
      { label: 'Subject', icon: BookOpen, hint: 'Primary grouping' },
      { label: 'Assignment', icon: ClipboardList, hint: 'Student work' },
      { label: 'Materials', icon: Library, hint: 'Class resources' },
    ],
  },
  {
    id: 'grades',
    title: 'Grades',
    section: 'Learning Work',
    summary: 'Academic work and graduation readiness shown separately, so grades do not hide attendance or ministry risk.',
    icon: GraduationCap,
    tone: 'violet',
    keywords: ['grades', 'academic', 'readiness', 'homework', 'reading', 'attendance gates'],
    essentials: [
      'Academic grade is based on graded homework and optional reading points.',
      'Graduation readiness is separate and includes attendance gates, Ministry, The Well, and Activation Saturday.',
      'Students can open assignments from My Grades and land on the same assignment detail page used to submit work.',
      'Readiness items point to the relevant attendance area instead of dumping raw records into Grades.',
    ],
    visual: [
      { label: 'Academic', icon: ClipboardList, hint: 'Points & feedback' },
      { label: 'Readiness', icon: ShieldCheck, hint: 'Pass/fail gates' },
      { label: 'Complete', icon: CheckCircle2, hint: 'Done work' },
    ],
  },
  {
    id: 'curriculum',
    title: 'Curriculum',
    section: 'School Setup',
    summary: 'The planning area for year groups, subjects, class sessions, Activation Saturday, The Well, archive, and books.',
    icon: CalendarDays,
    tone: 'amber',
    keywords: ['curriculum', 'planning', 'year groups', 'subjects', 'classes', 'activation saturday', 'the well', 'books'],
    essentials: [
      'Curriculum is operational planning, while Classwork is student/teacher learning work.',
      'Planning groups sessions by week and supports drag/drop through a floating toolbar.',
      'The Well has its own planning tab and can auto-fill Wednesdays, with manual removal for weeks that should not meet.',
      'Archived year groups should stay out of normal dropdowns and active work areas.',
      'Leaders of the Translation (Превод) ministry team can open Overview and Date View in the Team Leader workspace and assign translators to sessions only.',
      'On subject pages, Translation team leaders see only Sessions and Materials tabs (same as translators).',
    ],
    visual: [
      { label: 'Planning', icon: CalendarDays, hint: 'School year grid' },
      { label: 'Books', icon: Library, hint: 'Reading assignments' },
      { label: 'Archive', icon: Archive, hint: 'Inactive years' },
    ],
  },
  {
    id: 'attendance',
    title: 'Attendance',
    section: 'Graduation Gates',
    summary: 'Four independent graduation gates: Classes, The Well, Ministry, and Activation Saturday, with late counting as half credit.',
    icon: ClipboardList,
    tone: 'amber',
    keywords: ['attendance', 'classes', 'the well', 'ministry', 'activation saturday', 'on duty', 'corrections', 'online students', 'meet link', 'live session'],
    essentials: [
      'Weekly classes require 80% attendance credit.',
      'The Well officially requires two credits per month, with a yearly fallback score.',
      'Ministry is based on team leader reports and configurable team requirements.',
      'Activation Saturday allows at most one lost credit.',
      'Two late records equal one absent everywhere attendance is scored.',
      'Online students (flagged in People) have their own requirements row: use the Regular/Online switcher in Settings to configure each audience. Online requirements start identical to the regular ones.',
      'The school-wide Google Meet link lives at the top of Attendance Settings. Online students see a Join live session button on My Classwork that opens this link in a new tab; marking stays manual.',
    ],
    steps: [
      'Use Overview for graduation readiness across all gates.',
      'Use each gate page for the records and progress specific to that activity.',
      'Use On Duty Schedule for attendance keepers, not ministry team leaders.',
      'Use Settings to adjust rules without code changes, including the online student requirements and the live session Meet link.',
    ],
    visual: [
      { label: 'Classes', icon: CalendarDays, hint: 'Tue/Thu sessions' },
      { label: 'Ministry', icon: HeartHandshake, hint: 'Service reports' },
      { label: 'Settings', icon: ShieldCheck, hint: 'Rules & gates' },
    ],
  },
  {
    id: 'ministry',
    title: 'Ministry Reports',
    section: 'Graduation Gates',
    summary: 'Team leaders submit service reports with attendance and notes; admins review ministry health and rotations.',
    icon: HeartHandshake,
    tone: 'rose',
    keywords: ['ministry', 'team leaders', 'reports', 'rotations', 'service attendance', 'sunday'],
    essentials: [
      'Team leaders can lead one or more ministry teams.',
      'A report captures date, team, present/late students, and leader notes.',
      'Blank students in a submitted report count as absent for that service.',
      'Admins manage teams, contacts, rotations, submitted reports, and team health.',
      'Student Ministry under My Attendance shows the student’s rotation, contacts, and service attendance progress.',
    ],
    visual: [
      { label: 'Leader', icon: UserCheck, hint: 'Team contact' },
      { label: 'Report', icon: ClipboardList, hint: 'Attendance source' },
      { label: 'Health', icon: CheckCircle2, hint: 'Requirement progress' },
    ],
  },
  {
    id: 'todos',
    title: 'To-dos',
    section: 'Daily Operations',
    summary: 'Admin/staff task management with assignment to people or categories, priority reminders, and dynamic dashboard tasks.',
    icon: ListChecks,
    tone: 'blue',
    keywords: ['todos', 'tasks', 'priority', 'reminders', 'assigned', 'dashboard'],
    essentials: [
      'Admins can assign to-dos to people or categories; staff can create personal to-dos.',
      'Priority to-dos trigger reminder emails before/during the due date if still open.',
      'Dashboard to-dos also include dynamic work, such as on-duty or submissions needing review.',
      'Assignments can target multiple people without duplicate recipients.',
    ],
    visual: [
      { label: 'Priority', icon: Sparkles, hint: 'Reminder email' },
      { label: 'Assigned', icon: Users, hint: 'People/category' },
      { label: 'Done', icon: CheckCircle2, hint: 'Completed' },
    ],
  },
  {
    id: 'messages',
    title: 'Messages',
    section: 'Communication',
    summary: 'Admin-led in-app communication for sending messages to people or groups such as First Year, Second Year, Teachers, Students, or Everyone.',
    icon: MessageSquare,
    tone: 'slate',
    keywords: ['messages', 'admin messages', 'groups', 'first years', 'second years', 'teachers', 'students', 'all', 'unread'],
    essentials: [
      'Messages are for admins to communicate with users or groups inside the portal.',
      'Students should not use Messages as open student-to-student chat.',
      'Useful audiences include First Year, Second Year, Teachers, Students, Staff, and Everyone.',
      'Inbox is different: it shows portal emails sent to the admin account.',
      'Unread counts appear in the sidebar when someone has received an in-app message.',
    ],
    visual: [
      { label: 'Message', icon: MessageSquare, hint: 'Admin-led communication' },
      { label: 'Audience', icon: Users, hint: 'People or groups' },
      { label: 'Email copy', icon: Inbox, hint: 'Inbox' },
    ],
  },
  {
    id: 'tuition',
    title: 'Tuition',
    section: 'Finance',
    summary: 'The fee-management area for tuition plans, student balances, installments, payments, reminders, and dashboard finance signals.',
    icon: Mail,
    tone: 'green',
    keywords: ['tuition', 'fees', 'payments', 'installments', 'reminders', 'paid', 'outstanding', 'finance', 'budget'],
    essentials: [
      'Tuition tracks plan amounts, installments, student payment accounts, recorded payments, and reminder history.',
      'A student must be added to a tuition plan before the payment structure applies to that student.',
      'The dashboard shortcut shows unpaid students plus collected and remaining totals.',
      'Remind Outstanding queues email reminders only for students with remaining balances.',
      'Tuition currently uses EUR by default.',
    ],
    where: [
      'Open Tuition from the admin sidebar.',
      'Use Plans to define a tuition structure and its installments.',
      'Use Students/Accounts to add First Year, Second Year, or individual students to a plan.',
      'Use Payments to record money received.',
      'Use Reminder History to confirm whether reminder emails were queued, sent, or failed.',
    ],
    commonTasks: [
      'Create a new tuition plan for the school year.',
      'Add one or both active year groups to the plan.',
      'Record a student payment against the correct student account.',
      'Send outstanding reminders after confirming what will happen in the dialog.',
      'Open Tuition from Dashboard when checking budget progress.',
    ],
    careful: [
      'Creating a plan alone does not enroll students into that plan.',
      'Reminder status depends on both notification jobs and tuition reminder logs.',
      'If a reminder stays queued, check the process-notification-jobs Edge Function and Brevo configuration.',
      'Use amount fields carefully: plan totals, installment amounts, and payment amounts are different things.',
    ],
    visual: [
      { label: 'Outstanding', icon: Bell, hint: 'Needs payment' },
      { label: 'Payment', icon: CheckCircle2, hint: 'Recorded amount' },
      { label: 'Reminder', icon: Send, hint: 'Queued email' },
    ],
  },
  {
    id: 'books',
    title: 'Books & Reading',
    section: 'Learning Work',
    summary: 'Year-group reading assignments with book metadata, covers, due dates, instructions, submissions, and optional grading.',
    icon: Library,
    tone: 'violet',
    keywords: ['books', 'reading', 'isbn', 'cover', 'due date', 'reading assignments', 'submissions'],
    essentials: [
      'Books are separate from class-session homework because reading is usually year-group-level work.',
      'Admins can search by ISBN/title, use Google Books/Open Library metadata, or enter a book manually.',
      'Book covers can come from a URL or be uploaded when the URL option is not enough.',
      'Assignments can target First Year, Second Year, or both active year groups.',
      'Reading is completion-only by default, but can optionally support points.',
    ],
    where: [
      'Open Curriculum, then Books.',
      'Use Add Reading Assignment to search/select a book, choose year groups, set due date, and add instructions.',
      'Students see assigned readings from their own Classwork/Books areas.',
    ],
    commonTasks: [
      'Add a book by ISBN or title search.',
      'Upload a cover when metadata lookup does not provide a usable image.',
      'Assign a book to one or both active year groups.',
      'Review completion stats and reading submissions.',
    ],
    careful: [
      'External metadata is only a starting point; admins can override all book fields.',
      'A student should only see books assigned to their active year group.',
      'Past-due reading can affect academic work if grading is enabled.',
    ],
    visual: [
      { label: 'Book', icon: Library, hint: 'Reading work' },
      { label: 'Due', icon: CalendarDays, hint: 'Deadline' },
      { label: 'Done', icon: CheckCircle2, hint: 'Completed reading' },
    ],
  },
  {
    id: 'google-drive',
    title: 'Google Drive & Docs',
    section: 'Integrations',
    summary: 'School-owned Google Docs and Drive storage for assignment documents, submissions, materials, staff notes, and stream attachments.',
    icon: BookOpen,
    tone: 'blue',
    keywords: ['google drive', 'google docs', 'shared drive', 'materials', 'staff notes', 'assignment docs', 'oauth'],
    essentials: [
      'The school Google account connection is admin-only and is used to create school-owned documents in the Shared Drive.',
      'Assignment submissions are organized by year group, assignment, and student name.',
      'Materials and staff notes should be stored in Google Drive rather than Supabase Storage where possible.',
      'Teachers/admins can create Google Doc materials and staff notes directly from the portal; translators can view staff notes for subjects they are assigned to.',
      'Students should not be able to edit staff-created materials unless intentionally shared.',
    ],
    where: [
      'Open Settings as an admin to connect the school Google Docs account.',
      'Open a subject Materials tab to upload or create materials/staff notes.',
      'Open an assignment detail page to create or access the student Google Doc submission.',
    ],
    commonTasks: [
      'Reconnect the school Google account when the token expires or setup changes.',
      'Test the Google Docs setup from admin settings.',
      'Create a Google Doc material for a subject.',
      'Upload a file material and preview it from the portal.',
    ],
    careful: [
      'Personal student accounts should not be used as the school document owner.',
      'If Google says file not found, check the configured template/folder IDs and whether the connected account can access them.',
      'Deploying google-docs-v2 is required when Drive folder behavior changes.',
    ],
    visual: [
      { label: 'Doc', icon: BookOpen, hint: 'Google document' },
      { label: 'Material', icon: Library, hint: 'Drive resource' },
      { label: 'Private', icon: ShieldCheck, hint: 'Staff + translators' },
    ],
  },
  {
    id: 'absence-notices',
    title: 'Absence Notices',
    section: 'Attendance',
    summary: 'Student-submitted notices for future class or Activation Saturday sessions they expect to miss.',
    icon: CalendarDays,
    tone: 'amber',
    keywords: ['absence', 'notice', 'missing class', 'activation saturday', 'future sessions', 'email'],
    essentials: [
      'Students can submit absence notices only for today or future sessions.',
      'A notice can include one or more class/Activation Saturday sessions.',
      'Reason is optional, but useful for admin context.',
      'The student and admins receive email copies through the notification system.',
      'Admins can filter notices by upcoming events to see who expects to miss what.',
    ],
    where: [
      'Students open Classroom, then Absence Notice.',
      'Admins use the absence notice list and upcoming-event filters.',
      'Email copies also appear in Inbox for admins who received them.',
    ],
    commonTasks: [
      'Submit a notice for one or more upcoming sessions.',
      'Filter notices by the next five upcoming events.',
      'Review a student reason and attached sessions.',
      'Use the notice as context when marking or reviewing attendance.',
    ],
    careful: [
      'An absence notice is not the same as being marked present or excused; attendance still needs proper handling.',
      'Past sessions should not appear in the student notice form.',
      'Email delivery depends on the absence_notice_email notification job type.',
    ],
    visual: [
      { label: 'Notice', icon: Bell, hint: 'Future absence' },
      { label: 'Session', icon: CalendarDays, hint: 'Selected date' },
      { label: 'Email copy', icon: Mail, hint: 'Admin/student copy' },
    ],
  },
  {
    id: 'settings-permissions',
    title: 'Settings & Permissions',
    section: 'Admin Safety',
    summary: 'The places admins use to configure rules, integrations, Stream behavior, attendance gates, and role-based access.',
    icon: ShieldCheck,
    tone: 'rose',
    keywords: ['settings', 'permissions', 'roles', 'rls', 'admin', 'stream settings', 'attendance settings', 'google docs'],
    essentials: [
      'Most school policy changes should happen in Settings pages, not code.',
      'Attendance Settings stores graduation gate rules such as late credit, thresholds, and activity requirements.',
      'Stream settings control posting/comment permissions and should be admin-controlled.',
      'Google Docs setup should be visible only to real admins, not users merely viewing as students.',
      'Database RLS controls what non-admin users can read or write.',
      'Translation ministry team leaders can update only classes.translator_id; a DB trigger blocks other class fields.',
    ],
    where: [
      'Attendance Settings lives under Attendance, then Operations.',
      'Stream settings lives at the top right of Stream.',
      'Google Docs connection lives in admin Settings.',
      'Role assignment lives in People, Edit Person.',
    ],
    commonTasks: [
      'Change attendance thresholds when graduation policy changes.',
      'Restrict Stream posting/commenting rules.',
      'Confirm a teacher or student can only see the right year group.',
      'Troubleshoot when a user can see too much or too little data.',
    ],
    careful: [
      'When permissions look wrong, check both UI role logic and Supabase RLS policies.',
      'Viewing as another account as an admin can differ from what the real user sees if RLS is involved.',
      'After database migrations, update schema docs with npm run db:schema:sync before committing.',
    ],
    visual: [
      { label: 'Admin', icon: ShieldCheck, hint: 'Full access' },
      { label: 'Role', icon: UserCheck, hint: 'Workspace access' },
      { label: 'Rule', icon: ClipboardList, hint: 'Configurable setting' },
    ],
  },
];

export function KnowledgeBaseView() {
  const [query, setQuery] = useState('');
  const [activeTopicId, setActiveTopicId] = useState(topics[0].id);
  const [sectionFilter, setSectionFilter] = useState('All');

  const sections = useMemo(() => ['All', ...Array.from(new Set(topics.map(topic => topic.section)))], []);
  const filteredTopics = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return topics.filter(topic => {
      const matchesSection = sectionFilter === 'All' || topic.section === sectionFilter;
      if (!matchesSection) return false;
      if (!needle) return true;
      const haystack = [
        topic.title,
        topic.section,
        topic.summary,
        ...topic.keywords,
        ...topic.essentials,
        ...(topic.where ?? []),
        ...(topic.commonTasks ?? []),
        ...(topic.careful ?? []),
        ...(topic.steps ?? []),
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, sectionFilter]);

  const activeTopic = filteredTopics.find(topic => topic.id === activeTopicId) ?? filteredTopics[0] ?? topics[0];
  const activeTone = toneClasses[activeTopic.tone];
  const ActiveIcon = activeTopic.icon;

  return (
    <div className="min-h-full bg-[#f8faf7] px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-5">
        <header className="space-y-3 rounded-[22px] border border-[#e1d9cc] bg-[#fffdfa] p-3 shadow-[0_14px_40px_rgba(91,70,39,0.06)]">
          <div className="px-1">
            <h1 className="text-xl font-semibold tracking-tight text-[#171717]">Knowledgebase</h1>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9287]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search dashboard, attendance, stream, roles..."
                className="tbo-focus h-12 w-full rounded-2xl border border-[#ded8cc] bg-white pl-9 pr-3 text-sm text-[#171717] outline-none"
              />
            </label>
            <select
              value={sectionFilter}
              onChange={event => setSectionFilter(event.target.value)}
              className="tbo-focus h-12 rounded-2xl border border-[#ded8cc] bg-white px-3 text-sm font-medium text-[#3f3a34]"
            >
              {sections.map(section => <option key={section} value={section}>{section}</option>)}
            </select>
          </div>
        </header>

        <main className="grid min-h-[620px] overflow-hidden rounded-[26px] border border-[#e1d9cc] bg-white shadow-[0_18px_55px_rgba(91,70,39,0.07)] lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="border-b border-[#eee7dc] bg-[#fffdfa] lg:border-b-0 lg:border-r">
            <div className="border-b border-[#eee7dc] px-4 py-3">
              <p className="text-sm font-semibold text-[#171717]">Topics</p>
              <p className="text-xs text-[#7b7167]">{filteredTopics.length} matching</p>
            </div>
            <div className="max-h-[560px] overflow-y-auto p-2">
              {filteredTopics.length === 0 ? (
                <div className="p-6 text-center text-sm text-[#6b6257]">No topics match that search.</div>
              ) : (
                <div className="space-y-1">
                  {filteredTopics.map(topic => {
                    const Icon = topic.icon;
                    const tone = toneClasses[topic.tone];
                    const active = topic.id === activeTopic.id;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => setActiveTopicId(topic.id)}
                        className={`tbo-focus group grid w-full grid-cols-[4px_minmax(0,1fr)] rounded-2xl text-left transition-colors ${
                          active ? 'bg-[#fff8e6]' : 'hover:bg-[#f8f5ef]'
                        }`}
                      >
                        <span className={`rounded-l-2xl ${active ? tone.rail : 'bg-transparent'}`} />
                        <span className="flex min-w-0 items-center gap-3 px-3 py-3">
                          <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-[#171717]">{topic.title}</span>
                            <span className="block truncate text-xs text-[#7b7167]">{topic.section}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#a39a8d]" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <article className="min-h-0 bg-[#fffdfa]">
            <div className={`border-b ${activeTone.shell} p-6 lg:p-7`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] ${activeTone.icon}`}>
                      <ActiveIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${activeTone.accent}`}>{activeTopic.section}</p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#171717]">{activeTopic.title}</h2>
                    </div>
                  </div>
                  <p className="mt-4 max-w-3xl text-sm leading-6 text-[#4b463f]">{activeTopic.summary}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-7">
              <div className="space-y-5">
                {activeTopic.where && (
                  <section className="rounded-[22px] border border-[#e6dfd3] bg-white p-5">
                    <h3 className="text-sm font-semibold text-[#171717]">Where to find it</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {activeTopic.where.map(item => (
                        <div key={item} className="rounded-2xl border border-[#eee7dc] bg-[#fffdfa] p-4">
                          <div className="flex gap-3">
                            <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${activeTone.icon}`}>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                            <p className="text-sm leading-6 text-[#3f3a34]">{item}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="rounded-[22px] border border-[#e6dfd3] bg-white p-5">
                  <h3 className="text-sm font-semibold text-[#171717]">What admins should know</h3>
                  <div className="mt-4 space-y-3">
                    {activeTopic.essentials.map(item => (
                      <div key={item} className="flex gap-3">
                        <span className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${activeTone.icon}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                        <p className="text-sm leading-6 text-[#3f3a34]">{item}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {activeTopic.commonTasks && (
                  <section className="rounded-[22px] border border-[#e6dfd3] bg-white p-5">
                    <h3 className="text-sm font-semibold text-[#171717]">Common admin tasks</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {activeTopic.commonTasks.map(task => (
                        <div key={task} className={`rounded-2xl border p-4 ${activeTone.shell}`}>
                          <div className="flex gap-3">
                            <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${activeTone.icon}`}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </span>
                            <p className="text-sm leading-6 text-[#3f3a34]">{task}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {activeTopic.steps && (
                  <section className="rounded-[22px] border border-[#e6dfd3] bg-white p-5">
                    <h3 className="text-sm font-semibold text-[#171717]">Typical workflow</h3>
                    <div className="mt-4 space-y-3">
                      {activeTopic.steps.map((step, index) => (
                        <div key={step} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e1d9cc] bg-[#fffdfa] text-xs font-semibold text-[#8a6a45]">
                            {index + 1}
                          </span>
                          <p className="pt-1 text-sm leading-6 text-[#3f3a34]">{step}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {activeTopic.careful && (
                  <section className="rounded-[22px] border border-[#f2dfaa] bg-[#fffaf0] p-5">
                    <h3 className="text-sm font-semibold text-[#171717]">Careful with this</h3>
                    <div className="mt-4 space-y-3">
                      {activeTopic.careful.map(item => (
                        <div key={item} className="flex gap-3">
                          <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#9a5b00]">
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </span>
                          <p className="text-sm leading-6 text-[#3f3a34]">{item}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside className="space-y-5">
                <section className="rounded-[22px] border border-[#e6dfd3] bg-white p-4">
                  <h3 className="text-sm font-semibold text-[#171717]">Visual cues</h3>
                  <div className="mt-4 space-y-3">
                    {(activeTopic.visual ?? []).map(item => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className={`rounded-2xl border p-3 ${activeTone.shell}`}>
                          <div className="flex items-center gap-3">
                            <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${activeTone.icon}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-[#171717]">{item.label}</p>
                              <p className="text-xs text-[#6b6257]">{item.hint}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-[22px] border border-[#e6dfd3] bg-[#f8f5ef] p-4">
                  <h3 className="text-sm font-semibold text-[#171717]">Search words</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeTopic.keywords.slice(0, 8).map(keyword => (
                      <button
                        key={keyword}
                        type="button"
                        onClick={() => setQuery(keyword)}
                        className="tbo-focus rounded-full border border-[#ded8cc] bg-white px-2.5 py-1 text-xs font-medium text-[#6b6257] hover:bg-[#fffdfa]"
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </article>
        </main>
      </div>
    </div>
  );
}
