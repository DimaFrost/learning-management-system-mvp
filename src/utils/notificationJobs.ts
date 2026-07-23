import { supabase } from '../lib/supabase';
import type { User } from '../types/lms';

type WorkflowEmailKind = 'assignment' | 'attendance' | 'system';

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
