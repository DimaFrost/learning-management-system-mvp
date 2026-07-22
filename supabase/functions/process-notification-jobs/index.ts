import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Profile = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  preferred_language?: 'en' | 'bg' | null;
  notification_preferences?: {
    announcements?: boolean;
    todos?: boolean;
  } | null;
};

type Announcement = {
  id: number;
  title: string;
  content: string;
  title_bg: string | null;
  content_bg: string | null;
  course_id: number | null;
  target_roles: string[] | null;
  is_staff_only: boolean;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  scheduled_at: string | null;
  author?: { name: string | null } | null;
};

type NotificationJob = {
  id: number;
  type: string;
  announcement_id: number | null;
  scheduled_for: string;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown>;
};

type WorkflowEmailPayload = {
  recipientIds?: string[];
  subject?: string;
  title?: string;
  body?: string;
  kind?: 'announcement' | 'assignment' | 'attendance' | 'system';
  actionUrl?: string | null;
};

type TodoItem = {
  id: number;
  title: string;
  description: string | null;
  assigned_to: string;
  due_date: string;
  priority: 'none' | 'priority';
  status: 'open' | 'completed';
  assigned?: Profile | null;
};

type AbsenceNotice = {
  id: number;
  student_id: string;
  reason: string | null;
  status: 'submitted' | 'acknowledged' | 'archived';
  submitted_at: string;
  student?: Profile | null;
  sessions?: {
    id: number;
    class_id: number;
    class?: {
      id: number;
      title: string;
      date: string;
      hour: string;
      subject?: {
        id: number;
        title: string;
        course?: {
          id: number;
          course_type: string;
          graduation_year: number;
        } | null;
      } | null;
    } | null;
  }[] | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-notification-secret',
};

const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:3000';
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('BREVO_FROM_EMAIL') ?? 'zsml@theburningones.bg';
const FROM_NAME = Deno.env.get('BREVO_FROM_NAME') ?? 'The Burning Ones';
const PROCESS_SECRET = Deno.env.get('PROCESS_NOTIFICATION_SECRET') ?? '';
const DEFAULT_LOGO_URL = APP_URL.includes('localhost') || APP_URL.includes('127.0.0.1')
  ? ''
  : `${APP_URL.replace(/\/$/, '')}/tbo-logo.png`;
const LOGO_URL = Deno.env.get('LOGO_URL') ?? DEFAULT_LOGO_URL;
const CUSTOM_USER_PREFIX = 'user:';

function getAnnouncementEmailContent(announcement: Announcement, preferredLanguage: 'en' | 'bg' | null | undefined = 'en') {
  const englishTitle = announcement.title?.trim() ?? '';
  const englishContent = announcement.content?.trim() ?? '';
  const bgTitle = announcement.title_bg?.trim() ?? '';
  const bgContent = announcement.content_bg?.trim() ?? '';

  if (preferredLanguage === 'bg' && bgTitle && bgContent) {
    return { title: bgTitle, content: bgContent, language: 'bg' as const };
  }

  if (englishTitle && englishContent) {
    return { title: englishTitle, content: englishContent, language: 'en' as const };
  }

  const title = bgTitle || englishTitle || 'Announcement';
  const content = bgContent || englishContent || '';
  return { title, content };
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (PROCESS_SECRET && req.headers.get('x-notification-secret') !== PROCESS_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit ?? 10), 25);
    const result = await processDueJobs(limit);
    return json(result);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function processDueJobs(limit: number) {
  const now = new Date().toISOString();
  const { data: jobs, error } = await supabase
    .from('notification_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  if (error) throw error;

  const results = [];
  for (const job of (jobs ?? []) as NotificationJob[]) {
    results.push(await processJob(job));
  }
  return { processed: results.length, results };
}

async function processJob(job: NotificationJob) {
  await supabase
    .from('notification_jobs')
    .update({
      status: 'processing',
      attempts: job.attempts + 1,
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', job.id)
    .eq('status', 'pending');

  try {
    let result: Record<string, unknown>;

    if (job.type === 'announcement_email') {
      const announcementId = job.announcement_id ?? Number(job.payload?.announcementId);
      if (!announcementId) throw new Error('Missing announcement id');
      result = await sendAnnouncementEmails(job.id, announcementId);
    } else if (job.type === 'todo_reminder_email') {
      const todoId = Number(job.payload?.todoId);
      if (!todoId) throw new Error('Missing todo id');
      const reminderKind = job.payload?.reminderKind === 'day_before' ? 'day_before' : 'due_day';
      result = await sendTodoReminderEmail(job.id, todoId, reminderKind);
    } else if (job.type === 'absence_notice_email') {
      const noticeId = Number(job.payload?.noticeId);
      if (!noticeId) throw new Error('Missing absence notice id');
      result = await sendAbsenceNoticeEmails(job.id, noticeId);
    } else if (job.type === 'workflow_email') {
      result = await sendWorkflowEmails(job.id, job.payload as WorkflowEmailPayload);
    } else {
      throw new Error(`Unsupported notification job type: ${job.type}`);
    }

    await supabase
      .from('notification_jobs')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return { jobId: job.id, status: 'completed', ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nextStatus = job.attempts + 1 >= job.max_attempts ? 'failed' : 'pending';
    await supabase
      .from('notification_jobs')
      .update({
        status: nextStatus,
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return { jobId: job.id, status: nextStatus, error: message };
  }
}

async function sendWorkflowEmails(jobId: number, payload: WorkflowEmailPayload) {
  const recipientIds = Array.isArray(payload.recipientIds) ? payload.recipientIds.filter(Boolean) : [];
  if (recipientIds.length === 0) return { sent: 0, failed: 0, recipientCount: 0, skipped: true, reason: 'No recipients' };

  const { data: recipients, error } = await supabase
    .from('profiles')
    .select('id, name, email, roles, preferred_language, notification_preferences')
    .in('id', Array.from(new Set(recipientIds)));
  if (error) throw error;

  const profiles = ((recipients ?? []) as Profile[]).filter(profile => Boolean(profile.email));
  let sent = 0;
  let failed = 0;
  for (const recipient of profiles) {
    const delivery = await createDelivery(jobId, recipient);
    try {
      const response = await sendBrevoEmail({
        to: recipient,
        subject: payload.subject || payload.title || 'Portal update',
        html: renderWorkflowEmail(payload),
        text: `${payload.title || 'Portal update'}\n\n${payload.body || ''}\n\nOpen: ${payload.actionUrl || APP_URL}`,
        tags: [payload.kind ?? 'system', 'portal'],
      });
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'sent',
          provider_message_id: response.messageId ?? null,
          sent_at: new Date().toISOString(),
        })
        .eq('id', delivery.id);
      sent += 1;
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : String(sendError);
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'failed',
          error_message: message,
        })
        .eq('id', delivery.id);
      failed += 1;
    }
  }

  return { sent, failed, recipientCount: profiles.length };
}

async function sendAbsenceNoticeEmails(jobId: number, noticeId: number) {
  const { data: notice, error: noticeError } = await supabase
    .from('absence_notices')
    .select(`
      id, student_id, reason, status, submitted_at,
      student:profiles!student_id(id, name, email, roles, preferred_language, notification_preferences),
      sessions:absence_notice_sessions(
        id, class_id,
        class:classes(
          id, title, date, hour,
          subject:subjects(
            id, title,
            course:courses(id, course_type, graduation_year)
          )
        )
      )
    `)
    .eq('id', noticeId)
    .single();

  if (noticeError) throw noticeError;
  const typedNotice = notice as AbsenceNotice;
  const recipients = await resolveAbsenceNoticeRecipients(typedNotice);
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const delivery = await createDelivery(jobId, recipient);
    try {
      const response = await sendBrevoEmail({
        to: recipient,
        subject: `Absence notice: ${typedNotice.student?.name ?? 'Student'}`,
        html: renderAbsenceNoticeEmail(typedNotice, recipient),
        text: renderAbsenceNoticeText(typedNotice),
        tags: ['attendance', 'absence-notice', 'portal'],
      });
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'sent',
          provider_message_id: response.messageId ?? null,
          sent_at: new Date().toISOString(),
        })
        .eq('id', delivery.id);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'failed',
          error_message: message,
        })
        .eq('id', delivery.id);
      failed += 1;
    }
  }

  return { sent, failed, recipientCount: recipients.length };
}

async function resolveAbsenceNoticeRecipients(notice: AbsenceNotice) {
  const { data: admins, error } = await supabase
    .from('profiles')
    .select('id, name, email, roles, preferred_language, notification_preferences')
    .contains('roles', ['administrator']);
  if (error) throw error;

  const recipients = new Map<string, Profile>();
  if (notice.student?.email) recipients.set(notice.student.id, notice.student);
  for (const admin of (admins ?? []) as Profile[]) {
    if (admin.email) recipients.set(admin.id, admin);
  }
  return [...recipients.values()];
}

async function sendAnnouncementEmails(jobId: number, announcementId: number) {
  const { data: announcement, error: announcementError } = await supabase
    .from('announcements')
    .select('*, author:profiles!author_id(name)')
    .eq('id', announcementId)
    .single();

  if (announcementError) throw announcementError;
  const typedAnnouncement = announcement as Announcement;

  if (typedAnnouncement.status === 'draft' || typedAnnouncement.status === 'archived') {
    return { skipped: true, reason: `Announcement is ${typedAnnouncement.status}` };
  }

  if (typedAnnouncement.status === 'scheduled') {
    await supabase
      .from('announcements')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', announcementId);
  }

  const recipients = await resolveAnnouncementRecipients(typedAnnouncement);
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const delivery = await createDelivery(jobId, recipient);
    const emailContent = getAnnouncementEmailContent(typedAnnouncement, recipient.preferred_language ?? 'en');
    try {
      const response = await sendBrevoEmail({
        to: recipient,
        subject: `New announcement: ${emailContent.title}`,
        html: renderAnnouncementEmail(typedAnnouncement, emailContent),
        text: `${emailContent.title}\n\n${truncateText(emailContent.content)}\n\nPosted by ${typedAnnouncement.author?.name ?? 'The Burning Ones team'}\n\nOpen The Burning Ones Portal: ${APP_URL}`,
        tags: ['announcement', 'portal'],
      });
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'sent',
          provider_message_id: response.messageId ?? null,
          sent_at: new Date().toISOString(),
        })
        .eq('id', delivery.id);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'failed',
          error_message: message,
        })
        .eq('id', delivery.id);
      failed += 1;
    }
  }

  return { sent, failed, recipientCount: recipients.length };
}

async function sendTodoReminderEmail(
  jobId: number,
  todoId: number,
  reminderKind: 'day_before' | 'due_day'
) {
  const { data: todo, error: todoError } = await supabase
    .from('todo_items')
    .select('*, assigned:profiles!todo_items_assigned_to_fkey(id, name, email, roles, notification_preferences)')
    .eq('id', todoId)
    .single();

  if (todoError) throw todoError;
  const typedTodo = todo as TodoItem;

  if (typedTodo.status === 'completed') {
    return { skipped: true, reason: 'Todo already completed' };
  }

  if (typedTodo.priority !== 'priority') {
    return { skipped: true, reason: 'Todo is no longer priority' };
  }

  const recipient = typedTodo.assigned;
  if (!recipient?.email) {
    return { sent: 0, failed: 0, recipientCount: 0, skipped: true, reason: 'Assigned user has no email' };
  }

  if (recipient.notification_preferences?.todos === false) {
    return { sent: 0, failed: 0, recipientCount: 0, skipped: true, reason: 'Todo notifications disabled' };
  }

  const delivery = await createDelivery(jobId, recipient);
  try {
    const response = await sendBrevoEmail({
      to: recipient,
      subject: reminderKind === 'day_before'
        ? `Priority to-do due tomorrow: ${typedTodo.title}`
        : `Priority to-do due today: ${typedTodo.title}`,
      html: renderTodoReminderEmail(typedTodo, reminderKind),
      text: `${typedTodo.title}\n\n${typedTodo.description ? `${truncateText(typedTodo.description)}\n\n` : ''}Due ${formatDateLabel(typedTodo.due_date)}.\n\nOpen: ${APP_URL}`,
      tags: ['todo', 'portal'],
    });
    await supabase
      .from('notification_deliveries')
      .update({
        status: 'sent',
        provider_message_id: response.messageId ?? null,
        sent_at: new Date().toISOString(),
      })
      .eq('id', delivery.id);
    return { sent: 1, failed: 0, recipientCount: 1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from('notification_deliveries')
      .update({
        status: 'failed',
        error_message: message,
      })
      .eq('id', delivery.id);
    return { sent: 0, failed: 1, recipientCount: 1 };
  }
}

async function resolveAnnouncementRecipients(announcement: Announcement): Promise<Profile[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, email, roles, preferred_language, notification_preferences');

  if (profilesError) throw profilesError;

  const tokens = announcement.target_roles ?? [];
  let recipientIds: Set<string> | null = null;

  if (tokens.length > 0) {
    recipientIds = await resolveRecipientIdsFromTokens(tokens);
  } else if (announcement.course_id !== null) {
    recipientIds = new Set<string>();

    const { data: enrollments, error: enrollmentError } = await supabase
      .from('course_students')
      .select('student_id')
      .eq('course_id', announcement.course_id)
      .eq('status', 'active');
    if (enrollmentError) throw enrollmentError;
    (enrollments ?? []).forEach(row => recipientIds?.add(row.student_id));

    const { data: subjects, error: subjectError } = await supabase
      .from('subjects')
      .select('id, primary_teacher_id')
      .eq('course_id', announcement.course_id);
    if (subjectError) throw subjectError;

    const subjectIds = (subjects ?? []).map(row => row.id);
    (subjects ?? []).forEach(row => {
      if (row.primary_teacher_id) recipientIds?.add(row.primary_teacher_id);
    });

    if (subjectIds.length > 0) {
      const { data: classes, error: classError } = await supabase
        .from('classes')
        .select('teacher_id, translator_id')
        .in('subject_id', subjectIds);
      if (classError) throw classError;
      (classes ?? []).forEach(row => {
        if (row.teacher_id) recipientIds?.add(row.teacher_id);
        if (row.translator_id) recipientIds?.add(row.translator_id);
      });
    }
  }

  return ((profiles ?? []) as Profile[]).filter(profile => {
    if (!profile.email) return false;
    if (profile.notification_preferences?.announcements === false) return false;
    if (recipientIds && !recipientIds.has(profile.id)) return false;
    if (announcement.is_staff_only) {
      const realRoles = profile.roles.filter(role => role !== 'dev');
      return realRoles.length > 0 && !realRoles.every(role => role === 'student');
    }
    return true;
  });
}

async function resolveRecipientIdsFromTokens(tokens: string[]) {
  const ids = new Set<string>();

  tokens
    .filter(token => token.startsWith(CUSTOM_USER_PREFIX))
    .forEach(token => ids.add(token.slice(CUSTOM_USER_PREFIX.length)));

  if (tokens.includes('audience:staff')) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, roles');
    if (error) throw error;
    (data ?? []).forEach(row => {
      const realRoles = (row.roles ?? []).filter((role: string) => role !== 'dev');
      if (realRoles.length > 0 && !realRoles.every((role: string) => role === 'student')) {
        ids.add(row.id);
      }
    });
  }

  if (tokens.includes('role:teacher')) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .contains('roles', ['teacher']);
    if (error) throw error;
    (data ?? []).forEach(row => ids.add(row.id));
  }

  for (const courseTypeToken of ['course:first_year', 'course:second_year']) {
    if (!tokens.includes(courseTypeToken)) continue;
    const courseType = courseTypeToken === 'course:first_year' ? 'first_year' : 'second_year';
    const { data: courses, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('course_type', courseType);
    if (courseError) throw courseError;

    const courseIds = (courses ?? []).map(row => row.id);
    if (courseIds.length === 0) continue;

    const { data: enrollments, error: enrollmentError } = await supabase
      .from('course_students')
      .select('student_id')
      .eq('status', 'active')
      .in('course_id', courseIds);
    if (enrollmentError) throw enrollmentError;
    (enrollments ?? []).forEach(row => ids.add(row.student_id));
  }

  return ids;
}

async function createDelivery(jobId: number, recipient: Profile) {
  const { data, error } = await supabase
    .from('notification_deliveries')
    .insert({
      job_id: jobId,
      recipient_id: recipient.id,
      recipient_email: recipient.email,
      status: 'pending',
      provider: 'brevo',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

async function sendBrevoEmail({
  to,
  subject,
  html,
  text,
  tags,
}: {
  to: Profile;
  subject: string;
  html: string;
  text: string;
  tags?: string[];
}) {
  if (!BREVO_API_KEY) throw new Error('Missing BREVO_API_KEY');

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: FROM_NAME,
        email: FROM_EMAIL,
      },
      to: [
        {
          email: to.email,
          name: to.name,
        },
      ],
      subject,
      htmlContent: html,
      textContent: text,
      tags: tags ?? ['portal'],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Brevo failed with ${response.status}: ${JSON.stringify(data)}`);
  }
  return data as { messageId?: string };
}

function renderAnnouncementEmail(
  announcement: Announcement,
  emailContent: { title: string; content: string }
) {
  const theme = getNotificationTheme('announcement');
  const title = escapeHtml(emailContent.title);
  const content = escapeHtml(truncateText(emailContent.content)).replace(/\n/g, '<br>');
  const authorName = escapeHtml(announcement.author?.name ?? 'The Burning Ones team');
  const authorInitials = escapeHtml(getInitials(announcement.author?.name ?? 'TBO'));
  const scopeLabel = escapeHtml(getAnnouncementScopeLabel(announcement));
  const appUrl = escapeHtml(APP_URL);
  const logoUrl = escapeHtml(LOGO_URL);
  const brandMark = logoUrl
    ? `<img src="${logoUrl}" width="36" height="36" alt="The Burning Ones" style="display:block;width:36px;height:36px;margin:6px auto;object-fit:contain;border:0;">`
    : `<div style="width:36px;height:36px;margin:6px auto;border-radius:50%;background:${theme.accent};color:#ffffff;font-size:11px;font-weight:700;line-height:36px;text-align:center;letter-spacing:.02em;">TBO</div>`;
  const postedDate = escapeHtml(
    new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date()),
  );

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${title}</title>
  </head>
  <body style="margin:0;background:#f8faf7;padding:0;font-family:Roboto,Arial,'Segoe UI',sans-serif;color:#202124;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      A new announcement from The Burning Ones, posted by ${authorName}.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8faf7;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;margin:0 auto;">
            <tr>
              <td style="padding:0 4px 14px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="width:48px;height:48px;border-radius:14px;background:#ffffff;border:1px solid ${theme.border};text-align:center;vertical-align:middle;">
                            ${brandMark}
                          </td>
                          <td style="padding-left:12px;">
                            <div style="font-size:15px;font-weight:600;line-height:1.2;color:#202124;">The Burning Ones</div>
                            <div style="padding-top:3px;font-size:12px;line-height:1.3;color:#5f6368;">Portal announcement</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" style="vertical-align:middle;font-size:12px;line-height:1.4;color:#5f6368;white-space:nowrap;">
                      ${postedDate}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #dadce0;border-radius:24px;background:#ffffff;box-shadow:0 1px 2px rgba(60,64,67,.12),0 2px 6px rgba(60,64,67,.08);overflow:hidden;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="height:10px;background:${theme.accent};font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:26px 28px 18px;border-bottom:1px solid #eceff1;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="width:48px;vertical-align:top;">
                            <div style="width:40px;height:40px;border-radius:50%;background:${theme.tint};color:${theme.accent};font-size:14px;font-weight:700;line-height:40px;text-align:center;">
                              ${authorInitials}
                            </div>
                          </td>
                          <td style="vertical-align:top;">
                            <div style="font-size:14px;line-height:1.45;color:#3c4043;">
                              <strong style="font-weight:600;color:#202124;">${authorName}</strong> posted a new announcement
                            </div>
                            <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:5px;">
                              <tr>
                                <td style="width:22px;height:22px;border-radius:50%;background:${theme.tint};text-align:center;vertical-align:middle;">
                                  <img src="${theme.groupIconUrl}" width="14" height="14" alt="" style="display:block;width:14px;height:14px;margin:4px auto;border:0;object-fit:contain;">
                                </td>
                                <td style="padding-left:8px;font-size:12px;line-height:22px;color:#5f6368;vertical-align:middle;">
                                  ${scopeLabel}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 28px 28px;">
                      <h1 style="margin:0;font-family:Roboto,Arial,'Segoe UI',sans-serif;font-size:24px;line-height:1.25;font-weight:500;letter-spacing:0;color:#202124;">
                        ${title}
                      </h1>
                      <div style="margin-top:18px;font-size:14px;line-height:1.7;color:#3c4043;border-left:4px solid ${theme.tint};padding-left:14px;">
                        ${content}
                      </div>
                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:26px;">
                        <tr>
                          <td style="border-radius:999px;background:${theme.accent};">
                            <a href="${appUrl}" style="display:inline-block;padding:12px 22px;border-radius:999px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;line-height:1;">
                              Open
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 6px 0;text-align:center;font-size:12px;line-height:1.6;color:#5f6368;">
                You received this because announcement notifications are enabled for your account.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderTodoReminderEmail(todo: TodoItem, reminderKind: 'day_before' | 'due_day') {
  const theme = getNotificationTheme('assignment');
  const title = escapeHtml(todo.title);
  const description = todo.description
    ? escapeHtml(truncateText(todo.description, 420)).replace(/\n/g, '<br>')
    : '';
  const dueLabel = escapeHtml(formatDateLabel(todo.due_date));
  const reminderLabel = reminderKind === 'day_before' ? 'Due tomorrow' : 'Due today';
  const appUrl = escapeHtml(APP_URL);
  const logoUrl = escapeHtml(LOGO_URL);
  const brandMark = logoUrl
    ? `<img src="${logoUrl}" width="36" height="36" alt="The Burning Ones" style="display:block;width:36px;height:36px;margin:6px auto;object-fit:contain;border:0;">`
    : `<div style="width:36px;height:36px;margin:6px auto;border-radius:50%;background:${theme.accent};color:#ffffff;font-size:11px;font-weight:700;line-height:36px;text-align:center;letter-spacing:.02em;">TBO</div>`;

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${title}</title>
  </head>
  <body style="margin:0;background:#f8faf7;padding:0;font-family:Roboto,Arial,'Segoe UI',sans-serif;color:#202124;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Priority to-do reminder from The Burning Ones Portal.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8faf7;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;margin:0 auto;">
            <tr>
              <td style="padding:0 4px 14px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="width:48px;height:48px;border-radius:14px;background:#ffffff;border:1px solid ${theme.border};text-align:center;vertical-align:middle;">
                            ${brandMark}
                          </td>
                          <td style="padding-left:12px;">
                            <div style="font-size:15px;font-weight:600;line-height:1.2;color:#202124;">Priority to-do</div>
                            <div style="padding-top:3px;font-size:12px;line-height:1.3;color:#5f6368;">${reminderLabel}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="border-radius:999px;background:${theme.tint};color:${theme.accent};font-size:12px;font-weight:700;line-height:1;padding:8px 12px;">
                            ${dueLabel}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #dadce0;border-radius:24px;background:#ffffff;box-shadow:0 1px 2px rgba(60,64,67,.12),0 2px 6px rgba(60,64,67,.08);overflow:hidden;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="height:10px;background:${theme.accent};font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:28px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:18px;">
                        <tr>
                          <td style="width:34px;height:34px;border-radius:50%;background:${theme.tint};text-align:center;vertical-align:middle;">
                            <img src="${theme.groupIconUrl}" width="18" height="18" alt="" style="display:block;width:18px;height:18px;margin:8px auto;border:0;object-fit:contain;">
                          </td>
                          <td style="padding-left:10px;font-size:13px;line-height:1.4;color:#5f6368;">
                            This priority item is still open.
                          </td>
                        </tr>
                      </table>
                      <h1 style="margin:0;font-family:Roboto,Arial,'Segoe UI',sans-serif;font-size:24px;line-height:1.25;font-weight:500;letter-spacing:0;color:#202124;">
                        ${title}
                      </h1>
                      ${description ? `<div style="margin-top:16px;font-size:14px;line-height:1.7;color:#3c4043;border-left:4px solid ${theme.tint};padding-left:14px;">${description}</div>` : ''}
                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:26px;">
                        <tr>
                          <td style="border-radius:999px;background:${theme.accent};">
                            <a href="${appUrl}" style="display:inline-block;padding:12px 22px;border-radius:999px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;line-height:1;">
                              Open
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 6px 0;text-align:center;font-size:12px;line-height:1.6;color:#5f6368;">
                You received this because the to-do is marked priority and has not been completed.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderAbsenceNoticeEmail(notice: AbsenceNotice, recipient: Profile) {
  const theme = getNotificationTheme('attendance');
  const studentName = escapeHtml(notice.student?.name ?? 'Student');
  const recipientName = escapeHtml(recipient.name ?? 'there');
  const reason = notice.reason?.trim()
    ? escapeHtml(truncateText(notice.reason, 420)).replace(/\n/g, '<br>')
    : 'No reason was provided.';
  const submittedDate = escapeHtml(formatDateTimeLabel(notice.submitted_at));
  const appUrl = escapeHtml(APP_URL);
  const logoUrl = escapeHtml(LOGO_URL);
  const brandMark = logoUrl
    ? `<img src="${logoUrl}" width="36" height="36" alt="The Burning Ones" style="display:block;width:36px;height:36px;margin:6px auto;object-fit:contain;border:0;">`
    : `<div style="width:36px;height:36px;margin:6px auto;border-radius:50%;background:${theme.accent};color:#ffffff;font-size:11px;font-weight:700;line-height:36px;text-align:center;letter-spacing:.02em;">TBO</div>`;
  const sessionRows = (notice.sessions ?? []).map(item => {
    const cls = item.class;
    const date = cls?.date ? escapeHtml(formatDateLabel(cls.date)) : 'Date not set';
    const title = escapeHtml(cls?.title ?? 'Session');
    const subject = escapeHtml(cls?.subject?.title ?? 'Subject');
    const year = escapeHtml(getCourseTypeLabel(cls?.subject?.course?.course_type));
    const hour = escapeHtml(getHourLabel(cls?.hour ?? 'first'));
    return `
      <tr>
        <td style="padding:12px 0;border-top:1px solid #eeeeee;">
          <div style="font-size:14px;font-weight:700;color:#202124;">${title}</div>
          <div style="margin-top:4px;font-size:12px;color:#5f6368;">${date} · ${hour} · ${subject} · ${year}</div>
        </td>
      </tr>
    `;
  }).join('');

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Absence notice</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafd;font-family:Roboto,Arial,'Segoe UI',sans-serif;color:#202124;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafd;">
      <tr>
        <td align="center" style="padding:28px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dadce0;border-radius:24px;overflow:hidden;box-shadow:0 1px 2px rgba(60,64,67,.12),0 2px 6px rgba(60,64,67,.08);">
            <tr>
              <td style="height:10px;background:${theme.accent};font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:24px 28px 10px;text-align:center;">
                ${brandMark}
                <div style="margin-top:8px;display:inline-block;border-radius:999px;background:${theme.tint};border:1px solid ${theme.border};padding:6px 10px;color:${theme.accent};font-size:12px;font-weight:700;">Absence notice</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 26px;">
                <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:500;color:#202124;">${studentName} submitted an absence notice</h1>
                <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#5f6368;">Hi ${recipientName}, this is a copy of the absence notice submitted through the portal.</p>
                <div style="margin-top:20px;border-radius:18px;background:#fffaf0;border:1px solid ${theme.border};padding:16px;">
                  <div style="font-size:12px;font-weight:700;color:${theme.accent};text-transform:uppercase;letter-spacing:.08em;">Reason</div>
                  <div style="margin-top:8px;font-size:14px;line-height:1.6;color:#3c4043;">${reason}</div>
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                  ${sessionRows || '<tr><td style="padding:12px 0;font-size:14px;color:#5f6368;">No sessions were attached.</td></tr>'}
                </table>
                <div style="margin-top:20px;font-size:12px;color:#80868b;">Submitted ${submittedDate}</div>
                <div style="margin-top:22px;">
                  <a href="${appUrl}" style="display:inline-block;border-radius:999px;background:#202124;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;">Open</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderAbsenceNoticeText(notice: AbsenceNotice) {
  const sessions = (notice.sessions ?? [])
    .map(item => {
      const cls = item.class;
      return `- ${cls?.date ? formatDateLabel(cls.date) : 'Date not set'} · ${cls?.title ?? 'Session'} · ${cls?.subject?.title ?? 'Subject'} · ${getHourLabel(cls?.hour ?? 'first')}`;
    })
    .join('\n');
  return `Absence notice from ${notice.student?.name ?? 'Student'}\n\nReason:\n${notice.reason?.trim() || 'No reason was provided.'}\n\nSessions:\n${sessions || 'No sessions were attached.'}\n\nOpen: ${APP_URL}`;
}

function renderWorkflowEmail(payload: WorkflowEmailPayload) {
  const theme = getNotificationTheme(payload.kind ?? 'system');
  const title = escapeHtml(payload.title || 'Portal update');
  const body = escapeHtml(truncateText(payload.body || '', 900)).replace(/\n/g, '<br>');
  const appUrl = escapeHtml(payload.actionUrl || APP_URL);
  const logoUrl = escapeHtml(LOGO_URL);
  const brandMark = logoUrl
    ? `<img src="${logoUrl}" width="36" height="36" alt="The Burning Ones" style="display:block;width:36px;height:36px;margin:6px auto;object-fit:contain;border:0;">`
    : `<div style="width:36px;height:36px;margin:6px auto;border-radius:50%;background:${theme.accent};color:#ffffff;font-size:11px;font-weight:700;line-height:36px;text-align:center;letter-spacing:.02em;">TBO</div>`;

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${title}</title>
  </head>
  <body style="margin:0;background:#f8faf7;padding:0;font-family:Roboto,Arial,'Segoe UI',sans-serif;color:#202124;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8faf7;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;margin:0 auto;">
            <tr>
              <td style="padding:0 4px 14px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width:48px;height:48px;border-radius:14px;background:#ffffff;border:1px solid ${theme.border};text-align:center;vertical-align:middle;">${brandMark}</td>
                    <td style="padding-left:12px;">
                      <div style="font-size:15px;font-weight:600;line-height:1.2;color:#202124;">The Burning Ones</div>
                      <div style="padding-top:3px;font-size:12px;line-height:1.3;color:#5f6368;">Portal update</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #dadce0;border-radius:24px;background:#ffffff;box-shadow:0 1px 2px rgba(60,64,67,.12),0 2px 6px rgba(60,64,67,.08);overflow:hidden;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="height:10px;background:${theme.accent};font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:28px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:18px;">
                        <tr>
                          <td style="width:34px;height:34px;border-radius:50%;background:${theme.tint};text-align:center;vertical-align:middle;">
                            <img src="${theme.groupIconUrl}" width="18" height="18" alt="" style="display:block;width:18px;height:18px;margin:8px auto;border:0;object-fit:contain;">
                          </td>
                          <td style="padding-left:10px;font-size:13px;line-height:1.4;color:#5f6368;">A portal workflow needs your attention.</td>
                        </tr>
                      </table>
                      <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:500;color:#202124;">${title}</h1>
                      ${body ? `<div style="margin-top:16px;font-size:14px;line-height:1.7;color:#3c4043;border-left:4px solid ${theme.tint};padding-left:14px;">${body}</div>` : ''}
                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:26px;">
                        <tr>
                          <td style="border-radius:999px;background:${theme.accent};">
                            <a href="${appUrl}" style="display:inline-block;padding:12px 22px;border-radius:999px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;line-height:1;">Open</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function getNotificationTheme(kind: 'announcement' | 'assignment' | 'attendance' | 'system') {
  const iconBaseUrl = 'https://theburningones.bg/wp-content/uploads/2026/07';
  const themes = {
    announcement: {
      accent: '#137333',
      tint: '#e6f4ea',
      border: '#d7e7da',
      groupIconUrl: `${iconBaseUrl}/group-icon-green.png`,
    },
    assignment: {
      accent: '#1a73e8',
      tint: '#e8f0fe',
      border: '#d2e3fc',
      groupIconUrl: `${iconBaseUrl}/group-icon-blue.png`,
    },
    attendance: {
      accent: '#b06000',
      tint: '#fef7e0',
      border: '#fce8b2',
      groupIconUrl: `${iconBaseUrl}/group-icon-amber.png`,
    },
    system: {
      accent: '#5f6368',
      tint: '#f1f3f4',
      border: '#dadce0',
      groupIconUrl: `${iconBaseUrl}/group-icon-gray.png`,
    },
  };

  return themes[kind];
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getHourLabel(value: string) {
  if (value === 'both') return 'Joint session';
  if (value === 'first') return 'First session';
  if (value === 'second') return 'Second session';
  return value;
}

function getCourseTypeLabel(value: string | null | undefined) {
  if (value === 'first_year') return 'First Year';
  if (value === 'second_year') return 'Second Year';
  return 'Year group';
}

function getAnnouncementScopeLabel(announcement: Announcement) {
  const tokens = announcement.target_roles ?? [];
  if (tokens.length === 0) {
    if (announcement.course_id !== null) return 'Course audience';
    return 'Everyone';
  }

  const labels = new Set<string>();
  if (tokens.includes('audience:all')) labels.add('Everyone');
  if (tokens.includes('audience:staff')) labels.add('Staff');
  if (tokens.includes('role:teacher')) labels.add('Teachers');
  if (tokens.includes('course:first_year')) labels.add('First Year Students');
  if (tokens.includes('course:second_year')) labels.add('Second Year Students');

  const customCount = tokens.filter(token => token.startsWith(CUSTOM_USER_PREFIX)).length;
  if (customCount > 0) {
    labels.add(customCount === 1 ? 'You' : 'Selected people');
  }

  if (labels.size === 0) return 'Selected audience';
  if (labels.size === 1) return [...labels][0];
  return 'Selected audience';
}

function truncateText(value: string, maxLength = 700) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return 'TBO';
  return parts.map(part => part[0]?.toUpperCase() ?? '').join('');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
