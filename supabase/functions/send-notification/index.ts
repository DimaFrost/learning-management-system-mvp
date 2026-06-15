import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:3000';
const FROM_EMAIL = 'The Burning Ones <noreply@theburningones.bg>';

serve(async (req) => {
  const { type, data } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  if (type === 'announcement') {
    // data: { title, content, authorName, type, isStaffOnly }

    // Fetch all profiles that want announcement emails
    const { data: profiles } = await supabase
      .from('profiles')
      .select('email, name, roles, notification_preferences')
      .filter('notification_preferences->>announcements', 'eq', 'true');

    const recipients = (profiles ?? []).filter(p => {
      // If staff-only, skip pure students
      if (data.isStaffOnly) {
        const nonDevRoles = p.roles.filter((r: string) => r !== 'dev');
        return nonDevRoles.some((r: string) => r !== 'student');
      }
      return true;
    });

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f59e0b; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">
            📢 New Announcement
          </h1>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; 
                    border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #111827;">${data.title}</h2>
          <p style="color: #374151; line-height: 1.6;">${data.content}</p>
          <p style="color: #6b7280; font-size: 14px;">
            Posted by ${data.authorName}
          </p>
          <a href="${APP_URL}" 
             style="display: inline-block; background: #f59e0b; color: white;
                    padding: 12px 24px; border-radius: 6px; text-decoration: none;
                    font-weight: bold; margin-top: 16px;">
            View in The Burning Ones
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; 
                  margin-top: 16px;">
          You can manage your notification preferences in the Settings tab.
        </p>
      </div>
    `;

    for (const profile of recipients) {
      await sendEmail(profile.email,
        `New Announcement: ${data.title}`, emailHtml);
    }
  }

  else if (type === 'role_change') {
    // data: { userId, email, name, newRoles }

    const { data: profile } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', data.userId)
      .single();

    if (!profile?.notification_preferences?.roleChange) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const roleLabels: Record<string, string> = {
      administrator: 'Administrator',
      teacher: 'Teacher',
      translator: 'Translator',
      mentor: 'Mentor',
      student: 'Student',
    };

    const rolesDisplay = data.newRoles
      .filter((r: string) => r !== 'dev')
      .map((r: string) => roleLabels[r] ?? r)
      .join(', ') || 'No roles assigned';

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f59e0b; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">
            Your Role Has Been Updated
          </h1>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #e5e7eb;
                    border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #374151;">Hi ${data.name},</p>
          <p style="color: #374151; line-height: 1.6;">
            Your role in The Burning Ones platform has been updated by an 
            administrator.
          </p>
          <div style="background: #f9fafb; border-radius: 6px; padding: 16px; 
                      margin: 16px 0;">
            <p style="margin: 0; color: #111827; font-weight: bold;">
              Your current role(s): ${rolesDisplay}
            </p>
          </div>
          <a href="${APP_URL}"
             style="display: inline-block; background: #f59e0b; color: white;
                    padding: 12px 24px; border-radius: 6px; text-decoration: none;
                    font-weight: bold;">
            Open The Burning Ones
          </a>
        </div>
      </div>
    `;

    await sendEmail(data.email, 'Your role has been updated', emailHtml);
  }

  else if (type === 'enrollment') {
    // data: { studentId, studentEmail, studentName, courseName }

    const { data: profile } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', data.studentId)
      .single();

    if (!profile?.notification_preferences?.enrollment) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f59e0b; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">
            You've Been Added to a Course
          </h1>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #e5e7eb;
                    border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #374151;">Hi ${data.studentName},</p>
          <p style="color: #374151; line-height: 1.6;">
            You have been enrolled in the following course:
          </p>
          <div style="background: #f9fafb; border-radius: 6px; padding: 16px; 
                      margin: 16px 0;">
            <p style="margin: 0; color: #111827; font-weight: bold; font-size: 18px;">
              ${data.courseName}
            </p>
          </div>
          <a href="${APP_URL}"
             style="display: inline-block; background: #f59e0b; color: white;
                    padding: 12px 24px; border-radius: 6px; text-decoration: none;
                    font-weight: bold;">
            View My Course
          </a>
        </div>
      </div>
    `;

    await sendEmail(
      data.studentEmail,
      `You've been enrolled in ${data.courseName}`,
      emailHtml
    );
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});

async function sendEmail(to: string, subject: string, html: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
}
