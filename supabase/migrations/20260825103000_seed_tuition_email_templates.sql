insert into public.settings (key, value)
values (
  'tuition_email_templates',
  jsonb_build_object(
    'reminder',
    jsonb_build_object(
      'subject', 'Tuition payment reminder',
      'title', 'Tuition reminder',
      'body', 'Hello {{student_name}},

This is a reminder that your tuition still has an outstanding balance.

Remaining amount: {{remaining_amount}} {{currency}}
Plan: {{plan_name}}
{{installment_line}}

You can open the portal to review your tuition record or speak with the school office if anything looks incorrect.'
    )
  )
)
on conflict (key) do nothing;
