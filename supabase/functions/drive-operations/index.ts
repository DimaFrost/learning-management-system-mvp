import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ============================================
// Google Auth — Service Account JWT
// ============================================
async function getAccessToken(): Promise<string> {
  const sa = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')!);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Convert PEM private key to CryptoKey
  const pemContents = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const privateKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${signingInput}.${sigB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const { access_token } = await tokenRes.json();
  return access_token;
}

// ============================================
// Drive helpers (Shared Drive — service accounts have no My Drive quota)
// See supabase/functions/drive-operations/SETUP.md
// ============================================
const SHARED_DRIVE_QUERY = 'supportsAllDrives=true';
const LIST_DRIVE_QUERY = 'supportsAllDrives=true&includeItemsFromAllDrives=true';

async function createFolder(
  name: string,
  parentId: string,
  token: string
): Promise<string> {
  if (!name?.trim()) {
    throw new Error('Folder name is required');
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${SHARED_DRIVE_QUERY}`,
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
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Drive createFolder error:', data);
    throw new Error(data.error?.message ?? 'Failed to create Drive folder');
  }
  if (!data.id) {
    throw new Error('Drive API returned no folder id');
  }
  return data.id;
}

async function findFolder(
  name: string,
  parentId: string,
  token: string
): Promise<string | null> {
  const query = encodeURIComponent(
    `name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&${LIST_DRIVE_QUERY}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function findOrCreateFolder(
  name: string,
  parentId: string,
  token: string
): Promise<string> {
  const existing = await findFolder(name, parentId, token);
  if (existing) return existing;
  return await createFolder(name, parentId, token);
}

async function uploadFile(
  name: string,
  parentId: string,
  content: Uint8Array,
  mimeType: string,
  token: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata = JSON.stringify({ name, parents: [parentId] });
  const boundary = 'tbo_boundary';

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    '',
  ].join('\r\n');

  const bodyBytes = new TextEncoder().encode(body);
  const combined = new Uint8Array(bodyBytes.length + content.length + 
    new TextEncoder().encode(`\r\n--${boundary}--`).length);
  combined.set(bodyBytes);
  combined.set(content, bodyBytes.length);
  combined.set(
    new TextEncoder().encode(`\r\n--${boundary}--`),
    bodyBytes.length + content.length
  );

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&${SHARED_DRIVE_QUERY}&fields=id,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: combined,
    }
  );
  const data = await res.json();
  if (!res.ok) {
    console.error('Drive uploadFile error:', data);
    throw new Error(data.error?.message ?? 'Failed to upload file to Drive');
  }
  if (!data.id) {
    throw new Error('Drive API returned no file id');
  }
  return { id: data.id, webViewLink: data.webViewLink ?? '' };
}

async function deleteFile(fileId: string, token: string): Promise<void> {
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?${SHARED_DRIVE_QUERY}`,
    {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ============================================
// Main handler
// ============================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    console.log('Drive operation:', action);

    const token = await getAccessToken();
    const rootFolderId = Deno.env.get('DRIVE_ROOT_FOLDER_ID')!;

    // ACTION: create-course-folder
    // data: { startDate, endDate, courseType }
    // returns: { folderId }
    if (action === 'create-course-folder') {
      const startYear = new Date(data.startDate).getFullYear();
      const endYear = new Date(data.endDate).getFullYear();
      if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
        throw new Error('Valid startDate and endDate are required');
      }

      const academicYearName = `${startYear}-${endYear}`;

      const yearLabel = data.courseType === 'first_year'
        ? 'First Year'
        : 'Second Year';

      const academicYearFolderId = await findOrCreateFolder(
        academicYearName, rootFolderId, token
      );

      const courseFolderId = await findOrCreateFolder(
        yearLabel, academicYearFolderId, token
      );

      return respond({ folderId: courseFolderId });
    }

    // ACTION: create-subject-folder
    // data: { subjectName, courseFolderId }
    // returns: { folderId }
    if (action === 'create-subject-folder') {
      const folderId = await createFolder(
        data.subjectName, data.courseFolderId, token
      );
      return respond({ folderId });
    }

    // ACTION: create-class-folders
    // data: { className, subjectFolderId }
    // returns: { folderId, materialsFolderId, homeworkFolderId, 
    //            teacherNotesFolderId, translatorNotesFolderId }
    if (action === 'create-class-folders') {
      const folderId = await createFolder(
        data.className, data.subjectFolderId, token
      );
      const [materialsFolderId, homeworkFolderId, 
             teacherNotesFolderId, translatorNotesFolderId] = 
        await Promise.all([
          createFolder('Materials', folderId, token),
          createFolder('Homework', folderId, token),
          createFolder('Teacher Notes', folderId, token),
          createFolder('Translator Notes', folderId, token),
        ]);
      return respond({ 
        folderId, materialsFolderId, homeworkFolderId,
        teacherNotesFolderId, translatorNotesFolderId 
      });
    }

    // ACTION: upload-file
    // data: { fileName, mimeType, fileBase64, targetFolderId, 
    //         studentName? (for homework subfolder) }
    // returns: { driveFileId, driveViewUrl }
    if (action === 'upload-file') {
      let targetFolder = data.targetFolderId;

      // For homework, create a subfolder per student
      if (data.studentName) {
        targetFolder = await createFolder(
          data.studentName, data.targetFolderId, token
        );
      }

      const content = Uint8Array.from(
        atob(data.fileBase64), c => c.charCodeAt(0)
      );
      const file = await uploadFile(
        data.fileName, targetFolder, content, data.mimeType, token
      );
      return respond({ driveFileId: file.id, driveViewUrl: file.webViewLink });
    }

    // ACTION: delete-file
    // data: { driveFileId }
    if (action === 'delete-file') {
      await deleteFile(data.driveFileId, token);
      return respond({ success: true });
    }

    // ACTION: create-assignment-folder
    // data: { assignmentTitle, classHomeworkFolderId }
    // returns: { folderId }
    if (action === 'create-assignment-folder') {
      const folderId = await createFolder(
        data.assignmentTitle,
        data.classHomeworkFolderId,
        token
      );
      return respond({ folderId });
    }

    // ACTION: create-google-doc
    // data: { docTitle, studentFolderId, studentEmail }
    // returns: { googleDocId, googleDocUrl }
    if (action === 'create-google-doc') {
      const createRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?${SHARED_DRIVE_QUERY}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: data.docTitle,
            mimeType: 'application/vnd.google-apps.document',
            parents: [data.studentFolderId],
          }),
        }
      );
      const docFile = await createRes.json();

      await fetch(
        `https://www.googleapis.com/drive/v3/files/${docFile.id}/permissions?${SHARED_DRIVE_QUERY}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'user',
            role: 'writer',
            emailAddress: data.studentEmail,
          }),
        }
      );

      const fileRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${docFile.id}?${SHARED_DRIVE_QUERY}&fields=id,webViewLink`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const fileData = await fileRes.json();

      return respond({
        googleDocId: fileData.id,
        googleDocUrl: fileData.webViewLink,
      });
    }

    return respond({ error: 'Unknown action' }, 400);

  } catch (err) {
    console.error('Drive operation error:', err);
    return respond({
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});

function respond(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
