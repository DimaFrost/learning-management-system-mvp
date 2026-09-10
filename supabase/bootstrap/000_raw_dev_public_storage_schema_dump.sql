--
-- PostgreSQL database dump
--

\restrict NlifKBcjqC7beuIpZ3rsD3Wm9BQFBi4PCa2fROiFvtnNTJThs97e6mAlWfJvn3f

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: can_current_user_write_stream(bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_current_user_write_stream(target_course_id bigint, action text) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with me as (
    select roles from public.profiles where id = (select auth.uid())
  ),
  setting as (
    select coalesce(
      (select permission from public.stream_course_settings where course_id = target_course_id),
      'students_comment'
    ) as permission
  )
  select
    exists (select 1 from me where roles @> array['administrator']::text[])
    or exists (
      select 1
      from public.subjects s
      join public.classes c on c.subject_id = s.id
      where s.course_id = target_course_id
        and c.teacher_id = (select auth.uid())
    )
    or (
      exists (select 1 from me where roles @> array['student']::text[])
      and exists (
        select 1 from public.course_students
        where course_students.course_id = target_course_id
          and course_students.student_id = (select auth.uid())
          and course_students.status = 'active'
      )
      and (
        (action = 'comment' and (select permission from setting) in ('students_post_comment', 'students_comment'))
        or (action = 'post' and (select permission from setting) = 'students_post_comment')
      )
    );
$$;


--
-- Name: enforce_classes_translator_only_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_classes_translator_only_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if public.is_admin() then
    return new;
  end if;

  if public.is_translation_ministry_team_leader() then
    if new.subject_id is distinct from old.subject_id
      or new.title is distinct from old.title
      or new.date is distinct from old.date
      or new.hour is distinct from old.hour
      or new.teacher_id is distinct from old.teacher_id
      or new.drive_folder_id is distinct from old.drive_folder_id
      or new.materials_folder_id is distinct from old.materials_folder_id
      or new.homework_folder_id is distinct from old.homework_folder_id
      or new.teacher_notes_folder_id is distinct from old.teacher_notes_folder_id
      or new.translator_notes_folder_id is distinct from old.translator_notes_folder_id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Translation team leaders may only update translator_id on classes';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  invite_record public.profile_invites%rowtype;
  invite_payload jsonb := '{}'::jsonb;
  invite_roles text[] := '{}'::text[];
  invite_teaching_course_types text[] := '{}'::text[];
  invite_notification_preferences jsonb := null;
  profile_name text;
  derived_first_name text;
  derived_last_name text;
  default_notification_preferences jsonb := jsonb_build_object(
    'announcements', true,
    'roleChange', true,
    'enrollment', true,
    'messages', true
  );
begin
  select *
  into invite_record
  from public.profile_invites
  where lower(email) = lower(coalesce(new.email, ''))
    and status = 'pending'
  order by created_at desc
  limit 1;

  if invite_record.id is not null then
    invite_payload := coalesce(invite_record.payload, '{}'::jsonb);

    select coalesce(array_agg(value), '{}'::text[])
    into invite_roles
    from jsonb_array_elements_text(coalesce(invite_payload->'roles', '[]'::jsonb)) as value;

    select coalesce(array_agg(value), '{}'::text[])
    into invite_teaching_course_types
    from jsonb_array_elements_text(coalesce(invite_payload->'teachingCourseTypes', '[]'::jsonb)) as value;
  end if;

  profile_name := coalesce(
    nullif(invite_payload->>'name', ''),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  derived_first_name := coalesce(
    nullif(invite_payload->>'firstName', ''),
    split_part(profile_name, ' ', 1),
    ''
  );
  derived_last_name := coalesce(
    nullif(invite_payload->>'lastName', ''),
    nullif(trim(regexp_replace(profile_name, '^\S+\s*', '')), ''),
    ''
  );

  insert into public.profiles (
    id,
    name,
    roles,
    first_name,
    last_name,
    preferred_language,
    teaching_course_types,
    is_online_student,
    student_number
  )
  values (
    new.id,
    profile_name,
    invite_roles,
    derived_first_name,
    derived_last_name,
    case when invite_payload->>'preferredLanguage' = 'bg' then 'bg' else 'en' end,
    invite_teaching_course_types,
    case
      when invite_payload->>'isOnlineStudent' in ('true', 'false') then (invite_payload->>'isOnlineStudent')::boolean
      else false
    end,
    nullif(upper(regexp_replace(coalesce(invite_payload->>'studentNumber', ''), '\s+', '', 'g')), '')
  )
  on conflict (id) do update
  set
    name = excluded.name,
    roles = case
      when cardinality(excluded.roles) > 0 then excluded.roles
      else public.profiles.roles
    end,
    first_name = coalesce(nullif(excluded.first_name, ''), public.profiles.first_name, ''),
    last_name = coalesce(nullif(excluded.last_name, ''), public.profiles.last_name, ''),
    preferred_language = excluded.preferred_language,
    teaching_course_types = excluded.teaching_course_types,
    is_online_student = excluded.is_online_student,
    student_number = coalesce(excluded.student_number, public.profiles.student_number),
    updated_at = now();

  invite_notification_preferences := invite_payload->'notificationPreferences';

  insert into public.profile_private_data (
    profile_id,
    email,
    phone,
    notification_preferences
  )
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(invite_payload->>'phone', ''),
    case
      when jsonb_typeof(invite_notification_preferences) = 'object' then invite_notification_preferences
      else default_notification_preferences
    end
  )
  on conflict (profile_id) do update
  set
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profile_private_data.phone),
    notification_preferences = coalesce(
      excluded.notification_preferences,
      public.profile_private_data.notification_preferences,
      default_notification_preferences
    ),
    updated_at = now();

  if invite_record.id is not null then
    update public.profile_invites
    set
      status = 'accepted',
      claimed_by = new.id,
      claimed_at = now(),
      updated_at = now()
    where id = invite_record.id;
  end if;

  return new;
end;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and 'administrator' = any(roles)
  );
$$;


--
-- Name: is_translation_ministry_team_leader(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_translation_ministry_team_leader() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.roles @> array['team_leader']::text[]
    )
    and exists (
      select 1
      from public.ministry_teams t
      where t.active = true
        and (
          lower(t.name) = 'translation'
          or lower(coalesce(t.name_bg, '')) = 'превод'
        )
        and (
          t.leader_id = (select auth.uid())
          or exists (
            select 1
            from public.ministry_team_members m
            where m.team_id = t.id
              and m.user_id = (select auth.uid())
              and m.active = true
              and m.can_submit_reports = true
          )
        )
    );
$$;


--
-- Name: prevent_profile_private_data_escalation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_profile_private_data_escalation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to update private profile data.';
  end if;

  if public.is_admin() then
    new.updated_at = now();
    return new;
  end if;

  if old.profile_id is distinct from (select auth.uid()) then
    raise exception 'Only administrators can update other private profile data.';
  end if;

  if new.profile_id is distinct from old.profile_id
    or new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only administrators can update protected private profile fields.';
  end if;

  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: prevent_profile_privilege_escalation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_profile_privilege_escalation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to update profiles.';
  end if;

  if new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or new.notification_preferences is distinct from old.notification_preferences
  then
    raise exception 'Profile contact and notification fields must be updated through profile_private_data.';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if old.id is distinct from (select auth.uid()) then
    raise exception 'Only administrators can update other profiles.';
  end if;

  if new.id is distinct from old.id
    or new.roles is distinct from old.roles
    or new.teaching_course_types is distinct from old.teaching_course_types
    or new.is_online_student is distinct from old.is_online_student
    or new.student_number is distinct from old.student_number
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only administrators can update protected profile fields.';
  end if;

  return new;
end;
$$;


--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[array_length(_parts, 1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_prefix_len INT;
    v_prefix_start INT;
    v_combined_levels INT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_prefix_len := length(coalesce(prefix, ''));
    v_prefix_start := coalesce(array_length(string_to_array(coalesce(prefix, ''), v_delimiter), 1), 1);
    v_combined_levels := coalesce(array_length(string_to_array(v_prefix, v_delimiter), 1), 1);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT array_to_string(path_tokens[$1:$2], '/') AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $3 || '%%'
                  AND bucket_id = $4
                  AND array_length(objects.path_tokens, 1) <> $2
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT array_to_string(path_tokens[$1:$2], '/') AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $3 || '%%'
               AND bucket_id = $4
               AND array_length(objects.path_tokens, 1) = $2
             ORDER BY %I %s)
            LIMIT $5 OFFSET $6
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING v_prefix_start, v_combined_levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := substring(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter) from v_prefix_len + 1);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := substring(v_current.name from v_prefix_len + 1);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
    v_sort_order text;
    v_sort_column text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    -- Defense-in-depth: this function is independently reachable and must
    -- not trust p_sort_order/p_sort_column to already be validated by a
    -- caller. Normalize to the same strict allow-list storage.search_v2
    -- uses before interpolating anything into dynamic SQL below.
    v_sort_order := lower(coalesce(p_sort_order, 'asc'));
    IF v_sort_order NOT IN ('asc', 'desc') THEN
        v_sort_order := 'asc';
    END IF;

    v_sort_column := lower(coalesce(p_sort_column, 'updated_at'));
    IF v_sort_column NOT IN ('updated_at', 'created_at') THEN
        v_sort_column := 'updated_at';
    END IF;

    IF v_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        v_sort_column,
        v_cursor_op,
        v_sort_column,
        v_sort_order,
        v_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: absence_notice_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.absence_notice_sessions (
    id bigint NOT NULL,
    notice_id bigint NOT NULL,
    class_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: absence_notice_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.absence_notice_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: absence_notice_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.absence_notice_sessions_id_seq OWNED BY public.absence_notice_sessions.id;


--
-- Name: absence_notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.absence_notices (
    id bigint NOT NULL,
    student_id uuid NOT NULL,
    reason text,
    status text DEFAULT 'submitted'::text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT absence_notices_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'acknowledged'::text, 'archived'::text])))
);


--
-- Name: absence_notices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.absence_notices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: absence_notices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.absence_notices_id_seq OWNED BY public.absence_notices.id;


--
-- Name: announcement_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_attachments (
    id bigint NOT NULL,
    announcement_id bigint NOT NULL,
    uploader_id uuid NOT NULL,
    attachment_type text NOT NULL,
    file_name text,
    storage_path text,
    public_url text,
    mime_type text,
    file_size bigint,
    link_url text,
    link_title text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT announcement_attachments_attachment_type_check CHECK ((attachment_type = ANY (ARRAY['file'::text, 'google_doc'::text, 'google_sheet'::text, 'google_slide'::text, 'link'::text])))
);


--
-- Name: announcement_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcement_attachments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcement_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcement_attachments_id_seq OWNED BY public.announcement_attachments.id;


--
-- Name: announcement_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_comments (
    id bigint NOT NULL,
    announcement_id bigint NOT NULL,
    author_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: announcement_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcement_comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcement_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcement_comments_id_seq OWNED BY public.announcement_comments.id;


--
-- Name: announcement_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_reactions (
    id bigint NOT NULL,
    announcement_id bigint NOT NULL,
    user_id uuid NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT announcement_reactions_emoji_check CHECK (((char_length(emoji) >= 1) AND (char_length(emoji) <= 16)))
);


--
-- Name: announcement_reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.announcement_reactions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.announcement_reactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id bigint NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    type text DEFAULT 'post'::text NOT NULL,
    author_id uuid,
    course_id bigint,
    target_roles text[],
    is_pinned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_staff_only boolean DEFAULT false NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    scheduled_at timestamp with time zone,
    published_at timestamp with time zone,
    title_bg text,
    content_bg text,
    CONSTRAINT announcements_has_content_language_check CHECK ((((NULLIF(TRIM(BOTH FROM COALESCE(title, ''::text)), ''::text) IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE(content, ''::text)), ''::text) IS NOT NULL)) OR ((NULLIF(TRIM(BOTH FROM COALESCE(title_bg, ''::text)), ''::text) IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM COALESCE(content_bg, ''::text)), ''::text) IS NOT NULL)))),
    CONSTRAINT announcements_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'pending_review'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT announcements_type_check CHECK ((type = ANY (ARRAY['post'::text, 'homework'::text, 'material'::text, 'system'::text])))
);


--
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- Name: attendance_correction_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_correction_requests (
    id bigint NOT NULL,
    student_id uuid NOT NULL,
    course_id bigint,
    gate text NOT NULL,
    record_date date NOT NULL,
    title text NOT NULL,
    class_id bigint,
    well_week_start date,
    ministry_session_id bigint,
    current_status text,
    requested_status text NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    resolution_note text,
    CONSTRAINT attendance_correction_requests_current_status_check CHECK (((current_status = ANY (ARRAY['present'::text, 'late'::text, 'absent'::text])) OR (current_status IS NULL))),
    CONSTRAINT attendance_correction_requests_gate_check CHECK ((gate = ANY (ARRAY['classes'::text, 'the_well'::text, 'activation'::text, 'ministry'::text]))),
    CONSTRAINT attendance_correction_requests_requested_status_check CHECK ((requested_status = ANY (ARRAY['present'::text, 'late'::text, 'absent'::text]))),
    CONSTRAINT attendance_correction_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: attendance_correction_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.attendance_correction_requests ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.attendance_correction_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: attendance_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_settings (
    id integer DEFAULT 1 NOT NULL,
    late_class_weight numeric DEFAULT 0.5 NOT NULL,
    late_saturday_weight numeric DEFAULT 0.25 NOT NULL,
    graduation_threshold numeric DEFAULT 0.80 NOT NULL,
    the_well_required_per_month integer DEFAULT 2 NOT NULL,
    sunday_required_per_month integer DEFAULT 2 NOT NULL,
    late_well_weight numeric DEFAULT 0.5 NOT NULL,
    present_credit numeric DEFAULT 1 NOT NULL,
    late_credit numeric DEFAULT 0.5 NOT NULL,
    absent_credit numeric DEFAULT 0 NOT NULL,
    late_uses_global_credit boolean DEFAULT true NOT NULL,
    class_required_percent numeric DEFAULT 0.8 NOT NULL,
    class_included_weekdays integer[] DEFAULT ARRAY[2, 4] NOT NULL,
    class_sessions_per_day integer DEFAULT 2 NOT NULL,
    class_joint_counts_once boolean DEFAULT true NOT NULL,
    the_well_enabled boolean DEFAULT true NOT NULL,
    the_well_weekday integer DEFAULT 3 NOT NULL,
    the_well_fallback_enabled boolean DEFAULT true NOT NULL,
    the_well_fallback_percent numeric DEFAULT 0.5 NOT NULL,
    activation_enabled boolean DEFAULT true NOT NULL,
    activation_frequency text DEFAULT 'monthly'::text NOT NULL,
    activation_max_lost_credits numeric DEFAULT 1 NOT NULL,
    activation_detection_rule text DEFAULT 'saturday_both'::text NOT NULL,
    ministry_enabled boolean DEFAULT true NOT NULL,
    ministry_sunday_required_credits numeric DEFAULT 2 NOT NULL,
    ministry_sunday_period_months integer DEFAULT 1 NOT NULL,
    ministry_first_year_rotation_months integer DEFAULT 2 NOT NULL,
    ministry_second_year_rotation_months integer DEFAULT 4 NOT NULL,
    ministry_team_leaders_can_mark boolean DEFAULT true NOT NULL,
    ministry_admins_can_override_rotations boolean DEFAULT true NOT NULL,
    status_on_track_threshold numeric DEFAULT 0.9 NOT NULL,
    status_at_risk_threshold numeric DEFAULT 0.8 NOT NULL,
    status_failing_threshold numeric DEFAULT 0.8 NOT NULL,
    show_classes_on_student_view boolean DEFAULT true NOT NULL,
    show_the_well_on_student_view boolean DEFAULT true NOT NULL,
    show_activation_on_student_view boolean DEFAULT true NOT NULL,
    show_ministry_on_student_view boolean DEFAULT true NOT NULL,
    show_fallback_scores boolean DEFAULT true NOT NULL,
    remind_missing_class_attendance boolean DEFAULT true NOT NULL,
    remind_missing_well_attendance boolean DEFAULT true NOT NULL,
    remind_missing_ministry_attendance boolean DEFAULT true NOT NULL,
    audience text DEFAULT 'regular'::text NOT NULL,
    CONSTRAINT attendance_settings_row_check CHECK ((((id = 1) AND (audience = 'regular'::text)) OR ((id = 2) AND (audience = 'online'::text))))
);


--
-- Name: book_reading_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.book_reading_assignments (
    id bigint NOT NULL,
    book_id bigint NOT NULL,
    course_id bigint NOT NULL,
    assigned_by uuid,
    title text NOT NULL,
    instructions text,
    due_date date,
    status text DEFAULT 'assigned'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    max_points integer,
    CONSTRAINT book_reading_assignments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'assigned'::text, 'completed'::text, 'archived'::text])))
);


--
-- Name: book_reading_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.book_reading_assignments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.book_reading_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: book_reading_submission_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.book_reading_submission_comments (
    id bigint NOT NULL,
    submission_id bigint NOT NULL,
    author_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: book_reading_submission_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.book_reading_submission_comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: book_reading_submission_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.book_reading_submission_comments_id_seq OWNED BY public.book_reading_submission_comments.id;


--
-- Name: book_reading_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.book_reading_submissions (
    id bigint NOT NULL,
    assignment_id bigint NOT NULL,
    student_id uuid NOT NULL,
    status text DEFAULT 'not_started'::text NOT NULL,
    response_text text,
    response_url text,
    submitted_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    reviewer_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    points numeric,
    grade_comment text,
    graded_at timestamp with time zone,
    graded_by uuid,
    google_doc_id text,
    google_doc_url text,
    file_name text,
    CONSTRAINT book_reading_submissions_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'reading'::text, 'submitted'::text, 'returned'::text, 'completed'::text])))
);


--
-- Name: book_reading_submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.book_reading_submissions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.book_reading_submissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: books; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.books (
    id bigint NOT NULL,
    internal_code text,
    title text NOT NULL,
    subtitle text,
    authors text[] DEFAULT '{}'::text[] NOT NULL,
    description text,
    publisher text,
    published_date text,
    page_count integer,
    isbn_10 text,
    isbn_13 text,
    cover_url text,
    source_provider text,
    source_id text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: books_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.books ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.books_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_events (
    id bigint NOT NULL,
    title text NOT NULL,
    description text,
    location text,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    all_day boolean DEFAULT false NOT NULL,
    target_roles text[] DEFAULT '{}'::text[] NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_events_end_after_start CHECK (((ends_at IS NULL) OR (ends_at >= starts_at))),
    CONSTRAINT calendar_events_title_not_blank CHECK ((length(btrim(title)) > 0))
);


--
-- Name: calendar_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calendar_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calendar_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calendar_events_id_seq OWNED BY public.calendar_events.id;


--
-- Name: class_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_attendance (
    id bigint NOT NULL,
    class_id bigint NOT NULL,
    student_id uuid NOT NULL,
    status text DEFAULT 'absent'::text NOT NULL,
    marked_by uuid NOT NULL,
    marked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT class_attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'late'::text, 'absent'::text])))
);


--
-- Name: class_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.class_attendance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: class_attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.class_attendance_id_seq OWNED BY public.class_attendance.id;


--
-- Name: class_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_files (
    id bigint NOT NULL,
    class_id bigint,
    uploader_id uuid NOT NULL,
    file_type text NOT NULL,
    file_name text NOT NULL,
    drive_file_id text NOT NULL,
    drive_view_url text NOT NULL,
    mime_type text,
    file_size bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    subject_id bigint,
    CONSTRAINT class_files_file_type_check CHECK ((file_type = ANY (ARRAY['material'::text, 'homework'::text, 'teacher_note'::text, 'translator_note'::text]))),
    CONSTRAINT class_files_subject_or_class_check CHECK (((subject_id IS NOT NULL) OR (class_id IS NOT NULL)))
);


--
-- Name: class_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.class_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: class_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.class_files_id_seq OWNED BY public.class_files.id;


--
-- Name: class_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_notes (
    id bigint NOT NULL,
    class_id bigint NOT NULL,
    author_id uuid NOT NULL,
    note_type text NOT NULL,
    title text,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT class_notes_note_type_check CHECK ((note_type = ANY (ARRAY['teacher_note'::text, 'translator_note'::text, 'student_note'::text])))
);


--
-- Name: class_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.class_notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: class_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.class_notes_id_seq OWNED BY public.class_notes.id;


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id bigint NOT NULL,
    subject_id bigint NOT NULL,
    title text NOT NULL,
    date date,
    hour text,
    teacher_id uuid,
    translator_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    drive_folder_id text,
    materials_folder_id text,
    homework_folder_id text,
    teacher_notes_folder_id text,
    translator_notes_folder_id text,
    CONSTRAINT classes_hour_check CHECK ((hour = ANY (ARRAY['first'::text, 'second'::text, 'both'::text])))
);


--
-- Name: classes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.classes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;


--
-- Name: course_students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_students (
    id bigint NOT NULL,
    course_id bigint NOT NULL,
    student_id uuid NOT NULL,
    mentor_id uuid,
    enrollment_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'active'::text NOT NULL
);


--
-- Name: course_students_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.course_students_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: course_students_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.course_students_id_seq OWNED BY public.course_students.id;


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id bigint NOT NULL,
    course_type text NOT NULL,
    graduation_year integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    drive_folder_id text,
    CONSTRAINT courses_course_type_check CHECK ((course_type = ANY (ARRAY['first_year'::text, 'second_year'::text]))),
    CONSTRAINT courses_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: courses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.courses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.courses_id_seq OWNED BY public.courses.id;


--
-- Name: duty_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.duty_schedule (
    id bigint NOT NULL,
    course_id bigint NOT NULL,
    student_id uuid NOT NULL,
    week_start date NOT NULL,
    week_end date NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT duty_schedule_status_check CHECK ((status = ANY (ARRAY['active'::text, 'transferred'::text])))
);


--
-- Name: duty_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.duty_schedule_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: duty_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.duty_schedule_id_seq OWNED BY public.duty_schedule.id;


--
-- Name: duty_transfer_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.duty_transfer_requests (
    id bigint NOT NULL,
    duty_schedule_id bigint NOT NULL,
    from_student_id uuid NOT NULL,
    to_student_id uuid NOT NULL,
    course_id bigint NOT NULL,
    week_start date NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    CONSTRAINT duty_transfer_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: duty_transfer_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.duty_transfer_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: duty_transfer_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.duty_transfer_requests_id_seq OWNED BY public.duty_transfer_requests.id;


--
-- Name: google_docs_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_docs_connections (
    id text DEFAULT 'school_docs'::text NOT NULL,
    provider text DEFAULT 'google'::text NOT NULL,
    connected_email text NOT NULL,
    access_token text,
    refresh_token text NOT NULL,
    expires_at timestamp with time zone,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    connected_by uuid,
    connected_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT google_docs_connections_id_check CHECK ((id = 'school_docs'::text))
);


--
-- Name: grade_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade_categories (
    id bigint NOT NULL,
    course_id bigint,
    name text NOT NULL,
    default_points integer DEFAULT 100 NOT NULL,
    weight_percent numeric(5,2),
    color text DEFAULT '#1a73e8'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: grade_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.grade_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grade_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.grade_categories_id_seq OWNED BY public.grade_categories.id;


--
-- Name: grade_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grade_settings (
    id bigint NOT NULL,
    course_id bigint,
    calculation_method text DEFAULT 'total_points'::text NOT NULL,
    show_overall_grade_to_students boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grade_settings_calculation_method_check CHECK ((calculation_method = ANY (ARRAY['no_overall_grade'::text, 'total_points'::text, 'weighted_by_category'::text])))
);


--
-- Name: grade_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.grade_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grade_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.grade_settings_id_seq OWNED BY public.grade_settings.id;


--
-- Name: grading_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grading_periods (
    id bigint NOT NULL,
    course_id bigint,
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grading_period_dates_check CHECK ((start_date <= end_date))
);


--
-- Name: grading_periods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.grading_periods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grading_periods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.grading_periods_id_seq OWNED BY public.grading_periods.id;


--
-- Name: homework_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homework_assignments (
    id bigint NOT NULL,
    class_id bigint,
    author_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    due_date timestamp with time zone,
    max_points integer DEFAULT 100 NOT NULL,
    drive_folder_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    subject_id bigint,
    grading_due_date date,
    work_type text DEFAULT 'assignment'::text NOT NULL,
    question_type text,
    question_options jsonb DEFAULT '[]'::jsonb NOT NULL,
    grade_category_id bigint,
    grading_period_id bigint,
    CONSTRAINT homework_assignments_question_type_check CHECK (((question_type IS NULL) OR (question_type = ANY (ARRAY['short_answer'::text, 'multiple_choice'::text])))),
    CONSTRAINT homework_assignments_subject_or_class_check CHECK (((subject_id IS NOT NULL) OR (class_id IS NOT NULL))),
    CONSTRAINT homework_assignments_work_type_check CHECK ((work_type = ANY (ARRAY['assignment'::text, 'quick_check'::text])))
);


--
-- Name: homework_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.homework_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: homework_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.homework_assignments_id_seq OWNED BY public.homework_assignments.id;


--
-- Name: homework_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homework_comments (
    id bigint NOT NULL,
    submission_id bigint NOT NULL,
    author_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: homework_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.homework_comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: homework_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.homework_comments_id_seq OWNED BY public.homework_comments.id;


--
-- Name: homework_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homework_submissions (
    id bigint NOT NULL,
    assignment_id bigint NOT NULL,
    student_id uuid NOT NULL,
    submission_type text,
    drive_file_id text,
    drive_view_url text,
    file_name text,
    google_doc_id text,
    google_doc_url text,
    status text DEFAULT 'not_started'::text NOT NULL,
    submitted_at timestamp with time zone,
    points integer,
    grade_comment text,
    graded_at timestamp with time zone,
    graded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    response_text text,
    selected_option text,
    CONSTRAINT homework_submissions_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'draft'::text, 'submitted'::text, 'graded'::text, 'returned'::text]))),
    CONSTRAINT homework_submissions_submission_type_check CHECK ((submission_type = ANY (ARRAY['file'::text, 'google_doc'::text])))
);


--
-- Name: homework_submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.homework_submissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: homework_submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.homework_submissions_id_seq OWNED BY public.homework_submissions.id;


--
-- Name: mentorship_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentorship_logs (
    id bigint NOT NULL,
    mentor_id uuid,
    student_id uuid NOT NULL,
    type text NOT NULL,
    date date NOT NULL,
    notes text NOT NULL,
    duration integer,
    topics text[],
    next_steps text,
    student_progress text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    meeting_month text,
    in_person_meeting text,
    meetings_count text,
    stayed_in_touch text,
    main_topic text,
    engagement text,
    challenges text,
    school_support text,
    positive_moment text,
    other_observations text,
    CONSTRAINT mentorship_logs_student_progress_check CHECK ((student_progress = ANY (ARRAY['excellent'::text, 'good'::text, 'needs_improvement'::text, 'concern'::text]))),
    CONSTRAINT mentorship_logs_type_check CHECK ((type = ANY (ARRAY['digital'::text, 'in_person'::text])))
);


--
-- Name: COLUMN mentorship_logs.meeting_month; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mentorship_logs.meeting_month IS 'YYYY-MM month of conducted meetings selected by the mentor';


--
-- Name: COLUMN mentorship_logs.in_person_meeting; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mentorship_logs.in_person_meeting IS 'Q1: yes | planned_soon | unable';


--
-- Name: COLUMN mentorship_logs.meetings_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mentorship_logs.meetings_count IS 'Q2: 0 | 1 | 2 | more_than_2';


--
-- Name: COLUMN mentorship_logs.stayed_in_touch; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mentorship_logs.stayed_in_touch IS 'Q3: regularly | occasionally | no';


--
-- Name: COLUMN mentorship_logs.main_topic; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mentorship_logs.main_topic IS 'Q4: main discussion topic';


--
-- Name: COLUMN mentorship_logs.engagement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mentorship_logs.engagement IS 'Q5: very_high | good | moderate | low';


--
-- Name: COLUMN mentorship_logs.challenges; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mentorship_logs.challenges IS 'Q6: mentoring difficulties';


--
-- Name: COLUMN mentorship_logs.school_support; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mentorship_logs.school_support IS 'Q7: school support request';


--
-- Name: COLUMN mentorship_logs.positive_moment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mentorship_logs.positive_moment IS 'Q8: positive moment or progress';


--
-- Name: COLUMN mentorship_logs.other_observations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.mentorship_logs.other_observations IS 'Q9: other observations';


--
-- Name: mentorship_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mentorship_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mentorship_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mentorship_logs_id_seq OWNED BY public.mentorship_logs.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id bigint NOT NULL,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    content text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    audience_key text,
    audience_label text,
    CONSTRAINT no_self_message CHECK ((sender_id <> recipient_id))
);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: ministry_rotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ministry_rotations (
    id bigint NOT NULL,
    course_id bigint NOT NULL,
    student_id uuid NOT NULL,
    team_id bigint NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    locked boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ministry_rotations_check CHECK ((end_date >= start_date)),
    CONSTRAINT ministry_rotations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'locked'::text, 'completed'::text])))
);


--
-- Name: ministry_rotations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ministry_rotations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ministry_rotations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ministry_service_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ministry_service_attendance (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    student_id uuid NOT NULL,
    status text DEFAULT 'absent'::text NOT NULL,
    marked_by uuid NOT NULL,
    marked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ministry_service_attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'late'::text, 'absent'::text])))
);


--
-- Name: ministry_service_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ministry_service_attendance ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ministry_service_attendance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ministry_service_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ministry_service_sessions (
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    service_date date NOT NULL,
    title text NOT NULL,
    service_type text DEFAULT 'sunday'::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    general_view text,
    wins_testimonies text,
    challenges text,
    timely_actions text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ministry_service_sessions_service_type_check CHECK ((service_type = ANY (ARRAY['sunday'::text, 'non_sunday'::text]))),
    CONSTRAINT ministry_service_sessions_title_check CHECK ((char_length(btrim(title)) > 0))
);


--
-- Name: ministry_service_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ministry_service_sessions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ministry_service_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ministry_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ministry_team_members (
    id bigint NOT NULL,
    team_id bigint NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'leader'::text NOT NULL,
    can_submit_reports boolean DEFAULT true NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ministry_team_members_role_check CHECK ((role = ANY (ARRAY['leader'::text, 'assistant'::text, 'member'::text])))
);


--
-- Name: ministry_team_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ministry_team_members ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ministry_team_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ministry_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ministry_teams (
    id bigint NOT NULL,
    name text NOT NULL,
    name_bg text,
    info text,
    leader_id uuid,
    call_time text,
    service_type text DEFAULT 'sunday'::text NOT NULL,
    service_day integer,
    required_credits numeric DEFAULT 2 NOT NULL,
    requirement_period_months integer DEFAULT 1 NOT NULL,
    requirement_unit text DEFAULT 'month'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ministry_teams_name_check CHECK ((char_length(btrim(name)) > 0)),
    CONSTRAINT ministry_teams_required_credits_check CHECK ((required_credits >= (0)::numeric)),
    CONSTRAINT ministry_teams_requirement_period_months_check CHECK ((requirement_period_months > 0)),
    CONSTRAINT ministry_teams_requirement_unit_check CHECK ((requirement_unit = ANY (ARRAY['month'::text, 'rotation'::text, 'school_year'::text]))),
    CONSTRAINT ministry_teams_service_day_check CHECK (((service_day >= 0) AND (service_day <= 6))),
    CONSTRAINT ministry_teams_service_type_check CHECK ((service_type = ANY (ARRAY['sunday'::text, 'non_sunday'::text])))
);


--
-- Name: ministry_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ministry_teams ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ministry_teams_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notification_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_deliveries (
    id bigint NOT NULL,
    job_id bigint NOT NULL,
    recipient_id uuid,
    recipient_email text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    provider text DEFAULT 'brevo'::text NOT NULL,
    provider_message_id text,
    error_message text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_deliveries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: notification_deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_deliveries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_deliveries_id_seq OWNED BY public.notification_deliveries.id;


--
-- Name: notification_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_jobs (
    id bigint NOT NULL,
    type text NOT NULL,
    announcement_id bigint,
    status text DEFAULT 'pending'::text NOT NULL,
    scheduled_for timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_message text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'canceled'::text])))
);


--
-- Name: notification_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_jobs_id_seq OWNED BY public.notification_jobs.id;


--
-- Name: prayer_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prayer_schedule (
    id bigint NOT NULL,
    week_start date NOT NULL,
    week_end date NOT NULL,
    tuesday_student_id uuid,
    thursday_student_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prayer_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.prayer_schedule ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.prayer_schedule_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: profile_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_invites (
    id bigint NOT NULL,
    email text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    claimed_by uuid,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'cancelled'::text])))
);


--
-- Name: profile_invites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.profile_invites ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.profile_invites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: profile_private_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_private_data (
    profile_id uuid NOT NULL,
    email text NOT NULL,
    phone text,
    notification_preferences jsonb DEFAULT '{"messages": true, "enrollment": true, "roleChange": true, "announcements": true}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text NOT NULL,
    email text,
    roles text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    first_name text DEFAULT ''::text NOT NULL,
    last_name text DEFAULT ''::text NOT NULL,
    notification_preferences jsonb DEFAULT '{"enrollment": true, "roleChange": true, "announcements": true}'::jsonb,
    avatar_url text,
    preferred_language text DEFAULT 'en'::text NOT NULL,
    phone text,
    teaching_course_types text[] DEFAULT '{}'::text[] NOT NULL,
    is_online_student boolean DEFAULT false NOT NULL,
    student_number text,
    CONSTRAINT profiles_preferred_language_check CHECK ((preferred_language = ANY (ARRAY['en'::text, 'bg'::text]))),
    CONSTRAINT profiles_student_number_format_check CHECK (((student_number IS NULL) OR (student_number ~ '^[A-Z0-9]{1,10}$'::text))),
    CONSTRAINT profiles_teaching_course_types_check CHECK ((teaching_course_types <@ ARRAY['first_year'::text, 'second_year'::text]))
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stream_course_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stream_course_settings (
    course_id bigint NOT NULL,
    permission text DEFAULT 'students_comment'::text NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    require_student_post_approval boolean DEFAULT true NOT NULL,
    allow_student_attachments boolean DEFAULT false NOT NULL,
    email_notifications text DEFAULT 'staff_and_pinned'::text NOT NULL,
    pinned_post_limit integer DEFAULT 3 NOT NULL,
    CONSTRAINT stream_course_settings_email_notifications_check CHECK ((email_notifications = ANY (ARRAY['all_posts'::text, 'staff_and_pinned'::text, 'pinned_only'::text, 'none'::text]))),
    CONSTRAINT stream_course_settings_permission_check CHECK ((permission = ANY (ARRAY['students_post_comment'::text, 'students_comment'::text, 'staff_only'::text]))),
    CONSTRAINT stream_course_settings_pinned_post_limit_check CHECK (((pinned_post_limit >= 0) AND (pinned_post_limit <= 10)))
);


--
-- Name: student_tuition_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_tuition_accounts (
    id bigint NOT NULL,
    student_id uuid NOT NULL,
    plan_id bigint NOT NULL,
    expected_amount numeric(12,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_tuition_accounts_status_check CHECK ((status = ANY (ARRAY['open'::text, 'part_paid'::text, 'paid'::text, 'overdue'::text, 'waived'::text])))
);


--
-- Name: student_tuition_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.student_tuition_accounts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.student_tuition_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: student_tuition_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_tuition_payments (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    student_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    method text DEFAULT 'cash'::text NOT NULL,
    reference text,
    note text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_tuition_payments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: student_tuition_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.student_tuition_payments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.student_tuition_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: subject_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subject_notes (
    id bigint NOT NULL,
    subject_id bigint NOT NULL,
    author_id uuid NOT NULL,
    note_type text NOT NULL,
    title text,
    content text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    storage_path text,
    public_url text,
    file_name text,
    file_size bigint,
    mime_type text,
    CONSTRAINT subject_notes_note_type_check CHECK ((note_type = ANY (ARRAY['curriculum_plan'::text, 'student_note'::text])))
);


--
-- Name: subject_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subject_notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subject_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subject_notes_id_seq OWNED BY public.subject_notes.id;


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    id bigint NOT NULL,
    course_id bigint NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    start_date date NOT NULL,
    duration integer DEFAULT 0 NOT NULL,
    primary_teacher_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    drive_folder_id text
);


--
-- Name: subjects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subjects_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subjects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subjects_id_seq OWNED BY public.subjects.id;


--
-- Name: sunday_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sunday_attendance (
    id bigint NOT NULL,
    student_id uuid NOT NULL,
    course_id bigint NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    times_served integer DEFAULT 0 NOT NULL,
    marked_by uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sunday_attendance_month_check CHECK (((month >= 1) AND (month <= 12)))
);


--
-- Name: sunday_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sunday_attendance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sunday_attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sunday_attendance_id_seq OWNED BY public.sunday_attendance.id;


--
-- Name: the_well_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.the_well_attendance (
    id bigint NOT NULL,
    student_id uuid NOT NULL,
    course_id bigint NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    times_attended integer DEFAULT 0 NOT NULL,
    marked_by uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    times_late integer DEFAULT 0 NOT NULL,
    CONSTRAINT the_well_attendance_month_check CHECK (((month >= 1) AND (month <= 12)))
);


--
-- Name: the_well_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.the_well_attendance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: the_well_attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.the_well_attendance_id_seq OWNED BY public.the_well_attendance.id;


--
-- Name: the_well_session_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.the_well_session_attendance (
    id bigint NOT NULL,
    student_id uuid NOT NULL,
    course_id bigint NOT NULL,
    week_start date NOT NULL,
    status text NOT NULL,
    marked_by uuid NOT NULL,
    marked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT the_well_session_attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'late'::text, 'absent'::text])))
);


--
-- Name: the_well_session_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.the_well_session_attendance ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.the_well_session_attendance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: todo_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.todo_batches (
    id bigint NOT NULL,
    title text NOT NULL,
    description text,
    created_by uuid NOT NULL,
    due_date date NOT NULL,
    priority text DEFAULT 'none'::text NOT NULL,
    assignment_type text DEFAULT 'person'::text NOT NULL,
    target_label text NOT NULL,
    target_ids text[] DEFAULT '{}'::text[] NOT NULL,
    recipient_count integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT todo_batches_assignment_type_check CHECK ((assignment_type = ANY (ARRAY['person'::text, 'category'::text]))),
    CONSTRAINT todo_batches_priority_check CHECK ((priority = ANY (ARRAY['none'::text, 'priority'::text]))),
    CONSTRAINT todo_batches_recipient_count_check CHECK ((recipient_count >= 0)),
    CONSTRAINT todo_batches_title_check CHECK ((char_length(btrim(title)) > 0))
);


--
-- Name: todo_batches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.todo_batches ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.todo_batches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: todo_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.todo_items (
    id bigint NOT NULL,
    title text NOT NULL,
    description text,
    assigned_to uuid NOT NULL,
    created_by uuid NOT NULL,
    due_date date NOT NULL,
    priority text DEFAULT 'none'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    batch_id bigint,
    CONSTRAINT todo_items_priority_check CHECK ((priority = ANY (ARRAY['none'::text, 'priority'::text]))),
    CONSTRAINT todo_items_status_check CHECK ((status = ANY (ARRAY['open'::text, 'completed'::text]))),
    CONSTRAINT todo_items_title_check CHECK ((char_length(btrim(title)) > 0))
);


--
-- Name: todo_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.todo_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.todo_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tuition_installments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tuition_installments (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    title text NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    due_date date NOT NULL,
    reminder_days_before integer DEFAULT 7 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tuition_installments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.tuition_installments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.tuition_installments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tuition_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tuition_plans (
    id bigint NOT NULL,
    name text NOT NULL,
    course_id bigint,
    academic_year text,
    currency text DEFAULT 'EUR'::text NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tuition_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])))
);


--
-- Name: tuition_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.tuition_plans ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.tuition_plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tuition_reminder_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tuition_reminder_logs (
    id bigint NOT NULL,
    account_id bigint,
    installment_id bigint,
    student_id uuid NOT NULL,
    sent_by uuid,
    subject text NOT NULL,
    body text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    notification_job_id bigint,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tuition_reminder_logs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'failed'::text, 'canceled'::text])))
);


--
-- Name: tuition_reminder_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.tuition_reminder_logs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.tuition_reminder_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: well_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.well_schedule (
    id bigint NOT NULL,
    course_id bigint NOT NULL,
    week_start date NOT NULL,
    well_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: well_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.well_schedule ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.well_schedule_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL,
    versioning_status text DEFAULT 'DISABLED'::text NOT NULL,
    CONSTRAINT buckets_versioning_dark_check CHECK ((versioning_status = 'DISABLED'::text)),
    CONSTRAINT buckets_versioning_standard_only_check CHECK (((type = 'STANDARD'::storage.buckettype) OR (versioning_status = 'DISABLED'::text))),
    CONSTRAINT buckets_versioning_status_check CHECK ((versioning_status = ANY (ARRAY['DISABLED'::text, 'ENABLED'::text, 'SUSPENDED'::text])))
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    archived_at timestamp with time zone,
    is_delete_marker boolean DEFAULT false NOT NULL,
    is_versioned boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: absence_notice_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absence_notice_sessions ALTER COLUMN id SET DEFAULT nextval('public.absence_notice_sessions_id_seq'::regclass);


--
-- Name: absence_notices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absence_notices ALTER COLUMN id SET DEFAULT nextval('public.absence_notices_id_seq'::regclass);


--
-- Name: announcement_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_attachments ALTER COLUMN id SET DEFAULT nextval('public.announcement_attachments_id_seq'::regclass);


--
-- Name: announcement_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comments ALTER COLUMN id SET DEFAULT nextval('public.announcement_comments_id_seq'::regclass);


--
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- Name: book_reading_submission_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_submission_comments ALTER COLUMN id SET DEFAULT nextval('public.book_reading_submission_comments_id_seq'::regclass);


--
-- Name: calendar_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events ALTER COLUMN id SET DEFAULT nextval('public.calendar_events_id_seq'::regclass);


--
-- Name: class_attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_attendance ALTER COLUMN id SET DEFAULT nextval('public.class_attendance_id_seq'::regclass);


--
-- Name: class_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_files ALTER COLUMN id SET DEFAULT nextval('public.class_files_id_seq'::regclass);


--
-- Name: class_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_notes ALTER COLUMN id SET DEFAULT nextval('public.class_notes_id_seq'::regclass);


--
-- Name: classes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);


--
-- Name: course_students id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_students ALTER COLUMN id SET DEFAULT nextval('public.course_students_id_seq'::regclass);


--
-- Name: courses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses ALTER COLUMN id SET DEFAULT nextval('public.courses_id_seq'::regclass);


--
-- Name: duty_schedule id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_schedule ALTER COLUMN id SET DEFAULT nextval('public.duty_schedule_id_seq'::regclass);


--
-- Name: duty_transfer_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_transfer_requests ALTER COLUMN id SET DEFAULT nextval('public.duty_transfer_requests_id_seq'::regclass);


--
-- Name: grade_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_categories ALTER COLUMN id SET DEFAULT nextval('public.grade_categories_id_seq'::regclass);


--
-- Name: grade_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_settings ALTER COLUMN id SET DEFAULT nextval('public.grade_settings_id_seq'::regclass);


--
-- Name: grading_periods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_periods ALTER COLUMN id SET DEFAULT nextval('public.grading_periods_id_seq'::regclass);


--
-- Name: homework_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_assignments ALTER COLUMN id SET DEFAULT nextval('public.homework_assignments_id_seq'::regclass);


--
-- Name: homework_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_comments ALTER COLUMN id SET DEFAULT nextval('public.homework_comments_id_seq'::regclass);


--
-- Name: homework_submissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_submissions ALTER COLUMN id SET DEFAULT nextval('public.homework_submissions_id_seq'::regclass);


--
-- Name: mentorship_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_logs ALTER COLUMN id SET DEFAULT nextval('public.mentorship_logs_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: notification_deliveries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_deliveries ALTER COLUMN id SET DEFAULT nextval('public.notification_deliveries_id_seq'::regclass);


--
-- Name: notification_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_jobs ALTER COLUMN id SET DEFAULT nextval('public.notification_jobs_id_seq'::regclass);


--
-- Name: subject_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_notes ALTER COLUMN id SET DEFAULT nextval('public.subject_notes_id_seq'::regclass);


--
-- Name: subjects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects ALTER COLUMN id SET DEFAULT nextval('public.subjects_id_seq'::regclass);


--
-- Name: sunday_attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sunday_attendance ALTER COLUMN id SET DEFAULT nextval('public.sunday_attendance_id_seq'::regclass);


--
-- Name: the_well_attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.the_well_attendance ALTER COLUMN id SET DEFAULT nextval('public.the_well_attendance_id_seq'::regclass);


--
-- Name: absence_notice_sessions absence_notice_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absence_notice_sessions
    ADD CONSTRAINT absence_notice_sessions_pkey PRIMARY KEY (id);


--
-- Name: absence_notice_sessions absence_notice_sessions_unique_notice_class; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absence_notice_sessions
    ADD CONSTRAINT absence_notice_sessions_unique_notice_class UNIQUE (notice_id, class_id);


--
-- Name: absence_notices absence_notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absence_notices
    ADD CONSTRAINT absence_notices_pkey PRIMARY KEY (id);


--
-- Name: announcement_attachments announcement_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_attachments
    ADD CONSTRAINT announcement_attachments_pkey PRIMARY KEY (id);


--
-- Name: announcement_comments announcement_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comments
    ADD CONSTRAINT announcement_comments_pkey PRIMARY KEY (id);


--
-- Name: announcement_reactions announcement_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_reactions
    ADD CONSTRAINT announcement_reactions_pkey PRIMARY KEY (id);


--
-- Name: announcement_reactions announcement_reactions_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_reactions
    ADD CONSTRAINT announcement_reactions_unique UNIQUE (announcement_id, user_id, emoji);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: attendance_correction_requests attendance_correction_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_correction_requests
    ADD CONSTRAINT attendance_correction_requests_pkey PRIMARY KEY (id);


--
-- Name: attendance_settings attendance_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_settings
    ADD CONSTRAINT attendance_settings_pkey PRIMARY KEY (id);


--
-- Name: book_reading_assignments book_reading_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_assignments
    ADD CONSTRAINT book_reading_assignments_pkey PRIMARY KEY (id);


--
-- Name: book_reading_submission_comments book_reading_submission_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_submission_comments
    ADD CONSTRAINT book_reading_submission_comments_pkey PRIMARY KEY (id);


--
-- Name: book_reading_submissions book_reading_submissions_assignment_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_submissions
    ADD CONSTRAINT book_reading_submissions_assignment_id_student_id_key UNIQUE (assignment_id, student_id);


--
-- Name: book_reading_submissions book_reading_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_submissions
    ADD CONSTRAINT book_reading_submissions_pkey PRIMARY KEY (id);


--
-- Name: books books_internal_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_internal_code_key UNIQUE (internal_code);


--
-- Name: books books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: class_attendance class_attendance_class_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_attendance
    ADD CONSTRAINT class_attendance_class_id_student_id_key UNIQUE (class_id, student_id);


--
-- Name: class_attendance class_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_attendance
    ADD CONSTRAINT class_attendance_pkey PRIMARY KEY (id);


--
-- Name: class_files class_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_files
    ADD CONSTRAINT class_files_pkey PRIMARY KEY (id);


--
-- Name: class_notes class_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_notes
    ADD CONSTRAINT class_notes_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: course_students course_students_course_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_students
    ADD CONSTRAINT course_students_course_id_student_id_key UNIQUE (course_id, student_id);


--
-- Name: course_students course_students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_students
    ADD CONSTRAINT course_students_pkey PRIMARY KEY (id);


--
-- Name: courses courses_course_type_graduation_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_course_type_graduation_year_key UNIQUE (course_type, graduation_year);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: duty_schedule duty_schedule_course_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_schedule
    ADD CONSTRAINT duty_schedule_course_id_week_start_key UNIQUE (course_id, week_start);


--
-- Name: duty_schedule duty_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_schedule
    ADD CONSTRAINT duty_schedule_pkey PRIMARY KEY (id);


--
-- Name: duty_transfer_requests duty_transfer_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_transfer_requests
    ADD CONSTRAINT duty_transfer_requests_pkey PRIMARY KEY (id);


--
-- Name: google_docs_connections google_docs_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_docs_connections
    ADD CONSTRAINT google_docs_connections_pkey PRIMARY KEY (id);


--
-- Name: grade_categories grade_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_categories
    ADD CONSTRAINT grade_categories_pkey PRIMARY KEY (id);


--
-- Name: grade_settings grade_settings_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_settings
    ADD CONSTRAINT grade_settings_course_id_key UNIQUE (course_id);


--
-- Name: grade_settings grade_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_settings
    ADD CONSTRAINT grade_settings_pkey PRIMARY KEY (id);


--
-- Name: grading_periods grading_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_periods
    ADD CONSTRAINT grading_periods_pkey PRIMARY KEY (id);


--
-- Name: homework_assignments homework_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_assignments
    ADD CONSTRAINT homework_assignments_pkey PRIMARY KEY (id);


--
-- Name: homework_comments homework_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_comments
    ADD CONSTRAINT homework_comments_pkey PRIMARY KEY (id);


--
-- Name: homework_submissions homework_submissions_assignment_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_submissions
    ADD CONSTRAINT homework_submissions_assignment_id_student_id_key UNIQUE (assignment_id, student_id);


--
-- Name: homework_submissions homework_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_submissions
    ADD CONSTRAINT homework_submissions_pkey PRIMARY KEY (id);


--
-- Name: mentorship_logs mentorship_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_logs
    ADD CONSTRAINT mentorship_logs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: ministry_rotations ministry_rotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_rotations
    ADD CONSTRAINT ministry_rotations_pkey PRIMARY KEY (id);


--
-- Name: ministry_service_attendance ministry_service_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_service_attendance
    ADD CONSTRAINT ministry_service_attendance_pkey PRIMARY KEY (id);


--
-- Name: ministry_service_attendance ministry_service_attendance_session_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_service_attendance
    ADD CONSTRAINT ministry_service_attendance_session_id_student_id_key UNIQUE (session_id, student_id);


--
-- Name: ministry_service_sessions ministry_service_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_service_sessions
    ADD CONSTRAINT ministry_service_sessions_pkey PRIMARY KEY (id);


--
-- Name: ministry_team_members ministry_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_team_members
    ADD CONSTRAINT ministry_team_members_pkey PRIMARY KEY (id);


--
-- Name: ministry_team_members ministry_team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_team_members
    ADD CONSTRAINT ministry_team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- Name: ministry_teams ministry_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_teams
    ADD CONSTRAINT ministry_teams_pkey PRIMARY KEY (id);


--
-- Name: notification_deliveries notification_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_pkey PRIMARY KEY (id);


--
-- Name: notification_jobs notification_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_jobs
    ADD CONSTRAINT notification_jobs_pkey PRIMARY KEY (id);


--
-- Name: prayer_schedule prayer_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_schedule
    ADD CONSTRAINT prayer_schedule_pkey PRIMARY KEY (id);


--
-- Name: prayer_schedule prayer_schedule_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_schedule
    ADD CONSTRAINT prayer_schedule_week_start_key UNIQUE (week_start);


--
-- Name: profile_invites profile_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_invites
    ADD CONSTRAINT profile_invites_pkey PRIMARY KEY (id);


--
-- Name: profile_private_data profile_private_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_private_data
    ADD CONSTRAINT profile_private_data_pkey PRIMARY KEY (profile_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: stream_course_settings stream_course_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_course_settings
    ADD CONSTRAINT stream_course_settings_pkey PRIMARY KEY (course_id);


--
-- Name: student_tuition_accounts student_tuition_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_tuition_accounts
    ADD CONSTRAINT student_tuition_accounts_pkey PRIMARY KEY (id);


--
-- Name: student_tuition_accounts student_tuition_accounts_student_id_plan_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_tuition_accounts
    ADD CONSTRAINT student_tuition_accounts_student_id_plan_id_key UNIQUE (student_id, plan_id);


--
-- Name: student_tuition_payments student_tuition_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_tuition_payments
    ADD CONSTRAINT student_tuition_payments_pkey PRIMARY KEY (id);


--
-- Name: subject_notes subject_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_notes
    ADD CONSTRAINT subject_notes_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: sunday_attendance sunday_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sunday_attendance
    ADD CONSTRAINT sunday_attendance_pkey PRIMARY KEY (id);


--
-- Name: sunday_attendance sunday_attendance_student_id_course_id_year_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sunday_attendance
    ADD CONSTRAINT sunday_attendance_student_id_course_id_year_month_key UNIQUE (student_id, course_id, year, month);


--
-- Name: the_well_attendance the_well_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.the_well_attendance
    ADD CONSTRAINT the_well_attendance_pkey PRIMARY KEY (id);


--
-- Name: the_well_attendance the_well_attendance_student_id_course_id_year_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.the_well_attendance
    ADD CONSTRAINT the_well_attendance_student_id_course_id_year_month_key UNIQUE (student_id, course_id, year, month);


--
-- Name: the_well_session_attendance the_well_session_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.the_well_session_attendance
    ADD CONSTRAINT the_well_session_attendance_pkey PRIMARY KEY (id);


--
-- Name: the_well_session_attendance the_well_session_attendance_student_id_course_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.the_well_session_attendance
    ADD CONSTRAINT the_well_session_attendance_student_id_course_id_week_start_key UNIQUE (student_id, course_id, week_start);


--
-- Name: todo_batches todo_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_batches
    ADD CONSTRAINT todo_batches_pkey PRIMARY KEY (id);


--
-- Name: todo_items todo_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_items
    ADD CONSTRAINT todo_items_pkey PRIMARY KEY (id);


--
-- Name: tuition_installments tuition_installments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuition_installments
    ADD CONSTRAINT tuition_installments_pkey PRIMARY KEY (id);


--
-- Name: tuition_plans tuition_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuition_plans
    ADD CONSTRAINT tuition_plans_pkey PRIMARY KEY (id);


--
-- Name: tuition_reminder_logs tuition_reminder_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuition_reminder_logs
    ADD CONSTRAINT tuition_reminder_logs_pkey PRIMARY KEY (id);


--
-- Name: well_schedule well_schedule_course_week_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.well_schedule
    ADD CONSTRAINT well_schedule_course_week_key UNIQUE (course_id, week_start);


--
-- Name: well_schedule well_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.well_schedule
    ADD CONSTRAINT well_schedule_pkey PRIMARY KEY (id);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: absence_notice_sessions_class_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX absence_notice_sessions_class_idx ON public.absence_notice_sessions USING btree (class_id);


--
-- Name: absence_notices_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX absence_notices_student_idx ON public.absence_notices USING btree (student_id, submitted_at DESC);


--
-- Name: announcement_attachments_announcement_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcement_attachments_announcement_id_idx ON public.announcement_attachments USING btree (announcement_id);


--
-- Name: announcement_attachments_uploader_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcement_attachments_uploader_id_idx ON public.announcement_attachments USING btree (uploader_id);


--
-- Name: announcement_comments_announcement_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcement_comments_announcement_id_idx ON public.announcement_comments USING btree (announcement_id);


--
-- Name: announcement_comments_author_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcement_comments_author_id_idx ON public.announcement_comments USING btree (author_id);


--
-- Name: announcement_reactions_announcement_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcement_reactions_announcement_idx ON public.announcement_reactions USING btree (announcement_id);


--
-- Name: announcement_reactions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcement_reactions_user_idx ON public.announcement_reactions USING btree (user_id);


--
-- Name: announcements_author_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcements_author_id_idx ON public.announcements USING btree (author_id);


--
-- Name: announcements_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcements_course_id_idx ON public.announcements USING btree (course_id);


--
-- Name: announcements_feed_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcements_feed_order_idx ON public.announcements USING btree (is_pinned DESC, created_at DESC);


--
-- Name: announcements_status_schedule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcements_status_schedule_idx ON public.announcements USING btree (status, scheduled_at);


--
-- Name: announcements_target_roles_gin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcements_target_roles_gin_idx ON public.announcements USING gin (target_roles);


--
-- Name: attendance_correction_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_correction_requests_status_idx ON public.attendance_correction_requests USING btree (status, requested_at DESC);


--
-- Name: attendance_correction_requests_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_correction_requests_student_idx ON public.attendance_correction_requests USING btree (student_id, requested_at DESC);


--
-- Name: book_reading_assignments_book_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_reading_assignments_book_id_idx ON public.book_reading_assignments USING btree (book_id);


--
-- Name: book_reading_assignments_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_reading_assignments_course_id_idx ON public.book_reading_assignments USING btree (course_id);


--
-- Name: book_reading_assignments_due_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_reading_assignments_due_date_idx ON public.book_reading_assignments USING btree (due_date);


--
-- Name: book_reading_assignments_status_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_reading_assignments_status_due_idx ON public.book_reading_assignments USING btree (status, due_date);


--
-- Name: book_reading_submission_comments_author_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_reading_submission_comments_author_id_idx ON public.book_reading_submission_comments USING btree (author_id);


--
-- Name: book_reading_submission_comments_submission_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_reading_submission_comments_submission_id_idx ON public.book_reading_submission_comments USING btree (submission_id);


--
-- Name: book_reading_submissions_assignment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_reading_submissions_assignment_id_idx ON public.book_reading_submissions USING btree (assignment_id);


--
-- Name: book_reading_submissions_graded_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_reading_submissions_graded_at_idx ON public.book_reading_submissions USING btree (graded_at);


--
-- Name: book_reading_submissions_student_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_reading_submissions_student_id_idx ON public.book_reading_submissions USING btree (student_id);


--
-- Name: books_isbn_10_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX books_isbn_10_idx ON public.books USING btree (isbn_10);


--
-- Name: books_isbn_13_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX books_isbn_13_idx ON public.books USING btree (isbn_13);


--
-- Name: calendar_events_starts_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_events_starts_at_idx ON public.calendar_events USING btree (starts_at);


--
-- Name: calendar_events_target_roles_gin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_events_target_roles_gin_idx ON public.calendar_events USING gin (target_roles);


--
-- Name: class_files_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX class_files_subject_id_idx ON public.class_files USING btree (subject_id);


--
-- Name: classes_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX classes_subject_id_idx ON public.classes USING btree (subject_id);


--
-- Name: classes_teacher_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX classes_teacher_id_idx ON public.classes USING btree (teacher_id);


--
-- Name: classes_translator_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX classes_translator_id_idx ON public.classes USING btree (translator_id);


--
-- Name: course_students_course_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_students_course_status_idx ON public.course_students USING btree (course_id, status);


--
-- Name: course_students_mentor_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_students_mentor_status_idx ON public.course_students USING btree (mentor_id, status);


--
-- Name: course_students_student_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_students_student_status_idx ON public.course_students USING btree (student_id, status);


--
-- Name: grade_categories_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grade_categories_course_id_idx ON public.grade_categories USING btree (course_id);


--
-- Name: grading_periods_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grading_periods_course_id_idx ON public.grading_periods USING btree (course_id);


--
-- Name: homework_assignments_grade_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX homework_assignments_grade_category_id_idx ON public.homework_assignments USING btree (grade_category_id);


--
-- Name: homework_assignments_grading_due_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX homework_assignments_grading_due_date_idx ON public.homework_assignments USING btree (grading_due_date);


--
-- Name: homework_assignments_grading_period_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX homework_assignments_grading_period_id_idx ON public.homework_assignments USING btree (grading_period_id);


--
-- Name: homework_assignments_subject_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX homework_assignments_subject_id_idx ON public.homework_assignments USING btree (subject_id);


--
-- Name: homework_assignments_work_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX homework_assignments_work_type_idx ON public.homework_assignments USING btree (work_type);


--
-- Name: messages_audience_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_audience_key_idx ON public.messages USING btree (audience_key, created_at);


--
-- Name: messages_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_recipient_idx ON public.messages USING btree (recipient_id);


--
-- Name: messages_sender_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_sender_idx ON public.messages USING btree (sender_id);


--
-- Name: ministry_rotations_student_course_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ministry_rotations_student_course_idx ON public.ministry_rotations USING btree (student_id, course_id);


--
-- Name: ministry_rotations_team_dates_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ministry_rotations_team_dates_idx ON public.ministry_rotations USING btree (team_id, start_date, end_date);


--
-- Name: ministry_service_attendance_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ministry_service_attendance_session_idx ON public.ministry_service_attendance USING btree (session_id);


--
-- Name: ministry_service_sessions_team_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ministry_service_sessions_team_date_idx ON public.ministry_service_sessions USING btree (team_id, service_date);


--
-- Name: ministry_team_members_team_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ministry_team_members_team_idx ON public.ministry_team_members USING btree (team_id);


--
-- Name: ministry_team_members_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ministry_team_members_user_idx ON public.ministry_team_members USING btree (user_id);


--
-- Name: ministry_teams_leader_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ministry_teams_leader_idx ON public.ministry_teams USING btree (leader_id);


--
-- Name: notification_deliveries_job_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_deliveries_job_idx ON public.notification_deliveries USING btree (job_id);


--
-- Name: notification_jobs_announcement_type_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notification_jobs_announcement_type_key ON public.notification_jobs USING btree (announcement_id, type);


--
-- Name: notification_jobs_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_jobs_due_idx ON public.notification_jobs USING btree (status, scheduled_for) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));


--
-- Name: prayer_schedule_week_start_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prayer_schedule_week_start_idx ON public.prayer_schedule USING btree (week_start);


--
-- Name: profile_invites_pending_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profile_invites_pending_email_idx ON public.profile_invites USING btree (lower(email)) WHERE (status = 'pending'::text);


--
-- Name: profiles_roles_gin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_roles_gin_idx ON public.profiles USING gin (roles);


--
-- Name: profiles_student_number_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_student_number_unique_idx ON public.profiles USING btree (student_number) WHERE (student_number IS NOT NULL);


--
-- Name: subjects_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subjects_course_id_idx ON public.subjects USING btree (course_id);


--
-- Name: todo_batches_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX todo_batches_created_by_idx ON public.todo_batches USING btree (created_by);


--
-- Name: todo_items_assigned_to_status_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX todo_items_assigned_to_status_due_idx ON public.todo_items USING btree (assigned_to, status, due_date);


--
-- Name: todo_items_batch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX todo_items_batch_id_idx ON public.todo_items USING btree (batch_id);


--
-- Name: todo_items_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX todo_items_created_by_idx ON public.todo_items USING btree (created_by);


--
-- Name: todo_items_priority_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX todo_items_priority_due_idx ON public.todo_items USING btree (priority, due_date) WHERE (status = 'open'::text);


--
-- Name: well_schedule_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX well_schedule_course_id_idx ON public.well_schedule USING btree (course_id);


--
-- Name: well_schedule_well_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX well_schedule_well_date_idx ON public.well_schedule USING btree (well_date);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: idx_objects_current_version; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_objects_current_version ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE (archived_at IS NULL);


--
-- Name: idx_objects_null_version; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_objects_null_version ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE (NOT is_versioned);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_name_version_key; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_name_version_key ON storage.objects USING btree (bucket_id, name COLLATE "C", version) NULLS NOT DISTINCT;


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: classes classes_translator_only_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classes_translator_only_update BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.enforce_classes_translator_only_update();


--
-- Name: profile_private_data prevent_profile_private_data_escalation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_profile_private_data_escalation BEFORE UPDATE ON public.profile_private_data FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_private_data_escalation();


--
-- Name: profiles prevent_profile_privilege_escalation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_profile_privilege_escalation BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: absence_notice_sessions absence_notice_sessions_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absence_notice_sessions
    ADD CONSTRAINT absence_notice_sessions_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: absence_notice_sessions absence_notice_sessions_notice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absence_notice_sessions
    ADD CONSTRAINT absence_notice_sessions_notice_id_fkey FOREIGN KEY (notice_id) REFERENCES public.absence_notices(id) ON DELETE CASCADE;


--
-- Name: absence_notices absence_notices_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absence_notices
    ADD CONSTRAINT absence_notices_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: announcement_attachments announcement_attachments_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_attachments
    ADD CONSTRAINT announcement_attachments_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_attachments announcement_attachments_uploader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_attachments
    ADD CONSTRAINT announcement_attachments_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: announcement_comments announcement_comments_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comments
    ADD CONSTRAINT announcement_comments_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_comments announcement_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_comments
    ADD CONSTRAINT announcement_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: announcement_reactions announcement_reactions_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_reactions
    ADD CONSTRAINT announcement_reactions_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_reactions announcement_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_reactions
    ADD CONSTRAINT announcement_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: announcements announcements_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: attendance_correction_requests attendance_correction_requests_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_correction_requests
    ADD CONSTRAINT attendance_correction_requests_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- Name: attendance_correction_requests attendance_correction_requests_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_correction_requests
    ADD CONSTRAINT attendance_correction_requests_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;


--
-- Name: attendance_correction_requests attendance_correction_requests_ministry_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_correction_requests
    ADD CONSTRAINT attendance_correction_requests_ministry_session_id_fkey FOREIGN KEY (ministry_session_id) REFERENCES public.ministry_service_sessions(id) ON DELETE SET NULL;


--
-- Name: attendance_correction_requests attendance_correction_requests_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_correction_requests
    ADD CONSTRAINT attendance_correction_requests_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: attendance_correction_requests attendance_correction_requests_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_correction_requests
    ADD CONSTRAINT attendance_correction_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: book_reading_assignments book_reading_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_assignments
    ADD CONSTRAINT book_reading_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: book_reading_assignments book_reading_assignments_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_assignments
    ADD CONSTRAINT book_reading_assignments_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- Name: book_reading_assignments book_reading_assignments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_assignments
    ADD CONSTRAINT book_reading_assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: book_reading_submission_comments book_reading_submission_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_submission_comments
    ADD CONSTRAINT book_reading_submission_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: book_reading_submission_comments book_reading_submission_comments_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_submission_comments
    ADD CONSTRAINT book_reading_submission_comments_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.book_reading_submissions(id) ON DELETE CASCADE;


--
-- Name: book_reading_submissions book_reading_submissions_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_submissions
    ADD CONSTRAINT book_reading_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.book_reading_assignments(id) ON DELETE CASCADE;


--
-- Name: book_reading_submissions book_reading_submissions_graded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_submissions
    ADD CONSTRAINT book_reading_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: book_reading_submissions book_reading_submissions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_submissions
    ADD CONSTRAINT book_reading_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: book_reading_submissions book_reading_submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_reading_submissions
    ADD CONSTRAINT book_reading_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: books books_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: calendar_events calendar_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: class_attendance class_attendance_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_attendance
    ADD CONSTRAINT class_attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: class_attendance class_attendance_marked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_attendance
    ADD CONSTRAINT class_attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: class_attendance class_attendance_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_attendance
    ADD CONSTRAINT class_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: class_files class_files_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_files
    ADD CONSTRAINT class_files_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: class_files class_files_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_files
    ADD CONSTRAINT class_files_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: class_files class_files_uploader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_files
    ADD CONSTRAINT class_files_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: class_notes class_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_notes
    ADD CONSTRAINT class_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: class_notes class_notes_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_notes
    ADD CONSTRAINT class_notes_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: classes classes_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: classes classes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: classes classes_translator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_translator_id_fkey FOREIGN KEY (translator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: course_students course_students_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_students
    ADD CONSTRAINT course_students_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_students course_students_mentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_students
    ADD CONSTRAINT course_students_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: course_students course_students_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_students
    ADD CONSTRAINT course_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: duty_schedule duty_schedule_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_schedule
    ADD CONSTRAINT duty_schedule_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: duty_schedule duty_schedule_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_schedule
    ADD CONSTRAINT duty_schedule_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: duty_transfer_requests duty_transfer_requests_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_transfer_requests
    ADD CONSTRAINT duty_transfer_requests_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: duty_transfer_requests duty_transfer_requests_duty_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_transfer_requests
    ADD CONSTRAINT duty_transfer_requests_duty_schedule_id_fkey FOREIGN KEY (duty_schedule_id) REFERENCES public.duty_schedule(id) ON DELETE CASCADE;


--
-- Name: duty_transfer_requests duty_transfer_requests_from_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_transfer_requests
    ADD CONSTRAINT duty_transfer_requests_from_student_id_fkey FOREIGN KEY (from_student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: duty_transfer_requests duty_transfer_requests_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_transfer_requests
    ADD CONSTRAINT duty_transfer_requests_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: duty_transfer_requests duty_transfer_requests_to_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.duty_transfer_requests
    ADD CONSTRAINT duty_transfer_requests_to_student_id_fkey FOREIGN KEY (to_student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: google_docs_connections google_docs_connections_connected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_docs_connections
    ADD CONSTRAINT google_docs_connections_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: grade_categories grade_categories_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_categories
    ADD CONSTRAINT grade_categories_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: grade_settings grade_settings_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grade_settings
    ADD CONSTRAINT grade_settings_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: grading_periods grading_periods_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_periods
    ADD CONSTRAINT grading_periods_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: homework_assignments homework_assignments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_assignments
    ADD CONSTRAINT homework_assignments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: homework_assignments homework_assignments_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_assignments
    ADD CONSTRAINT homework_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: homework_assignments homework_assignments_grade_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_assignments
    ADD CONSTRAINT homework_assignments_grade_category_id_fkey FOREIGN KEY (grade_category_id) REFERENCES public.grade_categories(id) ON DELETE SET NULL;


--
-- Name: homework_assignments homework_assignments_grading_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_assignments
    ADD CONSTRAINT homework_assignments_grading_period_id_fkey FOREIGN KEY (grading_period_id) REFERENCES public.grading_periods(id) ON DELETE SET NULL;


--
-- Name: homework_assignments homework_assignments_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_assignments
    ADD CONSTRAINT homework_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: homework_comments homework_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_comments
    ADD CONSTRAINT homework_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: homework_comments homework_comments_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_comments
    ADD CONSTRAINT homework_comments_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.homework_submissions(id) ON DELETE CASCADE;


--
-- Name: homework_submissions homework_submissions_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_submissions
    ADD CONSTRAINT homework_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.homework_assignments(id) ON DELETE CASCADE;


--
-- Name: homework_submissions homework_submissions_graded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_submissions
    ADD CONSTRAINT homework_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: homework_submissions homework_submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_submissions
    ADD CONSTRAINT homework_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mentorship_logs mentorship_logs_mentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_logs
    ADD CONSTRAINT mentorship_logs_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: mentorship_logs mentorship_logs_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentorship_logs
    ADD CONSTRAINT mentorship_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: ministry_rotations ministry_rotations_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_rotations
    ADD CONSTRAINT ministry_rotations_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: ministry_rotations ministry_rotations_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_rotations
    ADD CONSTRAINT ministry_rotations_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: ministry_rotations ministry_rotations_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_rotations
    ADD CONSTRAINT ministry_rotations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.ministry_teams(id) ON DELETE CASCADE;


--
-- Name: ministry_service_attendance ministry_service_attendance_marked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_service_attendance
    ADD CONSTRAINT ministry_service_attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: ministry_service_attendance ministry_service_attendance_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_service_attendance
    ADD CONSTRAINT ministry_service_attendance_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.ministry_service_sessions(id) ON DELETE CASCADE;


--
-- Name: ministry_service_attendance ministry_service_attendance_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_service_attendance
    ADD CONSTRAINT ministry_service_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: ministry_service_sessions ministry_service_sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_service_sessions
    ADD CONSTRAINT ministry_service_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: ministry_service_sessions ministry_service_sessions_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_service_sessions
    ADD CONSTRAINT ministry_service_sessions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.ministry_teams(id) ON DELETE CASCADE;


--
-- Name: ministry_team_members ministry_team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_team_members
    ADD CONSTRAINT ministry_team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.ministry_teams(id) ON DELETE CASCADE;


--
-- Name: ministry_team_members ministry_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_team_members
    ADD CONSTRAINT ministry_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: ministry_teams ministry_teams_leader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ministry_teams
    ADD CONSTRAINT ministry_teams_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: notification_deliveries notification_deliveries_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.notification_jobs(id) ON DELETE CASCADE;


--
-- Name: notification_deliveries notification_deliveries_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: notification_jobs notification_jobs_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_jobs
    ADD CONSTRAINT notification_jobs_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: notification_jobs notification_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_jobs
    ADD CONSTRAINT notification_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: prayer_schedule prayer_schedule_thursday_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_schedule
    ADD CONSTRAINT prayer_schedule_thursday_student_id_fkey FOREIGN KEY (thursday_student_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: prayer_schedule prayer_schedule_tuesday_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_schedule
    ADD CONSTRAINT prayer_schedule_tuesday_student_id_fkey FOREIGN KEY (tuesday_student_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profile_invites profile_invites_claimed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_invites
    ADD CONSTRAINT profile_invites_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profile_invites profile_invites_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_invites
    ADD CONSTRAINT profile_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profile_private_data profile_private_data_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_private_data
    ADD CONSTRAINT profile_private_data_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: stream_course_settings stream_course_settings_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_course_settings
    ADD CONSTRAINT stream_course_settings_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: stream_course_settings stream_course_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stream_course_settings
    ADD CONSTRAINT stream_course_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: student_tuition_accounts student_tuition_accounts_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_tuition_accounts
    ADD CONSTRAINT student_tuition_accounts_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.tuition_plans(id) ON DELETE CASCADE;


--
-- Name: student_tuition_accounts student_tuition_accounts_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_tuition_accounts
    ADD CONSTRAINT student_tuition_accounts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: student_tuition_payments student_tuition_payments_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_tuition_payments
    ADD CONSTRAINT student_tuition_payments_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.student_tuition_accounts(id) ON DELETE CASCADE;


--
-- Name: student_tuition_payments student_tuition_payments_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_tuition_payments
    ADD CONSTRAINT student_tuition_payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: student_tuition_payments student_tuition_payments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_tuition_payments
    ADD CONSTRAINT student_tuition_payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: subject_notes subject_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_notes
    ADD CONSTRAINT subject_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: subject_notes subject_notes_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject_notes
    ADD CONSTRAINT subject_notes_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: subjects subjects_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: subjects subjects_primary_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_primary_teacher_id_fkey FOREIGN KEY (primary_teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: sunday_attendance sunday_attendance_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sunday_attendance
    ADD CONSTRAINT sunday_attendance_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: sunday_attendance sunday_attendance_marked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sunday_attendance
    ADD CONSTRAINT sunday_attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: sunday_attendance sunday_attendance_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sunday_attendance
    ADD CONSTRAINT sunday_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: the_well_attendance the_well_attendance_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.the_well_attendance
    ADD CONSTRAINT the_well_attendance_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: the_well_attendance the_well_attendance_marked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.the_well_attendance
    ADD CONSTRAINT the_well_attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: the_well_attendance the_well_attendance_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.the_well_attendance
    ADD CONSTRAINT the_well_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: todo_batches todo_batches_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_batches
    ADD CONSTRAINT todo_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: todo_items todo_items_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_items
    ADD CONSTRAINT todo_items_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: todo_items todo_items_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_items
    ADD CONSTRAINT todo_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.todo_batches(id) ON DELETE SET NULL;


--
-- Name: todo_items todo_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todo_items
    ADD CONSTRAINT todo_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: tuition_installments tuition_installments_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuition_installments
    ADD CONSTRAINT tuition_installments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.tuition_plans(id) ON DELETE CASCADE;


--
-- Name: tuition_plans tuition_plans_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuition_plans
    ADD CONSTRAINT tuition_plans_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;


--
-- Name: tuition_plans tuition_plans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuition_plans
    ADD CONSTRAINT tuition_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: tuition_reminder_logs tuition_reminder_logs_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuition_reminder_logs
    ADD CONSTRAINT tuition_reminder_logs_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.student_tuition_accounts(id) ON DELETE CASCADE;


--
-- Name: tuition_reminder_logs tuition_reminder_logs_installment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuition_reminder_logs
    ADD CONSTRAINT tuition_reminder_logs_installment_id_fkey FOREIGN KEY (installment_id) REFERENCES public.tuition_installments(id) ON DELETE SET NULL;


--
-- Name: tuition_reminder_logs tuition_reminder_logs_notification_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuition_reminder_logs
    ADD CONSTRAINT tuition_reminder_logs_notification_job_id_fkey FOREIGN KEY (notification_job_id) REFERENCES public.notification_jobs(id) ON DELETE SET NULL;


--
-- Name: tuition_reminder_logs tuition_reminder_logs_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuition_reminder_logs
    ADD CONSTRAINT tuition_reminder_logs_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: tuition_reminder_logs tuition_reminder_logs_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tuition_reminder_logs
    ADD CONSTRAINT tuition_reminder_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: well_schedule well_schedule_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.well_schedule
    ADD CONSTRAINT well_schedule_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: ministry_service_sessions Admins and assigned team members can create ministry reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and assigned team members can create ministry reports" ON public.ministry_service_sessions FOR INSERT TO authenticated WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))) OR (EXISTS ( SELECT 1
   FROM (public.ministry_team_members
     JOIN public.profiles ON ((profiles.id = ministry_team_members.user_id)))
  WHERE ((ministry_team_members.team_id = ministry_service_sessions.team_id) AND (ministry_team_members.user_id = ( SELECT auth.uid() AS uid)) AND (ministry_team_members.active = true) AND (ministry_team_members.can_submit_reports = true) AND (profiles.roles @> ARRAY['team_leader'::text])))))));


--
-- Name: ministry_service_attendance Admins and assigned team members can mark ministry attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and assigned team members can mark ministry attendance" ON public.ministry_service_attendance TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))) OR (EXISTS ( SELECT 1
   FROM ((public.ministry_service_sessions
     JOIN public.ministry_team_members ON ((ministry_team_members.team_id = ministry_service_sessions.team_id)))
     JOIN public.profiles ON ((profiles.id = ministry_team_members.user_id)))
  WHERE ((ministry_service_sessions.id = ministry_service_attendance.session_id) AND (ministry_team_members.user_id = ( SELECT auth.uid() AS uid)) AND (ministry_team_members.active = true) AND (ministry_team_members.can_submit_reports = true) AND (profiles.roles @> ARRAY['team_leader'::text])))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))) OR (EXISTS ( SELECT 1
   FROM ((public.ministry_service_sessions
     JOIN public.ministry_team_members ON ((ministry_team_members.team_id = ministry_service_sessions.team_id)))
     JOIN public.profiles ON ((profiles.id = ministry_team_members.user_id)))
  WHERE ((ministry_service_sessions.id = ministry_service_attendance.session_id) AND (ministry_team_members.user_id = ( SELECT auth.uid() AS uid)) AND (ministry_team_members.active = true) AND (ministry_team_members.can_submit_reports = true) AND (profiles.roles @> ARRAY['team_leader'::text]))))));


--
-- Name: ministry_service_sessions Admins and assigned team members can update ministry reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and assigned team members can update ministry reports" ON public.ministry_service_sessions FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))) OR (EXISTS ( SELECT 1
   FROM (public.ministry_team_members
     JOIN public.profiles ON ((profiles.id = ministry_team_members.user_id)))
  WHERE ((ministry_team_members.team_id = ministry_service_sessions.team_id) AND (ministry_team_members.user_id = ( SELECT auth.uid() AS uid)) AND (ministry_team_members.active = true) AND (ministry_team_members.can_submit_reports = true) AND (profiles.roles @> ARRAY['team_leader'::text])))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))) OR (EXISTS ( SELECT 1
   FROM (public.ministry_team_members
     JOIN public.profiles ON ((profiles.id = ministry_team_members.user_id)))
  WHERE ((ministry_team_members.team_id = ministry_service_sessions.team_id) AND (ministry_team_members.user_id = ( SELECT auth.uid() AS uid)) AND (ministry_team_members.active = true) AND (ministry_team_members.can_submit_reports = true) AND (profiles.roles @> ARRAY['team_leader'::text]))))));


--
-- Name: todo_items Admins and creators can delete todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and creators can delete todos" ON public.todo_items FOR DELETE TO authenticated USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))));


--
-- Name: todo_items Admins can assign todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can assign todos" ON public.todo_items FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))));


--
-- Name: todo_batches Admins can create todo batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create todo batches" ON public.todo_batches FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))));


--
-- Name: ministry_rotations Admins can manage ministry rotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage ministry rotations" ON public.ministry_rotations TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: ministry_team_members Admins can manage ministry team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage ministry team members" ON public.ministry_team_members TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: ministry_teams Admins can manage ministry teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage ministry teams" ON public.ministry_teams TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: prayer_schedule Admins can manage prayer schedule; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage prayer schedule" ON public.prayer_schedule TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: well_schedule Admins can manage well schedule; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage well schedule" ON public.well_schedule TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: todo_batches Admins can read all todo batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all todo batches" ON public.todo_batches FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: todo_items Admins can read all todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all todos" ON public.todo_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: todo_items Admins can update all todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all todos" ON public.todo_items FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: todo_batches Admins can update todo batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update todo batches" ON public.todo_batches FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: student_tuition_accounts Admins manage tuition accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage tuition accounts" ON public.student_tuition_accounts USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: tuition_installments Admins manage tuition installments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage tuition installments" ON public.tuition_installments USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: student_tuition_payments Admins manage tuition payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage tuition payments" ON public.student_tuition_payments USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: tuition_plans Admins manage tuition plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage tuition plans" ON public.tuition_plans USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: tuition_reminder_logs Admins manage tuition reminder logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage tuition reminder logs" ON public.tuition_reminder_logs USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: todo_batches Assigned users can read linked todo batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Assigned users can read linked todo batches" ON public.todo_batches FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.todo_items
  WHERE ((todo_items.batch_id = todo_batches.id) AND (todo_items.assigned_to = auth.uid())))));


--
-- Name: ministry_service_attendance Authenticated users can read ministry attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read ministry attendance" ON public.ministry_service_attendance FOR SELECT TO authenticated USING (true);


--
-- Name: ministry_rotations Authenticated users can read ministry rotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read ministry rotations" ON public.ministry_rotations FOR SELECT TO authenticated USING (true);


--
-- Name: ministry_service_sessions Authenticated users can read ministry sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read ministry sessions" ON public.ministry_service_sessions FOR SELECT TO authenticated USING (true);


--
-- Name: ministry_team_members Authenticated users can read ministry team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read ministry team members" ON public.ministry_team_members FOR SELECT TO authenticated USING (true);


--
-- Name: ministry_teams Authenticated users can read ministry teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read ministry teams" ON public.ministry_teams FOR SELECT TO authenticated USING (true);


--
-- Name: prayer_schedule Authenticated users can read prayer schedule; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read prayer schedule" ON public.prayer_schedule FOR SELECT TO authenticated USING (true);


--
-- Name: well_schedule Authenticated users can read well schedule; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read well schedule" ON public.well_schedule FOR SELECT TO authenticated USING (true);


--
-- Name: todo_batches Creators can delete own todo batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can delete own todo batches" ON public.todo_batches FOR DELETE TO authenticated USING (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles @> ARRAY['administrator'::text]))))));


--
-- Name: todo_batches Creators can read own todo batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can read own todo batches" ON public.todo_batches FOR SELECT TO authenticated USING ((created_by = auth.uid()));


--
-- Name: notification_deliveries Notification deliveries can be read by admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Notification deliveries can be read by admins" ON public.notification_deliveries FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: notification_jobs Notification jobs can be created by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Notification jobs can be created by owner" ON public.notification_jobs FOR INSERT TO authenticated WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (((type <> 'workflow_email'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles && ARRAY['administrator'::text, 'team_leader'::text]))))) AND ((type <> ALL (ARRAY['role_change_email'::text, 'enrollment_email'::text])) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['administrator'::text]))))))));


--
-- Name: notification_jobs Notification jobs can be read by admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Notification jobs can be read by admins" ON public.notification_jobs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: notification_jobs Notification jobs can be read by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Notification jobs can be read by owner" ON public.notification_jobs FOR SELECT TO authenticated USING ((created_by = ( SELECT auth.uid() AS uid)));


--
-- Name: notification_jobs Notification jobs can be updated by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Notification jobs can be updated by owner" ON public.notification_jobs FOR UPDATE TO authenticated USING ((created_by = ( SELECT auth.uid() AS uid))) WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (((type <> 'workflow_email'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles && ARRAY['administrator'::text, 'team_leader'::text]))))) AND ((type <> ALL (ARRAY['role_change_email'::text, 'enrollment_email'::text])) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['administrator'::text]))))))));


--
-- Name: todo_batches Staff can create personal todo batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create personal todo batches" ON public.todo_batches FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) AND (assignment_type = 'person'::text) AND (target_ids = ARRAY[(auth.uid())::text])));


--
-- Name: todo_items Staff can create personal todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create personal todos" ON public.todo_items FOR INSERT TO authenticated WITH CHECK (((created_by = auth.uid()) AND (assigned_to = auth.uid())));


--
-- Name: todo_items Staff can read their own todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can read their own todos" ON public.todo_items FOR SELECT TO authenticated USING (((assigned_to = auth.uid()) OR (created_by = auth.uid())));


--
-- Name: todo_items Staff can update their own todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update their own todos" ON public.todo_items FOR UPDATE TO authenticated USING (((assigned_to = auth.uid()) OR (created_by = auth.uid()))) WITH CHECK (((assigned_to = auth.uid()) OR (created_by = auth.uid())));


--
-- Name: classes Translation team leaders can assign class translators; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Translation team leaders can assign class translators" ON public.classes FOR UPDATE TO authenticated USING (public.is_translation_ministry_team_leader()) WITH CHECK (public.is_translation_ministry_team_leader());


--
-- Name: absence_notice_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.absence_notice_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: absence_notice_sessions absence_notice_sessions_insert_own_notice; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY absence_notice_sessions_insert_own_notice ON public.absence_notice_sessions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.absence_notices n
  WHERE ((n.id = absence_notice_sessions.notice_id) AND (n.student_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: absence_notice_sessions absence_notice_sessions_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY absence_notice_sessions_select_scoped ON public.absence_notice_sessions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.absence_notices n
  WHERE ((n.id = absence_notice_sessions.notice_id) AND ((n.student_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['administrator'::text])))))))));


--
-- Name: absence_notices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.absence_notices ENABLE ROW LEVEL SECURITY;

--
-- Name: absence_notices absence_notices_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY absence_notices_admin_update ON public.absence_notices FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['administrator'::text])))));


--
-- Name: absence_notices absence_notices_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY absence_notices_insert_own ON public.absence_notices FOR INSERT TO authenticated WITH CHECK ((student_id = ( SELECT auth.uid() AS uid)));


--
-- Name: absence_notices absence_notices_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY absence_notices_select_scoped ON public.absence_notices FOR SELECT TO authenticated USING (((student_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['administrator'::text]))))));


--
-- Name: announcement_reactions announcement reactions are viewable by scoped announcement audi; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "announcement reactions are viewable by scoped announcement audi" ON public.announcement_reactions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.announcements a
  WHERE (a.id = announcement_reactions.announcement_id))));


--
-- Name: announcement_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcement_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcement_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements announcements_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY announcements_delete ON public.announcements FOR DELETE TO authenticated USING ((public.is_admin() OR (auth.uid() = author_id)));


--
-- Name: announcements announcements_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY announcements_insert ON public.announcements FOR INSERT TO authenticated WITH CHECK (((author_id = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['administrator'::text, 'teacher'::text])))) OR ((course_id IS NOT NULL) AND public.can_current_user_write_stream(course_id, 'post'::text) AND (target_roles IS NULL) AND (is_staff_only = false) AND (((status = 'published'::text) AND (COALESCE(( SELECT stream_course_settings.require_student_post_approval
   FROM public.stream_course_settings
  WHERE (stream_course_settings.course_id = announcements.course_id)), true) = false)) OR ((status = 'pending_review'::text) AND (COALESCE(( SELECT stream_course_settings.require_student_post_approval
   FROM public.stream_course_settings
  WHERE (stream_course_settings.course_id = announcements.course_id)), true) = true)))))));


--
-- Name: announcements announcements_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY announcements_select ON public.announcements FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['administrator'::text])))) OR (author_id = ( SELECT auth.uid() AS uid)) OR ((status = 'published'::text) AND ((scheduled_at IS NULL) OR (scheduled_at <= now())) AND (((target_roles IS NULL) AND (course_id IS NULL) AND (is_staff_only = false)) OR ((target_roles IS NULL) AND (course_id IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.course_students cs
  WHERE ((cs.course_id = announcements.course_id) AND (cs.student_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text)))) OR (EXISTS ( SELECT 1
   FROM (public.subjects s
     JOIN public.classes c ON ((c.subject_id = s.id)))
  WHERE ((s.course_id = announcements.course_id) AND (c.teacher_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM public.course_students cs
  WHERE ((cs.course_id = announcements.course_id) AND (cs.mentor_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text)))))) OR ((is_staff_only = true) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles && ARRAY['administrator'::text, 'teacher'::text, 'mentor'::text, 'team_leader'::text]))))) OR ((target_roles IS NOT NULL) AND ((target_roles @> ARRAY[('user:'::text || ( SELECT auth.uid() AS uid))]) OR ((target_roles @> ARRAY['audience:staff'::text]) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles && ARRAY['administrator'::text, 'teacher'::text, 'mentor'::text, 'team_leader'::text]))))) OR ((target_roles @> ARRAY['role:teacher'::text]) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['teacher'::text]))))) OR ((target_roles @> ARRAY['role:translator'::text]) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['translator'::text]))))) OR ((target_roles @> ARRAY['course:first_year'::text]) AND ((EXISTS ( SELECT 1
   FROM (public.course_students cs
     JOIN public.courses co ON ((co.id = cs.course_id)))
  WHERE ((cs.student_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text) AND (co.status = 'active'::text) AND (co.course_type = 'first_year'::text)))) OR (EXISTS ( SELECT 1
   FROM ((public.courses co
     JOIN public.subjects s ON ((s.course_id = co.id)))
     JOIN public.classes c ON ((c.subject_id = s.id)))
  WHERE ((co.status = 'active'::text) AND (co.course_type = 'first_year'::text) AND (c.teacher_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM (public.course_students cs
     JOIN public.courses co ON ((co.id = cs.course_id)))
  WHERE ((cs.mentor_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text) AND (co.status = 'active'::text) AND (co.course_type = 'first_year'::text)))))) OR ((target_roles @> ARRAY['course:second_year'::text]) AND ((EXISTS ( SELECT 1
   FROM (public.course_students cs
     JOIN public.courses co ON ((co.id = cs.course_id)))
  WHERE ((cs.student_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text) AND (co.status = 'active'::text) AND (co.course_type = 'second_year'::text)))) OR (EXISTS ( SELECT 1
   FROM ((public.courses co
     JOIN public.subjects s ON ((s.course_id = co.id)))
     JOIN public.classes c ON ((c.subject_id = s.id)))
  WHERE ((co.status = 'active'::text) AND (co.course_type = 'second_year'::text) AND (c.teacher_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM (public.course_students cs
     JOIN public.courses co ON ((co.id = cs.course_id)))
  WHERE ((cs.mentor_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text) AND (co.status = 'active'::text) AND (co.course_type = 'second_year'::text))))))))))));


--
-- Name: announcements announcements_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY announcements_update ON public.announcements FOR UPDATE TO authenticated USING ((public.is_admin() OR (auth.uid() = author_id)));


--
-- Name: attendance_settings att_settings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY att_settings_select ON public.attendance_settings FOR SELECT TO authenticated USING (true);


--
-- Name: attendance_settings att_settings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY att_settings_update ON public.attendance_settings FOR UPDATE TO authenticated USING (public.is_admin());


--
-- Name: announcement_attachments attachments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attachments_delete ON public.announcement_attachments FOR DELETE TO authenticated USING (((auth.uid() = uploader_id) OR public.is_admin()));


--
-- Name: announcement_attachments attachments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attachments_insert ON public.announcement_attachments FOR INSERT TO authenticated WITH CHECK (((uploader_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.announcements a
  WHERE ((a.id = announcement_attachments.announcement_id) AND (a.author_id = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
           FROM public.profiles
          WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['administrator'::text, 'teacher'::text])))) OR ((a.course_id IS NOT NULL) AND (COALESCE(( SELECT stream_course_settings.allow_student_attachments
           FROM public.stream_course_settings
          WHERE (stream_course_settings.course_id = a.course_id)), false) = true) AND public.can_current_user_write_stream(a.course_id, 'post'::text))))))));


--
-- Name: announcement_attachments attachments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attachments_select ON public.announcement_attachments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.announcements a
  WHERE (a.id = announcement_attachments.announcement_id))));


--
-- Name: attendance_correction_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_correction_requests attendance_correction_requests_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attendance_correction_requests_admin_update ON public.attendance_correction_requests FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: attendance_correction_requests attendance_correction_requests_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attendance_correction_requests_insert_own ON public.attendance_correction_requests FOR INSERT TO authenticated WITH CHECK ((student_id = ( SELECT auth.uid() AS uid)));


--
-- Name: attendance_correction_requests attendance_correction_requests_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attendance_correction_requests_select ON public.attendance_correction_requests FOR SELECT TO authenticated USING (((student_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text]))))));


--
-- Name: attendance_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: book_reading_assignments book_assignments_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY book_assignments_admin_delete ON public.book_reading_assignments FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: book_reading_assignments book_assignments_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY book_assignments_admin_insert ON public.book_reading_assignments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: book_reading_assignments book_assignments_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY book_assignments_admin_update ON public.book_reading_assignments FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: book_reading_assignments book_assignments_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY book_assignments_select_scoped ON public.book_reading_assignments FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))) OR (EXISTS ( SELECT 1
   FROM public.course_students
  WHERE ((course_students.course_id = book_reading_assignments.course_id) AND (course_students.student_id = ( SELECT auth.uid() AS uid)) AND (course_students.status = 'active'::text)))) OR (EXISTS ( SELECT 1
   FROM (public.subjects s
     JOIN public.classes c ON ((c.subject_id = s.id)))
  WHERE ((s.course_id = book_reading_assignments.course_id) AND ((c.teacher_id = ( SELECT auth.uid() AS uid)) OR (c.translator_id = ( SELECT auth.uid() AS uid)))))) OR (EXISTS ( SELECT 1
   FROM public.course_students cs
  WHERE ((cs.course_id = book_reading_assignments.course_id) AND (cs.mentor_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text))))));


--
-- Name: book_reading_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.book_reading_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: book_reading_submission_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.book_reading_submission_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: book_reading_submission_comments book_reading_submission_comments_delete_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY book_reading_submission_comments_delete_own_or_admin ON public.book_reading_submission_comments FOR DELETE TO authenticated USING (((author_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text]))))));


--
-- Name: book_reading_submission_comments book_reading_submission_comments_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY book_reading_submission_comments_insert_scoped ON public.book_reading_submission_comments FOR INSERT TO authenticated WITH CHECK (((author_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (public.book_reading_submissions brs
     JOIN public.book_reading_assignments bra ON ((bra.id = brs.assignment_id)))
  WHERE ((brs.id = book_reading_submission_comments.submission_id) AND ((brs.student_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.profiles
          WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))) OR (EXISTS ( SELECT 1
           FROM (public.subjects s
             JOIN public.classes c ON ((c.subject_id = s.id)))
          WHERE ((s.course_id = bra.course_id) AND (c.teacher_id = ( SELECT auth.uid() AS uid)))))))))));


--
-- Name: book_reading_submission_comments book_reading_submission_comments_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY book_reading_submission_comments_select_scoped ON public.book_reading_submission_comments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.book_reading_submissions brs
     JOIN public.book_reading_assignments bra ON ((bra.id = brs.assignment_id)))
  WHERE ((brs.id = book_reading_submission_comments.submission_id) AND ((brs.student_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.profiles
          WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))) OR (EXISTS ( SELECT 1
           FROM (public.subjects s
             JOIN public.classes c ON ((c.subject_id = s.id)))
          WHERE ((s.course_id = bra.course_id) AND (c.teacher_id = ( SELECT auth.uid() AS uid))))))))));


--
-- Name: book_reading_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.book_reading_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: book_reading_submissions book_submissions_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY book_submissions_admin_delete ON public.book_reading_submissions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: book_reading_submissions book_submissions_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY book_submissions_select_scoped ON public.book_reading_submissions FOR SELECT TO authenticated USING (((student_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))) OR (EXISTS ( SELECT 1
   FROM ((public.book_reading_assignments bra
     JOIN public.subjects s ON ((s.course_id = bra.course_id)))
     JOIN public.classes c ON ((c.subject_id = s.id)))
  WHERE ((bra.id = book_reading_submissions.assignment_id) AND ((c.teacher_id = ( SELECT auth.uid() AS uid)) OR (c.translator_id = ( SELECT auth.uid() AS uid)))))) OR (EXISTS ( SELECT 1
   FROM (public.book_reading_assignments bra
     JOIN public.course_students cs ON ((cs.course_id = bra.course_id)))
  WHERE ((bra.id = book_reading_submissions.assignment_id) AND (cs.mentor_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text))))));


--
-- Name: book_reading_submissions book_submissions_student_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY book_submissions_student_insert ON public.book_reading_submissions FOR INSERT TO authenticated WITH CHECK (((student_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (public.book_reading_assignments bra
     JOIN public.course_students cs ON ((cs.course_id = bra.course_id)))
  WHERE ((bra.id = book_reading_submissions.assignment_id) AND (cs.student_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text))))));


--
-- Name: book_reading_submissions book_submissions_student_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY book_submissions_student_update ON public.book_reading_submissions FOR UPDATE TO authenticated USING (((student_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))) OR (EXISTS ( SELECT 1
   FROM ((public.book_reading_assignments bra
     JOIN public.subjects s ON ((s.course_id = bra.course_id)))
     JOIN public.classes c ON ((c.subject_id = s.id)))
  WHERE ((bra.id = book_reading_submissions.assignment_id) AND (c.teacher_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK (((student_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))) OR (EXISTS ( SELECT 1
   FROM ((public.book_reading_assignments bra
     JOIN public.subjects s ON ((s.course_id = bra.course_id)))
     JOIN public.classes c ON ((c.subject_id = s.id)))
  WHERE ((bra.id = book_reading_submissions.assignment_id) AND (c.teacher_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: books; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

--
-- Name: books books_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY books_admin_delete ON public.books FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: books books_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY books_admin_insert ON public.books FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: books books_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY books_admin_update ON public.books FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: books books_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY books_select_scoped ON public.books FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))) OR (EXISTS ( SELECT 1
   FROM (public.book_reading_assignments bra
     JOIN public.course_students cs ON ((cs.course_id = bra.course_id)))
  WHERE ((bra.book_id = books.id) AND (cs.student_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text)))) OR (EXISTS ( SELECT 1
   FROM ((public.book_reading_assignments bra
     JOIN public.subjects s ON ((s.course_id = bra.course_id)))
     JOIN public.classes c ON ((c.subject_id = s.id)))
  WHERE ((bra.book_id = books.id) AND ((c.teacher_id = ( SELECT auth.uid() AS uid)) OR (c.translator_id = ( SELECT auth.uid() AS uid)))))) OR (EXISTS ( SELECT 1
   FROM (public.book_reading_assignments bra
     JOIN public.course_students cs ON ((cs.course_id = bra.course_id)))
  WHERE ((bra.book_id = books.id) AND (cs.mentor_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text))))));


--
-- Name: calendar_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

--
-- Name: calendar_events calendar_events_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_events_admin_delete ON public.calendar_events FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: calendar_events calendar_events_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_events_admin_insert ON public.calendar_events FOR INSERT TO authenticated WITH CHECK ((public.is_admin() AND (created_by = ( SELECT auth.uid() AS uid))));


--
-- Name: calendar_events calendar_events_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_events_admin_update ON public.calendar_events FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: calendar_events calendar_events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY calendar_events_select ON public.calendar_events FOR SELECT TO authenticated USING ((public.is_admin() OR (created_by = ( SELECT auth.uid() AS uid)) OR (target_roles @> ARRAY['audience:all'::text]) OR (target_roles @> ARRAY[('user:'::text || ( SELECT auth.uid() AS uid))]) OR ((target_roles @> ARRAY['audience:staff'::text]) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles && ARRAY['administrator'::text, 'teacher'::text, 'translator'::text, 'mentor'::text, 'team_leader'::text]))))) OR ((target_roles @> ARRAY['role:teacher'::text]) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['teacher'::text]))))) OR ((target_roles @> ARRAY['role:translator'::text]) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['translator'::text]))))) OR ((target_roles @> ARRAY['role:mentor'::text]) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['mentor'::text]))))) OR ((target_roles @> ARRAY['role:team_leader'::text]) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['team_leader'::text]))))) OR ((target_roles @> ARRAY['course:first_year'::text]) AND ((EXISTS ( SELECT 1
   FROM (public.course_students cs
     JOIN public.courses co ON ((co.id = cs.course_id)))
  WHERE ((cs.student_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text) AND (co.status = 'active'::text) AND (co.course_type = 'first_year'::text)))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['teacher'::text]) AND (p.teaching_course_types @> ARRAY['first_year'::text])))) OR (EXISTS ( SELECT 1
   FROM (public.course_students cs
     JOIN public.courses co ON ((co.id = cs.course_id)))
  WHERE ((cs.mentor_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text) AND (co.status = 'active'::text) AND (co.course_type = 'first_year'::text)))))) OR ((target_roles @> ARRAY['course:second_year'::text]) AND ((EXISTS ( SELECT 1
   FROM (public.course_students cs
     JOIN public.courses co ON ((co.id = cs.course_id)))
  WHERE ((cs.student_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text) AND (co.status = 'active'::text) AND (co.course_type = 'second_year'::text)))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.roles @> ARRAY['teacher'::text]) AND (p.teaching_course_types @> ARRAY['second_year'::text])))) OR (EXISTS ( SELECT 1
   FROM (public.course_students cs
     JOIN public.courses co ON ((co.id = cs.course_id)))
  WHERE ((cs.mentor_id = ( SELECT auth.uid() AS uid)) AND (cs.status = 'active'::text) AND (co.status = 'active'::text) AND (co.course_type = 'second_year'::text))))))));


--
-- Name: class_attendance class_att_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_att_delete ON public.class_attendance FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: class_attendance class_att_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_att_insert ON public.class_attendance FOR INSERT TO authenticated WITH CHECK ((auth.uid() = marked_by));


--
-- Name: class_attendance class_att_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_att_select ON public.class_attendance FOR SELECT TO authenticated USING (true);


--
-- Name: class_attendance class_att_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_att_update ON public.class_attendance FOR UPDATE TO authenticated USING (((auth.uid() = marked_by) OR public.is_admin()));


--
-- Name: class_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: class_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.class_files ENABLE ROW LEVEL SECURITY;

--
-- Name: class_files class_files_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_files_delete ON public.class_files FOR DELETE TO authenticated USING (((auth.uid() = uploader_id) OR public.is_admin()));


--
-- Name: class_files class_files_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_files_insert ON public.class_files FOR INSERT TO authenticated WITH CHECK ((auth.uid() = uploader_id));


--
-- Name: class_files class_files_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_files_select ON public.class_files FOR SELECT TO authenticated USING ((public.is_admin() OR (file_type = 'material'::text) OR (uploader_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (('teacher'::text = ANY (profiles.roles)) OR ('translator'::text = ANY (profiles.roles)) OR ('mentor'::text = ANY (profiles.roles))))))));


--
-- Name: class_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.class_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: class_notes class_notes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_notes_delete ON public.class_notes FOR DELETE TO authenticated USING (((auth.uid() = author_id) OR public.is_admin()));


--
-- Name: class_notes class_notes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_notes_insert ON public.class_notes FOR INSERT TO authenticated WITH CHECK ((auth.uid() = author_id));


--
-- Name: class_notes class_notes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_notes_select ON public.class_notes FOR SELECT TO authenticated USING (((note_type = 'student_note'::text) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (('teacher'::text = ANY (profiles.roles)) OR ('translator'::text = ANY (profiles.roles))))))));


--
-- Name: class_notes class_notes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_notes_update ON public.class_notes FOR UPDATE TO authenticated USING (((auth.uid() = author_id) OR public.is_admin()));


--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: classes classes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY classes_delete ON public.classes FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: classes classes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY classes_insert ON public.classes FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: classes classes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY classes_select ON public.classes FOR SELECT TO authenticated USING (true);


--
-- Name: classes classes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY classes_update ON public.classes FOR UPDATE TO authenticated USING ((public.is_admin() OR (auth.uid() = teacher_id)));


--
-- Name: announcement_comments comments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_delete ON public.announcement_comments FOR DELETE TO authenticated USING (((auth.uid() = author_id) OR public.is_admin()));


--
-- Name: announcement_comments comments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_insert ON public.announcement_comments FOR INSERT TO authenticated WITH CHECK (((author_id = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['administrator'::text, 'teacher'::text])))) OR (EXISTS ( SELECT 1
   FROM public.announcements a
  WHERE ((a.id = announcement_comments.announcement_id) AND (a.status = 'published'::text) AND (a.course_id IS NOT NULL) AND public.can_current_user_write_stream(a.course_id, 'comment'::text)))))));


--
-- Name: announcement_comments comments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_select ON public.announcement_comments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.announcements a
  WHERE (a.id = announcement_comments.announcement_id))));


--
-- Name: announcement_comments comments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_update ON public.announcement_comments FOR UPDATE TO authenticated USING ((auth.uid() = author_id));


--
-- Name: course_students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_students ENABLE ROW LEVEL SECURITY;

--
-- Name: course_students course_students_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_students_delete ON public.course_students FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: course_students course_students_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_students_insert ON public.course_students FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: course_students course_students_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_students_select ON public.course_students FOR SELECT TO authenticated USING ((public.is_admin() OR (( SELECT auth.uid() AS uid) = student_id) OR (( SELECT auth.uid() AS uid) = mentor_id) OR (EXISTS ( SELECT 1
   FROM public.duty_schedule ds
  WHERE ((ds.course_id = course_students.course_id) AND (ds.student_id = ( SELECT auth.uid() AS uid)) AND (ds.status = ANY (ARRAY['active'::text, 'transferred'::text])) AND ((CURRENT_DATE >= ds.week_start) AND (CURRENT_DATE <= ds.week_end)))))));


--
-- Name: course_students course_students_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_students_update ON public.course_students FOR UPDATE TO authenticated USING (public.is_admin());


--
-- Name: courses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

--
-- Name: courses courses_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY courses_delete ON public.courses FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: courses courses_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY courses_insert ON public.courses FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: courses courses_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY courses_select ON public.courses FOR SELECT TO authenticated USING (true);


--
-- Name: courses courses_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY courses_update ON public.courses FOR UPDATE TO authenticated USING (public.is_admin());


--
-- Name: duty_schedule duty_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY duty_delete ON public.duty_schedule FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: duty_schedule duty_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY duty_insert ON public.duty_schedule FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: duty_schedule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.duty_schedule ENABLE ROW LEVEL SECURITY;

--
-- Name: duty_schedule duty_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY duty_select ON public.duty_schedule FOR SELECT TO authenticated USING (true);


--
-- Name: duty_transfer_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.duty_transfer_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: duty_schedule duty_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY duty_update ON public.duty_schedule FOR UPDATE TO authenticated USING (public.is_admin());


--
-- Name: google_docs_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_docs_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: google_docs_connections google_docs_connections_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY google_docs_connections_admin_select ON public.google_docs_connections FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND ('administrator'::text = ANY (profiles.roles))))));


--
-- Name: grade_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grade_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: grade_categories grade_categories_admin_teacher_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grade_categories_admin_teacher_write ON public.grade_categories USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ('administrator'::text = ANY (profiles.roles))))) OR ((course_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((public.courses
     JOIN public.subjects ON ((subjects.course_id = courses.id)))
     JOIN public.classes ON ((classes.subject_id = subjects.id)))
  WHERE ((courses.id = grade_categories.course_id) AND (classes.teacher_id = auth.uid()))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ('administrator'::text = ANY (profiles.roles))))) OR ((course_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((public.courses
     JOIN public.subjects ON ((subjects.course_id = courses.id)))
     JOIN public.classes ON ((classes.subject_id = subjects.id)))
  WHERE ((courses.id = grade_categories.course_id) AND (classes.teacher_id = auth.uid())))))));


--
-- Name: grade_categories grade_categories_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grade_categories_select_scoped ON public.grade_categories FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles && ARRAY['administrator'::text, 'teacher'::text, 'student'::text])))));


--
-- Name: grade_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grade_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: grade_settings grade_settings_admin_teacher_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grade_settings_admin_teacher_write ON public.grade_settings USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ('administrator'::text = ANY (profiles.roles))))) OR ((course_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((public.courses
     JOIN public.subjects ON ((subjects.course_id = courses.id)))
     JOIN public.classes ON ((classes.subject_id = subjects.id)))
  WHERE ((courses.id = grade_settings.course_id) AND (classes.teacher_id = auth.uid()))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ('administrator'::text = ANY (profiles.roles))))) OR ((course_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((public.courses
     JOIN public.subjects ON ((subjects.course_id = courses.id)))
     JOIN public.classes ON ((classes.subject_id = subjects.id)))
  WHERE ((courses.id = grade_settings.course_id) AND (classes.teacher_id = auth.uid())))))));


--
-- Name: grade_settings grade_settings_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grade_settings_select_scoped ON public.grade_settings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles && ARRAY['administrator'::text, 'teacher'::text, 'student'::text])))));


--
-- Name: grading_periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grading_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: grading_periods grading_periods_admin_teacher_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grading_periods_admin_teacher_write ON public.grading_periods USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ('administrator'::text = ANY (profiles.roles))))) OR ((course_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((public.courses
     JOIN public.subjects ON ((subjects.course_id = courses.id)))
     JOIN public.classes ON ((classes.subject_id = subjects.id)))
  WHERE ((courses.id = grading_periods.course_id) AND (classes.teacher_id = auth.uid()))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ('administrator'::text = ANY (profiles.roles))))) OR ((course_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((public.courses
     JOIN public.subjects ON ((subjects.course_id = courses.id)))
     JOIN public.classes ON ((classes.subject_id = subjects.id)))
  WHERE ((courses.id = grading_periods.course_id) AND (classes.teacher_id = auth.uid())))))));


--
-- Name: grading_periods grading_periods_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grading_periods_select_scoped ON public.grading_periods FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.roles && ARRAY['administrator'::text, 'teacher'::text, 'student'::text])))));


--
-- Name: homework_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: homework_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.homework_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: homework_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: homework_assignments hw_assignments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hw_assignments_delete ON public.homework_assignments FOR DELETE TO authenticated USING (((auth.uid() = author_id) OR public.is_admin()));


--
-- Name: homework_assignments hw_assignments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hw_assignments_insert ON public.homework_assignments FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ('teacher'::text = ANY (profiles.roles)))))));


--
-- Name: homework_assignments hw_assignments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hw_assignments_select ON public.homework_assignments FOR SELECT TO authenticated USING (true);


--
-- Name: homework_assignments hw_assignments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hw_assignments_update ON public.homework_assignments FOR UPDATE TO authenticated USING (((auth.uid() = author_id) OR public.is_admin()));


--
-- Name: homework_comments hw_comments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hw_comments_delete ON public.homework_comments FOR DELETE TO authenticated USING (((auth.uid() = author_id) OR public.is_admin()));


--
-- Name: homework_comments hw_comments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hw_comments_insert ON public.homework_comments FOR INSERT TO authenticated WITH CHECK ((auth.uid() = author_id));


--
-- Name: homework_comments hw_comments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hw_comments_select ON public.homework_comments FOR SELECT TO authenticated USING (true);


--
-- Name: homework_submissions hw_submissions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hw_submissions_insert ON public.homework_submissions FOR INSERT TO authenticated WITH CHECK ((auth.uid() = student_id));


--
-- Name: homework_submissions hw_submissions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hw_submissions_select ON public.homework_submissions FOR SELECT TO authenticated USING ((public.is_admin() OR (auth.uid() = student_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (('teacher'::text = ANY (profiles.roles)) OR ('mentor'::text = ANY (profiles.roles))))))));


--
-- Name: homework_submissions hw_submissions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hw_submissions_update ON public.homework_submissions FOR UPDATE TO authenticated USING (((auth.uid() = student_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ('teacher'::text = ANY (profiles.roles)))))));


--
-- Name: mentorship_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentorship_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: mentorship_logs mentorship_logs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentorship_logs_delete ON public.mentorship_logs FOR DELETE TO authenticated USING (((auth.uid() = mentor_id) OR public.is_admin()));


--
-- Name: mentorship_logs mentorship_logs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentorship_logs_insert ON public.mentorship_logs FOR INSERT TO authenticated WITH CHECK ((auth.uid() = mentor_id));


--
-- Name: mentorship_logs mentorship_logs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentorship_logs_select ON public.mentorship_logs FOR SELECT TO authenticated USING ((public.is_admin() OR (auth.uid() = mentor_id) OR (auth.uid() = student_id)));


--
-- Name: mentorship_logs mentorship_logs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentorship_logs_update ON public.mentorship_logs FOR UPDATE TO authenticated USING (((auth.uid() = mentor_id) OR public.is_admin()));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_delete ON public.messages FOR DELETE TO authenticated USING (((auth.uid() = sender_id) OR public.is_admin()));


--
-- Name: messages messages_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated WITH CHECK ((auth.uid() = sender_id));


--
-- Name: messages messages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated USING (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)));


--
-- Name: messages messages_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_update ON public.messages FOR UPDATE TO authenticated USING ((auth.uid() = recipient_id));


--
-- Name: ministry_rotations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ministry_rotations ENABLE ROW LEVEL SECURITY;

--
-- Name: ministry_service_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ministry_service_attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: ministry_service_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ministry_service_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: ministry_team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ministry_team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: ministry_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ministry_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: prayer_schedule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prayer_schedule ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_invites profile_invites_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_invites_admin_delete ON public.profile_invites FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: profile_invites profile_invites_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_invites_admin_insert ON public.profile_invites FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: profile_invites profile_invites_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_invites_admin_select ON public.profile_invites FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: profile_invites profile_invites_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_invites_admin_update ON public.profile_invites FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: profile_private_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_private_data ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_private_data profile_private_data_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_private_data_insert ON public.profile_private_data FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = profile_id) OR public.is_admin()));


--
-- Name: profile_private_data profile_private_data_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_private_data_select ON public.profile_private_data FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = profile_id) OR public.is_admin()));


--
-- Name: profile_private_data profile_private_data_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_private_data_update ON public.profile_private_data FOR UPDATE TO authenticated USING (((( SELECT auth.uid() AS uid) = profile_id) OR public.is_admin())) WITH CHECK (((( SELECT auth.uid() AS uid) = profile_id) OR public.is_admin()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_delete ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: profiles profiles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: profiles profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING (((( SELECT auth.uid() AS uid) = id) OR public.is_admin())) WITH CHECK (((( SELECT auth.uid() AS uid) = id) OR public.is_admin()));


--
-- Name: settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

--
-- Name: settings settings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_select ON public.settings FOR SELECT TO authenticated USING (true);


--
-- Name: settings settings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY settings_update ON public.settings FOR UPDATE TO authenticated USING (public.is_admin());


--
-- Name: stream_course_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stream_course_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: stream_course_settings stream_course_settings_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stream_course_settings_admin_update ON public.stream_course_settings FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text]))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: stream_course_settings stream_course_settings_admin_upsert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stream_course_settings_admin_upsert ON public.stream_course_settings FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles @> ARRAY['administrator'::text])))));


--
-- Name: stream_course_settings stream_course_settings_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stream_course_settings_select_scoped ON public.stream_course_settings FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.roles && ARRAY['administrator'::text, 'teacher'::text])))) OR (EXISTS ( SELECT 1
   FROM public.course_students
  WHERE ((course_students.course_id = stream_course_settings.course_id) AND (course_students.student_id = ( SELECT auth.uid() AS uid)) AND (course_students.status = 'active'::text))))));


--
-- Name: student_tuition_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_tuition_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: student_tuition_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_tuition_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: subject_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subject_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: subject_notes subject_notes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subject_notes_delete ON public.subject_notes FOR DELETE TO authenticated USING (((auth.uid() = author_id) OR public.is_admin()));


--
-- Name: subject_notes subject_notes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subject_notes_insert ON public.subject_notes FOR INSERT TO authenticated WITH CHECK ((auth.uid() = author_id));


--
-- Name: subject_notes subject_notes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subject_notes_select ON public.subject_notes FOR SELECT TO authenticated USING (true);


--
-- Name: subject_notes subject_notes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subject_notes_update ON public.subject_notes FOR UPDATE TO authenticated USING (((auth.uid() = author_id) OR public.is_admin()));


--
-- Name: subjects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

--
-- Name: subjects subjects_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subjects_delete ON public.subjects FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: subjects subjects_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subjects_insert ON public.subjects FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: subjects subjects_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subjects_select ON public.subjects FOR SELECT TO authenticated USING (true);


--
-- Name: subjects subjects_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subjects_update ON public.subjects FOR UPDATE TO authenticated USING (public.is_admin());


--
-- Name: sunday_attendance sunday_att_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sunday_att_insert ON public.sunday_attendance FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: sunday_attendance sunday_att_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sunday_att_select ON public.sunday_attendance FOR SELECT TO authenticated USING (true);


--
-- Name: sunday_attendance sunday_att_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sunday_att_update ON public.sunday_attendance FOR UPDATE TO authenticated USING (public.is_admin());


--
-- Name: sunday_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sunday_attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: the_well_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.the_well_attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: the_well_session_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.the_well_session_attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: the_well_session_attendance the_well_session_attendance_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY the_well_session_attendance_delete ON public.the_well_session_attendance FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: the_well_session_attendance the_well_session_attendance_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY the_well_session_attendance_insert ON public.the_well_session_attendance FOR INSERT TO authenticated WITH CHECK (((marked_by = ( SELECT auth.uid() AS uid)) AND (public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.duty_schedule ds
  WHERE ((ds.course_id = the_well_session_attendance.course_id) AND (ds.student_id = ( SELECT auth.uid() AS uid)) AND (ds.status = ANY (ARRAY['active'::text, 'transferred'::text])) AND ((the_well_session_attendance.week_start >= ds.week_start) AND (the_well_session_attendance.week_start <= ds.week_end))))))));


--
-- Name: the_well_session_attendance the_well_session_attendance_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY the_well_session_attendance_select ON public.the_well_session_attendance FOR SELECT TO authenticated USING (((student_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.duty_schedule ds
  WHERE ((ds.course_id = the_well_session_attendance.course_id) AND (ds.student_id = ( SELECT auth.uid() AS uid)) AND (ds.status = ANY (ARRAY['active'::text, 'transferred'::text])) AND ((the_well_session_attendance.week_start >= ds.week_start) AND (the_well_session_attendance.week_start <= ds.week_end)))))));


--
-- Name: the_well_session_attendance the_well_session_attendance_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY the_well_session_attendance_update ON public.the_well_session_attendance FOR UPDATE TO authenticated USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.duty_schedule ds
  WHERE ((ds.course_id = the_well_session_attendance.course_id) AND (ds.student_id = ( SELECT auth.uid() AS uid)) AND (ds.status = ANY (ARRAY['active'::text, 'transferred'::text])) AND ((the_well_session_attendance.week_start >= ds.week_start) AND (the_well_session_attendance.week_start <= ds.week_end))))))) WITH CHECK (((marked_by = ( SELECT auth.uid() AS uid)) AND (public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.duty_schedule ds
  WHERE ((ds.course_id = the_well_session_attendance.course_id) AND (ds.student_id = ( SELECT auth.uid() AS uid)) AND (ds.status = ANY (ARRAY['active'::text, 'transferred'::text])) AND ((the_well_session_attendance.week_start >= ds.week_start) AND (the_well_session_attendance.week_start <= ds.week_end))))))));


--
-- Name: todo_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.todo_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: todo_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;

--
-- Name: duty_transfer_requests transfer_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transfer_insert ON public.duty_transfer_requests FOR INSERT TO authenticated WITH CHECK ((auth.uid() = from_student_id));


--
-- Name: duty_transfer_requests transfer_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transfer_select ON public.duty_transfer_requests FOR SELECT TO authenticated USING ((public.is_admin() OR (auth.uid() = from_student_id) OR (auth.uid() = to_student_id)));


--
-- Name: duty_transfer_requests transfer_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transfer_update ON public.duty_transfer_requests FOR UPDATE TO authenticated USING (public.is_admin());


--
-- Name: tuition_installments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tuition_installments ENABLE ROW LEVEL SECURITY;

--
-- Name: tuition_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tuition_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: tuition_reminder_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tuition_reminder_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement_reactions users can add their own announcement reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can add their own announcement reactions" ON public.announcement_reactions FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: announcement_reactions users can remove their own announcement reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can remove their own announcement reactions" ON public.announcement_reactions FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: the_well_attendance well_att_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY well_att_insert ON public.the_well_attendance FOR INSERT TO authenticated WITH CHECK ((auth.uid() = marked_by));


--
-- Name: the_well_attendance well_att_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY well_att_select ON public.the_well_attendance FOR SELECT TO authenticated USING (true);


--
-- Name: the_well_attendance well_att_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY well_att_update ON public.the_well_attendance FOR UPDATE TO authenticated USING (((auth.uid() = marked_by) OR public.is_admin()));


--
-- Name: well_schedule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.well_schedule ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: objects storage_delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY storage_delete ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'tbo-lms'::text) AND (((auth.uid())::text = (storage.foldername(name))[1]) OR public.is_admin())));


--
-- Name: objects storage_select; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY storage_select ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'tbo-lms'::text));


--
-- Name: objects storage_upload; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY storage_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'tbo-lms'::text));


--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict NlifKBcjqC7beuIpZ3rsD3Wm9BQFBi4PCa2fROiFvtnNTJThs97e6mAlWfJvn3f

