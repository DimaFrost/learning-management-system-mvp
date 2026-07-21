import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Profile = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

type Course = {
  id: number;
  course_type: 'first_year' | 'second_year';
  graduation_year: number;
};

type Subject = {
  id: number;
  title: string;
  course_id: number;
  course?: Course | Course[] | null;
};

type ClassRow = {
  id: number;
  title: string;
  date: string | null;
  hour: string | null;
  teacher_id?: string | null;
  subject_id: number;
  subject?: Subject | Subject[] | null;
};

type SubjectTeacherRow = {
  teacher_id: string | null;
};

type Assignment = {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  max_points: number;
  class_id: number | null;
  subject_id: number | null;
  class?: ClassRow | ClassRow[] | null;
  subject?: Subject | Subject[] | null;
};

type HomeworkSubmissionRow = {
  id: number;
  assignment_id: number;
  student_id: string;
  google_doc_id: string | null;
  google_doc_url: string | null;
  file_name: string | null;
  status: string;
};

type DocsConnection = {
  connected_email: string;
  access_token: string | null;
  refresh_token: string;
  expires_at: string | null;
};

type OAuthState = {
  userId: string;
  returnTo: string;
  createdAt: number;
  nonce: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleClientId = Deno.env.get('GOOGLE_DOCS_OAUTH_CLIENT_ID') ?? Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!;
const googleClientSecret = Deno.env.get('GOOGLE_DOCS_OAUTH_CLIENT_SECRET') ?? Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!;
const firstYearFolderId = Deno.env.get('GOOGLE_FIRST_YEAR_FOLDER_ID')!;
const secondYearFolderId = Deno.env.get('GOOGLE_SECOND_YEAR_FOLDER_ID')!;
const sharedFolderId = Deno.env.get('GOOGLE_SHARED_FOLDER_ID')!;
const templateDocId = Deno.env.get('GOOGLE_DOC_TEMPLATE_ID')!;
const googleDocsRedirectUri =
  Deno.env.get('GOOGLE_DOCS_REDIRECT_URI') ??
  `${supabaseUrl.replace(/\/$/, '')}/functions/v1/google-docs-v2`;
const docsOAuthScopes = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
];

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return handleOAuthCallback(req);
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { action, ...body } = await req.json().catch(() => ({}));
    const authHeader = req.headers.get('authorization') ?? '';
    const user = await getCurrentProfile(authHeader);

    if (action === 'status') {
      return json(await getConnectionStatus(user));
    }

    if (action === 'start-oauth') {
      return json(await startGoogleDocsOAuth(user, body));
    }

    if (action === 'diagnostics') {
      return json(await getGoogleDocsDiagnostics(user));
    }

    if (action === 'get-homework-doc-status') {
      return json(await getHomeworkDocStatus(user, body));
    }

    if (action === 'create-homework-doc') {
      return json(await createHomeworkDoc(user, body));
    }

    if (action === 'create-material-doc') {
      return json(await createMaterialDoc(user, body));
    }

    if (action === 'upload-material-file') {
      return json(await uploadMaterialFile(user, body));
    }

    if (action === 'upload-stream-attachment') {
      return json(await uploadStreamAttachment(user, body));
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('google-docs-v2 error:', error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function getCurrentProfile(authHeader: string): Promise<Profile> {
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    throw new HttpError('Missing authorization header', 401);
  }

  const token = authHeader.replace(/^bearer\s+/i, '');
  const userClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) {
    throw new HttpError('Invalid session', 401);
  }

  const { data, error } = await adminClient
    .from('profiles')
    .select('id, name, email, roles')
    .eq('id', authData.user.id)
    .single();

  if (error || !data) {
    throw new HttpError('Profile not found', 404);
  }

  return data as Profile;
}

function isAdmin(profile: Profile): boolean {
  return Array.isArray(profile.roles) && profile.roles.includes('administrator');
}

async function getConnectionStatus(profile: Profile) {
  if (!isAdmin(profile)) {
    throw new HttpError('Only administrators can view Google Docs connection status', 403);
  }

  const { data, error } = await adminClient
    .from('google_docs_connections')
    .select('connected_email, connected_at, updated_at, expires_at, scopes')
    .eq('id', 'school_docs')
    .maybeSingle();

  if (error) throw error;
  return { connected: !!data, connection: data ?? null };
}

async function startGoogleDocsOAuth(profile: Profile, body: Record<string, unknown>) {
  if (!isAdmin(profile)) {
    throw new HttpError('Only administrators can connect Google Docs', 403);
  }

  const returnTo = sanitizeReturnTo(String(body.returnTo ?? ''));
  const redirectUri = getOAuthRedirectUri();
  const state = await createOAuthState({
    userId: profile.id,
    returnTo,
    createdAt: Date.now(),
    nonce: crypto.randomUUID(),
  });

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', googleClientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', docsOAuthScopes.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  return {
    authUrl: authUrl.toString(),
    redirectUri,
    clientId: googleClientId,
    scopes: docsOAuthScopes,
  };
}

async function handleOAuthCallback(req: Request) {
  const url = new URL(req.url);
  const stateParam = url.searchParams.get('state') ?? '';
  let state: OAuthState | null = null;

  try {
    state = await verifyOAuthState(stateParam);
    const error = url.searchParams.get('error');
    if (error) {
      return redirectWithGoogleDocsStatus(state.returnTo, 'error', error);
    }

    const code = url.searchParams.get('code');
    if (!code) {
      return redirectWithGoogleDocsStatus(state.returnTo, 'error', 'Google did not return an authorization code.');
    }

    const redirectUri = getOAuthRedirectUri();
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error('Google OAuth callback token error:', tokenData);
      return redirectWithGoogleDocsStatus(
        state.returnTo,
        'error',
        tokenData.error_description ?? 'Google authorization could not be saved.'
      );
    }

    const accessToken = String(tokenData.access_token ?? '');
    const refreshToken = String(tokenData.refresh_token ?? '');
    if (!refreshToken) {
      return redirectWithGoogleDocsStatus(
        state.returnTo,
        'error',
        'Google did not return a refresh token. Reconnect and approve offline access.'
      );
    }

    const expiresAt = new Date(Date.now() + Number(tokenData.expires_in ?? 3600) * 1000).toISOString();
    const googleProfile = await fetchGoogleProfile(accessToken);
    const connectedEmail = googleProfile.email ?? '';

    const { error: saveError } = await adminClient
      .from('google_docs_connections')
      .upsert({
        id: 'school_docs',
        provider: 'google',
        connected_email: connectedEmail,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        scopes: typeof tokenData.scope === 'string' ? tokenData.scope.split(/\s+/).filter(Boolean) : docsOAuthScopes,
        connected_by: state.userId,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (saveError) throw saveError;
    return redirectWithGoogleDocsStatus(state.returnTo, 'connected', connectedEmail || 'Google account');
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return redirectWithGoogleDocsStatus(
      state?.returnTo ?? `${url.origin}/settings`,
      'error',
      error instanceof Error ? error.message : 'Google authorization failed.'
    );
  }
}

async function getGoogleDocsDiagnostics(profile: Profile) {
  if (!isAdmin(profile)) {
    throw new HttpError('Only administrators can test Google Docs setup', 403);
  }

  const token = await getGoogleAccessToken();
  const checks = await Promise.all([
    checkDriveFile(token, 'Template document', templateDocId, 'application/vnd.google-apps.document'),
    checkDriveFile(token, 'First Year folder', firstYearFolderId, 'application/vnd.google-apps.folder'),
    checkDriveFile(token, 'Second Year folder', secondYearFolderId, 'application/vnd.google-apps.folder'),
    checkDriveFile(token, 'Shared folder', sharedFolderId, 'application/vnd.google-apps.folder'),
  ]);

  return {
    ok: checks.every(check => check.ok),
    checks,
  };
}

async function getHomeworkDocStatus(profile: Profile, body: Record<string, unknown>) {
  const submissionId = Number(body.submissionId);
  if (!Number.isFinite(submissionId)) {
    throw new HttpError('Valid submissionId is required', 400);
  }

  const { data, error } = await adminClient
    .from('homework_submissions')
    .select('id, assignment_id, student_id, google_doc_id, google_doc_url, file_name, status')
    .eq('id', submissionId)
    .single();

  if (error || !data) {
    throw new HttpError('Submission not found', 404);
  }

  const submission = data as HomeworkSubmissionRow;
  if (!isAdmin(profile) && submission.student_id !== profile.id) {
    throw new HttpError('You can only view your own Google Doc status', 403);
  }

  const fileId = submission.google_doc_id ?? extractGoogleDocId(submission.google_doc_url);
  if (!fileId) {
    throw new HttpError('This submission does not have a Google Doc file ID yet', 400);
  }

  const token = await getGoogleAccessToken();
  const metadata = await getDriveFileMetadata(token, fileId);
  const access = await checkFilePermission(token, fileId, profile.email);

  return {
    submissionId: submission.id,
    assignmentId: submission.assignment_id,
    fileId,
    url: metadata.webViewLink ?? submission.google_doc_url,
    name: metadata.name ?? submission.file_name,
    mimeType: metadata.mimeType ?? null,
    iconLink: metadata.iconLink ?? null,
    thumbnailLink: metadata.thumbnailLink ?? null,
    modifiedTime: metadata.modifiedTime ?? null,
    createdTime: metadata.createdTime ?? null,
    owners: (metadata.owners ?? []).map((owner: Record<string, unknown>) => ({
      name: owner.displayName ?? null,
      email: owner.emailAddress ?? null,
      photoUrl: owner.photoLink ?? null,
    })),
    lastModifyingUser: metadata.lastModifyingUser
      ? {
          name: metadata.lastModifyingUser.displayName ?? null,
          email: metadata.lastModifyingUser.emailAddress ?? null,
          photoUrl: metadata.lastModifyingUser.photoLink ?? null,
        }
      : null,
    schoolCanAccess: true,
    currentUserAccess: access,
  };
}

async function createHomeworkDoc(profile: Profile, body: Record<string, unknown>) {
  const assignmentId = Number(body.assignmentId);
  if (!Number.isFinite(assignmentId)) {
    throw new HttpError('Valid assignmentId is required', 400);
  }

  const { data: assignmentData, error: assignmentError } = await adminClient
    .from('homework_assignments')
    .select(`
      id, title, description, due_date, max_points, class_id, subject_id,
      class:classes(
        id, title, date, hour, subject_id,
        subject:subjects(
          id, title, course_id,
          course:courses(id, course_type, graduation_year)
        )
      ),
      subject:subjects(
        id, title, course_id,
        course:courses(id, course_type, graduation_year)
      )
    `)
    .eq('id', assignmentId)
    .single();

  if (assignmentError || !assignmentData) {
    throw new HttpError('Assignment not found', 404);
  }

  const assignment = assignmentData as Assignment;
  const classRow = firstItem(assignment.class);
  const subject = firstItem(classRow?.subject) ?? firstItem(assignment.subject);
  const course = firstItem(subject?.course);

  if (!subject || !course) {
    throw new HttpError('Assignment is missing subject/year group context', 400);
  }

  if (!isAdmin(profile)) {
    const { data: enrollment, error: enrollmentError } = await adminClient
      .from('course_students')
      .select('course_id')
      .eq('student_id', profile.id)
      .eq('course_id', course.id)
      .eq('status', 'active')
      .maybeSingle();

    if (enrollmentError) throw enrollmentError;
    if (!enrollment) {
      throw new HttpError('This assignment is not assigned to your active year group', 403);
    }
  }

  const existing = await findExistingSubmission(assignmentId, profile.id);
  if (existing?.google_doc_url) {
    return {
      submissionId: existing.id,
      googleDocId: existing.google_doc_id,
      googleDocUrl: existing.google_doc_url,
      alreadyCreated: true,
    };
  }

  const token = await getGoogleAccessToken();
  const folderId = course.course_type === 'first_year' ? firstYearFolderId : secondYearFolderId;
  const yearGroup = course.course_type === 'first_year' ? 'First Year' : 'Second Year';
  const docName = sanitizeDocName(`${profile.name} - ${assignment.title}`);
  const assignmentFolderId = await ensureDriveFolderPath(token, folderId, [
    'Assignments',
    subject.title,
    assignment.title,
  ]);

  const copied = await copyTemplateDoc(token, docName, assignmentFolderId);
  await replaceDocPlaceholders(token, copied.id, {
    STUDENT_NAME: profile.name,
    STUDENT_EMAIL: profile.email,
    ASSIGNMENT_TITLE: assignment.title,
    SUBJECT_TITLE: subject.title,
    CLASS_TITLE: classRow?.title ?? subject.title,
    YEAR_GROUP: yearGroup,
    DUE_DATE: assignment.due_date ?? '',
    INSTRUCTIONS: assignment.description ?? '',
  });
  await shareFile(token, copied.id, profile.email, 'writer');

  const { data: submission, error: submissionError } = await adminClient
    .from('homework_submissions')
    .upsert({
      assignment_id: assignmentId,
      student_id: profile.id,
      submission_type: 'google_doc',
      drive_file_id: null,
      drive_view_url: null,
      file_name: docName,
      google_doc_id: copied.id,
      google_doc_url: copied.webViewLink,
      status: 'draft',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'assignment_id,student_id' })
    .select('id')
    .single();

  if (submissionError) throw submissionError;

  return {
    submissionId: submission.id,
    googleDocId: copied.id,
    googleDocUrl: copied.webViewLink,
    alreadyCreated: false,
  };
}

async function createMaterialDoc(profile: Profile, body: Record<string, unknown>) {
  const classId = body.classId == null || body.classId === '' ? NaN : Number(body.classId);
  const subjectIdParam = body.subjectId == null || body.subjectId === '' ? NaN : Number(body.subjectId);
  const requestedTitle = String(body.title ?? '').trim();
  const rawFileType = String(body.fileType ?? 'material').trim();
  const fileType = rawFileType === 'teacher_note' ? 'teacher_note' : 'material';
  const hasClassId = Number.isFinite(classId);
  const hasSubjectId = Number.isFinite(subjectIdParam);

  if (!hasClassId && !hasSubjectId) {
    throw new HttpError('Valid classId or subjectId is required', 400);
  }
  if (!requestedTitle) {
    throw new HttpError('A material title is required', 400);
  }

  let subject: Subject;
  let course: Course;
  let classRow: ClassRow | null = null;
  let insertClassId: number | null = null;
  let insertSubjectId: number;

  if (hasClassId) {
    const ctx = await getClassContext(classId);
    subject = ctx.subject;
    course = ctx.course;
    classRow = ctx.classRow;
    insertClassId = classId;
    insertSubjectId = subject.id;
  } else {
    const ctx = await getSubjectContext(subjectIdParam);
    subject = ctx.subject;
    course = ctx.course;
    insertSubjectId = subject.id;
  }

  const subjectTeachers = await getSubjectTeacherIds(subject.id);
  const canCreate =
    isAdmin(profile) ||
    (profile.roles.includes('teacher') && subjectTeachers.includes(profile.id));
  if (!canCreate) {
    throw new HttpError('Only administrators or teachers assigned to this subject can create material docs', 403);
  }

  const token = await getGoogleAccessToken();
  const folderId = course.course_type === 'first_year' ? firstYearFolderId : secondYearFolderId;
  const rootFolderName = fileType === 'teacher_note' ? 'Teacher Notes' : 'Materials';
  const folderPath = [rootFolderName, subject.title];
  if (classRow) {
    const classFolderName = [
      classRow.date ?? 'No date',
      classRow.title,
    ].filter(Boolean).join(' - ');
    folderPath.push(classFolderName);
  }
  const materialsFolderId = await ensureDriveFolderPath(token, folderId, folderPath);
  const docName = sanitizeDocName(requestedTitle);
  const created = await createGoogleDoc(token, docName, materialsFolderId);

  const teacherEmails = await getProfileEmails(subjectTeachers);
  await shareFileBatch(token, created.id, teacherEmails, 'writer');
  if (fileType === 'material') {
    const studentEmails = await getActiveCourseStudentEmails(course.id);
    await shareFileBatch(token, created.id, studentEmails, 'reader');
  }

  const { data: file, error: fileError } = await adminClient
    .from('class_files')
    .insert({
      class_id: insertClassId,
      subject_id: insertSubjectId,
      uploader_id: profile.id,
      file_type: fileType,
      file_name: docName,
      drive_file_id: created.id,
      drive_view_url: created.webViewLink,
      mime_type: 'application/vnd.google-apps.document',
      file_size: null,
    })
    .select('id')
    .single();

  if (fileError) throw fileError;

  return {
    fileId: file.id,
    googleDocId: created.id,
    googleDocUrl: created.webViewLink,
    folderId: materialsFolderId,
  };
}

async function uploadMaterialFile(profile: Profile, body: Record<string, unknown>) {
  const classId = body.classId == null || body.classId === '' ? NaN : Number(body.classId);
  const subjectIdParam = body.subjectId == null || body.subjectId === '' ? NaN : Number(body.subjectId);
  const fileName = String(body.fileName ?? '').trim();
  const mimeType = String(body.mimeType ?? 'application/octet-stream');
  const base64 = String(body.base64 ?? '');
  const fileSize = Number(body.fileSize ?? 0);
  const hasClassId = Number.isFinite(classId);
  const hasSubjectId = Number.isFinite(subjectIdParam);

  if (!hasClassId && !hasSubjectId) {
    throw new HttpError('Valid classId or subjectId is required', 400);
  }
  if (!fileName || !base64) {
    throw new HttpError('A file name and file content are required', 400);
  }

  let subject: Subject;
  let course: Course;
  let folderPath: string[];
  let insertClassId: number | null = null;
  let insertSubjectId: number;

  if (hasClassId) {
    const ctx = await getClassContext(classId);
    subject = ctx.subject;
    course = ctx.course;
    insertClassId = classId;
    insertSubjectId = subject.id;
    const classFolderName = [
      ctx.classRow.date ?? 'No date',
      ctx.classRow.title,
    ].filter(Boolean).join(' - ');
    folderPath = ['Materials', subject.title, classFolderName];
  } else {
    const ctx = await getSubjectContext(subjectIdParam);
    subject = ctx.subject;
    course = ctx.course;
    insertSubjectId = subject.id;
    folderPath = ['Materials', subject.title];
  }

  const subjectTeachers = await getSubjectTeacherIds(subject.id);
  const canUpload =
    isAdmin(profile) ||
    (profile.roles.includes('teacher') && subjectTeachers.includes(profile.id));
  if (!canUpload) {
    throw new HttpError('Only administrators or teachers assigned to this subject can upload material files', 403);
  }

  const token = await getGoogleAccessToken();
  const folderId = course.course_type === 'first_year' ? firstYearFolderId : secondYearFolderId;
  const materialsFolderId = await ensureDriveFolderPath(token, folderId, folderPath);

  const uploaded = await uploadDriveFile(token, {
    folderId: materialsFolderId,
    fileName: sanitizeDocName(fileName),
    mimeType,
    bytes: base64ToBytes(base64),
  });

  const teacherEmails = await getProfileEmails(subjectTeachers);
  const studentEmails = await getActiveCourseStudentEmails(course.id);
  await shareFileBatch(token, uploaded.id, teacherEmails, 'writer');
  await shareFileBatch(token, uploaded.id, studentEmails, 'reader');

  const { data: file, error: fileError } = await adminClient
    .from('class_files')
    .insert({
      class_id: insertClassId,
      subject_id: insertSubjectId,
      uploader_id: profile.id,
      file_type: 'material',
      file_name: fileName,
      drive_file_id: uploaded.id,
      drive_view_url: uploaded.webViewLink,
      mime_type: mimeType,
      file_size: Number.isFinite(fileSize) ? fileSize : null,
    })
    .select('id')
    .single();

  if (fileError) throw fileError;

  return {
    fileId: file.id,
    googleDriveFileId: uploaded.id,
    googleDriveUrl: uploaded.webViewLink,
    folderId: materialsFolderId,
  };
}

async function uploadStreamAttachment(profile: Profile, body: Record<string, unknown>) {
  const announcementId = Number(body.announcementId);
  const fileName = String(body.fileName ?? '').trim();
  const displayName = String(body.displayName ?? '').trim();
  const mimeType = String(body.mimeType ?? 'application/octet-stream');
  const base64 = String(body.base64 ?? '');
  const fileSize = Number(body.fileSize ?? 0);

  if (!Number.isFinite(announcementId)) {
    throw new HttpError('Valid announcementId is required', 400);
  }
  if (!fileName || !base64) {
    throw new HttpError('A file name and file content are required', 400);
  }
  if (!sharedFolderId) {
    throw new HttpError('GOOGLE_SHARED_FOLDER_ID is required for Stream attachment uploads', 400);
  }

  const { data: announcement, error: announcementError } = await adminClient
    .from('announcements')
    .select('id, title, course_id, target_roles, author_id')
    .eq('id', announcementId)
    .single();
  if (announcementError || !announcement) {
    throw new HttpError('Stream post not found', 404);
  }

  if (!isAdmin(profile) && announcement.author_id !== profile.id) {
    throw new HttpError('Only administrators or the post author can add Stream attachments', 403);
  }

  const token = await getGoogleAccessToken();
  const rootFolderId = await resolveStreamRootFolderId(
    announcement.course_id as number | null,
    (announcement.target_roles ?? []) as string[]
  );
  const now = new Date();
  const year = String(now.getFullYear());
  const month = `${String(now.getMonth() + 1).padStart(2, '0')} ${now.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })}`;
  const streamFolderId = await ensureDriveFolderPath(token, rootFolderId, [
    'Stream',
    year,
    month,
    announcement.title || `Post ${announcementId}`,
  ]);

  const uploaded = await uploadDriveFile(token, {
    folderId: streamFolderId,
    fileName: sanitizeDocName(fileName),
    mimeType,
    bytes: base64ToBytes(base64),
  });

  const { data: attachment, error: attachmentError } = await adminClient
    .from('announcement_attachments')
    .insert({
      announcement_id: announcementId,
      uploader_id: profile.id,
      attachment_type: 'file',
      file_name: displayName || fileName,
      storage_path: uploaded.id,
      public_url: uploaded.webViewLink,
      mime_type: mimeType,
      file_size: Number.isFinite(fileSize) ? fileSize : null,
    })
    .select('id')
    .single();

  if (attachmentError) throw attachmentError;

  return {
    attachmentId: attachment.id,
    googleDriveFileId: uploaded.id,
    googleDriveUrl: uploaded.webViewLink,
    folderId: streamFolderId,
  };
}

async function resolveStreamRootFolderId(courseId: number | null, targetRoles: string[]) {
  if (courseId !== null) {
    const { data, error } = await adminClient
      .from('courses')
      .select('course_type')
      .eq('id', courseId)
      .single();
    if (error || !data) return sharedFolderId;
    return data.course_type === 'first_year' ? firstYearFolderId : secondYearFolderId;
  }

  const hasFirstYear = targetRoles.includes('course:first_year');
  const hasSecondYear = targetRoles.includes('course:second_year');
  const yearAudienceOnly = targetRoles.length > 0 && targetRoles.every(token =>
    token === 'course:first_year' || token === 'course:second_year'
  );

  if (yearAudienceOnly && hasFirstYear && !hasSecondYear) return firstYearFolderId;
  if (yearAudienceOnly && hasSecondYear && !hasFirstYear) return secondYearFolderId;
  return sharedFolderId;
}

async function getClassContext(classId: number) {
  const { data: classData, error: classError } = await adminClient
    .from('classes')
    .select(`
      id, title, date, hour, teacher_id, subject_id,
      subject:subjects(
        id, title, course_id,
        course:courses(id, course_type, graduation_year)
      )
    `)
    .eq('id', classId)
    .single();

  if (classError || !classData) {
    throw new HttpError('Class session not found', 404);
  }

  const classRow = classData as ClassRow;
  const subject = firstItem(classRow.subject);
  const course = firstItem(subject?.course);
  if (!subject || !course) {
    throw new HttpError('Class session is missing subject/year group context', 400);
  }

  return { classRow, subject, course };
}

async function getSubjectContext(subjectId: number) {
  const { data: subjectData, error: subjectError } = await adminClient
    .from('subjects')
    .select(`
      id, title, course_id,
      course:courses(id, course_type, graduation_year)
    `)
    .eq('id', subjectId)
    .single();

  if (subjectError || !subjectData) {
    throw new HttpError('Subject not found', 404);
  }

  const subject = subjectData as Subject;
  const course = firstItem(subject.course);
  if (!course) {
    throw new HttpError('Subject is missing year group context', 400);
  }

  return { subject, course };
}

async function getSubjectTeacherIds(subjectId: number) {
  const { data, error } = await adminClient
    .from('classes')
    .select('teacher_id')
    .eq('subject_id', subjectId);
  if (error) throw error;
  return Array.from(new Set((data ?? [])
    .map((row: SubjectTeacherRow) => row.teacher_id)
    .filter((id): id is string => Boolean(id))));
}

async function getProfileEmails(userIds: string[]) {
  if (userIds.length === 0) return [];
  const { data, error } = await adminClient
    .from('profiles')
    .select('email')
    .in('id', userIds);
  if (error) throw error;
  return Array.from(new Set((data ?? [])
    .map((row: { email: string | null }) => row.email)
    .filter((email): email is string => Boolean(email))));
}

async function getActiveCourseStudentEmails(courseId: number) {
  const { data, error } = await adminClient
    .from('course_students')
    .select('student:profiles!student_id(email)')
    .eq('course_id', courseId)
    .eq('status', 'active');
  if (error) throw error;
  return Array.from(new Set((data ?? [])
    .map((row: { student?: { email?: string | null } | { email?: string | null }[] | null }) => firstItem(row.student)?.email)
    .filter((email): email is string => Boolean(email))));
}

async function findExistingSubmission(assignmentId: number, studentId: string) {
  const { data, error } = await adminClient
    .from('homework_submissions')
    .select('id, google_doc_id, google_doc_url')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getGoogleAccessToken(): Promise<string> {
  const { data, error } = await adminClient
    .from('google_docs_connections')
    .select('connected_email, access_token, refresh_token, expires_at')
    .eq('id', 'school_docs')
    .single();

  if (error || !data) {
    throw new HttpError('Google Docs is not connected yet', 400);
  }

  const connection = data as DocsConnection;
  const expiresAtMs = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  if (connection.access_token && expiresAtMs > Date.now() + 60_000) {
    return connection.access_token;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const refreshed = await response.json();
  if (!response.ok) {
    console.error('Google refresh error:', refreshed);
    throw new HttpError(refreshed.error_description ?? 'Failed to refresh Google access token', 400);
  }

  const accessToken = refreshed.access_token as string;
  const nextExpiresAt = new Date(Date.now() + Number(refreshed.expires_in ?? 3600) * 1000).toISOString();

  await adminClient
    .from('google_docs_connections')
    .update({
      access_token: accessToken,
      expires_at: nextExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'school_docs');

  return accessToken;
}

async function fetchGoogleProfile(accessToken: string): Promise<{ email?: string }> {
  if (!accessToken) return {};
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return {};
  return await response.json();
}

async function copyTemplateDoc(token: string, name: string, folderId: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${templateDocId}/copy?supportsAllDrives=true&fields=id,name,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        parents: [folderId],
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    console.error('Google copy error:', data);
    throw new HttpError(
      explainDriveCopyError(data.error?.message, response.status),
      response.status
    );
  }
  return data as { id: string; name: string; webViewLink: string };
}

async function createGoogleDoc(token: string, name: string, folderId: string) {
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.document',
        parents: [folderId],
      }),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Google doc create error:', data);
    throw new HttpError(data.error?.message ?? 'Failed to create Google material doc', response.status);
  }
  return data as { id: string; name: string; webViewLink: string };
}

async function uploadDriveFile(
  token: string,
  params: {
    folderId: string;
    fileName: string;
    mimeType: string;
    bytes: Uint8Array;
  }
) {
  const metadata = {
    name: params.fileName,
    parents: [params.folderId],
  };
  const boundary = `tbo_${crypto.randomUUID()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const encoder = new TextEncoder();
  const body = concatBytes([
    encoder.encode(delimiter),
    encoder.encode('Content-Type: application/json; charset=UTF-8\r\n\r\n'),
    encoder.encode(JSON.stringify(metadata)),
    encoder.encode(delimiter),
    encoder.encode(`Content-Type: ${params.mimeType}\r\n\r\n`),
    params.bytes,
    encoder.encode(closeDelimiter),
  ]);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Google file upload error:', data);
    throw new HttpError(data.error?.message ?? 'Failed to upload material file to Google Drive', response.status);
  }
  return data as { id: string; name: string; webViewLink: string };
}

async function ensureDriveFolderPath(token: string, rootFolderId: string, names: string[]) {
  let parentId = rootFolderId;
  for (const name of names) {
    parentId = await ensureDriveFolder(token, parentId, sanitizeFolderName(name));
  }
  return parentId;
}

async function ensureDriveFolder(token: string, parentId: string, name: string) {
  const escapedName = name.replace(/'/g, "\\'");
  const query = [
    `name = '${escapedName}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    `'${parentId}' in parents`,
    'trashed = false',
  ].join(' and ');

  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const searchData = await searchResponse.json().catch(() => ({}));
  if (!searchResponse.ok) {
    console.error('Google folder search error:', searchData);
    throw new HttpError(searchData.error?.message ?? 'Failed to search Google Drive folders', searchResponse.status);
  }

  const existing = searchData.files?.[0];
  if (existing?.id) return existing.id as string;

  const createResponse = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    }
  );

  const createData = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok) {
    console.error('Google folder create error:', createData);
    throw new HttpError(createData.error?.message ?? 'Failed to create Google Drive folder', createResponse.status);
  }

  return createData.id as string;
}

async function checkDriveFile(token: string, label: string, fileId: string, expectedMimeType: string) {
  if (!fileId) {
    return {
      label,
      ok: false,
      message: 'Missing Supabase secret value',
    };
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=id,name,mimeType,driveId,webViewLink`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      label,
      ok: false,
      message: data.error?.message
        ? `${data.error.message}. Check the ID and make sure the connected Google account can access it.`
        : 'Google could not read this file or folder.',
    };
  }

  const mimeType = String(data.mimeType ?? '');
  if (mimeType !== expectedMimeType) {
    return {
      label,
      ok: false,
      name: data.name,
      message: `Expected ${expectedMimeType.includes('folder') ? 'a folder' : 'a Google Doc'}, but found ${mimeType || 'an unknown file type'}.`,
    };
  }

  return {
    label,
    ok: true,
    name: data.name,
    message: 'Accessible',
  };
}

async function getDriveFileMetadata(token: string, fileId: string) {
  const fields = [
    'id',
    'name',
    'mimeType',
    'webViewLink',
    'iconLink',
    'thumbnailLink',
    'createdTime',
    'modifiedTime',
    'owners(displayName,emailAddress,photoLink)',
    'lastModifyingUser(displayName,emailAddress,photoLink)',
  ].join(',');

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=${encodeURIComponent(fields)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Google file metadata error:', data);
    throw new HttpError(data.error?.message ?? 'Failed to read Google Doc metadata', response.status);
  }
  return data;
}

async function checkFilePermission(token: string, fileId: string, email: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true&fields=permissions(id,type,emailAddress,role,displayName)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Google permission check error:', data);
    return {
      hasAccess: false,
      role: null,
      message: data.error?.message ?? 'Could not verify document sharing.',
    };
  }

  const lowerEmail = email.toLowerCase();
  const permission = (data.permissions ?? []).find((item: Record<string, unknown>) =>
    String(item.emailAddress ?? '').toLowerCase() === lowerEmail ||
    (item.type === 'anyone' && (item.role === 'reader' || item.role === 'writer'))
  );

  return permission
    ? {
        hasAccess: true,
        role: permission.role ?? null,
        message: permission.type === 'anyone'
          ? 'Anyone with the link can open it.'
          : 'Your account is listed on the document.',
      }
    : {
        hasAccess: false,
        role: null,
        message: 'Your account is not listed on the document sharing settings.',
      };
}

function extractGoogleDocId(url: string | null) {
  if (!url) return null;
  const match = url.match(/\/document\/d\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function explainDriveCopyError(message: string | undefined, status: number) {
  if (status === 404) {
    return [
      message ?? 'Google Drive could not find the template document.',
      'Check GOOGLE_DOC_TEMPLATE_ID and make sure the connected Google account can open that Google Doc.',
      'If the template is in a Shared Drive, share it with the connected account or move it into the Shared Drive used by the school.',
    ].join(' ');
  }

  if (status === 403) {
    return [
      message ?? 'Google Drive rejected access.',
      'Check that the connected Google account has permission to copy the template and create files in the destination year-group folder.',
    ].join(' ');
  }

  return message ?? 'Failed to create Google Doc';
}

async function replaceDocPlaceholders(token: string, documentId: string, values: Record<string, string>) {
  const requests = Object.entries(values).map(([key, value]) => ({
    replaceAllText: {
      containsText: {
        text: `{{${key}}}`,
        matchCase: true,
      },
      replaceText: value,
    },
  }));

  const response = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Google Docs placeholder error:', data);
    throw new HttpError(data.error?.message ?? 'Failed to prepare Google Doc', response.status);
  }
}

async function shareFile(token: string, fileId: string, emailAddress: string, role: 'writer' | 'reader') {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'user',
        role,
        emailAddress,
      }),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Google share error:', data);
    throw new HttpError(data.error?.message ?? 'Failed to share Google Doc', response.status);
  }
}

async function shareFileBatch(token: string, fileId: string, emailAddresses: string[], role: 'writer' | 'reader') {
  const uniqueEmails = Array.from(new Set(emailAddresses.map(email => email.trim()).filter(Boolean)));
  for (const email of uniqueEmails) {
    try {
      await shareFile(token, fileId, email, role);
    } catch (error) {
      console.error(`Google share skipped for ${email}:`, error);
    }
  }
}

function firstItem<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getOAuthRedirectUri() {
  return googleDocsRedirectUri;
}

function sanitizeReturnTo(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    // Fall through to local default.
  }
  return 'http://localhost:3000/settings';
}

async function createOAuthState(payload: OAuthState) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await signState(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

async function verifyOAuthState(state: string): Promise<OAuthState> {
  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) {
    throw new HttpError('Invalid Google authorization state.', 400);
  }

  const expectedSignature = await signState(encodedPayload);
  if (signature !== expectedSignature) {
    throw new HttpError('Invalid Google authorization signature.', 400);
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as OAuthState;
  if (!payload.userId || !payload.returnTo || !payload.createdAt) {
    throw new HttpError('Incomplete Google authorization state.', 400);
  }

  if (Date.now() - payload.createdAt > 10 * 60 * 1000) {
    throw new HttpError('Google authorization expired. Please reconnect.', 400);
  }

  return payload;
}

async function signState(value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(supabaseServiceRoleKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function base64UrlEncode(value: string) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function redirectWithGoogleDocsStatus(returnTo: string, status: 'connected' | 'error', message: string) {
  const url = new URL(returnTo);
  url.searchParams.set('google_docs', status);
  url.searchParams.set('google_docs_message', message);
  return Response.redirect(url.toString(), 302);
}

function sanitizeDocName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function sanitizeFolderName(name: string): string {
  return sanitizeDocName(name) || 'Untitled';
}

function base64ToBytes(base64: string) {
  const clean = base64.includes(',') ? base64.split(',').pop() ?? '' : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function concatBytes(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged;
}

function json(data: unknown, status = 200) {
  const responseStatus = data instanceof HttpError ? data.status : status;
  return new Response(JSON.stringify(data), {
    status: responseStatus,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
