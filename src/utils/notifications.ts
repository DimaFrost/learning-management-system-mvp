import { supabase } from '../lib/supabase';

export async function sendNotification(
  type: 'announcement' | 'role_change' | 'enrollment' | 'direct_message',
  data: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.functions.invoke('send-notification', {
      body: { type, data },
    });
  } catch (err) {
    // Email failure should never break the app — just log it
    console.error('Notification send failed:', err);
  }
}
