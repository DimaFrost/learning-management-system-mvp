import { supabase } from '../lib/supabase';
import type { User } from '../types/lms';

type WorkflowEmailKind = 'assignment' | 'attendance' | 'system';
const WORKFLOW_EMAIL_MAX_RECIPIENTS = 250;

async function queueNotificationJob(params: {
  type: string;
  createdBy: string;
  payload: Record<string, unknown>;
  announcementId?: number | null;
}) {
  const { error } = await supabase.from('notification_jobs').insert({
    type: params.type,
    status: 'pending',
    scheduled_for: new Date().toISOString(),
    created_by: params.createdBy,
    announcement_id: params.announcementId ?? null,
    payload: params.payload,
  });

  if (error) {
    console.error(`Failed to queue ${params.type}`, error);
    return false;
  }

  return true;
}

export async function queueAnnouncementEmail(params: {
  announcementId: number;
  createdBy: string;
}) {
  return queueNotificationJob({
    type: 'announcement_email',
    createdBy: params.createdBy,
    announcementId: params.announcementId,
    payload: { announcementId: params.announcementId },
  });
}

export async function queueRoleChangeEmail(params: {
  createdBy: string;
  userId: string;
  newRoles: string[];
}) {
  return queueNotificationJob({
    type: 'role_change_email',
    createdBy: params.createdBy,
    payload: {
      userId: params.userId,
      newRoles: params.newRoles,
    },
  });
}

export async function queueProfileInviteEmail(params: {
  createdBy: string;
  email: string;
  name?: string;
  roles?: string[];
  actionUrl?: string;
}) {
  return queueNotificationJob({
    type: 'profile_invite_email',
    createdBy: params.createdBy,
    payload: {
      email: params.email,
      name: params.name ?? '',
      roles: params.roles ?? [],
      actionUrl: params.actionUrl ?? window.location.origin,
    },
  });
}

export async function queueEnrollmentEmail(params: {
  createdBy: string;
  studentId: string;
  courseId: number;
}) {
  return queueNotificationJob({
    type: 'enrollment_email',
    createdBy: params.createdBy,
    payload: {
      studentId: params.studentId,
      courseId: params.courseId,
    },
  });
}

export async function queueDirectMessageEmail(params: {
  senderId: string;
  recipientId: string;
  preview: string;
}) {
  return queueNotificationJob({
    type: 'direct_message_email',
    createdBy: params.senderId,
    payload: {
      recipientId: params.recipientId,
      preview: params.preview,
    },
  });
}

export async function queueWorkflowEmail(params: {
  createdBy: string;
  recipientIds: string[];
  subject: string;
  title: string;
  body: string;
  kind?: WorkflowEmailKind;
  actionUrl?: string;
}) {
  const recipientIds = Array.from(new Set(params.recipientIds.filter(Boolean)));
  if (recipientIds.length === 0) return;
  if (recipientIds.length > WORKFLOW_EMAIL_MAX_RECIPIENTS) {
    console.error(`Workflow email recipient limit exceeded (${recipientIds.length}/${WORKFLOW_EMAIL_MAX_RECIPIENTS})`);
    return null;
  }

  const { data, error } = await supabase.from('notification_jobs').insert({
    type: 'workflow_email',
    status: 'pending',
    scheduled_for: new Date().toISOString(),
    created_by: params.createdBy,
    payload: {
      recipientIds,
      subject: params.subject,
      title: params.title,
      body: params.body,
      kind: params.kind ?? 'system',
      actionUrl: params.actionUrl ?? null,
    },
  }).select('id').single();

  if (error) {
    console.error('Failed to queue workflow email', error);
    return null;
  }

  return data?.id ?? null;
}

export function getAdminIds(users: User[]) {
  return users.filter(user => user.roles.includes('administrator')).map(user => user.id);
}
