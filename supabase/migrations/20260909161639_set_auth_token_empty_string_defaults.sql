-- Supabase Auth expects empty token strings for "no token" in some auth flows.
-- Imported/bootstrap users may have NULL token values, which can make GoTrue
-- fail during OAuth callback with "converting NULL to string is unsupported".
-- The managed auth server also expects instance_id to scan as a UUID; Supabase
-- projects commonly use the zero UUID for the default instance.

do $$
begin
  begin
    alter table auth.users
      alter column confirmation_token set default '',
      alter column recovery_token set default '',
      alter column email_change_token_new set default '',
      alter column email_change_token_current set default '',
      alter column email_change set default '',
      alter column phone_change set default '',
      alter column phone_change_token set default '',
      alter column reauthentication_token set default '',
      alter column instance_id set default '00000000-0000-0000-0000-000000000000'::uuid;
  exception
    when insufficient_privilege then
      raise notice 'Skipping auth.users token defaults because this role cannot alter Supabase Auth tables.';
    when undefined_table then
      raise notice 'Skipping auth.users token defaults because auth.users is not available in this environment.';
  end;

  begin
    update auth.users
    set
      confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      email_change = coalesce(email_change, ''),
      phone_change = coalesce(phone_change, ''),
      phone_change_token = coalesce(phone_change_token, ''),
      reauthentication_token = coalesce(reauthentication_token, ''),
      instance_id = coalesce(instance_id, '00000000-0000-0000-0000-000000000000'::uuid)
    where confirmation_token is null
       or recovery_token is null
       or email_change_token_new is null
       or email_change_token_current is null
       or email_change is null
       or phone_change is null
       or phone_change_token is null
       or reauthentication_token is null
       or instance_id is null;
  exception
    when insufficient_privilege then
      raise notice 'Skipping auth.users token cleanup because this role cannot update Supabase Auth tables.';
    when undefined_table then
      raise notice 'Skipping auth.users token cleanup because auth.users is not available in this environment.';
  end;
end $$;
